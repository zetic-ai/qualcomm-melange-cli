// Build target resolution shared by the Vite config, the electron-builder
// config, and the prebuild scripts. Keep this file free of Bun-only APIs so
// every loader can import it.

export type TargetOS = "darwin" | "win32"
export type TargetArch = "arm64" | "x64"

export type Target = {
  os: TargetOS
  arch: TargetArch
  /** `${os}-${arch}`, for example `win32-arm64`. */
  key: string
  /** Platform package that ships the node-pty JS *and* prebuilt binaries for this target. */
  nodePty: string
  /** File name of the Qualcomm Melange CLI binary inside the release archive. */
  binary: string
  /** File name of the packaged launcher that agent shells find on PATH. */
  launcher: string
}

export const TARGET_OS_ENV = "MELANGE_TARGET_OS"
export const TARGET_ARCH_ENV = "MELANGE_TARGET_ARCH"
export const BUILD_TARGET_FILE = "out/main/build-target.json"

export const SUPPORTED_TARGETS = ["darwin-arm64", "win32-arm64", "win32-x64"] as const

export function targetFor(os: string, arch: string): Target {
  const key = `${os}-${arch}`
  if (!(SUPPORTED_TARGETS as readonly string[]).includes(key)) {
    throw new Error(`Melange Agent does not build for ${key}. Supported targets: ${SUPPORTED_TARGETS.join(", ")}`)
  }
  const win = os === "win32"
  return {
    os: os as TargetOS,
    arch: arch as TargetArch,
    key,
    nodePty: `@lydell/node-pty-${key}`,
    binary: win ? "melange-qcom.exe" : "melange-qcom",
    launcher: win ? "melange-qcom.cmd" : "melange-qcom",
  }
}

/**
 * The target defaults to the build host. Cross-builds (for example a Windows
 * on Arm installer produced on an Apple Silicon Mac) set MELANGE_TARGET_OS and
 * MELANGE_TARGET_ARCH so that every stage packages the same platform: without
 * this the bundle keeps the host's node-pty package, which does not contain
 * `lib/windowsTerminal.js`, and the packaged app dies on launch with
 * "Cannot find module './windowsTerminal'".
 */
export function resolveTarget(
  env: Record<string, string | undefined> = process.env,
  host: { platform: string; arch: string } = process,
): Target {
  const os = env[TARGET_OS_ENV]?.trim() || host.platform
  const arch = env[TARGET_ARCH_ENV]?.trim() || host.arch
  return targetFor(os, arch)
}

export function melangeArchiveName(target: Target, version: string) {
  const cpu = target.arch === "x64" ? "amd64" : "arm64"
  if (target.os === "win32") return `melange-qcom_${version}_windows_${cpu}.zip`
  return `melange-qcom_${version}_darwin_${cpu}.tar.gz`
}

export function describeMismatch(stage: string, built: { os?: string; arch?: string }, wanted: Target) {
  const have = built.os && built.arch ? `${built.os}-${built.arch}` : "an unknown target"
  return (
    `${stage} was produced for ${have} but electron-builder is packaging ${wanted.key}. ` +
    `Rebuild with ${TARGET_OS_ENV}=${wanted.os} ${TARGET_ARCH_ENV}=${wanted.arch} bun run build, ` +
    `or run bun run dist:${wanted.os === "win32" ? "win" : "mac"} which sets both stages consistently.`
  )
}
