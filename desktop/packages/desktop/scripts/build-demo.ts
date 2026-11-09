import { spawnSync } from "node:child_process"

// Demo build: embeds MELANGE_DEMO_PAT(_FILE) and optionally MELANGE_DEMO_ANTHROPIC_KEY_FILE,
// then runs the same single-target dist pipeline as normal builds.
//
//   bun run build:demo                    # the build host (darwin-arm64)
//   bun run build:demo win32              # Windows on Arm (Snapdragon X)
//   bun run build:demo win32 --arch x64   # Windows x64 (Intel / AMD)
if (!process.env.MELANGE_DEMO_PAT && !process.env.MELANGE_DEMO_PAT_FILE)
  throw new Error("Set MELANGE_DEMO_PAT or MELANGE_DEMO_PAT_FILE for a demo build")
const [os = process.platform, ...rest] = process.argv.slice(2)
const script = { darwin: "dist:mac", win32: "dist:win" }[os]
if (!script) throw new Error(`Unsupported demo build target: ${os}`)
const result = spawnSync(process.execPath, ["run", script, ...rest], {
  stdio: "inherit",
  env: { ...process.env, OPENCODE_CHANNEL: "prod" },
})
if (result.error || result.status !== 0) process.exit(result.status ?? 1)
