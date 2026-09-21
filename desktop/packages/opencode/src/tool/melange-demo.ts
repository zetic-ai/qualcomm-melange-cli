import type { Context } from "./tool"

const models = {
  translation: "zetic/Hy-MT2-1.8B",
  image: "changgeun/LFM2.5-VL-450M",
  appliance: "SJ_zetic/LFM2.5-1.2B-Instruct",
} as const

export function demoModel(messages: Context["messages"]) {
  const user = messages.findLast((message) => message.info.role === "user")
  const part = user?.parts.find((part) => part.type === "text" && part.synthetic && part.metadata?.melangeDemoApp)
  const app = part?.type === "text" ? part.metadata?.melangeDemoApp : undefined
  if (typeof app === "string" && Object.hasOwn(models, app)) return models[app as keyof typeof models]

  const text = user?.parts
    .filter((part) => part.type === "text" && !part.synthetic && !part.ignored)
    .map((part) => part.type === "text" ? part.text : "")
    .join(" ") ?? ""
  const matches = [
    /\b(translat(?:e|es|ed|ing|ion|ions|or|ors)|interpretation)\b|번역|통역/iu.test(text) ? models.translation : undefined,
    /\b(images?|photos?|photographs?|vision|camera|pictures?)\b|이미지|사진|비전|카메라/iu.test(text) ? models.image : undefined,
    /\b(appliances?|smart[ -]?home|home automation)\b|가전|스마트\s*홈/iu.test(text) ? models.appliance : undefined,
  ].filter((model) => model !== undefined)
  // Mixed-purpose requests keep the chooser instead of guessing which capability matters most.
  return matches.length === 1 ? matches[0] : undefined
}
