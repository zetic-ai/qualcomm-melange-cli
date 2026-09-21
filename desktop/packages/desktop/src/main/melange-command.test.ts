import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { getMelangeBinDirectory, getMelangeCommandPath } from "./melange-command"

describe("Melange CLI resources", () => {
  test("uses the Windows executable directly", () => {
    expect(getMelangeBinDirectory("resources", "win32")).toBe(join("resources", "bin"))
    expect(getMelangeCommandPath("resources", "win32")).toBe(join("resources", "bin", "melange-qcom.exe"))
  })

  test("keeps the Unix launcher path", () => {
    expect(getMelangeBinDirectory("resources", "darwin")).toBe(join("resources", "launcher"))
    expect(getMelangeCommandPath("resources", "darwin")).toBe(join("resources", "launcher", "melange-qcom"))
  })
})
