import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createAutoScroll } from "@opencode-ai/ui/hooks"

test("revealing a chart holds scrolling until the user resumes", async () => {
  const element = document.createElement("div")
  document.body.append(element)
  Object.defineProperties(element, { scrollHeight: { value: 1000 }, clientHeight: { value: 400 } })
  const state = createRoot((dispose) => {
    const scroll = createAutoScroll({ working: () => true })
    scroll.scrollRef(element)
    return { scroll, dispose }
  })
  try {
    await Promise.resolve()
    element.dispatchEvent(new CustomEvent("opencode:hold-scroll", { bubbles: true }))
    element.scrollTop = 600
    state.scroll.handleScroll()
    expect(state.scroll.userScrolled()).toBe(true)
    element.scrollTop = 200
    state.scroll.scrollToBottom()
    expect(element.scrollTop).toBe(200)
    state.scroll.resume()
    expect(state.scroll.userScrolled()).toBe(false)
    expect(element.scrollTop).toBe(1000)
  } finally {
    state.dispose()
    element.remove()
  }
})
