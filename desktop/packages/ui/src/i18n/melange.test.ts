import { describe, expect, test } from "bun:test"
import { melangeModelForQuestionOption, melangeModelSummaryKey } from "./melange"

describe("Melange model presentation mapping", () => {
  test("maps approved model IDs to localized display summaries", () => {
    expect(melangeModelSummaryKey("zetic/LFM3-VL-2B")).toBe("ui.melange.model.summary.lfm3_vl_2b")
    expect(melangeModelSummaryKey("zetic/d1-Omni-2B")).toBe("ui.melange.model.summary.d1_omni_2b")
    expect(melangeModelSummaryKey("some/unknown-model")).toBeUndefined()
  })

  test("recognizes the model card label while keeping recommendation presentation separate", () => {
    expect(melangeModelForQuestionOption("LFM3-1.7B (Recommended)")).toEqual({
      id: "zetic/LFM3-1.7B",
      name: "LFM3-1.7B",
      recommended: true,
    })
    expect(melangeModelForQuestionOption("d1-2B")).toEqual({
      id: "zetic/d1-2B",
      name: "d1-2B",
      recommended: false,
    })
    expect(melangeModelForQuestionOption("Unrelated option (Recommended)")).toBeUndefined()
  })
})
