import { expect, test } from "bun:test"
import type { Context } from "./tool"
import { demoModel } from "./melange-demo"

test("template metadata only comes from the latest user message", () => {
  const message = (app?: string, synthetic = true, role = "user") => ({
    info: { role },
    parts: [{ type: "text", text: "Build a chatbot app", synthetic,
      metadata: app ? { melangeDemoApp: app } : {} }],
  }) as Context["messages"][number]
  expect(demoModel([message("translation")])).toBe("zetic/Hy-MT2-1.8B")
  expect(demoModel([message("image")])).toBe("changgeun/LFM2.5-VL-450M")
  expect(demoModel([message("appliance")])).toBe("SJ_zetic/LFM2.5-1.2B-Instruct")
  expect(demoModel([message()])).toBeUndefined()
  expect(demoModel([message("translation", false)])).toBeUndefined()
  expect(demoModel([message("constructor")])).toBeUndefined()
  expect(demoModel([message("image"), message()])).toBeUndefined()
  expect(demoModel([message(), message("image", true, "assistant")])).toBeUndefined()
})

test("typed English and Korean requests use the same models; ambiguous requests keep selection", () => {
  const model = (text: string) => demoModel([{
    info: { role: "user" }, parts: [{ type: "text", text }],
  }] as Context["messages"])
  for (const text of ["Build an on-device real time translation app", "A REAL-TIME translator", "Translate speech instantly", "실시간 번역 앱 만들어줘", "통역 앱"])
    expect(model(text)).toBe("zetic/Hy-MT2-1.8B")
  for (const text of ["Build an image analysis app", "Describe photos and answer questions", "on-device vision app", "사진을 설명하는 앱", "이미지 분석"])
    expect(model(text)).toBe("changgeun/LFM2.5-VL-450M")
  for (const text of ["Control home appliances", "smart-home agent", "가전제품 제어 앱"])
    expect(model(text)).toBe("SJ_zetic/LFM2.5-1.2B-Instruct")
  for (const text of ["Build a chatbot", "real time audio app", "Imagine an app", "Translate text in photos"])
    expect(model(text)).toBeUndefined()
})
