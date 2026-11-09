import { Effect, Schema } from "effect"
import { execFileSync } from "node:child_process"
import * as Tool from "./tool"
import { Question } from "../question"
import { benchmark, type ReportRecord } from "./melange-benchmark"
import { demoModel } from "./melange-demo"

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
        "First call without arguments to check the public library. Follow the returned next step. Translation, image/vision and home-appliance requests (typed or button) verify their assigned model; explain its suitability, then call again with that candidate to render its benchmark without a chooser. Unmatched or mixed-purpose requests require four task-appropriate candidates (model=full_name, reason=strengths/tradeoffs), one recommended model ID, and a question in the user's language. The tool waits for the user's choice for these requests.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context): Effect.Effect<Tool.ExecuteResult> =>
        Effect.gen(function* () {
          const fixed = demoModel(ctx.messages)
          const library = runJson(["library", "list", "--json", "--paginate"])
          const candidates = Array.isArray(library.results) ? (library.results as LibraryModel[]) : []
          if (fixed && !candidates.some((candidate) => candidate.full_name === fixed))
            throw new Error(`The app's model ${fixed} is not available in the public library. Explain this blocker; do not substitute a different model or start implementation.`)
          if (fixed && !params.candidates?.length) {
            const models = runJson(["model", "list", "-R", fixed, "--json"])
            const ready = (models.results as ListedModel[] | undefined)?.find((model) => model.state === "ready")
            if (!ready) throw new Error(`${fixed} has no ready model. Do not substitute or start implementation.`)
            return {
              title: "Melange For Snapdragon",
              output: JSON.stringify({
                model: candidates.find((candidate) => candidate.full_name === fixed),
                ready,
                next: "The model is available. Briefly explain why its verified capabilities suit this app, using its model name without the owner prefix. Do not claim a search or comparison you did not perform. Then call this tool with this model as the sole candidate and its suitability as reason. No recommendation label or user chooser is needed. Do not start implementation before the benchmark is prepared.",
              }),
              metadata: { phase: "discovery" },
            }
          }
          if (fixed) params = {
            ...params,
            candidates: [{ model: fixed, reason: params.candidates?.find((candidate) => candidate.model === fixed)?.reason ?? "" }],
            recommended: fixed,
          }
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
            } catch (error) {
              if (fixed) throw error
              continue
            }
            const ready = (models.results as ListedModel[] | undefined)?.find((model) => model.state === "ready")
            if (!ready) continue
            let report: Json
            try {
              // The vision package report overflows the CLI's typed float32 parser for
              // unrelated metrics. Raw API preserves numbers; benchmark() filters FP16 TPS/SoCs.
              report = candidate.full_name === "changgeun/LFM2.5-VL-450M"
                ? runJson(["api", `/v1/repos/changgeun/LFM2.5-VL-450M/models/${encodeURIComponent(ready.key)}/reports/package`])
                : runJson(["report", "view", ready.key, "-R", candidate.full_name, "--json"])
            } catch (error) {
              if (fixed) throw error
              continue
            }
            const records = (report.records as ReportRecord[] | undefined) ?? []
            const { points, quantization, precision, optimized, details, q4DecodePoints } = benchmark(records, candidate.full_name)
            if (points.length === 0) continue
            const visualization = [
              `${candidate.name}`,
              "",
              "```benchmark-chart",
              JSON.stringify({
                title: `${candidate.name} — Snapdragon · ${precision}`,
                metric: "throughput",
                unit: "tokens/s",
                points,
              }),
              "```",
              "",
              `${precision}: highest measured TPS per SoC${quantization === "fp16" ? " across FP16 configurations" : " across CPU, GPU and NPU"}. Missing measurements are omitted, not zero.`,
              ...(optimized ? ["SM8975: 25.41 TPS and SM8975 - ZETIC Optimized: 65.42 Decode TPS are separate supplied measurements. Optimized details below are supplied data; other chips come from the Melange CLI."] : []),
              "",
              ...(optimized ? [
                `### ${optimized.label} · FP16`,
                "",
                "| Metric | Value |",
                "|---|---:|",
                `| TTFT | ${optimized.ttftSeconds} s |`,
                `| Prefill TPS | ${optimized.prefillTps.toLocaleString("en-US")} tokens/s |`,
                `| Decode TPS | ${optimized.decodeTps} tokens/s |`,
                `| Vision only | ${optimized.visionOnlyMs} ms |`,
              ] : details ? [
                "### SM8975 - ZETIC Optimized",
                "",
                "| Metric | Value |",
                "|---|---:|",
                `| TTFT | ${details.ttftSeconds} s |`,
                `| Prefill TPS | ${details.prefillTps.toLocaleString("en-US")} tokens/s |`,
                `| Decode TPS | ${details.decodeTps} tokens/s |`,
                "",
                "Supplied benchmark data; separate from the CLI measurements in the chart above.",
              ] : points.some((p) => p.label === "SM8975") ? [
                `### SM8975 · ${precision}`,
                "",
                "| Metric | Value |",
                "|---|---:|",
                `| TPS | ${points.find((p) => p.label === "SM8975")!.value.toFixed(2)} tokens/s |`,
              ] : ["SM8975 benchmark details are not available for this model."]),
              ...(q4DecodePoints.length ? [
                "",
                "```benchmark-chart",
                JSON.stringify({
                  title: `${candidate.name} — Snapdragon · Q4 Decode TPS`,
                  metric: "Decode TPS",
                  unit: "tokens/s",
                  points: q4DecodePoints,
                }),
                "```",
                "",
                "Q4 Decode TPS: supplied benchmark data. Separate from the FP16 measurements above.",
              ] : []),
            ].join("\n")
            prepared.push({
              label: `${candidate.name}${params.candidates.filter((input) => input.model.split("/").at(-1) === candidate.name).length > 1 ? ` (${prepared.length + 1})` : ""}${candidate.full_name === params.recommended ? " (Recommended)" : ""}`,
              reason: input.reason,
              result: {
                title: `${candidate.name} Qualcomm benchmark`,
                output: `${fixed ? "Verified app model" : "User selected"} ${candidate.full_name} (${ready.key}). The desktop tool card has ALREADY rendered the benchmark chart and new-chip details (${precision}). ${optimized ? "SM8975 = 25.41 TPS and SM8975 - ZETIC Optimized = 65.42 Decode TPS are separate supplied measurements. Never overwrite or equate them. The table shows supplied optimized TTFT, Prefill TPS, Decode TPS and Vision only." : "Single highest TPS per SoC across accelerators."} Do not repeat the chart, benchmark-chart block, or table in your response. Continue target selection and app implementation with this model.`,
                metadata: { phase: "selected", model: candidate.full_name, modelKey: ready.key, points, optimized, q4DecodePoints, visualization },
              },
            })
          }
          if (prepared.length !== params.candidates.length)
            throw new Error(
              fixed
                ? `${fixed} has no available compatible Qualcomm benchmark. Explain the missing data; do not invent values, substitute another model, or start implementation.`
                : "Some candidates lack ready Qualcomm benchmarks at the required precision (FP16 for changgeun/LFM2.5-VL-450M; Q4 q4_k_m for others). Replace ineligible candidates and try again; do not select a default.",
            )
          if (fixed) {
            yield* Effect.sleep("300 millis")
            return prepared[0]!.result
          }
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
