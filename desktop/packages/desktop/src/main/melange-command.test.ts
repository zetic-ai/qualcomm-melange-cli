import { expect, test } from "bun:test"
import { join } from "node:path"
import { melangeCommandFor } from "./melange-command"

test("agent sign-in spawns the launcher on macOS and the binary on Windows", () => {
  const root = join("Resources", "melange-qcom")
  expect(melangeCommandFor(root, "darwin")).toBe(join(root, "launcher", "melange-qcom"))
  expect(melangeCommandFor(root, "win32")).toBe(join(root, "bin", "melange-qcom.exe"))
})
