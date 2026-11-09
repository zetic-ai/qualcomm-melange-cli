import { flatten, resolveTemplate, translator, type Flatten } from "@solid-primitives/i18n"
import { defaultLocale, loadInitialLocale, type Locale } from "@opencode-ai/app"
import { desktopEnglish } from "./en"
import { desktopKorean } from "./ko"

type Dictionary = Record<keyof Flatten<typeof desktopEnglish>, string>
const dictionaries: Record<Locale, Dictionary> = {
  en: flatten(desktopEnglish) as Dictionary,
  ko: flatten(desktopKorean) as Dictionary,
}
let locale = defaultLocale()
let localeFromProvider = false
const translate = translator(() => dictionaries[locale], resolveTemplate)

export function t(key: keyof Dictionary, params?: Record<string, string | number>) {
  return translate(key, params)
}

export function setLocale(value: Locale) {
  locale = value
  localeFromProvider = true
}

export function initI18n() {
  return loadInitialLocale().then((value) => {
    if (!localeFromProvider) locale = value
    return locale
  })
}
