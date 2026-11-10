export const QIYL_PLANNING_TOOL_IDS = new Set([
  "melange_prepare_model",
  "melange_plan_app",
  "melange_start_implementation",
])

export const QIYL_ANDROID_IMPLEMENTATION_TOOL_IDS = new Set([
  "bash",
  "read",
  "glob",
  "grep",
  "edit",
  "write",
  "apply_patch",
  "skill",
  "todowrite",
])

export const QIYL_TOOL_IDS = new Set([
  ...QIYL_PLANNING_TOOL_IDS,
  ...QIYL_ANDROID_IMPLEMENTATION_TOOL_IDS,
])

export * as MelangeQiylPolicy from "./melange-qiyl-policy"
