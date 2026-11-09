import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Global, storageDirs } from "@opencode-ai/core/global"

describe("global paths", () => {
  test("tmp path is under the system temp directory", () => {
    expect(Global.Path.tmp).toBe(path.join(os.tmpdir(), "opencode"))
    expect(Global.make().tmp).toBe(Global.Path.tmp)
  })

  test("tmp path is created on module load", async () => {
    expect((await fs.stat(Global.Path.tmp)).isDirectory()).toBe(true)
  })
})

describe("storage root override", () => {
  const xdg = { data: "/x/data", cache: "/x/cache", config: "/x/config", state: "/x/state" }

  test("defaults to the shared XDG opencode directories", () => {
    expect(storageDirs(undefined, xdg)).toEqual({
      data: path.join("/x/data", "opencode"),
      cache: path.join("/x/cache", "opencode"),
      config: path.join("/x/config", "opencode"),
      state: path.join("/x/state", "opencode"),
    })
    expect(storageDirs("", xdg)).toEqual(storageDirs(undefined, xdg))
  })

  test("OPENCODE_STORAGE_ROOT moves every directory under one app-owned root", () => {
    expect(storageDirs("/app/opencode", xdg)).toEqual({
      data: path.join("/app/opencode", "data"),
      cache: path.join("/app/opencode", "cache"),
      config: path.join("/app/opencode", "config"),
      state: path.join("/app/opencode", "state"),
    })
  })
})
