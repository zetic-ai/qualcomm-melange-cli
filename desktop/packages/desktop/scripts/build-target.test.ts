import { describe, expect, test } from "bun:test"
import { getNodePtyPackage } from "./build-target"

describe("desktop build target", () => {
  test("selects the Windows x64 PTY package from the Rust target", () => {
    expect(getNodePtyPackage("x86_64-pc-windows-msvc")).toBe("@lydell/node-pty-win32-x64")
  })

  test("keeps the Apple Silicon PTY package for the existing target", () => {
    expect(getNodePtyPackage("aarch64-apple-darwin")).toBe("@lydell/node-pty-darwin-arm64")
  })
})
