import { base64Encode } from "@opencode-ai/core/util/encode"
import { expect, test } from "@playwright/test"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectSessionTitle } from "../utils/waits"

const directory = "C:/OpenCode/LocaleSettings"
const projectID = "proj_locale_settings"
const sessionID = "ses_locale_settings"
const title = "Locale settings regression"

const progress = (locale: "en" | "ko") => (locale === "ko" ? "2개의 질문 중 1개" : "1 of 2 questions")
const nextButton = (locale: "en" | "ko") => (locale === "ko" ? "다음" : "Next")
const localeName = (locale: "en" | "ko") => (locale === "ko" ? "한국어" : "English")

test("uses the build default locale and persists language changes", async ({ page }, testInfo) => {
  const defaultLocale = process.env.VITE_QIYL_DEMO === "1" ? "ko" : "en"
  const alternateLocale = defaultLocale === "ko" ? "en" : "ko"

  await mockOpenCodeServer(page, {
    protocol: "v2",
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "LocaleSettings",
      time: { created: 1_700_000_000_000, updated: 1_700_000_000_000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: {
            "lfm3-1.7b": {
              id: "lfm3-1.7b",
              name: "LFM3-1.7B",
              limit: { context: 256_000 },
            },
          },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "lfm3-1.7b" },
    },
    sessions: [
      {
        id: sessionID,
        slug: "locale-settings",
        projectID,
        directory,
        title,
        version: "dev",
        time: { created: 1_700_000_000_000, updated: 1_700_000_000_000 },
      },
    ],
    pageMessages: () => ({ items: [] }),
    questions: [
      {
        id: "locale-question",
        sessionID,
        questions: [
          {
            header: "Model",
            question: "Choose a model",
            options: [{ label: "LFM3-1.7B" }, { label: "D1-2B" }],
          },
          {
            header: "Feature",
            question: "Choose a feature",
            options: [{ label: "Local processing" }, { label: "Tool calls" }],
          },
        ],
      },
    ],
  })

  await page.addInitScript(({ directory, dirBase64, server, sessionID }) => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
    localStorage.setItem(
      "opencode.global.dat:server",
      JSON.stringify({
        projects: { local: [{ worktree: directory, expanded: true }] },
        lastProject: { local: directory },
      }),
    )
    localStorage.setItem(
      "opencode.window.browser.dat:tabs",
      JSON.stringify([{ type: "session", server, dirBase64, sessionId }]),
    )
  }, {
    directory,
    dirBase64: base64Encode(directory),
    server: `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`,
    sessionID,
  })

  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const question = page.locator('[data-component="dock-prompt"][data-kind="question"]')
  await expect(question).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("lang", defaultLocale)
  await expect(question.getByText(progress(defaultLocale))).toBeVisible()
  await expect(question.getByRole("button", { name: nextButton(defaultLocale) })).toBeVisible()

  const chooseLocale = async (locale: "en" | "ko") => {
    await page.keyboard.press("Control+,")
    const settings = page.locator(".settings-v2-dialog")
    await expect(settings).toBeVisible()
    const picker = settings.locator('[data-action="settings-language"]')
    await picker.locator('[data-component="select-v2"]').click()
    const menu = page.locator('[data-component="menu-v2-content"]')
    await expect(menu).toBeVisible()
    const option = menu.locator('[data-component="menu-v2-item"]').filter({ hasText: localeName(locale) })
    await expect(option).toBeVisible()
    await option.click()
    await expect(page.locator("html")).toHaveAttribute("lang", locale)
    if (locale === "ko") {
      await page.screenshot({ path: testInfo.outputPath("locale-settings-ko.png"), fullPage: true })
    }
    await page.keyboard.press("Escape")
    await expect(settings).toHaveCount(0)
    await expect(question.getByText(progress(locale))).toBeVisible()
    await expect(question.getByRole("button", { name: nextButton(locale) })).toBeVisible()
    if (locale === "ko") {
      await page.screenshot({ path: testInfo.outputPath("locale-question-ko.png"), fullPage: true })
    }
  }

  await chooseLocale(alternateLocale)
  await page.reload()
  await expectSessionTitle(page, title)
  await expect(page.locator("html")).toHaveAttribute("lang", alternateLocale)
  await expect(question.getByText(progress(alternateLocale))).toBeVisible()

  await chooseLocale(defaultLocale)
  await page.reload()
  await expectSessionTitle(page, title)
  await expect(page.locator("html")).toHaveAttribute("lang", defaultLocale)
  await expect(question.getByText(progress(defaultLocale))).toBeVisible()

  await page.goto(`/${base64Encode(directory)}/session`)
  await expect(page.locator('[data-component="prompt-input-v2"]')).toBeVisible()

  if (defaultLocale === "ko") {
    const demoPrompts = page.locator('[data-component="demo-prompts"][data-qiyl-demo="true"]')
    await expect(demoPrompts).toBeVisible()
    await expect(demoPrompts.getByText("가전 관리 앱")).toBeVisible()
    await expect(demoPrompts.getByText("집 안의 가전제품을 더 편리하게 관리")).toBeVisible()
    await expect(page.locator('[data-component="prompt-input-v2"]')).toContainText("만들고 싶은 앱을 설명해 주세요...")
    await page.screenshot({ path: testInfo.outputPath("locale-event-home-ko.png"), fullPage: true })
  }
})
