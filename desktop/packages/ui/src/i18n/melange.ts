import type { UiI18nKey } from "../context/i18n"

export const MELANGE_MODEL_CARDS = {
  "zetic/LFM3-1.7B": {
    name: "LFM3-1.7B",
    summaryKey: "ui.melange.model.summary.lfm3_17b",
  },
  "zetic/LFM3-VL-2B": {
    name: "LFM3-VL-2B",
    summaryKey: "ui.melange.model.summary.lfm3_vl_2b",
  },
  "zetic/LFM3-Audio-2B": {
    name: "LFM3-Audio-2B",
    summaryKey: "ui.melange.model.summary.lfm3_audio_2b",
  },
  "zetic/LFM3-Omni-2B": {
    name: "LFM3-Omni-2B",
    summaryKey: "ui.melange.model.summary.lfm3_omni_2b",
  },
  "zetic/d1-2B": {
    name: "d1-2B",
    summaryKey: "ui.melange.model.summary.d1_2b",
  },
  "zetic/d1-Omni-2B": {
    name: "d1-Omni-2B",
    summaryKey: "ui.melange.model.summary.d1_omni_2b",
  },
} as const satisfies Record<string, { name: string; summaryKey: UiI18nKey }>

export type MelangeModelID = keyof typeof MELANGE_MODEL_CARDS
export type MelangeModelSummaryKey = (typeof MELANGE_MODEL_CARDS)[MelangeModelID]["summaryKey"]

export function melangeModelSummaryKey(id: string): MelangeModelSummaryKey | undefined {
  return MELANGE_MODEL_CARDS[id as MelangeModelID]?.summaryKey
}

export function melangeModelForQuestionOption(label: string) {
  const recommended = label.endsWith(" (Recommended)")
  const name = recommended ? label.slice(0, -" (Recommended)".length) : label
  const entry = Object.entries(MELANGE_MODEL_CARDS).find(([, card]) => card.name === name)
  if (!entry) return
  const [id, card] = entry as [MelangeModelID, (typeof MELANGE_MODEL_CARDS)[MelangeModelID]]
  return { id, name: card.name, recommended }
}
