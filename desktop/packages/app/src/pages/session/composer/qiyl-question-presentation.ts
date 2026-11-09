import type { UiI18nKey, UiI18nParams } from "@opencode-ai/ui/context/i18n"
import { melangeModelForQuestionOption, melangeModelSummaryKey } from "@opencode-ai/ui/i18n/melange"

type Translate = (key: UiI18nKey, params?: UiI18nParams) => string
type TranslateOptional = (key: UiI18nKey, params?: UiI18nParams) => string | undefined

export function qiylQuestionOptionPresentation(
  label: string,
  description: string | undefined,
  t: Translate,
  tOptional: TranslateOptional,
) {
  const model = melangeModelForQuestionOption(label)
  if (!model) return { label, description }

  const displayLabel = model.recommended
    ? t("ui.melange.question.recommendedOption", { model: model.name })
    : label
  if (!description) return { label: displayLabel, description }

  const summaryKey = melangeModelSummaryKey(model.id)
  const summary = summaryKey ? tOptional(summaryKey, { description }) : undefined
  if (!summary) return { label: displayLabel, description }

  const tagsMatch = /\sCard tags: (.+)\.$/s.exec(description)
  if (!tagsMatch) return { label: displayLabel, description: summary }

  const localizedDescription = tOptional("ui.melange.question.modelDescription", {
    description,
    summary,
    tags: tagsMatch[1]!,
  })
  return { label: displayLabel, description: localizedDescription ?? description }
}
