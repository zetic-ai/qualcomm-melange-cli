import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { Configuration } from "electron-builder"

import { BUILD_TARGET_FILE, describeMismatch, resolveTarget, targetFor } from "./scripts/target"

const packageDir = path.dirname(fileURLToPath(import.meta.url))
const target = resolveTarget()

// Platform-specific optional dependency families declared in package.json.
const NATIVE_FAMILIES = ["@lydell/node-pty", "@parcel/watcher", "@msgpackr-extract/msgpackr-extract"]

export function foreignNativePackages(key: string) {
  return NATIVE_FAMILIES.map((family) => `!node_modules/${family}-!(${key})/**`)
}

// electron-builder's Arch enum (builder-util): ia32 = 0, x64 = 1, armv7l = 2, arm64 = 3, universal = 4.
const ARCH_NAMES: Record<number, string> = { 1: "x64", 3: "arm64" }

type Recorded = { os?: string; arch?: string }

async function readJson(file: string) {
  return JSON.parse(await readFile(path.join(packageDir, file), "utf8")) as Recorded
}

/**
 * Guard against packaging a bundle that was built for another platform. A
 * Windows installer assembled from a macOS `out/` ships the darwin node-pty
 * package and fails at launch with "Cannot find module './windowsTerminal'".
 */
export function packagingGuard(read: (file: string) => Promise<Recorded>) {
  return async (context: { electronPlatformName: string; arch: number }) => {
    const wanted = targetFor(context.electronPlatformName, ARCH_NAMES[context.arch] ?? String(context.arch))
    const built = await read(BUILD_TARGET_FILE).catch(() => ({}) as Recorded)
    if (built.os !== wanted.os || built.arch !== wanted.arch) throw new Error(describeMismatch("out/", built, wanted))
    const cli = await read("resources/melange-qcom/VERIFIED.json").catch(() => ({}) as Recorded)
    const cliTarget = { os: cli.os ?? "darwin", arch: cli.arch ?? "arm64" } // pre-target builds were mac only
    if (cliTarget.os !== wanted.os || cliTarget.arch !== wanted.arch) {
      throw new Error(describeMismatch("resources/melange-qcom", cliTarget, wanted))
    }
  }
}

const config: Configuration = {
  appId: "ai.zetic.melange-agent",
  productName: "Melange Agent",
  artifactName: "melange-agent-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  files: [
    "out/**/*",
    "resources/**/*",
    "!resources/linux/**",
    "!resources/*.metainfo.xml",
    "!resources/opencode-cli*",
    "!resources/melange-qcom/**",
    // Only the target's native packages belong in the app; the others were
    // installed for the build host (or a previous target) and cannot load there.
    ...foreignNativePackages(target.key),
  ],
  extraResources: [
    {
      from: "resources/melange-qcom",
      to: "melange-qcom",
    },
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  beforePack: packagingGuard(readJson),
  mac: {
    category: "public.app-category.developer-tools",
    icon: "resources/icons/icon.icns",
    hardenedRuntime: false,
    gatekeeperAssess: false,
    identity: null,
    target: [
      { target: "dmg", arch: ["arm64"] },
      { target: "zip", arch: ["arm64"] },
    ],
  },
  dmg: { sign: false },
  win: {
    icon: "resources/icons/icon.ico",
    // Unsigned internal builds, like the macOS app. SmartScreen will warn on first launch.
    target: [{ target: "nsis", arch: [target.os === "win32" ? target.arch : "arm64"] }],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: "resources/icons/icon.ico",
    installerHeaderIcon: "resources/icons/icon.ico",
  },
  protocols: {
    name: "Melange Agent",
    schemes: ["melange-agent"],
  },
}

export default config
