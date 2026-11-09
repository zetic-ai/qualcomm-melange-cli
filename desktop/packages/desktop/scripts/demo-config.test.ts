import { expect, test } from "bun:test"
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { prepareDemoConfig } from "./demo-config"
import { demoEnv } from "../src/main/demo-env"

test("demo credentials reach CLI and Gradle; normal builds remove them and explicit auth wins", () => {
  const root = mkdtempSync(join(tmpdir(), "melange-demo-test-"))
  try {
    prepareDemoConfig(root, { MELANGE_DEMO_PAT: "ztp_testonly" })
    expect(readFileSync(join(root, "demo-pat"), "utf8")).toBe("ztp_testonly")
    expect(demoEnv(root, {})).toEqual({ MELANGE_API_KEY_FILE: join(root, "demo-pat"), ORG_GRADLE_PROJECT_MELANGE_API_KEY: "ztp_testonly", MELANGE_DEMO_MODE: "1" })
    expect(demoEnv(root, { MELANGE_API_KEY: "explicit" })).toEqual({})
    expect(demoEnv(root, { MELANGE_API_KEY_FILE: "/explicit" })).toEqual({})
    prepareDemoConfig(root, {})
    expect(existsSync(join(root, "demo-pat"))).toBe(false)
    expect(demoEnv(root, {})).toEqual({})
    expect(() => prepareDemoConfig(root, { MELANGE_DEMO_PAT: "bad\nvalue" })).toThrow("Invalid demo PAT format")
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("demo Anthropic key is bundled, locks Opus 5, and is removed for normal builds", () => {
  const root = mkdtempSync(join(tmpdir(), "melange-anthropic-test-"))
  try {
    const keyFile = join(root, "key.local")
    writeFileSync(keyFile, "sk-ant-api03-testonly")
    prepareDemoConfig(root, { MELANGE_DEMO_ANTHROPIC_KEY_FILE: keyFile })
    const env = demoEnv(root, { ANTHROPIC_API_KEY: "old", MELANGE_API_KEY: "explicit" })
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-api03-testonly")
    expect(env.MELANGE_DEMO_ANTHROPIC).toBe("1")
    const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT!)
    expect(config.model).toBe("anthropic/claude-opus-5")
    expect(config.small_model).toBe(config.model)
    expect(config.enabled_providers).toEqual(["anthropic"])
    expect(config.provider.anthropic.whitelist).toEqual(["claude-opus-5"])
    prepareDemoConfig(root, {})
    expect(existsSync(join(root, "demo-anthropic"))).toBe(false)
    expect(demoEnv(root, {})).toEqual({})
  } finally { rmSync(root, { recursive: true, force: true }) }
})
