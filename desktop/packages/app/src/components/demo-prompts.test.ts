import { describe, expect, test } from "bun:test"
import { dict as en } from "@/i18n/en"
import { dict as ko } from "@/i18n/ko"
import { demoPromptOptions, demoPromptTranslationKey } from "./demo-prompts"

describe("demo prompts", () => {
  test("limits the event demo to the appliance app while retaining normal app cards", () => {
    expect(demoPromptOptions(true)).toEqual(["appliance"])
    expect(demoPromptOptions(false)).toEqual(["translation", "image", "appliance"])
  })

  test("uses broad appliance-management prompts in Korean and English", () => {
    expect(demoPromptTranslationKey(true, "appliance", "prompt")).toBe("prompt.demo.qiyl.appliance.prompt")
    expect(demoPromptTranslationKey(false, "appliance", "prompt")).toBe("prompt.demo.appliance.prompt")
    expect(ko["prompt.demo.qiyl.appliance.prompt"]).toBe("집에 있는 가전제품을 보다 편리하게 관리할 수 있는 앱을 만들어줘.")
    expect(en["prompt.demo.qiyl.appliance.prompt"]).toBe("Create an app that makes it easier to manage the appliances in my home.")
    expect(ko["prompt.demo.qiyl.appliance.prompt"]).not.toMatch(/조명|에어컨|온도|시나리오/)
    expect(en["prompt.demo.qiyl.appliance.prompt"]).not.toMatch(/light|air conditioner|temperature|scenario/i)
    expect(en["prompt.demo.appliance.prompt"]).toBe(
      "Build an on-device agent that controls home appliances through natural-language commands.",
    )
  })
})
