import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { Effect, Schema } from "effect"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Question } from "../question"
import { Tool } from "./tool"

export const QIYL_DEMO_TOOL_IDS = new Set(["melange_prepare_model", "melange_plan_app"])

const ALLOWED_MODELS = [
  "zetic/LFM3-1.7B",
  "zetic/LFM3-VL-2B",
  "zetic/LFM3-Audio-2B",
  "zetic/LFM3-Omni-2B",
  "zetic/d1-2B",
  "zetic/d1-Omni-2B",
] as const

type ModelID = (typeof ALLOWED_MODELS)[number]
type Card = {
  full_name: ModelID
  name: string
  description: string
  tags: string[]
}
type Json = Record<string, unknown>
type ToolMetadata = Record<string, unknown>
type BenchmarkChart = {
  title: string
  metric: "throughput"
  unit: "tokens/s"
  quantization: string
  points: Array<{ label: string; accelerator: string; value: number }>
}

function cliEnvironment() {
  const env = { ...process.env }
  if (env.MELANGE_AGENT_XDG_STATE_HOME_SET === "1") env.XDG_STATE_HOME = env.MELANGE_AGENT_XDG_STATE_HOME
  else if (env.MELANGE_AGENT_XDG_STATE_HOME_SET === "0") delete env.XDG_STATE_HOME
  delete env.MELANGE_AGENT_XDG_STATE_HOME
  delete env.MELANGE_AGENT_XDG_STATE_HOME_SET
  return env
}

function runJson(args: string[]) {
  const raw = execFileSync("melange-qcom", args, {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
    env: cliEnvironment(),
  })
  return JSON.parse(raw) as Json
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isApprovedModel(value: unknown): value is ModelID {
  return typeof value === "string" && ALLOWED_MODELS.some((id) => id === value)
}

function isBenchmarkChart(value: unknown): value is BenchmarkChart {
  return isRecord(value) &&
    typeof value.title === "string" &&
    value.metric === "throughput" &&
    value.unit === "tokens/s" &&
    typeof value.quantization === "string" &&
    Array.isArray(value.points) &&
    value.points.every((point) =>
      isRecord(point) && typeof point.label === "string" && typeof point.accelerator === "string" &&
      typeof point.value === "number" && Number.isFinite(point.value),
    )
}

function cardFromView(value: Json, expected: ModelID): Card | undefined {
  const card = isRecord(value.card) ? value.card : value
  if (card.full_name !== expected || typeof card.name !== "string" || typeof card.description !== "string") return
  return {
    full_name: expected,
    name: card.name,
    description: card.description,
    tags: Array.isArray(card.tags) ? card.tags.filter((tag): tag is string => typeof tag === "string") : [],
  }
}

function libraryCards(): Card[] {
  let library: Json
  try {
    library = runJson(["library", "list", "--json", "--paginate"])
  } catch {
    throw new Error("Could not read the Melange public library. Check that melange-qcom is installed and authenticated.")
  }
  const listed = new Set<string>()
  if (Array.isArray(library.results)) {
    for (const item of library.results) {
      if (isRecord(item) && typeof item.full_name === "string") listed.add(item.full_name)
    }
  }
  const result: Card[] = []
  for (const id of ALLOWED_MODELS) {
    if (!listed.has(id)) continue
    try {
      const card = cardFromView(runJson(["library", "view", id, "--json"]), id)
      if (card) result.push(card)
    } catch {
      // An unreadable card is not evidence. Omit it instead of inferring its capabilities.
    }
  }
  if (result.length === 0) throw new Error("No approved LFM3 or D1 model cards could be read from the Melange library.")
  return result
}

function benchmarkCharts(records: unknown, modelName: string): BenchmarkChart[] {
  if (!Array.isArray(records)) return []
  const grouped = new Map<string, Map<string, { label: string; accelerator: string; value: number }>>()
  for (const value of records) {
    if (!isRecord(value)) continue
    const record = value
    const device = isRecord(record.device) ? record.device : {}
    const soc = device.soc
    const quantization = record.quant_type
    const apType = record.ap_type
    const tps = record.value
    if (
      record.metric !== "tps" ||
      typeof tps !== "number" || !Number.isFinite(tps) || tps < 0 ||
      typeof quantization !== "string" || !quantization ||
      typeof soc !== "string" || !/^SM\d+$/i.test(soc) ||
      typeof apType !== "string" || !/^(cpu|gpu|npu)$/i.test(apType)
    ) continue
    const byDevice = grouped.get(quantization) ?? new Map()
    const label = soc.toUpperCase()
    const accelerator = apType.toUpperCase()
    const key = `${label}\u0000${accelerator}`
    if (!byDevice.has(key) || byDevice.get(key)!.value < tps)
      byDevice.set(key, { label, accelerator, value: tps })
    grouped.set(quantization, byDevice)
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([quantization, points]) => ({
      title: `${modelName} — Qualcomm throughput · ${quantization}`,
      metric: "throughput",
      unit: "tokens/s",
      quantization,
      points: [...points.values()].sort((left, right) =>
        left.label.localeCompare(right.label, undefined, { numeric: true }) || left.accelerator.localeCompare(right.accelerator),
      ),
    }))
}

function performance(card: Card) {
  try {
    const models = runJson(["model", "list", "-R", card.full_name, "--json"])
    const resultRows = Array.isArray(models.results) ? models.results.filter(isRecord) : []
    const readyModels = resultRows.filter((model) => model.state === "ready" && typeof model.key === "string")
    const ready = readyModels.find((model) => model.is_default === true) ?? readyModels[0]
    if (!ready) return { status: "unavailable" as const, charts: [], note: "No ready Melange model version was returned; performance data is unavailable." }
    const modelKey = ready.key as string
    const report = runJson(["report", "view", modelKey, "-R", card.full_name, "--json"])
    const charts = benchmarkCharts(report.records, card.name)
    if (charts.length === 0)
      return { status: "unavailable" as const, modelKey, charts, note: "No Qualcomm throughput measurements were returned for this model." }
    return {
      status: "available" as const,
      modelKey,
      charts,
      note: "Each chart keeps a reported quantization separate; each point is the highest returned tokens/s measurement per Qualcomm SoC and accelerator type.",
    }
  } catch {
    return { status: "unavailable" as const, charts: [], note: "A Melange performance report could not be retrieved; no benchmark claim is available." }
  }
}

function metadata(part: SessionV1.Part): ToolMetadata | undefined {
  if (part.type !== "tool" || part.state.status !== "completed") return
  const value = part.state.metadata
  return isRecord(value) ? value : undefined
}

function latestPhase(messages: Tool.Context["messages"], phase: string, toolID?: string): ToolMetadata | undefined {
  for (const message of messages.toReversed()) {
    for (const part of message.parts.toReversed()) {
      if (part.type !== "tool" || (toolID && part.tool !== toolID)) continue
      const value = metadata(part)
      if (value?.phase === phase) return value
    }
  }
}

export const PrepareParameters = Schema.Struct({
  features: Schema.optional(Schema.Array(Schema.String)),
  candidates: Schema.optional(Schema.Array(Schema.Struct({ model: Schema.String }))),
  recommended: Schema.optional(Schema.String),
  question: Schema.optional(Schema.String),
})

type PrepareMetadata = {
  phase: string
  models?: Array<{ id: ModelID; name: string; description: string; capabilities: string[] }>
  proposedFeatures?: string[]
  confirmedFeatures?: string[]
  confirmationId?: string
  featureConfirmationId?: string
  model?: ModelID
  modelName?: string
  description?: string
  capabilities?: string[]
  modelKey?: string
  benchmarkStatus?: "available" | "unavailable"
  benchmarkCharts?: BenchmarkChart[]
  benchmarkNote?: string
}

export const MelangePrepareModelQiylTool = Tool.define<typeof PrepareParameters, PrepareMetadata, Question.Service>(
  "melange_prepare_model",
  Effect.gen(function* () {
    const question = yield* Question.Service
    return {
      description:
        "QIYL planning flow: discover approved LFM3/D1 model cards; confirm user-selected app features; recommend verified card candidates and wait for the user's model choice. This tool never builds or edits files.",
      parameters: PrepareParameters,
      execute: (params: Schema.Schema.Type<typeof PrepareParameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const cards = libraryCards()
          const featureConfirmation = latestPhase(ctx.messages, "features_confirmed", "melange_prepare_model")
          const selection = latestPhase(ctx.messages, "selected", "melange_prepare_model")

          if (params.features !== undefined) {
            if (params.candidates !== undefined)
              throw new Error("Confirm features and select the model in separate steps.")
            if (!latestPhase(ctx.messages, "discovery", "melange_prepare_model"))
              throw new Error("Read the approved model cards before asking the user to confirm features.")
            if (params.features.length === 0 || params.features.length > 8 || params.features.some((feature) => !feature.trim()))
              throw new Error("Propose between one and eight non-empty app features.")
            if (!params.question?.trim())
              throw new Error("Provide the feature confirmation question in the user's language.")
            const unique = [...new Set(params.features.map((feature) => feature.trim()))]
            const answers = yield* question.ask({
              sessionID: ctx.sessionID,
              questions: [
                {
                  header: "Features",
                  question: params.question.trim(),
                  options: unique.map((feature) => ({ label: feature, description: feature })),
                  multiple: true,
                  custom: true,
                },
              ],
              tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
            })
            const confirmed = [...new Set((answers[0] ?? []).map((feature) => feature.trim()).filter(Boolean))]
            if (confirmed.length === 0) throw new Error("No features were confirmed. Ask the user to select at least one feature.")
            const confirmationId = randomUUID()
            return {
              title: "App features confirmed",
              output: JSON.stringify({ phase: "features_confirmed", confirmedFeatures: confirmed }),
              metadata: {
                phase: "features_confirmed",
                proposedFeatures: unique,
                confirmedFeatures: confirmed,
                confirmationId,
              },
            }
          }

          if (params.candidates !== undefined) {
            if (!featureConfirmation)
              throw new Error("Confirm the proposed app features with the user before asking them to choose a model.")
            if (params.candidates.length === 0) throw new Error("Offer at least one approved model card.")
            if (selection?.featureConfirmationId === featureConfirmation.confirmationId)
              throw new Error("A model has already been selected for the current confirmed features.")
            if (!params.question?.trim())
              throw new Error("Provide the model selection question in the user's language.")
            if (params.candidates.length > cards.length || new Set(params.candidates.map((item) => item.model)).size !== params.candidates.length)
              throw new Error("Offer up to six distinct approved model cards.")
            if (!params.candidates.some((item) => item.model === params.recommended))
              throw new Error("The recommended model must be one of the offered candidates.")

            const offered = params.candidates.map((item) => {
              if (!ALLOWED_MODELS.includes(item.model as ModelID))
                throw new Error(`${item.model} is outside the approved LFM3/D1 model set.`)
              const card = cards.find((candidate) => candidate.full_name === item.model)
              if (!card) throw new Error(`${item.model} is not an available, readable Melange model card.`)
              const label = `${card.name}${card.full_name === params.recommended ? " (Recommended)" : ""}`
              const factual = [card.description, card.tags.length ? `Card tags: ${card.tags.join(", ")}.` : undefined]
                .filter(Boolean)
                .join(" ")
              return { card, label, factual }
            })
            const answers = yield* question.ask({
              sessionID: ctx.sessionID,
              questions: [
                {
                  header: "Model",
                  question: params.question.trim(),
                  options: offered.map((item) => ({ label: item.label, description: item.factual })),
                  multiple: false,
                  custom: false,
                },
              ],
              tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
            })
            const chosen = offered.find((item) => (answers[0] ?? []).includes(item.label))
            if (!chosen) throw new Error("No offered model was selected. Ask again; do not choose a default.")
            const features = Array.isArray(featureConfirmation.confirmedFeatures)
              ? featureConfirmation.confirmedFeatures.filter((feature): feature is string => typeof feature === "string")
              : []
            if (typeof featureConfirmation.confirmationId !== "string")
              throw new Error("The current feature confirmation is missing its confirmation record. Ask the user again.")
            const measured = performance(chosen.card)
            return {
              title: `Model selected: ${chosen.card.name}`,
              output: JSON.stringify({
                phase: "selected",
                model: chosen.card.full_name,
                modelName: chosen.card.name,
                description: chosen.card.description,
                capabilities: chosen.card.tags,
                featureConfirmationId: featureConfirmation.confirmationId,
                performance: { status: measured.status, charts: measured.charts, note: measured.note },
              }),
              metadata: {
                phase: "selected",
                model: chosen.card.full_name,
                modelName: chosen.card.name,
                description: chosen.card.description,
                capabilities: chosen.card.tags,
                modelKey: measured.modelKey,
                benchmarkStatus: measured.status,
                benchmarkCharts: measured.charts,
                benchmarkNote: measured.note,
                confirmedFeatures: features,
                featureConfirmationId: featureConfirmation.confirmationId,
              },
            }
          }

          if (featureConfirmation || selection)
            throw new Error("Continue the existing QIYL flow: select a model after feature confirmation, then prepare the app plan.")
          if (params.recommended !== undefined || params.question !== undefined)
            throw new Error("Use melange_prepare_model with no arguments to discover the approved model cards.")
          return {
            title: "Approved Melange model cards",
            output: JSON.stringify({
              phase: "discovery",
              models: cards.map((card) => ({
                id: card.full_name,
                name: card.name,
                description: card.description,
                capabilities: card.tags,
              })),
              next: "Use only these verified card descriptions and tags. Propose a concise feature set, then call melange_prepare_model with features to ask the user which to include. Ask no implementation or build questions.",
            }),
            metadata: {
              phase: "discovery",
              models: cards.map((card) => ({
                id: card.full_name,
                name: card.name,
                description: card.description,
                capabilities: card.tags,
              })),
            },
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export const PlanParameters = Schema.Struct({
  appName: Schema.String,
  summary: Schema.String,
  features: Schema.Array(Schema.String),
  screens: Schema.Array(Schema.String),
  deviceRoles: Schema.Array(Schema.Struct({ device: Schema.String, responsibilities: Schema.Array(Schema.String) })),
  modelId: Schema.String,
})

type PlanMetadata = {
  phase: "planned"
  appName: string
  summary: string
  features: string[]
  screens: string[]
  deviceRoles: Array<{ device: string; responsibilities: string[] }>
  selectedModel: {
    id: ModelID
    name: string
    description: string
    benchmarkStatus?: "available" | "unavailable"
    benchmarkCharts?: BenchmarkChart[]
    benchmarkNote?: string
  }
}

export const MelangePlanAppTool = Tool.define<typeof PlanParameters, PlanMetadata, never>(
  "melange_plan_app",
  Effect.gen(function* () {
    return {
      description:
        "Finalize a structured QIYL app plan only after the user's feature confirmation and Melange model selection. This tool cannot write code or start a build.",
      parameters: PlanParameters,
      execute: (params: Schema.Schema.Type<typeof PlanParameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const confirmation = latestPhase(ctx.messages, "features_confirmed", "melange_prepare_model")
          const selected = latestPhase(ctx.messages, "selected", "melange_prepare_model")
          if (!confirmation) throw new Error("The user must confirm app features before the plan can be finalized.")
          if (!selected) throw new Error("The user must select a verified Melange model before the plan can be finalized.")
          if (
            typeof confirmation.confirmationId !== "string" ||
            selected.featureConfirmationId !== confirmation.confirmationId
          )
            throw new Error("The confirmed features changed after model selection. Ask the user to select a model again.")
          if (!isApprovedModel(selected.model) || params.modelId !== selected.model)
            throw new Error("The plan's model must exactly match the model the user selected from the approved cards.")
          const confirmed = Array.isArray(confirmation.confirmedFeatures)
            ? confirmation.confirmedFeatures.filter((feature): feature is string => typeof feature === "string")
            : []
          const features = [...new Set(params.features.map((feature) => feature.trim()).filter(Boolean))]
          if (features.length === 0 || features.length !== confirmed.length || features.some((feature) => !confirmed.includes(feature)))
            throw new Error("The plan must include every feature the user confirmed, without adding unconfirmed features.")
          if (typeof selected.modelName !== "string" || typeof selected.description !== "string")
            throw new Error("The selected model card is incomplete. Read the model card again before planning.")
          const benchmarkStatus: "available" | "unavailable" | undefined = selected.benchmarkStatus === "available" || selected.benchmarkStatus === "unavailable"
            ? selected.benchmarkStatus
            : undefined
          const benchmarkCharts = Array.isArray(selected.benchmarkCharts)
            ? selected.benchmarkCharts.filter(isBenchmarkChart)
            : undefined
          const benchmarkNote = typeof selected.benchmarkNote === "string" ? selected.benchmarkNote : undefined
          if (!params.appName.trim() || !params.summary.trim() || params.screens.length === 0 || params.deviceRoles.length === 0)
            throw new Error("A plan needs an app name, summary, at least one screen, and at least one device role.")
          if (params.screens.some((screen) => !screen.trim()) || params.deviceRoles.some((role) =>
            !role.device.trim() || role.responsibilities.length === 0 || role.responsibilities.some((item) => !item.trim())))
            throw new Error("Screens, devices, and device responsibilities must be non-empty.")
          const plan = {
            phase: "planned" as const,
            appName: params.appName.trim(),
            summary: params.summary.trim(),
            features,
            screens: params.screens.map((screen) => screen.trim()),
            deviceRoles: params.deviceRoles.map((role) => ({
              device: role.device.trim(),
              responsibilities: role.responsibilities.map((item) => item.trim()),
            })),
            selectedModel: {
              id: selected.model,
              name: selected.modelName,
              description: selected.description,
              ...(benchmarkStatus ? { benchmarkStatus } : {}),
              ...(benchmarkCharts ? { benchmarkCharts } : {}),
              ...(benchmarkNote ? { benchmarkNote } : {}),
            },
          }
          return {
            title: `App plan ready: ${plan.appName}`,
            output: JSON.stringify(plan),
            metadata: plan,
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export * as MelangeQiyl from "./melange-qiyl"
