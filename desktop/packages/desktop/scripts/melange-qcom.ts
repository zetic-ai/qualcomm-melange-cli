import { createHash } from "node:crypto"
import { cp, chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"

import { melangeArchiveName, resolveTarget, type Target } from "./target"

const PINNED_TAG = "v0.10.0"
const MIRROR = "https://github.com/zetic-ai/qualcomm-melange-cli"
const SIGNER = `https://github.com/zetic-ai/melange-cli/.github/workflows/release.yml@refs/tags/${PINNED_TAG}`
const OIDC_ISSUER = "https://token.actions.githubusercontent.com"

export function parsePinnedUpstream(text: string) {
  let value: { tag?: unknown }
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error("UPSTREAM.json is invalid")
  }
  if (value.tag !== PINNED_TAG) throw new Error(`Melange Agent requires ${PINNED_TAG} in UPSTREAM.json`)
  return { tag: PINNED_TAG, version: PINNED_TAG.slice(1) }
}

export function checksumFor(manifest: string, filename: string) {
  const entries = manifest
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[1]?.replace(/^\*/, "") === filename)
  if (entries.length !== 1) throw new Error(`signed checksum manifest must contain exactly one entry for ${filename}`)
  const checksum = entries[0][0]
  if (!/^[0-9a-fA-F]{64}$/.test(checksum))
    throw new Error(`signed checksum manifest has an invalid checksum for ${filename}`)
  return checksum.toLowerCase()
}

export async function verifySHA256(data: Uint8Array, expected: string) {
  const actual = createHash("sha256").update(data).digest("hex")
  if (actual !== expected.toLowerCase()) throw new Error(`checksum mismatch: expected ${expected}, got ${actual}`)
}

async function download(url: string) {
  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok) throw new Error(`download failed (${response.status}): ${url}`)
  return new Uint8Array(await response.arrayBuffer())
}

async function run(command: string, args: string[], cwd?: string) {
  const child = Bun.spawn([command, ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (code !== 0) throw new Error(`${command} failed: ${(stderr || stdout).trim()}`)
  return stdout.trim()
}

async function findBinary(directory: string, name: string): Promise<string> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      const nested = await findBinary(path, name).catch(() => "")
      if (nested) return nested
    }
    if (entry.isFile() && entry.name === name) return path
  }
  throw new Error(`verified archive does not contain ${name}`)
}

/** Machine type of a Windows PE image, read from the COFF header. */
export function peMachine(bytes: Uint8Array): "arm64" | "x64" | "unknown" {
  if (bytes.length < 0x40 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) return "unknown"
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const offset = view.getUint32(0x3c, true)
  if (offset + 6 > bytes.length || view.getUint32(offset, true) !== 0x00004550) return "unknown"
  const machine = view.getUint16(offset + 4, true)
  if (machine === 0xaa64) return "arm64"
  if (machine === 0x8664) return "x64"
  return "unknown"
}

/**
 * The launcher is what agent shells run when they call `melange-qcom` from
 * PATH. It restores the user's XDG_STATE_HOME (the app points its own at the
 * Electron user-data directory) and maps `--version` to the CLI's `version`
 * command. The main process spawns the binary directly instead; see
 * `melangeCommandFor` in src/main/melange-command.ts.
 */
export function unixLauncher() {
  return `#!/bin/sh\nif [ "\${MELANGE_AGENT_XDG_STATE_HOME_SET:-0}" = 1 ]; then\n  export XDG_STATE_HOME="\${MELANGE_AGENT_XDG_STATE_HOME:-}"\nelse\n  unset XDG_STATE_HOME\nfi\nunset MELANGE_AGENT_XDG_STATE_HOME MELANGE_AGENT_XDG_STATE_HOME_SET\nif [ "$#" = 1 ] && [ "$1" = "--version" ]; then\n  set -- version\nfi\nexec "$(dirname "$0")/../bin/melange-qcom" "$@"\n`
}

export function windowsLauncher() {
  return [
    "@echo off",
    "setlocal",
    'if "%MELANGE_AGENT_XDG_STATE_HOME_SET%"=="1" (',
    '  set "XDG_STATE_HOME=%MELANGE_AGENT_XDG_STATE_HOME%"',
    ") else (",
    '  set "XDG_STATE_HOME="',
    ")",
    'set "MELANGE_AGENT_XDG_STATE_HOME="',
    'set "MELANGE_AGENT_XDG_STATE_HOME_SET="',
    'if "%~1"=="--version" if "%~2"=="" (',
    '  "%~dp0..\\bin\\melange-qcom.exe" version',
    "  exit /b %ERRORLEVEL%",
    ")",
    '"%~dp0..\\bin\\melange-qcom.exe" %*',
    "exit /b %ERRORLEVEL%",
    "",
  ].join("\r\n")
}

export async function prepareMelangeQcom(target: Target = resolveTarget()) {
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error(`Melange Agent v1 builds only on macOS arm64, not ${process.platform} ${process.arch}`)
  }
  console.log(`Preparing Qualcomm Melange CLI for ${target.key}`)
  const mirrorRoot = resolve(import.meta.dir, "../../../..")
  const { tag, version } = parsePinnedUpstream(await readFile(join(mirrorRoot, "UPSTREAM.json"), "utf8"))
  const filename = melangeArchiveName(target, version)
  const release = `${MIRROR}/releases/download/${tag}`
  const scratch = await mkdtemp(join(tmpdir(), "melange-agent-build-"))
  try {
    const checksumsPath = join(scratch, "checksums.txt")
    const bundlePath = join(scratch, "checksums.txt.sigstore.json")
    const [manifest, bundle] = await Promise.all([
      download(`${release}/checksums.txt`),
      download(`${release}/checksums.txt.sigstore.json`),
    ])
    await Promise.all([writeFile(checksumsPath, manifest), writeFile(bundlePath, bundle)])
    await run("cosign", [
      "verify-blob",
      "--bundle",
      bundlePath,
      "--certificate-identity",
      SIGNER,
      "--certificate-oidc-issuer",
      OIDC_ISSUER,
      checksumsPath,
    ])
    const expected = checksumFor(new TextDecoder().decode(manifest), filename)
    const cacheDir = join(homedir(), ".cache", "melange-agent", `${version}-${expected}`)
    const cachedArchive = join(cacheDir, filename)
    let archive: Uint8Array
    try {
      archive = new Uint8Array(await readFile(cachedArchive))
      await verifySHA256(archive, expected)
    } catch {
      archive = await download(`${release}/${filename}`)
      await verifySHA256(archive, expected)
      await mkdir(cacheDir, { recursive: true })
      const pending = join(cacheDir, `${filename}.pending-${process.pid}`)
      await writeFile(pending, archive, { mode: 0o600 })
      await rename(pending, cachedArchive)
    }

    const archivePath = join(scratch, filename)
    const extractDir = join(scratch, "extract")
    await Promise.all([writeFile(archivePath, archive), mkdir(extractDir)])
    // macOS bsdtar extracts both the darwin tarballs and the Windows zip archives.
    await run("tar", [filename.endsWith(".zip") ? "-xf" : "-xzf", archivePath, "-C", extractDir])
    const sourceBinary = await findBinary(extractDir, target.binary)
    if (target.os === "win32") {
      const machine = peMachine(new Uint8Array(await readFile(sourceBinary)))
      if (machine !== target.arch) {
        throw new Error(`verified CLI has the wrong architecture: PE machine ${machine}, expected ${target.arch}`)
      }
    } else {
      const fileDescription = await run("file", [sourceBinary])
      if (!/arm64|Mach-O 64-bit.*arm64/i.test(fileDescription)) {
        throw new Error(`verified CLI has the wrong architecture: ${fileDescription}`)
      }
    }

    const resources = resolve(import.meta.dir, "../resources")
    const packagedRoot = join(resources, "melange-qcom")
    await rm(packagedRoot, { recursive: true, force: true })
    await mkdir(join(packagedRoot, "bin"), { recursive: true })
    const packagedBinary = join(packagedRoot, "bin", target.binary)
    await copyFile(sourceBinary, packagedBinary)
    await chmod(packagedBinary, 0o755)
    if (target.os === "darwin") await run("codesign", ["--force", "--sign", "-", packagedBinary])

    const launcherDir = join(packagedRoot, "launcher")
    await mkdir(launcherDir)
    const launcher = join(launcherDir, target.launcher)
    await writeFile(launcher, target.os === "win32" ? windowsLauncher() : unixLauncher(), { mode: 0o755 })
    await cp(join(mirrorRoot, "skills", "melange-qcom"), join(packagedRoot, "skill", "melange-qcom"), {
      recursive: true,
    })
    await writeFile(
      join(packagedRoot, "VERIFIED.json"),
      `${JSON.stringify(
        { tag, os: target.os, arch: target.arch, filename: basename(cachedArchive), sha256: expected, signer: SIGNER },
        null,
        2,
      )}\n`,
    )
    const mode = (await stat(packagedBinary)).mode & 0o777
    if ((mode & 0o111) === 0) throw new Error("packaged Qualcomm Melange CLI is not executable")
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}
