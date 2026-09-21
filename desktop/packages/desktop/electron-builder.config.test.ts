import { expect, test } from "bun:test"
import type { Configuration } from "electron-builder"
import config, { foreignNativePackages, packagingGuard, sevenZipFilterFor } from "./electron-builder.config"

const value = config as Configuration

test("packages a stable unsigned Apple Silicon Melange Agent", () => {
  expect(value.appId).toBe("ai.zetic.melange-agent")
  expect(value.productName).toBe("Melange Agent")
  expect(value.artifactName).toBe("melange-agent-${os}-${arch}.${ext}")
  expect(value.protocols).toEqual({ name: "Melange Agent", schemes: ["melange-agent"] })
  expect(value.mac?.identity).toBeNull()
  expect(value.mac?.target).toEqual([
    { target: "dmg", arch: ["arm64"] },
    { target: "zip", arch: ["arm64"] },
  ])
  expect(value.publish).toBeUndefined()
})

test("packages an unsigned Windows on Arm installer by default", () => {
  expect(value.extraMetadata).toEqual({ name: "melange-agent" })
  expect(value.win?.icon).toBe("resources/icons/icon.ico")
  expect(value.win?.target).toEqual([{ target: "nsis", arch: ["arm64"] }])
  expect(value.win?.verifyUpdateCodeSignature).toBe(false)
  expect(value.nsis?.oneClick).toBe(true)
  expect(value.nsis?.perMachine).toBe(false)
})

test("packages the verified CLI and skill outside the app archive", () => {
  expect(value.files).toContain("!resources/melange-qcom/**")
  expect(value.extraResources).toContainEqual({ from: "resources/melange-qcom", to: "melange-qcom" })
})

test("keeps only the target platform's native packages", () => {
  const key = `${process.platform}-${process.arch}`
  expect(foreignNativePackages("win32-arm64")).toEqual([
    "!node_modules/@lydell/node-pty-!(win32-arm64)/**",
    "!node_modules/@parcel/watcher-!(win32-arm64)/**",
    "!node_modules/@msgpackr-extract/msgpackr-extract-!(win32-arm64)/**",
  ])
  for (const pattern of foreignNativePackages(key)) expect(value.files).toContain(pattern)
})

test("refuses to package a bundle built for another platform", async () => {
  const mac = packagingGuard(async () => ({ os: "darwin", arch: "arm64" }))
  await expect(mac({ electronPlatformName: "win32", arch: 3 })).rejects.toThrow(/darwin-arm64.*win32-arm64/)
  await expect(mac({ electronPlatformName: "darwin", arch: 3 })).resolves.toBeUndefined()

  const legacy = packagingGuard(async (file) => (file.startsWith("out/") ? { os: "win32", arch: "arm64" } : {}))
  await expect(legacy({ electronPlatformName: "win32", arch: 3 })).rejects.toThrow(/resources\/melange-qcom/)

  const win = packagingGuard(async () => ({ os: "win32", arch: "x64" }))
  await expect(win({ electronPlatformName: "win32", arch: 1 })).resolves.toBeUndefined()
  await expect(win({ electronPlatformName: "win32", arch: 3 })).rejects.toThrow(/win32-x64.*win32-arm64/)
})

test("disables 7-Zip branch filters for Windows payloads so NSIS can extract Arm64 executables", () => {
  expect(sevenZipFilterFor("win32")).toBe("off")
  expect(sevenZipFilterFor("darwin")).toBeUndefined()
})
