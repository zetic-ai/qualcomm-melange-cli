import { expect } from "bun:test"
import { Effect, Exit, Layer } from "effect"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Question } from "../../src/question"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "../../src/tool/truncate"
import {
  availableQiylToolIDs,
  MelangeStartImplementationTool,
} from "../../src/tool/melange-qiyl-implementation"
import { Tool } from "../../src/tool/tool"
import { MessageID, PartID, SessionID } from "../../src/session/schema"
import { testEffect } from "../lib/effect"

let answer = "구현 시작"
let questionCalls = 0
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
      expect(input.questions[0]?.header).toBe("구현 시작")
      expect(input.questions[0]?.question).toContain("Home Companion")
      expect(input.questions[0]?.question).toContain("d1-2B")
      expect(input.questions[0]?.options.map((option) => option.label)).toEqual(["구현 시작", "계획 수정"])
      return Effect.succeed([[answer]])
    },
    }),
  ),
)

function priorTool(name: string, metadata: Record<string, unknown>, suffix: string): SessionV1.WithParts {
  const sessionID = SessionID.make("ses_qiyl_implementation")
  const messageID = MessageID.make("msg_" + suffix)
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
        id: PartID.make("prt_" + suffix),
        sessionID,
        messageID,
        type: "tool",
        tool: name,
        callID: "call_" + suffix,
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

const feature = {
  phase: "features_confirmed",
  confirmationId: "feature-1",
  confirmedFeatures: ["Room light control", "Appliance status"],
}
const selected = {
  phase: "selected",
  selectionId: "selection-1",
  featureConfirmationId: "feature-1",
  model: "zetic/d1-2B",
  modelName: "d1-2B",
}
const plan = {
  phase: "planned",
  planId: "plan-1",
  featureConfirmationId: "feature-1",
  selectionId: "selection-1",
  appName: "Home Companion",
  features: ["Room light control", "Appliance status"],
  selectedModel: { id: "zetic/d1-2B", name: "d1-2B" },
}
const approval = {
  phase: "implementation_approved",
  planId: "plan-1",
  featureConfirmationId: "feature-1",
  selectionId: "selection-1",
  model: "zetic/d1-2B",
  appName: "Home Companion",
}

function history(...extra: SessionV1.WithParts[]) {
  return [
    priorTool("melange_prepare_model", feature, "feature"),
    priorTool("melange_prepare_model", selected, "selected"),
    priorTool("melange_plan_app", plan, "plan"),
    ...extra,
  ]
}

function hasBuildTools(messages: SessionV1.WithParts[]) {
  const available = availableQiylToolIDs(messages as unknown as Tool.Context["messages"])
  return ["bash", "read", "write", "apply_patch", "skill"].every((id) => available.has(id))
}

it.live("keeps Android build tools unavailable until explicit approval and revokes stale approval", () =>
  Effect.sync(() => {
  const planning = history()
  const approved = history(priorTool("melange_start_implementation", approval, "approval"))
  expect(hasBuildTools(planning)).toBe(false)
  expect(hasBuildTools(approved)).toBe(true)
  expect(hasBuildTools([...approved, priorTool("bash", {}, "same_plan_retry")])).toBe(true)
  expect(
    hasBuildTools([...approved, priorTool("melange_prepare_model", { phase: "discovery" }, "new_discovery")]),
  ).toBe(false)
  const refreshedFeature = { ...feature, confirmationId: "feature-2" }
  const refreshedSelection = { ...selected, selectionId: "selection-2", featureConfirmationId: "feature-2" }
  const refreshedPlan = { ...plan, planId: "plan-2", featureConfirmationId: "feature-2", selectionId: "selection-2" }
  const refreshedApproval = { ...approval, planId: "plan-2", featureConfirmationId: "feature-2", selectionId: "selection-2" }
  expect(
    hasBuildTools([
      ...approved,
      priorTool("melange_prepare_model", { phase: "discovery" }, "new_discovery_with_plan"),
      priorTool("melange_prepare_model", refreshedFeature, "refreshed_feature"),
      priorTool("melange_prepare_model", refreshedSelection, "refreshed_selection"),
      priorTool("melange_plan_app", refreshedPlan, "refreshed_plan"),
      priorTool("melange_start_implementation", refreshedApproval, "refreshed_approval"),
    ]),
  ).toBe(true)

  const changedPlan = { ...plan, planId: "plan-2" }
  expect(
    hasBuildTools([
      ...planning,
      priorTool("melange_start_implementation", approval, "old_approval"),
      priorTool("melange_plan_app", changedPlan, "new_plan"),
    ]),
  ).toBe(false)

  const changedFeatures = { ...feature, confirmationId: "feature-2", confirmedFeatures: ["Another feature"] }
  expect(
    hasBuildTools([
      ...approved,
      priorTool("melange_prepare_model", changedFeatures, "changed_features"),
    ]),
  ).toBe(false)

  const changedModel = {
    ...selected,
    selectionId: "selection-2",
    model: "zetic/LFM3-1.7B",
    modelName: "LFM3-1.7B",
  }
  expect(
    hasBuildTools([
      ...approved,
      priorTool("melange_prepare_model", changedModel, "changed_model"),
    ]),
  ).toBe(false)

  const declined = { ...approval, phase: "implementation_declined" }
  expect(
    hasBuildTools([
      ...approved,
      priorTool("melange_start_implementation", declined, "declined"),
    ]),
  ).toBe(false)
  }),
)

it.live("asks for explicit localized approval and records the bound model and plan", () =>
  Effect.gen(function* () {
    const tool = yield* MelangeStartImplementationTool
    const instance = yield* Tool.init(tool)
    const messages = history()
    const ctx: Tool.Context = {
      sessionID: SessionID.make("ses_qiyl_implementation"),
      messageID: MessageID.make("msg_current"),
      agent: "build",
      abort: new AbortController().signal,
      messages: messages as unknown as Tool.Context["messages"],
      metadata: () => Effect.void,
      ask: () => Effect.void,
    }

    questionCalls = 0
    const afterDiscovery: Tool.Context = {
      ...ctx,
      messages: [...messages, priorTool("melange_prepare_model", { phase: "discovery" }, "new_discovery")] as unknown as Tool.Context["messages"],
    }
    const staleApproval = yield* Effect.exit(instance.execute({}, afterDiscovery))
    expect(Exit.isFailure(staleApproval)).toBe(true)
    expect(questionCalls).toBe(0)

    answer = "계획 수정"
    const denied = yield* instance.execute({}, ctx)
    expect(denied.metadata).toMatchObject({
      phase: "implementation_declined",
      planId: "plan-1",
      featureConfirmationId: "feature-1",
      selectionId: "selection-1",
      model: "zetic/d1-2B",
    })
    expect(hasBuildTools([...messages, priorTool("melange_start_implementation", denied.metadata, "denied")])).toBe(false)

    answer = "구현 시작"
    const accepted = yield* instance.execute({}, ctx)
    expect(accepted.metadata).toMatchObject({
      phase: "implementation_approved",
      planId: "plan-1",
      featureConfirmationId: "feature-1",
      selectionId: "selection-1",
      model: "zetic/d1-2B",
    })
    expect(questionCalls).toBe(2)
    expect(hasBuildTools([...messages, priorTool("melange_start_implementation", accepted.metadata, "accepted")])).toBe(true)
  }),
)
