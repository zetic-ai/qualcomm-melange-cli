import * as i18n from "@solid-primitives/i18n"
import { dict } from "./en"

type Dictionary = Record<keyof i18n.Flatten<typeof dict>, string>
const translate = i18n.translator(() => i18n.flatten(dict) as Dictionary, i18n.resolveTemplate)

export function t(key: keyof Dictionary, params?: Record<string, string | number>) {
  return translate(key, params)
}

export function initI18n() {
  return Promise.resolve("en" as const)
}
