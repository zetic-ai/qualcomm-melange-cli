import { Effect, Schema } from "effect"
import { execFileSync } from "node:child_process"
import * as Tool from "./tool"
import { Question } from "../question"
import { benchmark, type ReportRecord } from "./melange-benchmark"

export const Parameters = Schema.Struct({
  candidates: Schema.optional(Schema.Array(Schema.Struct({ model: Schema.String, reason: Schema.String }))),
  recommended: Schema.optional(Schema.String),
  question: Schema.optional(Schema.String),
})
type Json = { results?: unknown[]; records?: unknown[] }
type LibraryModel = { full_name: string; name: string }
type ListedModel = { key: string; state?: string }

function runJson(args: string[]) {
  return JSON.parse(
    execFileSync("melange-qcom", args, { encoding: "utf8", timeout: 120_000, maxBuffer: 64 * 1024 * 1024 }),
  ) as Json
}

export const MelangePrepareModelTool = Tool.define(
  "melange_prepare_model",
  Effect.gen(function* () {
    const question = yield* Question.Service
    return {
      description:
        "First call without arguments to discover the public library. Then supply four task-appropriate candidates (model=full_name, reason=strengths/tradeoffs), one recommended model ID, and a question in the user's language. This tool validates Qualcomm benchmarks and WAITS for the user to choose before returning the selected model's chart and table. Never choose a model on behalf of the user.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const library = runJson(["library", "list", "--json"])
          const candidates = Array.isArray(library.results) ? (library.results as LibraryModel[]) : []
          if (!params.candidates?.length)
            return {
              title: "Melange For Snapdragon",
              output: JSON.stringify({
                candidates,
                next: "Call this tool with four task-appropriate candidates, one recommended ID, and a selection question. The user must choose before implementation.",
              }),
              metadata: { phase: "discovery" },
            }
          if (
            params.candidates.length > 4 ||
            new Set(params.candidates.map((c) => c.model)).size !== params.candidates.length
          )
            throw new Error("Supply at most four distinct public models")
          if (!params.candidates.some((c) => c.model === params.recommended))
            throw new Error("The recommended model must be one of the candidates")
          const prepared = []
          for (const input of params.candidates) {
            const candidate = candidates.find((c) => c.full_name === input.model)
            if (!candidate) throw new Error(`${input.model} is not in the public library`)
            if (!candidate.full_name || !candidate.name) continue
            let models: Json
            try {
              models = runJson(["model", "list", "-R", candidate.full_name, "--json"])
            } catch {
              continue
            }
            const ready = (models.results as ListedModel[] | undefined)?.find((model) => model.state === "ready")
            if (!ready) continue
            let report: Json
            try {
              report = runJson(["report", "view", ready.key, "-R", candidate.full_name, "--json"])
            } catch {
              continue
            }
            const records = (report.records as ReportRecord[] | undefined) ?? []
            const { points, quantization } = benchmark(records)
            if (points.length === 0) continue
            const visualization = [
              `${candidate.name}`,
              "",
              "```benchmark-chart",
              JSON.stringify({
                title: `${candidate.name} — Snapdragon · Q4 (${quantization})`,
                metric: "throughput",
                unit: "tokens/s",
                points,
              }),
              "```",
              "",
              `Q4 (${quantization}): highest measured TPS per SoC across CPU, GPU and NPU. Missing Q4 measurements are omitted, not zero.`,
              "",
              "| Snapdragon SoC | Q4 TPS (tokens/s) |",
              "|---|---:|",
              ...points.map((p) => `| ${p.label} | ${p.value.toFixed(2)} |`),
            ].join("\n")
            prepared.push({
              label: `${candidate.name}${params.candidates.filter((input) => input.model.split("/").at(-1) === candidate.name).length > 1 ? ` (${prepared.length + 1})` : ""}${candidate.full_name === params.recommended ? " (Recommended)" : ""}`,
              reason: input.reason,
              result: {
                title: `${candidate.name} Qualcomm benchmark`,
                output: `User selected ${candidate.full_name} (${ready.key}). The desktop tool card has ALREADY rendered the benchmark chart and table (Q4 ${quantization}; ${points.length} Snapdragon SoCs; single highest TPS per SoC across accelerators). Do not repeat the chart, benchmark-chart block, or table in your response. Continue target selection and app implementation with this model.`,
                metadata: { phase: "selected", model: candidate.full_name, modelKey: ready.key, points, visualization },
              },
            })
          }
          if (prepared.length !== params.candidates.length)
            throw new Error(
              "Some candidates lack ready Qualcomm Q4 (q4_k_m) benchmarks. Replace ineligible candidates and try again; do not select a default.",
            )
          const answers = yield* question.ask({
            sessionID: ctx.sessionID,
            questions: [
              {
                header: "Model",
                question: params.question ?? "Which model should the app use?",
                options: prepared.map((p) => ({ label: p.label, description: p.reason })),
                multiple: false,
              },
            ],
            tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          })
          const selected =
            answers[0]?.length === 1
              ? prepared.find((p) => p.label === answers[0]![0] || p.result.metadata.model === answers[0]![0])
              : undefined
          if (!selected)
            throw new Error("No offered model selected. Ask again; do not choose a default or start implementation.")
          yield* Effect.sleep("300 millis")
          return selected.result
        }).pipe(Effect.orDie),
    }
  }),
)
