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
