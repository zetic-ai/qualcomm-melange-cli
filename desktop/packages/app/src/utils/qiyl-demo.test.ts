import { describe, expect, test } from "bun:test"
import { demoTemplateMetadata, hideModelControls, qiylDemoEnabled, showComposerCommand } from "./qiyl-demo"

describe("event renderer mode", () => {
  test("keeps regular builds normal and allows setup mode in the event build", () => {
    expect(qiylDemoEnabled(false, false)).toBe(false)
    expect(qiylDemoEnabled(true, false)).toBe(true)
    expect(qiylDemoEnabled(true, true)).toBe(false)
  })
})

describe("event demo model controls", () => {
  test("hides runtime model setup in the event renderer regardless of readiness", () => {
    expect(hideModelControls(true, false)).toBe(true)
    expect(hideModelControls(true, true)).toBe(true)
  })

  test("does not change the regular experience", () => {
    expect(hideModelControls(false, false)).toBe(false)
    expect(hideModelControls(false, true)).toBe(false)
  })

  test("sends the event's broad user prompt without hidden template metadata", () => {
    expect(demoTemplateMetadata(true, "appliance")).toBeUndefined()
    expect(demoTemplateMetadata(false, "appliance")).toBe("appliance")
  })

  test("hides runtime model, agent, shell, and terminal commands only in the event UI", () => {
    expect(showComposerCommand("agent.cycle", true, false)).toBe(false)
    expect(showComposerCommand("agent.cycle.reverse", true, true)).toBe(false)
    expect(showComposerCommand("model.choose", true, false)).toBe(false)
    expect(showComposerCommand("model.choose", true, true)).toBe(false)
    expect(showComposerCommand("model.variant.cycle", true, false)).toBe(false)
    expect(showComposerCommand("prompt.mode.shell", true, false)).toBe(false)
    expect(showComposerCommand("terminal.toggle", true, false)).toBe(false)
    expect(showComposerCommand("terminal.new", true, false)).toBe(false)
    expect(showComposerCommand("provider.connect", true, false)).toBe(false)
    expect(showComposerCommand("file.attach", true, false)).toBe(true)
    expect(showComposerCommand("model.choose", false, true)).toBe(true)
    expect(showComposerCommand("agent.cycle", false, true)).toBe(true)
    expect(showComposerCommand("terminal.toggle", false, true)).toBe(true)
  })
})
