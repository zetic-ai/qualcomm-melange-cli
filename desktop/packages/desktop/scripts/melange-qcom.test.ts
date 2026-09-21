import { describe, expect, test } from "bun:test"
import { checksumFor, parsePinnedUpstream, resolveBuildTarget, verifySHA256 } from "./melange-qcom"

describe("Qualcomm Melange release verification", () => {
  test("accepts only the pinned v0.10.0 upstream release", () => {
    expect(
      parsePinnedUpstream(
        JSON.stringify({
          tag: "v0.10.0",
          upstream_repository: "https://github.com/zetic-ai/melange-cli",
          commit: "db278f73349f93836d08a991666e7149ff09fce9",
        }),
      ),
    ).toEqual({ tag: "v0.10.0", version: "0.10.0" })
    expect(() => parsePinnedUpstream('{"tag":"v0.10.1"}')).toThrow("requires v0.10.0")
  })

  test("rejects missing, duplicate, and malformed checksum entries", () => {
    const name = "melange-qcom_0.10.0_darwin_arm64.tar.gz"
    const hash = "a".repeat(64)
    expect(checksumFor(`${hash}  ${name}\n`, name)).toBe(hash)
    expect(() => checksumFor("", name)).toThrow("exactly one")
    expect(() => checksumFor(`${hash}  ${name}\n${hash}  ${name}\n`, name)).toThrow("exactly one")
    expect(() => checksumFor(`nope  ${name}\n`, name)).toThrow("invalid checksum")
  })

  test("fails closed when an archive does not match its signed checksum", async () => {
    const verifiedHash = "1c34f88707b55e6104c4eb20e71ffa3d33e414b71ef689a15fad0640d0ac58cb"
    expect(await verifySHA256(new TextEncoder().encode("verified"), verifiedHash)).toBeUndefined()
    await expect(verifySHA256(new TextEncoder().encode("tampered"), verifiedHash)).rejects.toThrow("checksum mismatch")
  })

  test("selects the Windows x64 release from an explicit Rust target", () => {
    expect(resolveBuildTarget("0.10.0", "x86_64-pc-windows-msvc", "darwin", "arm64")).toMatchObject({
      filename: "melange-qcom_0.10.0_windows_amd64.zip",
      binary: "melange-qcom.exe",
      archive: "zip",
    })
  })

  test("keeps the native Apple Silicon release as the default", () => {
    expect(resolveBuildTarget("0.10.0", undefined, "darwin", "arm64")).toMatchObject({
      filename: "melange-qcom_0.10.0_darwin_arm64.tar.gz",
      binary: "melange-qcom",
      archive: "tar.gz",
    })
  })
})
