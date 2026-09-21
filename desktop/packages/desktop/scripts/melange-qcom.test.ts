import { describe, expect, test } from "bun:test"
import { checksumFor, parsePinnedUpstream, peMachine, verifySHA256, windowsLauncher } from "./melange-qcom"

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

  test("reads the machine type of a Windows PE image", () => {
    const image = (machine: number) => {
      const bytes = new Uint8Array(0x100)
      bytes[0] = 0x4d
      bytes[1] = 0x5a
      const view = new DataView(bytes.buffer)
      view.setUint32(0x3c, 0x80, true)
      view.setUint32(0x80, 0x00004550, true)
      view.setUint16(0x84, machine, true)
      return bytes
    }
    expect(peMachine(image(0xaa64))).toBe("arm64")
    expect(peMachine(image(0x8664))).toBe("x64")
    expect(peMachine(image(0x014c))).toBe("unknown")
    expect(peMachine(new TextEncoder().encode("#!/bin/sh"))).toBe("unknown")
  })

  test("writes a Windows launcher with the same contract as the shell launcher", () => {
    const launcher = windowsLauncher()
    expect(launcher.split("\r\n")[0]).toBe("@echo off")
    expect(launcher).toContain('set "XDG_STATE_HOME=%MELANGE_AGENT_XDG_STATE_HOME%"')
    expect(launcher).toContain('set "MELANGE_AGENT_XDG_STATE_HOME_SET="')
    expect(launcher).toContain('if "%~1"=="--version" if "%~2"=="" (')
    expect(launcher).toContain('"%~dp0..\\bin\\melange-qcom.exe" %*')
  })
})
