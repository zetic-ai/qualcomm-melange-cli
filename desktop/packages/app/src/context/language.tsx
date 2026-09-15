import * as i18n from "@solid-primitives/i18n"
import { createEffect, createMemo, createSignal } from "solid-js"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { pluralCategory, type UiI18nPluralKey } from "@opencode-ai/ui/context/i18n"
import { dict as en } from "@/i18n/en"
import { dict as uiEn } from "@opencode-ai/ui/i18n/en"
import { createDesktopNativeBundle, DESKTOP_NATIVE_ENGLISH, type DesktopNativeBundle } from "@/i18n/desktop-native"

export type Locale = "en"
export type Direction = "ltr" | "rtl"

type RawDictionary = typeof en & typeof uiEn
type Dictionary = i18n.Flatten<RawDictionary>
type PluralKey =
  UiI18nPluralKey | "session.question.pending" | "session.followupDock.summary" | "session.revertDock.summary"

const base = i18n.flatten({ ...en, ...uiEn })

export function loadLocaleDict(_locale: Locale) {
  return Promise.resolve()
}

export function normalizeLocale(_value: string): Locale {
  return "en"
}

export function loadInitialLocale() {
  return Promise.resolve("en" as const)
}

export const { use: useLanguage, provider: LanguageProvider } = createSimpleContext({
  name: "Language",
  gate: false,
  init: (props: { locale?: Locale; onNativeTranslations?: (bundle: DesktopNativeBundle) => void }) => {
    const locale = () => "en" as const
    const intl = () => "en"
    const [direction, setDirection] = createSignal<Direction>("ltr")
    const t = i18n.translator(() => base, i18n.resolveTemplate) as (
      key: keyof Dictionary,
      params?: Record<string, string | number | boolean>,
    ) => string

    const plural = (key: PluralKey, count: number, params?: Record<string, string | number | boolean>) => {
      const current = base as Record<string, string>
      const candidate = `${key}.${pluralCategory("en", count)}`
      const fallback = `${key}.other`
      return i18n.resolveTemplate(current[candidate] ?? current[fallback] ?? fallback, { ...params, count })
    }

    createEffect(() => {
      if (typeof document !== "object") return
      document.documentElement.lang = "en"
      document.documentElement.dir = direction()
      document.cookie = "oc_locale=en; Path=/; Max-Age=31536000; SameSite=Lax"
    })

    createEffect(() => {
      props.onNativeTranslations?.(
        createDesktopNativeBundle("en", (key) => (base as Record<string, string>)[key] ?? DESKTOP_NATIVE_ENGLISH[key]),
      )
    })

    return {
      ready: () => true,
      locale,
      intl,
      direction,
      layoutLocale: createMemo(() => (direction() === "rtl" ? "ar" : "en")),
      locales: ["en"] as const,
      label: (_value: Locale) => "English",
      t,
      plural,
      setLocale: (_next: Locale) => undefined,
      setDirection,
    }
  },
})
