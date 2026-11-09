import { expect, test } from "bun:test"
import { join } from "node:path"
import { opencodeStorageRoot } from "./storage-root"

test("the sidecar stores OpenCode files under the app's user-data directory", () => {
  const userData = join("C:", "Users", "demo", "AppData", "Roaming", "ai.zetic.melange-agent")
  expect(opencodeStorageRoot(userData, {})).toBe(join(userData, "opencode"))
  expect(opencodeStorageRoot(userData, { OPENCODE_STORAGE_ROOT: "" })).toBe(join(userData, "opencode"))
  expect(opencodeStorageRoot(userData, { OPENCODE_STORAGE_ROOT: "/tmp/isolated" })).toBe("/tmp/isolated")
})
