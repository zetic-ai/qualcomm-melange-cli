import { describe, expect, test } from "bun:test"
import { messageIdentity } from "./message-identity"

describe("message identity", () => {
  test("keeps agent and model labels in the normal UI", () => {
    expect(messageIdentity("build", "Claude", false)).toEqual(["Build", "Claude"])
    expect(messageIdentity(undefined, "GPT", false)).toEqual(["GPT"])
  })

  test("omits agent and model labels in the event UI", () => {
    expect(messageIdentity("build", "Claude", true)).toEqual([])
    expect(messageIdentity(undefined, "GPT", true)).toEqual([])
  })
})
