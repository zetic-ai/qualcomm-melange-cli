import { $ } from "bun"
import { access, cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

import type { Target } from "./target"

const desktopDir = resolve(import.meta.dir, "..")

async function exists(path: string) {
  return access(path)
    .then(() => true)
    .catch(() => false)
}

/** A file that must be present for the package to be usable on the target. */
function requiredFile(pkg: string, target: Target) {
  if (pkg.startsWith("@lydell/node-pty-"))
    return join("lib", target.os === "win32" ? "windowsTerminal.js" : "unixTerminal.js")
  return undefined
}

async function hasNativeBinary(dir: string): Promise<boolean> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && (await hasNativeBinary(join(dir, entry.name)))) return true
    if (entry.isFile() && entry.name.endsWith(".node")) return true
  }
  return false
}

async function installedVersion(pkg: string) {
  try {
    const file = Bun.resolveSync(`${pkg}/package.json`, desktopDir)
    return { dir: dirname(file), version: (await Bun.file(file).json()).version as string }
  } catch {
    return undefined
  }
}

async function usable(pkg: string, dir: string, target: Target) {
  const required = requiredFile(pkg, target)
  if (required && !(await exists(join(dir, required)))) return false
  return hasNativeBinary(dir)
}

/**
 * Platform-specific optional dependencies declared in package.json that belong
 * to the target: `@lydell/node-pty-<os>-<arch>`, `@parcel/watcher-<os>-<arch>`, …
 */
export async function targetOptionalDependencies(target: Target) {
  const pkg = await Bun.file(join(desktopDir, "package.json")).json()
  const optional: Record<string, string> = pkg.optionalDependencies ?? {}
  const entries = Object.entries(optional).filter(([name]) => name.endsWith(`-${target.key}`))
  if (!entries.some(([name]) => name === target.nodePty)) {
    throw new Error(`${target.nodePty} is not declared in packages/desktop optionalDependencies`)
  }
  return entries
}

/**
 * Bun installs only the optional native packages that match the build host, so
 * a cross-build has nothing to bundle for the target platform. Fetch the
 * target's packages into this workspace's own node_modules; electron-builder
 * collects them from there because they are declared optionalDependencies.
 * Without this the Windows app either dies at launch (node-pty: "Cannot find
 * module './windowsTerminal'") or silently loses file watching (@parcel/watcher).
 */
export async function ensureNativeDependencies(target: Target) {
  const installed: string[] = []
  for (const [pkg, version] of await targetOptionalDependencies(target)) {
    const current = await installedVersion(pkg)
    if (current?.version === version && (await usable(pkg, current.dir, target))) {
      console.log(`Using ${pkg}@${version} from ${current.dir}`)
      installed.push(current.dir)
      continue
    }

    const staging = await mkdtemp(join(tmpdir(), "melange-agent-native-"))
    const dest = join(desktopDir, "node_modules", pkg)
    try {
      await $`bun install --no-save --cwd ${staging} ${`${pkg}@${version}`} ${`--os=${target.os}`} ${`--cpu=${target.arch}`}`.quiet()
      await rm(dest, { recursive: true, force: true })
      await mkdir(dirname(dest), { recursive: true })
      await cp(join(staging, "node_modules", pkg), dest, { recursive: true })
    } finally {
      await rm(staging, { recursive: true, force: true })
    }

    if (!(await usable(pkg, dest, target))) {
      throw new Error(`${pkg}@${version} is not usable on ${target.key}; refusing to package a broken native module`)
    }
    console.log(`Installed ${pkg}@${version} for ${target.key} into ${dest}`)
    installed.push(dest)
  }
  return installed
}
