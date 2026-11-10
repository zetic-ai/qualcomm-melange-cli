import { Effect, Schema } from "effect"
import { Question } from "../question"
import { Tool } from "./tool"
import { isApprovedModel } from "./melange-qiyl"
import { QIYL_ANDROID_IMPLEMENTATION_TOOL_IDS, QIYL_PLANNING_TOOL_IDS } from "./melange-qiyl-policy"

type Metadata = Record<string, unknown>
type Position = { message: number; part: number }
type ToolEvent = { metadata?: Metadata; position: Position }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toolMetadata(part: Tool.Context["messages"][number]["parts"][number], toolID: string): Metadata | undefined {
  if (part.type !== "tool" || part.tool !== toolID || part.state.status !== "completed") return
  return isRecord(part.state.metadata) ? part.state.metadata : undefined
}

function latestPhase(messages: Tool.Context["messages"], toolID: string, phase: string): Metadata | undefined {
  for (const message of messages.toReversed()) {
    for (const part of message.parts.toReversed()) {
      const value = toolMetadata(part, toolID)
      if (value?.phase === phase) return value
    }
  }
}

function latestToolEvent(messages: Tool.Context["messages"], toolID: string, phase?: string): ToolEvent | undefined {
  for (let message = messages.length - 1; message >= 0; message--) {
    const parts = messages[message].parts
    for (let part = parts.length - 1; part >= 0; part--) {
      const item = parts[part]
      if (item.type !== "tool" || item.tool !== toolID) continue
      const metadata = toolMetadata(item, toolID)
      if (phase !== undefined && metadata?.phase !== phase) continue
      return { metadata, position: { message, part } }
    }
  }
}

function isAfter(left: Position, right: Position) {
  return left.message > right.message || (left.message === right.message && left.part > right.part)
}

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return
  return value
}

function currentPlan(messages: Tool.Context["messages"]): Metadata | undefined {
  const planEvent = latestToolEvent(messages, "melange_plan_app", "planned")
  const plan = planEvent?.metadata
  const discovery = latestToolEvent(messages, "melange_prepare_model", "discovery")
  const features = strings(plan?.features)
  const selectedModel = isRecord(plan?.selectedModel) ? plan.selectedModel : undefined
  const confirmation = latestPhase(messages, "melange_prepare_model", "features_confirmed")
  const selected = latestPhase(messages, "melange_prepare_model", "selected")
  const confirmedFeatures = strings(confirmation?.confirmedFeatures)

  if (
    (discovery && planEvent && isAfter(discovery.position, planEvent.position)) ||
    !plan || typeof plan.planId !== "string" ||
    typeof plan.featureConfirmationId !== "string" || typeof plan.selectionId !== "string" ||
    typeof plan.appName !== "string" || !plan.appName.trim() ||
    !features || !selectedModel || !isApprovedModel(selectedModel.id) ||
    !confirmation || typeof confirmation.confirmationId !== "string" ||
    !confirmedFeatures || !selected || typeof selected.selectionId !== "string" ||
    confirmation.confirmationId !== plan.featureConfirmationId ||
    selected.selectionId !== plan.selectionId ||
    selected.featureConfirmationId !== plan.featureConfirmationId ||
    selected.model !== selectedModel.id ||
    features.length !== confirmedFeatures.length || features.some((feature) => !confirmedFeatures.includes(feature))
  ) return

  return plan
}

export function hasValidImplementationApproval(messages: Tool.Context["messages"]) {
  const plan = currentPlan(messages)
  const approval = latestToolEvent(messages, "melange_start_implementation")
  const discovery = latestToolEvent(messages, "melange_prepare_model", "discovery")
  return !!plan && approval?.metadata?.phase === "implementation_approved" &&
    (!discovery || !isAfter(discovery.position, approval.position)) &&
    approval.metadata.planId === plan.planId &&
    approval.metadata.featureConfirmationId === plan.featureConfirmationId &&
    approval.metadata.selectionId === plan.selectionId &&
    approval.metadata.model === (plan.selectedModel as Record<string, unknown>).id
}

export function availableQiylToolIDs(messages: Tool.Context["messages"]) {
  const result = new Set(QIYL_PLANNING_TOOL_IDS)
  if (hasValidImplementationApproval(messages)) {
    for (const id of QIYL_ANDROID_IMPLEMENTATION_TOOL_IDS) result.add(id)
  }
  return result
}

export const Parameters = Schema.Struct({})

export const MelangeStartImplementationTool = Tool.define<typeof Parameters, Metadata, Question.Service>(
  "melange_start_implementation",
  Effect.gen(function* () {
    const question = yield* Question.Service
    return {
      description:
        "After the latest confirmed feature set, selected model, and structured app plan are bound together, ask the user for explicit approval before enabling Android implementation and build tools.",
      parameters: Parameters,
      execute: (_params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const plan = currentPlan(ctx.messages)
          if (!plan) throw new Error("A current plan bound to the latest confirmed features and selected model is required before implementation approval.")
          const selectedModel = plan.selectedModel as Record<string, unknown>
          const answers = yield* question.ask({
            sessionID: ctx.sessionID,
            questions: [
              {
                header: "구현 시작",
                question: "선택한 " + String(selectedModel.name ?? selectedModel.id) + " 모델로 '" + String(plan.appName) + "' Android 앱 구현을 시작할까요?",
                options: [
                  { label: "구현 시작", description: "확인한 앱 계획에 따라 Android 구현과 실제 빌드를 시작합니다." },
                  { label: "계획 수정", description: "구현을 시작하지 않습니다." },
                ],
                multiple: false,
                custom: false,
              },
            ],
            tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          })
          const metadata = {
            planId: plan.planId,
            featureConfirmationId: plan.featureConfirmationId,
            selectionId: plan.selectionId,
            model: selectedModel.id,
            appName: plan.appName,
          }
          if (!(answers[0] ?? []).includes("구현 시작")) {
            return {
              title: "Android implementation not started",
              output: JSON.stringify({ phase: "implementation_declined", ...metadata }),
              metadata: { phase: "implementation_declined", ...metadata },
            }
          }
          return {
            title: "Android implementation approved",
            output: JSON.stringify({
              phase: "implementation_approved",
              ...metadata,
              next: "Implement the approved Android app and report only a real Gradle build result.",
            }),
            metadata: { phase: "implementation_approved", ...metadata },
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export * as MelangeQiylImplementation from "./melange-qiyl-implementation"
