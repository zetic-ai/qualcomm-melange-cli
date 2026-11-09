import { describe, expect, test } from "bun:test"
import { qiylQuestionOptionPresentation } from "./qiyl-question-presentation"

const sourceDescription =
  "Liquid AI LFM3 text model for local agents and specialized applications, with a 256K-token context window and tool calling. Learn more on: https://huggingface.co/LiquidAI/LFM3-1.7B Card tags: text-generation."

describe("QIYL question option presentation", () => {
  test("localizes the recommended label and model description without changing the source option", () => {
    const label = "LFM3-1.7B (Recommended)"
    const presentation = qiylQuestionOptionPresentation(
      label,
      sourceDescription,
      (key, params) => {
        if (key === "ui.melange.question.recommendedOption")
          return `${params?.model} (추천)`
        if (key === "ui.melange.question.modelDescription") return `${params?.summary}\n모델 카드 태그: ${params?.tags}`
        return String(key)
      },
      (key, params) => {
        if (key === "ui.melange.model.summary.lfm3_17b")
          return "로컬 에이전트와 특화 앱에 적합한 텍스트 모델입니다."
        if (key === "ui.melange.question.modelDescription")
          return `${params?.summary}\n모델 카드 태그: ${params?.tags}`
        return undefined
      },
    )

    expect(presentation).toEqual({
      label: "LFM3-1.7B (추천)",
      description: "로컬 에이전트와 특화 앱에 적합한 텍스트 모델입니다.\n모델 카드 태그: text-generation",
    })
    expect(label).toBe("LFM3-1.7B (Recommended)")
    expect(sourceDescription).toContain("https://huggingface.co/LiquidAI/LFM3-1.7B")
  })

  test("preserves canonical option text when there is no localized override", () => {
    const label = "LFM3-1.7B (Recommended)"
    const presentation = qiylQuestionOptionPresentation(
      label,
      sourceDescription,
      (key, params) => {
        if (key === "ui.melange.question.recommendedOption")
          return `${params?.model} (Recommended)`
        return String(key)
      },
      () => undefined,
    )

    expect(presentation).toEqual({ label, description: sourceDescription })
  })
})
