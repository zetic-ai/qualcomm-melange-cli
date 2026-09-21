import { expect, test } from "bun:test"
import { join } from "node:path"
import { melangeCommandFor, melangePathEntries } from "./melange-command"

test("agent sign-in spawns the launcher on macOS and the binary on Windows", () => {
  const root = join("Resources", "melange-qcom")
  expect(melangeCommandFor(root, "darwin")).toBe(join(root, "launcher", "melange-qcom"))
  expect(melangeCommandFor(root, "win32")).toBe(join(root, "bin", "melange-qcom.exe"))
})

test("PATH exposes the launcher first and, on Windows, the binary for shell-less spawns", () => {
  const root = join("Resources", "melange-qcom")
  expect(melangePathEntries(root, "darwin")).toEqual([join(root, "launcher")])
  expect(melangePathEntries(root, "win32")).toEqual([join(root, "launcher"), join(root, "bin")])
})
