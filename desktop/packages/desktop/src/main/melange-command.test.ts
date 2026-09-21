import { expect, test } from "bun:test"
import { join } from "node:path"
import { melangeCommandFor, melangePath, melangePathEntries, pathKey } from "./melange-command"

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

test("search path keeps the user's entries under the key Windows actually uses", () => {
  const root = "C:\\App\\resources\\melange-qcom"
  const env = { Path: "C:\\Windows\\System32;C:\\Windows", HOME: "x" }
  expect(pathKey(env)).toBe("Path")
  expect(pathKey({ PATH: "/usr/bin" })).toBe("PATH")
  expect(pathKey({})).toBe("PATH")
  expect(melangePath(root, env, "win32", ";")).toBe(
    `${join(root, "launcher")};${join(root, "bin")};C:\\Windows\\System32;C:\\Windows`,
  )
  expect(melangePath("/app/melange-qcom", { PATH: "/usr/bin" }, "darwin", ":")).toBe("/app/melange-qcom/launcher:/usr/bin")
  expect(melangePath("/app/melange-qcom", {}, "darwin", ":")).toBe("/app/melange-qcom/launcher")
})
