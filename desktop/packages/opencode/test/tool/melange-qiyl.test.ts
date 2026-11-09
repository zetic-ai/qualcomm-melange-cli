import { expect } from "bun:test"
import { Effect, Exit, Layer } from "effect"
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Question } from "../../src/question"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool/truncate"
import { MelangePlanAppTool, MelangePrepareModelQiylTool } from "../../src/tool/melange-qiyl"
import { Tool } from "../../src/tool/tool"
import { MessageID, PartID, SessionID } from "../../src/session/schema"
import { testEffect } from "../lib/effect"

const approved = [
  "zetic/LFM3-1.7B",
  "zetic/LFM3-VL-2B",
  "zetic/LFM3-Audio-2B",
  "zetic/LFM3-Omni-2B",
  "zetic/d1-2B",
  "zetic/d1-Omni-2B",
]

let questionCalls = 0
let modelChoiceIndex = 1
let selectedFeatureIndexes = [0, 1]
const it = testEffect(
  Layer.mergeAll(
    Layer.mock(Agent.Service, {
      get: () => Effect.succeed({ name: "build", mode: "primary", permission: [], options: {} }),
    }),
    Layer.mock(Truncate.Service, {
      output: (content) => Effect.succeed({ content, truncated: false }),
    }),
    Layer.mock(Question.Service, {
      ask: (input) => {
        questionCalls++
        const question = input.questions[0]!
        const options = question.options
        // Confirm the first proposal; for the model chooser, pick D1 to ensure the
        // tool records the user's choice rather than silently taking Recommended.
        const selected = question.header === "Features" ? selectedFeatureIndexes : [modelChoiceIndex]
        return Effect.succeed([selected.map((index) => options[index]!.label)])
      },
    }),
  ),
)

function toolContext(messages: SessionV1.WithParts[] = []): Tool.Context {
  return {
    sessionID: SessionID.make("ses_qiyl"),
    messageID: MessageID.make("msg_qiyl_current"),
    agent: "build",
    abort: new AbortController().signal,
    messages,
    metadata: () => Effect.void,
    ask: () => Effect.void,
  }
}

function priorTool(name: string, metadata: Record<string, unknown>, suffix: string): SessionV1.WithParts {
  const sessionID = SessionID.make("ses_qiyl")
  const messageID = MessageID.make(`msg_${suffix}`)
  return ({
    info: {
      role: "assistant",
      id: messageID,
      sessionID,
      time: { created: 1 },
      agent: "build",
      model: {
        providerID: ProviderV2.ID.anthropic,
        modelID: ModelV2.ID.make("claude-opus-5"),
      },
    },
    parts: [
      {
        id: PartID.make(`prt_${suffix}`),
        sessionID,
        messageID,
        type: "tool",
        tool: name,
        callID: `call_${suffix}`,
        state: {
          status: "completed",
          input: {},
          output: "",
          title: "test",
          metadata,
          time: { start: 1, end: 2 },
        },
      },
    ],
  }) as unknown as SessionV1.WithParts
}

it.live("QIYL confirms features and model choice, then returns only a bound plan", () =>
  Effect.gen(function* () {
    const dir = mkdtempSync(join(tmpdir(), "melange-qiyl-"))
    const previousPath = process.env.PATH
    const envKeys = [
      "QIYL_ENV_CAPTURE",
      "XDG_STATE_HOME",
      "MELANGE_AGENT_XDG_STATE_HOME",
      "MELANGE_AGENT_XDG_STATE_HOME_SET",
    ] as const
    const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
    const envCapture = join(dir, "cli-env.json")
    process.env.QIYL_ENV_CAPTURE = envCapture
    process.env.XDG_STATE_HOME = "app-state-home"
    process.env.MELANGE_AGENT_XDG_STATE_HOME = "user-state-home"
    process.env.MELANGE_AGENT_XDG_STATE_HOME_SET = "1"
    const cards = Object.fromEntries(
      [
        ...approved.map((id) => [id, {
          full_name: id,
          name: id.split("/")[1],
          description: id.includes("d1-")
            ? "Liquid AI decision model returning calibrated answers without token generation."
            : `Liquid AI model card for ${id}; token generation and capabilities are described by the catalog tags.`,
          tags: id.includes("d1-") ? ["decision-model"] : ["text-generation"],
        }]),
        ["rogue/LFM3-99B", { full_name: "rogue/LFM3-99B", name: "LFM3-99B", description: "Rogue card", tags: [] }],
        ["zetic/LFM2.5-1.2B", { full_name: "zetic/LFM2.5-1.2B", name: "LFM2.5-1.2B", description: "Old card", tags: [] }],
      ],
    )
    const script = `#!/usr/bin/env node
const cards = ${JSON.stringify(cards)};
const command = process.argv[2];
const action = process.argv[3];
const id = process.argv[4];
const result = command === 'library' && action === 'list'
  ? { results: Object.keys(cards).map((full_name) => ({ full_name })) }
  : command === 'library' && action === 'view'
    ? { card: cards[id] }
    : command === 'model' && action === 'list'
      ? { results: [{ key: 'ready-model-key', state: 'ready' }] }
      : command === 'report' && action === 'view'
        ? { records: (process.argv[6] || '').includes('d1-') ? [] : [
            { metric: 'tps', value: 12.3, quant_type: 'q4_0', ap_type: 'cpu', device: { soc: 'SM8650' } },
            { metric: 'tps', value: 11.1, quant_type: 'q4_0', ap_type: 'cpu', device: { soc: 'SM8650' } },
            { metric: 'tps', value: 8.7, quant_type: 'q4_0', ap_type: 'gpu', device: { soc: 'SM8650' } },
            { metric: 'tps', value: 15.2, quant_type: 'q4_0_qad', ap_type: 'cpu', device: { soc: 'SM8650' } },
            { metric: 'tps', value: 4.0, quant_type: 'f16', ap_type: 'cpu', device: { soc: 'SM8550' } },
            { metric: 'tps', value: 99, quant_type: 'q4_0', ap_type: 'cpu', device: { soc: 'Tensor G5' } },
            { metric: 'ttft_ms', value: 7, quant_type: 'q4_0', ap_type: 'cpu', device: { soc: 'SM8650' } },
          ] }
    : {};
require('node:fs').writeFileSync(process.env.QIYL_ENV_CAPTURE, JSON.stringify({
  XDG_STATE_HOME: process.env.XDG_STATE_HOME,
  MELANGE_AGENT_XDG_STATE_HOME: process.env.MELANGE_AGENT_XDG_STATE_HOME,
  MELANGE_AGENT_XDG_STATE_HOME_SET: process.env.MELANGE_AGENT_XDG_STATE_HOME_SET,
}));
process.stdout.write(JSON.stringify(result));
`
    writeFileSync(join(dir, "melange-qcom"), script, { mode: 0o755 })
    process.env.PATH = `${dir}:${previousPath}`
    try {
      questionCalls = 0
      modelChoiceIndex = 1
      selectedFeatureIndexes = [0, 1]
      const prepare = yield* MelangePrepareModelQiylTool
      const prepareTool = yield* Tool.init(prepare)
      const empty = toolContext()
      const discovery = yield* prepareTool.execute({}, empty)
      expect(discovery.metadata.phase).toBe("discovery")
      expect(JSON.stringify(discovery.metadata.models!.map((model) => model.id))).toBe(JSON.stringify(approved))
      expect(discovery.output).not.toContain("rogue/LFM3-99B")
      expect(JSON.parse(readFileSync(envCapture, "utf8"))).toEqual({ XDG_STATE_HOME: "user-state-home" })

      process.env.MELANGE_AGENT_XDG_STATE_HOME_SET = "0"
      const features = yield* prepareTool.execute(
        { features: ["Room light control", "Appliance status"], question: "어떤 기능을 포함할까요?" },
        toolContext([priorTool("melange_prepare_model", discovery.metadata, "discovery")]),
      )
      expect(features.metadata).toMatchObject({
        phase: "features_confirmed",
        proposedFeatures: ["Room light control", "Appliance status"],
        confirmedFeatures: ["Room light control", "Appliance status"],
      })
      expect(JSON.parse(readFileSync(envCapture, "utf8"))).toEqual({})

      const beforeFeatures = yield* Effect.exit(
        prepareTool.execute(
          { candidates: [{ model: approved[0]! }], recommended: approved[0], question: "어떤 모델을 선택할까요?" },
          toolContext([priorTool("melange_prepare_model", discovery.metadata, "discovery")]),
        ),
      )
      expect(Exit.isFailure(beforeFeatures)).toBe(true)

      const selection = yield* prepareTool.execute(
        {
          candidates: [{ model: approved[0]! }, { model: approved[4]! }],
          recommended: approved[0],
          question: "어떤 모델을 선택할까요?",
        },
        toolContext([
          priorTool("melange_prepare_model", discovery.metadata, "discovery2"),
          priorTool("melange_prepare_model", features.metadata, "features"),
        ]),
      )
      expect(selection.metadata).toMatchObject({
        phase: "selected",
        model: "zetic/d1-2B",
        modelName: "d1-2B",
        benchmarkStatus: "unavailable",
        confirmedFeatures: ["Room light control", "Appliance status"],
      })
      expect(selection.metadata.description).toContain("without token generation")
      expect(selection.metadata.benchmarkCharts).toEqual([])

      modelChoiceIndex = 0
      const lfmSelection = yield* prepareTool.execute(
        { candidates: [{ model: approved[0]! }], recommended: approved[0], question: "Which model should be used?" },
        toolContext([
          priorTool("melange_prepare_model", discovery.metadata, "discovery3"),
          priorTool("melange_prepare_model", features.metadata, "features2"),
        ]),
      )
      expect(lfmSelection.metadata).toMatchObject({
        phase: "selected",
        model: approved[0],
        benchmarkStatus: "available",
      })
      expect(lfmSelection.metadata.benchmarkCharts!.map((chart) => chart.quantization)).toEqual([
        "f16",
        "q4_0",
        "q4_0_qad",
      ])
      const q4 = lfmSelection.metadata.benchmarkCharts!.find((chart) => chart.quantization === "q4_0")
      expect(q4!.points).toEqual([
        { label: "SM8650", accelerator: "CPU", value: 12.3 },
        { label: "SM8650", accelerator: "GPU", value: 8.7 },
      ])

      const plan = yield* MelangePlanAppTool
      const planTool = yield* Tool.init(plan)
      const previousResults = [
        priorTool("melange_prepare_model", features.metadata, "features_for_plan"),
        priorTool("melange_prepare_model", selection.metadata, "selection_for_plan"),
      ]
      const args = {
        appName: "Home Companion",
        summary: "Manage household appliances through a mobile controller.",
        features: ["Room light control", "Appliance status"],
        screens: ["Home dashboard", "Room controls"],
        deviceRoles: [
          { device: "Phone", responsibilities: ["Send appliance commands", "Show current status"] },
          { device: "Snapdragon PC", responsibilities: ["Run the virtual room and reflect appliance state"] },
        ],
        modelId: "zetic/d1-2B",
      }
      const output = yield* planTool.execute(args, toolContext(previousResults))
      expect(output.metadata).toMatchObject({
        phase: "planned",
        appName: "Home Companion",
        features: ["Room light control", "Appliance status"],
        selectedModel: { id: "zetic/d1-2B", name: "d1-2B" },
      })
      expect(output.metadata.selectedModel.benchmarkStatus).toBe("unavailable")

      const changedModel = yield* Effect.exit(planTool.execute({ ...args, modelId: approved[0]! }, toolContext(previousResults)))
      expect(Exit.isFailure(changedModel)).toBe(true)
      const omittedFeature = yield* Effect.exit(
        planTool.execute({ ...args, features: ["Room light control"] }, toolContext(previousResults)),
      )
      expect(Exit.isFailure(omittedFeature)).toBe(true)
      const inventedFeature = yield* Effect.exit(
        planTool.execute({ ...args, features: ["Invented feature"] }, toolContext(previousResults)),
      )
      expect(Exit.isFailure(inventedFeature)).toBe(true)

      selectedFeatureIndexes = [0]
      const changedFeatures = yield* prepareTool.execute(
        { features: ["Room light control"], question: "기능을 다시 선택해주세요." },
        toolContext([
          priorTool("melange_prepare_model", discovery.metadata, "discovery4"),
          priorTool("melange_prepare_model", features.metadata, "features3"),
          priorTool("melange_prepare_model", selection.metadata, "selection3"),
        ]),
      )
      const staleSelection = yield* Effect.exit(
        planTool.execute(
          { ...args, features: ["Room light control"] },
          toolContext([
            priorTool("melange_prepare_model", changedFeatures.metadata, "changed_features"),
            priorTool("melange_prepare_model", selection.metadata, "stale_selection"),
          ]),
        ),
      )
      expect(Exit.isFailure(staleSelection)).toBe(true)

      const updatedSelection = yield* prepareTool.execute(
        {
          candidates: [{ model: approved[0]! }],
          recommended: approved[0],
          question: "기능 변경에 맞는 모델을 다시 선택해주세요.",
        },
        toolContext([
          priorTool("melange_prepare_model", discovery.metadata, "discovery5"),
          priorTool("melange_prepare_model", features.metadata, "features4"),
          priorTool("melange_prepare_model", selection.metadata, "old_selection"),
          priorTool("melange_prepare_model", changedFeatures.metadata, "new_features"),
        ]),
      )
      expect(updatedSelection.metadata.featureConfirmationId).toBe(changedFeatures.metadata.confirmationId)
      const refreshedPlan = yield* Effect.exit(
        planTool.execute(
          { ...args, features: ["Room light control"], modelId: approved[0]! },
          toolContext([
            priorTool("melange_prepare_model", changedFeatures.metadata, "new_features_for_plan"),
            priorTool("melange_prepare_model", updatedSelection.metadata, "new_selection_for_plan"),
          ]),
        ),
      )
      expect(Exit.isSuccess(refreshedPlan)).toBe(true)

      const badCandidate = yield* Effect.exit(
        prepareTool.execute(
          { candidates: [{ model: "rogue/LFM3-99B" }], recommended: "rogue/LFM3-99B", question: "Choose a model?" },
          toolContext([
            priorTool("melange_prepare_model", discovery.metadata, "bad_discovery"),
            priorTool("melange_prepare_model", features.metadata, "bad_features"),
          ]),
        ),
      )
      expect(Exit.isFailure(badCandidate)).toBe(true)
    } finally {
      process.env.PATH = previousPath
      for (const key of envKeys) {
        const value = previousEnv[key]
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
      rmSync(dir, { recursive: true, force: true })
    }
  }),
  30_000,
)
