// Drives the packaged Melange Agent window over the Chrome DevTools Protocol:
// passes the first-launch gate, types a prompt into the real prompt box, grants
// the agent's permission requests, and records the assistant's reply. Run after
// launching the app with --remote-debugging-port=9222. Requires playwright-core.
import { mkdirSync, writeFileSync } from "node:fs"
import { chromium } from "playwright-core"

const CDP_URL = process.env.CDP_URL ?? "http://127.0.0.1:9222"
const OUT = process.env.EVIDENCE_DIR ?? "artifacts"
const PROMPT =
  process.env.SMOKE_PROMPT ?? "build an on-device vision app that describes photos and answers questions about them."
// A full agent turn runs the Qualcomm tools and may take a while. Poll every 5 s,
// log every 30 s, and stop once the app is idle and the reply text has not changed.
const REPLY_TIMEOUT_MS = Number(process.env.SMOKE_REPLY_TIMEOUT_MS ?? 15 * 60_000)
const SETTLE_MS = 30_000

// Stable markers in the session page (see packages/app and packages/session-ui).
const PROMPT_INPUT = '[data-component="prompt-input"]'
const USER_MESSAGE = '[data-component="user-message"]'
const TEXT_PART = '[data-component="text-part"]'
const SUBMIT = '[data-action="prompt-submit"]'

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

async function snap(page, name, fullPage = false) {
  try {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
  } catch (error) {
    log(`screenshot ${name} failed:`, error.message)
  }
}

const pageText = (page) => page.evaluate(() => document.body.innerText).catch(() => "")

async function visible(locator) {
  return (await locator.count()) > 0 && locator.first().isVisible()
}

async function reachPrompt(page) {
  const deadline = Date.now() + 150_000
  while (Date.now() < deadline) {
    const prompt = page.locator(PROMPT_INPUT).first()
    if (await visible(prompt)) return prompt
    const gate = page.getByRole("button", { name: /^Continue( without signing in)?$/ })
    if (await visible(gate)) {
      log("first-launch gate: clicking", JSON.stringify(await gate.first().innerText()))
      await gate.first().click()
    }
    await sleep(2_000)
  }
  log("page text at timeout:\n" + (await pageText(page)).slice(0, 3000))
  throw new Error("prompt input never became visible")
}

async function assistantText(page) {
  const parts = await page.locator(TEXT_PART).allInnerTexts().catch(() => [])
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n")
}

async function busy(page) {
  const label = await page
    .locator(SUBMIT)
    .first()
    .getAttribute("aria-label")
    .catch(() => null)
  return /stop/i.test(label ?? "")
}

// The agent asks before touching files outside the project (the CLI's temp
// directory, for example). A person clicks Allow in the demo; do the same here.
async function grantPermissions(page, granted) {
  const allow = page.getByRole("button", { name: /^Allow always$/ })
  if (!(await visible(allow))) return false
  const request = await page
    .getByText("Permission required")
    .first()
    .locator("xpath=ancestor::*[self::div][3]")
    .innerText()
    .catch(() => "(could not read request)")
  granted.push(request.replace(/\s+/g, " ").trim())
  log("permission request:", granted.at(-1))
  await snap(page, `ui-permission-${granted.length}`)
  await allow.first().click()
  return true
}

const summary = { prompt: PROMPT, finished: false, permissions: [], reply: "" }
const browser = await connect()
try {
  const page = await appPage(browser)
  log("app page:", page.url())
  await snap(page, "ui-01-initial")

  const prompt = await reachPrompt(page)
  await snap(page, "ui-02-prompt-ready")

  const usersBefore = await page.locator(USER_MESSAGE).count()
  await prompt.click()
  await page.keyboard.type(PROMPT, { delay: 5 })
  await page.keyboard.press("Enter")
  log(`sent (${usersBefore} user messages before):`, PROMPT)
  await sleep(10_000)
  await snap(page, "ui-03-prompt-sent")
  if ((await page.locator(USER_MESSAGE).count()) <= usersBefore) {
    log("page text:\n" + (await pageText(page)).slice(0, 3000))
    throw new Error("the prompt was not submitted (no new user message)")
  }

  const deadline = Date.now() + REPLY_TIMEOUT_MS
  let last = ""
  let changedAt = Date.now()
  let lastLog = 0
  while (Date.now() < deadline) {
    if (await grantPermissions(page, summary.permissions)) changedAt = Date.now()
    const running = await busy(page)
    const text = await assistantText(page)
    if (text !== last) {
      last = text
      changedAt = Date.now()
    }
    if (Date.now() - lastLog > 30_000) {
      lastLog = Date.now()
      log(`running=${running} reply=${text.length} chars, tail: ${JSON.stringify(text.slice(-160))}`)
    }
    if (!running && text.length > 0 && Date.now() - changedAt > SETTLE_MS) {
      summary.finished = true
      break
    }
    await sleep(5_000)
  }
  summary.reply = last
  if (!summary.finished) log(`agent still running after ${REPLY_TIMEOUT_MS / 1000}s; recording what it produced so far`)

  const transcript = await pageText(page)
  writeFileSync(`${OUT}/ui-transcript.txt`, transcript)
  writeFileSync(
    `${OUT}/ui-reply.md`,
    `# Prompt\n\n${PROMPT}\n\n# Finished: ${summary.finished}\n\n# Permissions granted\n\n${
      summary.permissions.map((item) => `- ${item}`).join("\n") || "(none)"
    }\n\n# Assistant text\n\n${last}\n`,
  )
  log("reply:\n" + last)
  await snap(page, "ui-04-reply")
  await snap(page, "ui-05-reply-fullpage", true)
  if (!last) throw new Error("the assistant produced no text")
} finally {
  writeFileSync(`${OUT}/ui-summary.json`, JSON.stringify(summary, null, 2))
  await browser.close().catch(() => {})
}
