import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export function demoEnv(root: string, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {}
  const anthropic = join(root, "demo-anthropic")
  if (existsSync(anthropic)) {
    const key = readFileSync(anthropic, "utf8").trim()
    if (!/^sk-ant-[a-zA-Z0-9_-]+$/.test(key)) throw new Error("Invalid bundled Anthropic key")
    result.ANTHROPIC_API_KEY = key
    result.MELANGE_DEMO_ANTHROPIC = "1"
    const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT || "{}")
    result.OPENCODE_CONFIG_CONTENT = JSON.stringify({
      ...config,
      model: "anthropic/claude-opus-5",
      small_model: "anthropic/claude-opus-5",
      enabled_providers: ["anthropic"],
      disabled_providers: [],
      provider: {
        anthropic: {
          options: { apiKey: key },
          whitelist: ["claude-opus-5"],
          models: { "claude-opus-5": { name: "Claude Opus 5", tool_call: true, reasoning: true, modalities: { input: ["text", "image", "pdf"], output: ["text"] }, limit: { context: 1000000, output: 128000 } } },
        },
      },
    })
  }
  const file = join(root, "demo-pat")
  if (env.MELANGE_API_KEY || env.MELANGE_API_KEY_FILE || !existsSync(file)) return result
  const token = readFileSync(file, "utf8").trim()
  if (!/^ztp_[a-zA-Z0-9]+$/.test(token)) throw new Error("Invalid bundled demo PAT")
  return {
    ...result,
    MELANGE_API_KEY_FILE: file,
    ORG_GRADLE_PROJECT_MELANGE_API_KEY: env.ORG_GRADLE_PROJECT_MELANGE_API_KEY || token,
    MELANGE_DEMO_MODE: "1",
  }
}
