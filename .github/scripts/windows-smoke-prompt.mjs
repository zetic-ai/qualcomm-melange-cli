// Drives the packaged Melange Agent window over the Chrome DevTools Protocol:
// passes the first-launch gate, types a prompt into the real prompt box, and
// waits for the assistant's reply. Run after launching the app with
// --remote-debugging-port=9222. Requires playwright-core (no browser download).
import { mkdirSync, writeFileSync } from "node:fs"
import { chromium } from "playwright-core"

const CDP_URL = process.env.CDP_URL ?? "http://127.0.0.1:9222"
const OUT = process.env.EVIDENCE_DIR ?? "artifacts"
const PROMPT_INPUT = '[data-component="prompt-input"]'
const MESSAGE = "[data-message]"

mkdirSync(OUT, { recursive: true })
const log = (...args) => console.log(new Date().toISOString(), ...args)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function connect() {
  const deadline = Date.now() + 90_000
  let last
  while (Date.now() < deadline) {
    try {
      return await chromium.connectOverCDP(CDP_URL, { timeout: 10_000 })
    } catch (error) {
      last = error
      await sleep(3_000)
    }
  }
  throw new Error(`could not connect to ${CDP_URL}: ${last?.message}`)
}

async function appPage(browser) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const pages = browser.contexts().flatMap((context) => context.pages())
    log("pages:", pages.map((page) => page.url()).join(" | ") || "(none)")
    const page = pages.find((candidate) => !candidate.url().startsWith("devtools://"))
    if (page) return page
    await sleep(2_000)
  }
  throw new Error("no application page reachable over CDP")
}

async function snap(page, name) {
  try {
    await page.screenshot({ path: `${OUT}/${name}.png` })
  } catch (error) {
    log(`screenshot ${name} failed:`, error.message)
  }
}

const pageText = (page) => page.evaluate(() => document.body.innerText.slice(0, 3000)).catch(() => "")

async function reachPrompt(page) {
  const deadline = Date.now() + 150_000
  while (Date.now() < deadline) {
    const prompt = page.locator(PROMPT_INPUT).first()
    if ((await prompt.count()) && (await prompt.isVisible())) return prompt
    const gate = page.getByRole("button", { name: /^Continue( without signing in)?$/ }).first()
    if ((await gate.count()) && (await gate.isVisible())) {
      log("first-launch gate: clicking", JSON.stringify(await gate.innerText()))
      await gate.click()
    }
    await sleep(2_000)
  }
  log("page text at timeout:\n" + (await pageText(page)))
  throw new Error("prompt input never became visible")
}

async function send(page, prompt, text) {
  const before = await page.locator(MESSAGE).count()
  await prompt.click()
  await page.keyboard.type(text, { delay: 5 })
  await page.keyboard.press("Enter")
  log(`sent (${before} messages before):`, text)
  return before
}

// Waits until the reply that follows the user's own message contains `pattern`,
// or, when pattern is null, until its text has stopped changing for `settleMs`.
async function waitReply(page, before, pattern, timeoutMs, settleMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  let last = ""
  let stableSince = Date.now()
  while (Date.now() < deadline) {
    const messages = page.locator(MESSAGE)
    const count = await messages.count()
    if (count >= before + 2) {
      const text = (await messages.nth(count - 1).innerText().catch(() => "")).trim()
      if (text !== last) {
        last = text
        stableSince = Date.now()
      }
      if (pattern ? pattern.test(text) : text.length > 0 && Date.now() - stableSince > settleMs) return text
    }
    await sleep(3_000)
  }
  log("last reply text:", JSON.stringify(last.slice(0, 500)))
  log("page text at timeout:\n" + (await pageText(page)))
  throw new Error(`no matching reply within ${timeoutMs / 1000}s`)
}

const summary = { pong: "pending", library: "pending" }
const browser = await connect()
try {
  const page = await appPage(browser)
  log("app page:", page.url())
  await snap(page, "ui-01-initial")

  const prompt = await reachPrompt(page)
  await snap(page, "ui-02-prompt-ready")

  const before = await send(page, prompt, "Reply with exactly the single word PONG and nothing else.")
  const reply = await waitReply(page, before, /\bPONG\b/, 180_000)
  summary.pong = reply.slice(0, 200)
  log("reply 1:", JSON.stringify(summary.pong))
  await snap(page, "ui-03-reply-pong")

  // Exercises the bundled Qualcomm CLI and the Melange PAT through the agent's tools.
  // Recorded as evidence; not yet required for a green run.
  try {
    const before2 = await send(
      page,
      prompt,
      "Which models are available in my Qualcomm Melange library? Use the Melange tools to look, then list only their names.",
    )
    const reply2 = await waitReply(page, before2, null, 300_000)
    summary.library = reply2.slice(0, 1000)
    log("reply 2:", JSON.stringify(summary.library))
  } catch (error) {
    summary.library = `soft failure: ${error.message}`
    log(summary.library)
  }
  await snap(page, "ui-04-reply-library")
} finally {
  writeFileSync(`${OUT}/ui-summary.json`, JSON.stringify(summary, null, 2))
  await browser.close().catch(() => {})
}
