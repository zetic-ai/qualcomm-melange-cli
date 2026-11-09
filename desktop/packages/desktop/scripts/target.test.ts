import { describe, expect, test } from "bun:test"
import { describeMismatch, melangeArchiveName, resolveTarget, targetFor } from "./target"

describe("build target resolution", () => {
  test("defaults to the build host", () => {
    expect(resolveTarget({}, { platform: "darwin", arch: "arm64" }).key).toBe("darwin-arm64")
  })

  test("environment overrides select a cross-build target", () => {
    const target = resolveTarget(
      { MELANGE_TARGET_OS: "win32", MELANGE_TARGET_ARCH: "arm64" },
      { platform: "darwin", arch: "arm64" },
    )
    expect(target).toEqual({
      os: "win32",
      arch: "arm64",
      key: "win32-arm64",
      nodePty: "@lydell/node-pty-win32-arm64",
      binary: "melange-qcom.exe",
      launcher: "melange-qcom.cmd",
    })
  })

  test("rejects targets the app does not build for", () => {
    expect(() => targetFor("linux", "x64")).toThrow("does not build for linux-x64")
    expect(() => resolveTarget({ MELANGE_TARGET_OS: "win32" }, { platform: "darwin", arch: "ia32" })).toThrow()
  })

  test("maps targets to the mirrored Qualcomm CLI archives", () => {
    expect(melangeArchiveName(targetFor("darwin", "arm64"), "0.10.0")).toBe("melange-qcom_0.10.0_darwin_arm64.tar.gz")
    expect(melangeArchiveName(targetFor("win32", "arm64"), "0.10.0")).toBe("melange-qcom_0.10.0_windows_arm64.zip")
    expect(melangeArchiveName(targetFor("win32", "x64"), "0.10.0")).toBe("melange-qcom_0.10.0_windows_amd64.zip")
  })

  test("explains how to repair a mismatched build", () => {
    const message = describeMismatch("out/", { os: "darwin", arch: "arm64" }, targetFor("win32", "arm64"))
    expect(message).toContain("darwin-arm64")
    expect(message).toContain("MELANGE_TARGET_OS=win32 MELANGE_TARGET_ARCH=arm64")
    expect(message).toContain("dist:win")
  })
})
