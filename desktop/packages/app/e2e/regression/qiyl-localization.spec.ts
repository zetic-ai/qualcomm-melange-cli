import { resolve } from "node:path"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { expect, test, type Page } from "@playwright/test"
import { assistantMessage, setupTimeline, toolPart, userMessage } from "../performance/timeline-stability/fixture"
import { mockOpenCodeServer } from "../utils/mock-server"
import { expectSessionTitle } from "../utils/waits"

const directory = "C:/OpenCode/QiYLLocalization"
const projectID = "proj_qiyl_localization"
const sessionID = "ses_qiyl_localization"
const title = "QIYL localization"
const modelDescription =
  "Liquid AI LFM3 text model for local agents and specialized applications, with a 256K-token context window and tool calling. Learn more on: https://huggingface.co/LiquidAI/LFM3-1.7B"
const modelTags = ["text-generation"]
const benchmarkNote =
  "Each chart keeps a reported quantization separate; each point is the highest returned tokens/s measurement per Qualcomm SoC and accelerator type."

test("renders Korean QIYL plan and expandable source model card", async ({ page }) => {
  const plan = {
    phase: "planned",
    appName: "집안 가전 관리",
    summary: "휴대폰으로 가상 거실의 조명을 제어합니다.",
    features: ["방 조명 켜기"],
    screens: ["가전 목록", "방 제어"],
    deviceRoles: [{ device: "휴대폰", responsibilities: ["조명 제어 명령 전송"] }],
    selectedModel: {
      id: "zetic/LFM3-1.7B",
      name: "LFM3-1.7B",
      description: modelDescription,
      capabilities: modelTags,
      benchmarkStatus: "available",
      benchmarkCharts: [
        {
          title: "LFM3-1.7B — Qualcomm throughput · Q4_0",
          metric: "throughput",
          unit: "tokens/s",
          quantization: "Q4_0",
          points: [{ label: "SM8650", accelerator: "NPU", value: 51 }],
        },
      ],
      benchmarkNote,
    },
  }
  await setupTimeline(page, {
    locale: "ko",
    messages: [
      userMessage(),
      assistantMessage([
        toolPart("prt_qiyl_plan", "melange_plan_app", "completed", {}, {
          title: "App plan ready: Home appliance manager",
          output: JSON.stringify(plan),
          metadata: plan,
        }),
      ]),
    ],
  })

  const planCard = page.locator('[data-component="melange-app-plan"]')
  await expect(planCard).toContainText("앱 구성 계획을 확인해 주세요. 이번 시연은 앱 빌드가 시작되기 전에 마무리됩니다.")
  await expect(planCard).toContainText("모델 설명")
  await expect(planCard).toContainText(
    "로컬 에이전트와 특화 애플리케이션에 사용하는 Liquid AI LFM3 텍스트 모델입니다. 256K 토큰 컨텍스트 창과 도구 호출을 지원합니다.",
  )
  await expect(planCard.locator('[data-component="melange-model-source"] summary')).toHaveText("원본 모델 카드 설명")
  await planCard.locator('[data-component="melange-model-source"] summary').click()
  await expect(planCard.locator('[data-component="melange-model-source"]')).toContainText(modelDescription)
  await page.screenshot({ path: resolve(process.cwd(), "../../../../qiyl-korean-plan.png"), fullPage: true })
})

test("localizes the selected model benchmark disclosure", async ({ page }) => {
  const selected = {
    phase: "selected",
    model: "zetic/LFM3-1.7B",
    modelName: "LFM3-1.7B",
    description: modelDescription,
    capabilities: modelTags,
    benchmarkStatus: "available",
    benchmarkCharts: [
      {
        title: "LFM3-1.7B — Qualcomm throughput · Q4_0",
        metric: "throughput",
        unit: "tokens/s",
        quantization: "Q4_0",
        points: [{ label: "SM8650", accelerator: "NPU", value: 51 }],
      },
    ],
    benchmarkNote,
  }
  await setupTimeline(page, {
    locale: "ko",
    messages: [
      userMessage(),
      assistantMessage([
        toolPart("prt_qiyl_selected", "melange_prepare_model", "completed", {}, {
          title: "Model selected: LFM3-1.7B",
          output: JSON.stringify(selected),
          metadata: selected,
        }),
      ]),
    ],
  })

  const modelCard = page.locator('[data-component="melange-model-details"]').first()
  await expect(modelCard).toContainText(
    "로컬 에이전트와 특화 애플리케이션에 사용하는 Liquid AI LFM3 텍스트 모델입니다. 256K 토큰 컨텍스트 창과 도구 호출을 지원합니다.",
  )
  const benchmarks = modelCard.locator('[data-component="melange-benchmarks"]')
  await benchmarks.locator("summary").click()
  await expect(benchmarks.locator('[data-slot="melange-benchmark-note"]')).toHaveText(
    "각 차트는 보고된 양자화 방식을 구분해 표시합니다. 각 Qualcomm SoC와 가속기 유형에서는 초당 토큰 수가 가장 높은 측정값을 보여줍니다.",
  )
  await expect(benchmarks.locator("figcaption")).toHaveText("LFM3-1.7B — Qualcomm 처리량 · Q4_0")
  await expect(benchmarks.locator('[data-slot="melange-benchmark-point"]')).toContainText("SM8650 · NPU")
  await page.screenshot({ path: resolve(process.cwd(), "../../../../qiyl-korean-benchmarks.png"), fullPage: true })
})

test("updates recommended model presentation on locale switch and submits the unchanged answer", async ({ page }) => {
  await mockQuestionServer(page, {
    questions: [
      {
        id: "qiyl-model-choice",
        sessionID,
        questions: [
          {
            header: "Model",
            question: "Choose the model for this app.",
            options: [
              { label: "LFM3-1.7B (Recommended)", description: `${modelDescription} Card tags: ${modelTags.join(", ")}.` },
              {
                label: "d1-2B",
                description:
                  "Liquid AI d1 decision model for text, images, and video, returning calibrated answers in a single forward pass without generating tokens. Learn more on: https://huggingface.co/LiquidAI/d1-2B Card tags: vision-input.",
              },
            ],
            custom: false,
          },
        ],
      },
    ],
  })
  await page.addInitScript(() => {
    localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale: "en" }))
  })

  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  await expectSessionTitle(page, title)
  const question = page.locator('[data-component="dock-prompt"][data-kind="question"]')
  const recommended = question.locator('[data-slot="question-option"]').filter({ hasText: "LFM3-1.7B" }).first()
  await expect(recommended).toContainText("(Recommended)")
  await expect(recommended).toContainText("Liquid AI LFM3 text model")

  await page.keyboard.press("Control+,")
  const settings = page.locator(".settings-v2-dialog")
  await expect(settings).toBeVisible()
  await settings.locator('[data-action="settings-language"] [data-component="select-v2"]').click()
  await page.locator('[role="option"]').filter({ hasText: "한국어" }).click()
  await expect(page.locator("html")).toHaveAttribute("lang", "ko")
  await page.keyboard.press("Escape")

  await expect(recommended).toContainText("(추천)")
  await expect(recommended).toContainText(
    "로컬 에이전트와 특화 애플리케이션에 사용하는 Liquid AI LFM3 텍스트 모델입니다.",
  )
  await expect(recommended).toContainText("모델 카드 태그: text-generation")
  await page.screenshot({ path: resolve(process.cwd(), "../../../../qiyl-korean-model-question.png"), fullPage: true })

  await recommended.click()
  const reply = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === `/api/session/${sessionID}/question/qiyl-model-choice/reply`,
  )
  await question.getByRole("button", { name: "제출" }).click()
  expect((await reply).postDataJSON()).toEqual({ answers: [["LFM3-1.7B (Recommended)"]] })
})

async function mockQuestionServer(
  page: Page,
  requests: { questions: unknown[] },
) {
  await mockOpenCodeServer(page, {
    protocol: "v2",
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "qiyl-localization",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "opencode",
          name: "OpenCode",
          models: {
            "claude-opus-4-6": { id: "claude-opus-4-6", name: "Claude Opus 4.6", limit: { context: 200000 } },
          },
        },
      ],
      connected: ["opencode"],
      default: { providerID: "opencode", modelID: "claude-opus-4-6" },
    },
    sessions: [
      {
        id: sessionID,
        slug: "qiyl-localization",
        projectID,
        directory,
        title,
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    pageMessages: () => ({ items: [] }),
    questions: requests.questions,
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
  })
}
