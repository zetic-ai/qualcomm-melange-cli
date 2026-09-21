import { join } from "node:path"

/**
 * Command the main process spawns for `melange-qcom auth ...`.
 *
 * Agent shells go through the `launcher/` directory on PATH. On Windows that
 * launcher is a `.cmd` file, which Node refuses to spawn without a shell
 * (CVE-2024-27980) and which node-pty cannot start directly either, so the
 * main process runs the binary itself. The launcher's only other job, the
 * XDG_STATE_HOME handoff, is done in-process by `commandEnv` in melange-auth.ts.
 */
export function melangeCommandFor(resourceRoot: string, platform: NodeJS.Platform = process.platform) {
  if (platform === "win32") return join(resourceRoot, "bin", "melange-qcom.exe")
  return join(resourceRoot, "launcher", "melange-qcom")
}

/**
 * Directories prepended to PATH for agent shells and sidecar tools.
 *
 * `launcher/` comes first so cmd.exe and PowerShell, which try every PATHEXT
 * in a directory before moving on, run the `.cmd` launcher. Node's execFile
 * and spawn only match `.exe`/`.com` and cannot run a `.cmd` without a shell,
 * so on Windows `bin/` follows: tools such as melange_prepare_model that call
 * `execFileSync("melange-qcom", ...)` fall through to `bin\melange-qcom.exe`
 * instead of failing with ENOENT.
 */
export function melangePathEntries(resourceRoot: string, platform: NodeJS.Platform = process.platform) {
  const entries = [join(resourceRoot, "launcher")]
  if (platform === "win32") entries.push(join(resourceRoot, "bin"))
  return entries
}
