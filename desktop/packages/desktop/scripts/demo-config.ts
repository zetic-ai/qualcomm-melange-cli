import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export function prepareDemoConfig(root: string, env: NodeJS.ProcessEnv) {
  rmSync(join(root, "demo-anthropic"), { force: true })
  const key = (env.MELANGE_DEMO_ANTHROPIC_KEY_FILE ? readFileSync(env.MELANGE_DEMO_ANTHROPIC_KEY_FILE, "utf8") : "").trim()
  if (key) {
    if (!/^sk-ant-[a-zA-Z0-9_-]+$/.test(key)) throw new Error("Invalid demo Anthropic key format")
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, "demo-anthropic"), key, { mode: 0o600 })
  }
  const file = join(root, "demo-pat")
  rmSync(file, { force: true })
  const token = (env.MELANGE_DEMO_PAT ?? (env.MELANGE_DEMO_PAT_FILE ? readFileSync(env.MELANGE_DEMO_PAT_FILE, "utf8") : "")).trim()
  if (!token) return
  if (!/^ztp_[a-zA-Z0-9]+$/.test(token)) throw new Error("Invalid demo PAT format")
  mkdirSync(root, { recursive: true })
  writeFileSync(file, token, { mode: 0o600 })
}
