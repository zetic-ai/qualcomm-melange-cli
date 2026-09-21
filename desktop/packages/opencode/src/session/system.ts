import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer } from "effect"

import { InstanceState } from "@/effect/instance-state"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_DEFAULT from "./prompt/default.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_GPT from "./prompt/gpt.txt"
import PROMPT_ASTRA from "./prompt/gpt-astra.txt"
import PROMPT_KIMI from "./prompt/kimi.txt"
import PROMPT_META from "./prompt/meta.txt"

import PROMPT_CODEX from "./prompt/codex.txt"
import PROMPT_TRINITY from "./prompt/trinity.txt"
import type { Provider } from "@/provider/provider"
import type { Agent } from "@/agent/agent"
import { Permission } from "@/permission"
import { Skill } from "@/skill"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { Location } from "@opencode-ai/core/location"
import { LocationServiceMap, locationServiceMapLayer } from "@opencode-ai/core/location-services"
import { Reference } from "@opencode-ai/core/reference"
import { MCP } from "@/mcp"
import { PermissionV1 } from "@opencode-ai/core/v1/permission"

const MELANGE_CONTEXT = `
You are Melange Agent for Qualcomm on-device AI development.

USER-FACING VOICE: Present yourself and this workflow as Melange For Snapdragon.
Keep opening messages short, natural, and focused on the app the user wants to build.
Do not narrate internal eligibility checks or use phrases like "Qualcomm-benchmarked
public models", "public Melange library", or "loading melange-qcom" in introductions,
model-selection questions, or candidate descriptions. Simply offer suitable models
and explain their practical strengths for the requested app. Perform all required
public-library and benchmark checks internally; disclose any actual blocker honestly.
Keep technical CLI names unchanged in executable commands.

When the user asks to build an AI-powered app, including translation, vision, or speech apps,
you MUST load the melange-qcom skill before planning or coding. Recommend an available model
through Melange, and use only models from the Melange model library. Start with
'melange-qcom library list --json' and choose candidates from that result. For each candidate,
inspect its public library entry and associated ready model/report, selecting only one with
Qualcomm device benchmark data. Never start model discovery with 'repo list' or 'model list',
and never use Hugging Face or any external model catalog. Do not use private repositories,
repository creation, local upload, or model import for this workflow. Use melange-qcom to inspect
and benchmark the selected library model,
then let the model-preparation tool card render the benchmark before selecting a Qualcomm target and
integrating it into the app. The card owns the visualization; never duplicate it in prose,
a benchmark-chart block, SVG file, Markdown image link, ASCII chart, or Markdown bars.
Report the selected model, target device, and build
status. Do not use private models or repositories, and do not substitute a generic mock model
when the Melange workflow applies.

MANDATORY MODEL SELECTION: For an AI app request, first call 'melange_prepare_model' without
arguments. The tool routes translation, image/vision, and home-appliance requests to the
assigned model based on the request text, whether typed or started with a button.
For a matched request, the tool checks the assigned model's actual library
entry and ready state. Briefly explain its suitability from verified information, then call
the tool again with that model as the sole candidate to show its benchmark. Do not open a
chooser, add a Recommended label, claim to have compared alternatives, or discuss internal
template configuration unprompted. If unavailable, report the blocker instead of substituting.
For unmatched or mixed-purpose requests, first call 'melange_prepare_model' without
arguments to discover the public library. Compare the catalog against the user's task and
call it again with four suitable candidates (full model IDs and concise strengths/tradeoffs),
exactly one 'recommended' ID, and a selection question in the user's language. Include the
reason for your recommendation. If fewer than four eligible models exist, explain why and
offer only verified candidates. Never invent candidates to fill four slots.
The tool opens a model chooser and WAITS for the user's answer. Recommended is a suggestion,
not consent. Do not choose a model, edit app files, or start implementation before this tool
returns a user-confirmed model. If the user dismisses the chooser, wait for their choice.
After selection, the tool card automatically shows the benchmark chart and table exactly once.
For changgeun/LFM2.5-VL-450M, the tool uses FP16 CLI measurements and merges the supplied
SM8975 measurement (25.41 TPS); do not relabel it as Q4 or claim the supplied value came
from the CLI. The separate SM8975 - ZETIC Optimized entry is supplied Decode TPS 65.42,
not a replacement for 25.41 TPS. Its detail table contains TTFT 0.331 s, Prefill TPS 3150,
Decode TPS 65.42 and Vision only 45 ms. Tables below graphs are for SM8975 only,
not a repetition of the per-chip graph values. Do not invent missing details for other models.
The tool also renders a separate supplied Q4 Decode TPS chart for this model:
SM8250 30.93, SM8550 94.49, SM8650 84.43, SM8750 137.12, SM8850 158.40,
SM8975 180.20 tokens/s. Keep this series separate from FP16; never merge the values.
Do not claim these supplied optimization measurements came
from the CLI. All other models use Q4 q4_k_m. A CLI report error must be reported, not
treated as an empty successful report or replaced with invented benchmark data.
Do not repeat either in commentary or the final answer. Proceed directly with
target selection and implementation using only the user's chosen model. This tool is the
approved discovery and selection path; do not bypass the chooser with shell commands.

ANDROID DELIVERY: For Android app requests, validate the Android project itself.
Every generated Android app MUST declare <uses-permission android:name="android.permission.INTERNET" />
as a direct child of <manifest>, outside <application>, in app/src/main/AndroidManifest.xml.
This is required even for on-device apps because Melange initialization and model downloads
need network access. Before building, inspect the manifest and add the permission if missing;
preserve any existing permissions and avoid duplicate declarations.
If MELANGE_DEMO_MODE is 1, authentication and the Gradle MELANGE_API_KEY project property
are already supplied by the desktop environment. Use providers.gradleProperty("MELANGE_API_KEY")
in generated Android build scripts to configure the SDK key. Do not ask the user for a key,
print environment variables, read/display the credential file, or put a literal token in source.
Pass the configured property to the app's SDK initialization (for example through BuildConfig).
Keep this environment inherited by Gradle and Melange CLI subprocesses.

For Android app requests, inspect
the project's Gradle wrapper and JDK; if the wrapper is missing, set up a compatible
Gradle wrapper and attempt assembleDebug. Do not stop merely because global gradle is absent.
Report an APK path only after successful assembly. Clearly distinguish a compiler/build
failure from a build that could not be run due to missing SDK/JDK or other prerequisites.
Do not run or mention Swift builds or unrelated platform checks for an Android request.
Use model display names without repository-owner prefixes in user-facing summaries;
retain full library IDs for CLI calls and SDK configuration.
`

function providerPrompt(model: Provider.Model) {
  if (model.api.id.includes("muse")) {
    const name = model.api.id.includes("muse-glimmer") ? "Muse Glimmer" : "Muse Spark"
    return [PROMPT_META.replaceAll("{{MODEL_NAME}}", name)]
  }
  if (model.api.id.includes("gpt-4") || model.api.id.includes("o1") || model.api.id.includes("o3"))
    return [PROMPT_BEAST]
  if (model.api.id.includes("gpt")) {
    if (model.api.id.includes("gpt-6")) return [PROMPT_ASTRA]
    if (model.api.id.includes("codex")) {
      return [PROMPT_CODEX]
    }
    return [PROMPT_GPT]
  }
  if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
  if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
  if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]
  if (
    model.api.id.toLowerCase().includes("kimi") ||
    ["kimi-for-coding", "moonshotai", "moonshotai-cn"].includes(model.providerID)
  )
    return [PROMPT_KIMI]
  return [PROMPT_DEFAULT]
}

export function provider(model: Provider.Model) {
  return [...providerPrompt(model), MELANGE_CONTEXT, ...(process.env.MELANGE_DEMO_MODE === "1" ? ["Demo mode is active. Melange CLI authentication and the Gradle MELANGE_API_KEY property are preconfigured. Use them without asking for or displaying credentials."] : [])]
}

export interface Interface {
  readonly environment: (model: Provider.Model) => Effect.Effect<string[]>
  readonly skills: (agent: Agent.Info) => Effect.Effect<string | undefined>
  readonly mcp: (agent: Agent.Info, permission?: PermissionV1.Ruleset) => Effect.Effect<string | undefined>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SystemPrompt") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const skill = yield* Skill.Service
    const mcp = yield* MCP.Service
    const locations = yield* LocationServiceMap.Service

    return Service.of({
      environment: Effect.fn("SystemPrompt.environment")(function* (model: Provider.Model) {
        const ctx = yield* InstanceState.context
        const references = yield* Effect.gen(function* () {
          return (yield* (yield* Reference.Service).list()).filter((reference) => reference.description !== undefined)
        }).pipe(Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(ctx.directory) }))))
        return [
          [
            `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
            `Here is some useful information about the environment you are running in:`,
            `<env>`,
            `  Working directory: ${ctx.directory}`,
            `  Workspace root folder: ${ctx.worktree}`,
            `  Is directory a git repo: ${ctx.project.vcs === "git" ? "yes" : "no"}`,
            `  Platform: ${process.platform}`,
            `  Today's date: ${new Date().toDateString()}`,
            `</env>`,
          ].join("\n"),
          references.length === 0
            ? undefined
            : [
                "Project references provide additional directories that can be accessed when relevant.",
                "<available_references>",
                ...references
                  .toSorted((a, b) => a.name.localeCompare(b.name))
                  .flatMap((reference) => [
                    "  <reference>",
                    `    <name>${reference.name}</name>`,
                    `    <path>${reference.path}</path>`,
                    ...(reference.description === undefined
                      ? []
                      : [`    <description>${reference.description}</description>`]),
                    "  </reference>",
                  ]),
                "</available_references>",
              ].join("\n"),
        ].filter((part): part is string => part !== undefined)
      }),

      skills: Effect.fn("SystemPrompt.skills")(function* (agent: Agent.Info) {
        if (Permission.disabled(["skill"], agent.permission).has("skill")) return

        const list = yield* skill.available(agent)

        return [
          "Skills provide specialized instructions and workflows for specific tasks.",
          "Use the skill tool to load a skill when a task matches its description.",
          // the agents seem to ingest the information about skills a bit better if we present a more verbose
          // version of them here and a less verbose version in tool description, rather than vice versa.
          Skill.fmt(list, { verbose: true }),
        ].join("\n")
      }),

      mcp: Effect.fn("SystemPrompt.mcp")(function* (agent: Agent.Info, permission?: PermissionV1.Ruleset) {
        const ruleset = Permission.merge(agent.permission, permission ?? [])
        const instructions = (yield* mcp.instructions()).filter(
          (item) => item.tools.length === 0 || Permission.disabled(item.tools, ruleset).size < item.tools.length,
        )
        if (instructions.length === 0) return

        return [
          "<mcp_instructions>",
          ...instructions.flatMap((item) => [
            `  <server name="${item.name}">`,
            ...item.instructions.split("\n").map((line) => `    ${line}`),
            "  </server>",
          ]),
          "</mcp_instructions>",
        ].join("\n")
      }),
    })
  }),
)

const locationServiceMapNode = LayerNode.make({
  service: LocationServiceMap.Service,
  layer: locationServiceMapLayer,
  deps: [],
})

export const node = LayerNode.make({
  service: Service,
  layer: layer,
  deps: [Skill.node, MCP.node, locationServiceMapNode],
})

export * as SystemPrompt from "./system"
