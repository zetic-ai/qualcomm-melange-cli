import { expect } from "bun:test"
import { Effect, Layer } from "effect"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { testEffect } from "../lib/effect"
import { Agent } from "../../src/agent/agent"
import { Question } from "../../src/question"
import { Truncate } from "../../src/tool/truncate"
import { MelangePrepareModelTool } from "../../src/tool/melange-prepare-model"
import { Tool } from "../../src/tool/tool"
import { MessageID, SessionID, PartID } from "../../src/session/schema"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProviderV2 } from "@opencode-ai/core/provider"

let questions = 0
const it = testEffect(Layer.mergeAll(
  Layer.mock(Agent.Service, { get: () => Effect.succeed({ name: "build", mode: "primary", permission: [], options: {} }) }),
  Layer.mock(Truncate.Service, { output: (content) => Effect.succeed({ content, truncated: false }) }),
  Layer.mock(Question.Service, { ask: (input) => {
    questions++
    return Effect.succeed([[input.questions[0]!.options[0]!.label]])
  } }),
))

it.live("template verifies then renders the pinned model without a chooser; typed requests still ask", () =>
  Effect.gen(function* () {
    const dir = mkdtempSync(join(tmpdir(), "melange-tool-"))
    const previous = process.env.PATH
    const model = "changgeun/LFM2.5-VL-450M"
    writeFileSync(join(dir, "melange-qcom"), `#!/usr/bin/env node
const output = process.argv[2] === 'library'
  ? {results:[{full_name:'${model}',name:'LFM2.5-VL-450M'},{full_name:'zetic/Hy-MT2-1.8B',name:'Hy-MT2-1.8B'},{full_name:'SJ_zetic/LFM2.5-1.2B-Instruct',name:'LFM2.5-1.2B-Instruct'}]}
  : process.argv[2] === 'model' ? {results:[{key:'ready-model',state:'ready'}]}
  : {records:[{device:{soc:'SM8750'},run_configuration:{package:'tflite_fp16_test'},metric:'tps',value:12.3},{device:{soc:'SM8750'},ap_type:'cpu',quant_type:'q4_k_m',metric:'tps',value:10}]};
process.stdout.write(JSON.stringify(output));
`, { mode: 0o755 })
    process.env.PATH = `${dir}:${previous}`
    try {
      questions = 0
      const info = yield* MelangePrepareModelTool
      const tool = yield* Tool.init(info)
      const ctx: Tool.Context = {
        sessionID: SessionID.make("ses_test"), messageID: MessageID.make("msg_test"),
        agent: "build", abort: new AbortController().signal, metadata: () => Effect.void, ask: () => Effect.void,
        messages: [{
          info: { role: "user", id: MessageID.make("msg_user"), sessionID: SessionID.make("ses_test"),
            time: { created: 0 }, agent: "build", model: { providerID: ProviderV2.ID.anthropic, modelID: ModelV2.ID.make("claude-opus-5") } },
          parts: [{ id: PartID.make("prt_test"), messageID: MessageID.make("msg_user"), sessionID: SessionID.make("ses_test"),
            type: "text", text: "Build a vision app", synthetic: true, metadata: { melangeDemoApp: "image" } }],
        }],
      }
      const discovery = yield* tool.execute({}, ctx)
      expect(JSON.parse(discovery.output).model.full_name).toBe(model)
      expect(discovery.metadata.visualization).toBeUndefined()
      const chart = yield* tool.execute({ candidates: [{ model: "wrong/model", reason: "wrong" }] }, ctx)
      expect(chart.metadata.model).toBe(model)
      expect(chart.metadata.visualization).toContain("```benchmark-chart")
      expect(chart.metadata.visualization).toContain("FP16")
      expect(chart.metadata.visualization).toContain("Q4 Decode TPS")
      expect(chart.metadata.visualization.match(/```benchmark-chart/g)).toHaveLength(2)
      expect(chart.metadata.q4DecodePoints).toHaveLength(6)
      expect(chart.metadata.q4DecodePoints.at(-1).value).toBe(180.20)
      expect(chart.metadata.visualization).not.toContain("115.9")
      expect(chart.metadata.visualization).toContain("### SM8975 - ZETIC Optimized")
      expect(chart.metadata.visualization).toContain("| TTFT | 0.331 s |")
      expect(chart.metadata.visualization).toContain("| Prefill TPS | 3,150 tokens/s |")
      expect(chart.metadata.visualization).toContain("| Decode TPS | 65.42 tokens/s |")
      expect(chart.metadata.visualization).toContain("| Vision only | 45 ms |")
      expect(chart.metadata.visualization).not.toContain("| SM8750 |")
      expect(chart.metadata.points).toEqual([
        { label: "SM8750", accelerator: "FP16", value: 12.3 },
        { label: "SM8975", accelerator: "FP16", value: 25.41 },
    { label: "SM8975 - ZETIC Optimized", accelerator: "ZETIC Optimized · Decode TPS", value: 65.42 },
      ])
      expect(questions).toBe(0)
      const vision = { ...ctx, messages: ctx.messages.map((message) => ({ ...message,
        parts: message.parts.map((part) => part.type === "text" ? { ...part, synthetic: false, metadata: {} } : part),
      })) }
      expect(JSON.parse((yield* tool.execute({}, vision)).output).model.full_name).toBe(model)
      expect((yield* tool.execute({ candidates: [{ model, reason: "Vision" }] }, vision)).metadata.model).toBe(model)
      expect(questions).toBe(0)
      const typed = { ...ctx, messages: [] }
      expect((yield* tool.execute({}, typed)).metadata.phase).toBe("discovery")
      yield* tool.execute({ candidates: [{ model, reason: "Vision" }], recommended: model }, typed)
      expect(questions).toBe(1)
      const translation = yield* tool.execute({ candidates: [{ model: "zetic/Hy-MT2-1.8B", reason: "Translation" }], recommended: "zetic/Hy-MT2-1.8B" }, typed)
      expect(translation.metadata.visualization).toContain("### SM8975 - ZETIC Optimized")
      expect(translation.metadata.visualization).toContain("| TTFT | 0.597 s |")
      expect(translation.metadata.visualization).toContain("| Prefill TPS | 1,714 tokens/s |")
      expect(translation.metadata.visualization).toContain("| Decode TPS | 38.76 tokens/s |")
      expect(translation.metadata.visualization).not.toContain("Vision only")
      expect(translation.metadata.points).toEqual([
        { label: "SM8750", accelerator: "Q4 (q4_k_m)", value: 10 },
        { label: "SM8975 - ZETIC Optimized", accelerator: "ZETIC Optimized · Decode TPS", value: 38.76 },
      ])
      const appliance = yield* tool.execute({ candidates: [{ model: "SJ_zetic/LFM2.5-1.2B-Instruct", reason: "Appliances" }], recommended: "SJ_zetic/LFM2.5-1.2B-Instruct" }, typed)
      expect(appliance.metadata.visualization).toContain("| TTFT | 0.221 s |")
      expect(appliance.metadata.visualization).toContain("| Prefill TPS | 4,635 tokens/s |")
      expect(appliance.metadata.visualization).toContain("| Decode TPS | 62.9 tokens/s |")
      expect(appliance.metadata.visualization).not.toContain("Vision only")
      expect(appliance.metadata.points.at(-1)).toEqual({
        label: "SM8975 - ZETIC Optimized", accelerator: "ZETIC Optimized · Decode TPS", value: 62.9,
      })
    } finally {
      if (previous === undefined) delete process.env.PATH
      else process.env.PATH = previous
      rmSync(dir, { recursive: true, force: true })
    }
  }),
)
