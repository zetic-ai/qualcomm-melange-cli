import { expect, test } from "bun:test"
import type { Part } from "@opencode-ai/sdk/v2"
import { groupParts, sameGroups } from "./part-groups"

test("shell groups grow across messages and stop at visible content or other tools", () => {
  const item = (id: string, tool: string, messageID = "m1") => ({
    messageID,
    part: { id, type: "tool", tool } as Part,
  })
  const first = [item("1", "bash")]
  const more = [...first, item("2", "shell", "m2")]
  const before = groupParts(first)
  const after = groupParts(more)
  expect(after).toEqual([
    {
      key: "shell:1",
      type: "shell",
      refs: [
        { messageID: "m1", partID: "1" },
        { messageID: "m2", partID: "2" },
      ],
    },
  ])
  expect(before[0]!.key).toBe(after[0]!.key)
  expect(sameGroups(before, after)).toBe(false)
  expect(sameGroups(after, groupParts(more))).toBe(true)
  const groups = groupParts([
    ...more,
    item("3", "read"),
    item("4", "grep"),
    item("5", "bash"),
    { messageID: "m2", part: { id: "6", type: "text", text: "Result" } as Part },
    item("7", "bash"),
    item("8", "melange_prepare_model"),
    item("9", "bash"),
  ])
  expect(groups.map((group) => group.type)).toEqual(["shell", "context", "shell", "part", "shell", "part", "shell"])
  expect(groupParts([])).toEqual([])
})
