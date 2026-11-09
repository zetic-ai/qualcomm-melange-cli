// This flag is compiled into the event-specific renderer, not the backend.
export function qiylDemoEnabled(eventBuild: boolean, setupMode: boolean) {
  return eventBuild && !setupMode
}

const qiylSetupMode =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("qiylSetup") === "1"

export const qiylDemo = qiylDemoEnabled(import.meta.env.VITE_QIYL_DEMO === "1", qiylSetupMode)

// Runtime provider/model setup is configured before the event demo begins.
export function hideModelControls(demo: boolean, _modelReady: boolean) {
  return demo
}

export function demoTemplateMetadata<T>(demo: boolean, value: T): T | undefined {
  return demo ? undefined : value
}

export function showComposerCommand(id: string, demo: boolean, _modelReady: boolean) {
  if (!demo) return true
  if (id.startsWith("agent.") || id.startsWith("model.") || id.startsWith("terminal.")) return false
  if (id === "provider.connect" || id === "prompt.mode.shell") return false
  return true
}
