import { flatten, translator, resolveTemplate } from "@solid-primitives/i18n"
import { createEffect, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { pluralCategory, type UiI18nPluralKey } from "@opencode-ai/ui/context/i18n"
import { appEnglish } from "@/i18n/en"
import { appKorean } from "@/i18n/ko"
import { uiEnglish } from "@opencode-ai/ui/i18n/en"
import { uiKorean } from "@opencode-ai/ui/i18n/ko"
import { createDesktopNativeBundle, DESKTOP_NATIVE_ENGLISH, type DesktopNativeBundle } from "@/i18n/desktop-native"
import { Persist, persisted } from "@/utils/persist"

export type Locale = "en" | "ko"
export type Direction = "ltr" | "rtl"

type Dictionary = Record<keyof typeof appEnglish | keyof typeof uiEnglish, string>
type PluralKey =
  UiI18nPluralKey | "session.question.pending" | "session.followupDock.summary" | "session.revertDock.summary"

const dictionaries = {
  en: flatten({ ...appEnglish, ...uiEnglish }),
  ko: flatten({ ...appEnglish, ...uiEnglish, ...appKorean, ...uiKorean }),
}

export function loadLocaleDict(_locale: Locale) {
  return Promise.resolve()
}

export function normalizeLocale(value: string): Locale {
  return value.trim().toLowerCase().replaceAll("_", "-").split("-")[0] === "ko" ? "ko" : "en"
}

export function defaultLocale(): Locale {
  return import.meta.env?.VITE_QIYL_DEMO === "1" ? "ko" : "en"
}

export function loadInitialLocale() {
  return Promise.resolve(defaultLocale())
}

export const { use: useLanguage, provider: LanguageProvider } = createSimpleContext({
  name: "Language",
  gate: true,
  init: (props: { locale?: Locale; onNativeTranslations?: (bundle: DesktopNativeBundle) => void }) => {
    const initial = props.locale ?? defaultLocale()
    // The old English-only renderer wrote oc_locale=en on every load. Persist explicit choices separately.
    const [store, setStore, , ready] = persisted(
      {
        ...Persist.global("language"),
        migrate: (value) => {
          const locale = value && typeof value === "object" && "locale" in value ? value.locale : undefined
          return { locale: typeof locale === "string" ? normalizeLocale(locale) : initial }
        },
      },
      createStore<{ locale: Locale }>({ locale: initial }),
    )
    const [layout, setLayout] = createStore<{ direction: Direction }>({ direction: "ltr" })
    const locale = createMemo(() => normalizeLocale(store.locale))
    const current = createMemo(() => dictionaries[locale()])
    const direction = () => layout.direction
    const t = translator(current, resolveTemplate) as (
      key: keyof Dictionary,
      params?: Record<string, string | number | boolean>,
    ) => string

    const plural = (key: PluralKey, count: number, params?: Record<string, string | number | boolean>) => {
      const dict = current() as Record<string, string>
      const candidate = `${key}.${pluralCategory(locale(), count)}`
      const fallback = `${key}.other`
      return resolveTemplate(dict[candidate] ?? dict[fallback] ?? fallback, { ...params, count })
    }

    createEffect(() => {
      if (!ready() || typeof document !== "object") return
      document.documentElement.lang = locale()
      document.documentElement.dir = direction()
      document.cookie = `oc_locale=${locale()}; Path=/; Max-Age=31536000; SameSite=Lax`
    })

    createEffect(() => {
      if (!ready()) return
      props.onNativeTranslations?.(
        createDesktopNativeBundle(locale(), (key) => (current() as Record<string, string>)[key] ?? DESKTOP_NATIVE_ENGLISH[key]),
      )
    })

    return {
      ready,
      locale,
      intl: locale,
      direction,
      layoutLocale: createMemo(() => (direction() === "rtl" ? "ar" : locale())),
      locales: ["en", "ko"] as const,
      label: (value: Locale) => value === "ko" ? "한국어" : "English",
      t,
      plural,
      tOptional: (key: keyof Dictionary, params?: Record<string, string | number | boolean>) => {
        const value = (current() as Record<string, string>)[key]
        if (value === undefined || value === (dictionaries.en as Record<string, string>)[key]) return undefined
        return resolveTemplate(value, params)
      },
      setLocale: (next: Locale) => setStore("locale", normalizeLocale(next)),
      setDirection: (next: Direction) => setLayout("direction", next),
    }
  },
})
