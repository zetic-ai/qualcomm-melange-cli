import { createMemo, For, Show } from "solid-js"
import type { UiI18nKey, UiI18nParams } from "@opencode-ai/ui/context/i18n"
import { useI18n } from "@opencode-ai/ui/context/i18n"
import { melangeModelSummaryKey, type MelangeModelSummaryKey } from "@opencode-ai/ui/i18n/melange"

export type MelangeAppPlan = {
  appName: string
  summary: string
  features: string[]
  screens: string[]
  deviceRoles: Array<{ device: string; responsibilities: string[] }>
  selectedModel: MelangeModel
}

export type MelangeBenchmarkChart = {
  title: string
  displayTitle?: string
  metric: string
  unit: string
  quantization: string
  points: Array<{ label: string; accelerator: string; value: number }>
}

export type MelangeModel = {
  id: string
  name: string
  description: string
  capabilities: string[]
  benchmarkStatus?: "available" | "unavailable"
  benchmarkCharts: MelangeBenchmarkChart[]
  benchmarkNote?: string
}

type MelangeLabelKey =
  | "ui.melange.plan.stopBeforeBuild"
  | "ui.melange.plan.summary"
  | "ui.melange.plan.features"
  | "ui.melange.plan.screens"
  | "ui.melange.plan.deviceRoles"
  | "ui.melange.plan.selectedModel"
  | "ui.melange.model.description"
  | "ui.melange.model.capabilities"
  | "ui.melange.model.benchmark"
  | "ui.melange.model.viewBenchmarks"
  | "ui.melange.model.benchmarkUnavailable"
  | "ui.melange.model.description.source"
  | "ui.melange.model.benchmark.title.throughput"
  | "ui.melange.model.benchmark.note.available"
  | "ui.melange.model.benchmark.note.noReadyModel"
  | "ui.melange.model.benchmark.note.noMeasurements"
  | "ui.melange.model.benchmark.note.reportUnavailable"

type MelangeTranslationKey = MelangeLabelKey | MelangeModelSummaryKey
type TranslateMelange = (key: MelangeTranslationKey, params?: UiI18nParams) => string
type TranslateOptionalMelange = (key: UiI18nKey, params?: UiI18nParams) => string | undefined

const benchmarkNotes = {
  "Each chart keeps a reported quantization separate; each point is the highest returned tokens/s measurement per Qualcomm SoC and accelerator type.":
    "ui.melange.model.benchmark.note.available",
  "No ready Melange model version was returned; performance data is unavailable.":
    "ui.melange.model.benchmark.note.noReadyModel",
  "No Qualcomm throughput measurements were returned for this model.":
    "ui.melange.model.benchmark.note.noMeasurements",
  "A Melange performance report could not be retrieved; no benchmark claim is available.":
    "ui.melange.model.benchmark.note.reportUnavailable",
} as const satisfies Record<string, MelangeLabelKey>

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function benchmarkCharts(value: unknown): MelangeBenchmarkChart[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const chart = item as Record<string, unknown>
    if (
      typeof chart.title !== "string" ||
      typeof chart.metric !== "string" ||
      typeof chart.unit !== "string" ||
      typeof chart.quantization !== "string" ||
      !Array.isArray(chart.points)
    )
      return []
    const points = chart.points.flatMap((point) => {
      if (!point || typeof point !== "object") return []
      const value = point as Record<string, unknown>
      if (
        typeof value.label !== "string" ||
        typeof value.accelerator !== "string" ||
        typeof value.value !== "number" ||
        !Number.isFinite(value.value)
      )
        return []
      return [{ label: value.label, accelerator: value.accelerator, value: value.value }]
    })
    return [{
      title: chart.title,
      metric: chart.metric,
      unit: chart.unit,
      quantization: chart.quantization,
      points,
    }]
  })
}

function melangeModel(value: unknown): MelangeModel | undefined {
  if (!value || typeof value !== "object") return
  const model = value as Record<string, unknown>
  if (typeof model.id !== "string" || typeof model.name !== "string" || typeof model.description !== "string") return
  return {
    id: model.id,
    name: model.name,
    description: model.description,
    capabilities: stringList(model.capabilities),
    benchmarkStatus:
      model.benchmarkStatus === "available" || model.benchmarkStatus === "unavailable" ? model.benchmarkStatus : undefined,
    benchmarkCharts: benchmarkCharts(model.benchmarkCharts),
    benchmarkNote: typeof model.benchmarkNote === "string" ? model.benchmarkNote : undefined,
  }
}

export function readMelangeAppPlan(metadata: Record<string, unknown>): MelangeAppPlan | undefined {
  if (metadata.phase !== "planned") return
  const selectedModel = melangeModel(metadata.selectedModel)
  if (typeof metadata.appName !== "string" || typeof metadata.summary !== "string" || !selectedModel) return

  const deviceRoles = Array.isArray(metadata.deviceRoles)
    ? metadata.deviceRoles.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const role = item as Record<string, unknown>
        if (typeof role.device !== "string") return []
        return [{ device: role.device, responsibilities: stringList(role.responsibilities) }]
      })
    : []

  return {
    appName: metadata.appName,
    summary: metadata.summary,
    features: stringList(metadata.features),
    screens: stringList(metadata.screens),
    deviceRoles,
    selectedModel,
  }
}

export function readMelangeSelectedModel(metadata: Record<string, unknown>): MelangeModel | undefined {
  if (metadata.phase !== "selected") return
  const id = typeof metadata.model === "string" ? metadata.model : metadata.modelKey
  if (typeof id !== "string" && typeof metadata.modelName !== "string") return
  return {
    id: typeof id === "string" ? id : metadata.modelName as string,
    name: typeof metadata.modelName === "string" ? metadata.modelName : (id as string),
    description: typeof metadata.description === "string" ? metadata.description : "",
    capabilities: stringList(metadata.capabilities),
    benchmarkStatus: (
      metadata.benchmarkStatus === "available" || metadata.benchmarkStatus === "unavailable"
        ? metadata.benchmarkStatus
        : undefined
    ) as MelangeModel["benchmarkStatus"],
    benchmarkCharts: benchmarkCharts(metadata.benchmarkCharts),
    benchmarkNote: typeof metadata.benchmarkNote === "string" ? metadata.benchmarkNote : undefined,
  }
}

export function melangeModelDisplay(
  model: MelangeModel,
  t: TranslateMelange,
  tOptional?: TranslateOptionalMelange,
) {
  const summaryKey = melangeModelSummaryKey(model.id)
  const localizedDescription = summaryKey ? tOptional?.(summaryKey, { description: model.description }) : undefined
  const noteKey = model.benchmarkNote ? benchmarkNotes[model.benchmarkNote as keyof typeof benchmarkNotes] : undefined
  const localizedBenchmarkNote = noteKey ? tOptional?.(noteKey) : undefined
  const benchmarkNoteDisplay =
    localizedBenchmarkNote ??
    (model.benchmarkStatus === "unavailable"
      ? model.benchmarkNote || t("ui.melange.model.benchmarkUnavailable")
      : model.benchmarkNote)
  return {
    descriptionLabel: t("ui.melange.model.description"),
    description: localizedDescription ?? model.description,
    sourceDescriptionLabel: localizedDescription ? t("ui.melange.model.description.source") : undefined,
    sourceDescription: localizedDescription ? model.description : undefined,
    capabilitiesLabel: t("ui.melange.model.capabilities"),
    benchmarkLabel: t("ui.melange.model.benchmark"),
    viewBenchmarksLabel: t("ui.melange.model.viewBenchmarks"),
    benchmarkNote: benchmarkNoteDisplay,
    localizedBenchmarkNote,
    benchmarkCharts: model.benchmarkCharts.map((chart) => ({
      ...chart,
      displayTitle:
        tOptional?.("ui.melange.model.benchmark.title.throughput", {
          model: model.name,
          quantization: chart.quantization,
        }) ?? undefined,
    })),
  }
}

export function melangeAppPlanDisplay(plan: MelangeAppPlan, t: TranslateMelange) {
  return {
    stopBeforeBuild: t("ui.melange.plan.stopBeforeBuild"),
    summary: { label: t("ui.melange.plan.summary"), text: plan.summary },
    features: { label: t("ui.melange.plan.features"), items: plan.features },
    screens: { label: t("ui.melange.plan.screens"), items: plan.screens },
    deviceRoles: { label: t("ui.melange.plan.deviceRoles"), items: plan.deviceRoles },
    selectedModel: { label: t("ui.melange.plan.selectedModel"), model: plan.selectedModel },
  }
}

export function MelangeModelDetails(props: { model: MelangeModel; includeName?: boolean; benchmarkGraphs?: boolean }) {
  const i18n = useI18n()
  const display = createMemo(() => melangeModelDisplay(props.model, i18n.t, i18n.tOptional))
  const max = (points: MelangeBenchmarkChart["points"]) => Math.max(1, ...points.map((point) => point.value))
  return (
    <div data-component="melange-model-details" class="flex flex-col gap-3">
      <Show when={props.includeName}>
        <div>
          <strong>{props.model.name}</strong>
          <code class="mt-1 block text-12-regular">{props.model.id}</code>
        </div>
      </Show>
      <Show when={props.model.description}>
        <section>
          <h3 class="text-12-medium text-text-weak">{display().descriptionLabel}</h3>
          <p class="mt-1 whitespace-pre-wrap">{display().description}</p>
          <Show when={display().sourceDescription}>
            <details data-component="melange-model-source" class="mt-2 text-12-regular text-text-weak">
              <summary class="cursor-pointer">{display().sourceDescriptionLabel}</summary>
              <p class="mt-1 whitespace-pre-wrap">{display().sourceDescription}</p>
            </details>
          </Show>
        </section>
      </Show>
      <Show when={props.model.capabilities.length > 0}>
        <section>
          <h3 class="text-12-medium text-text-weak">{display().capabilitiesLabel}</h3>
          <ul class="mt-1 list-disc pl-5">
            <For each={props.model.capabilities}>{(capability) => <li>{capability}</li>}</For>
          </ul>
        </section>
      </Show>
      <Show
        when={
          props.model.benchmarkStatus === "unavailable" ||
          (props.model.benchmarkStatus === "available" && props.model.benchmarkCharts.length === 0)
        }
      >
        <p data-slot="melange-benchmark-unavailable" class="text-text-weak">
          {display().benchmarkNote}
        </p>
      </Show>
      <Show when={props.benchmarkGraphs !== false && display().benchmarkCharts.length > 0}>
        <details data-component="melange-benchmarks" class="rounded-md bg-surface-raised-base px-3 py-2">
          <summary class="cursor-pointer text-12-medium text-text-weak">
            {display().viewBenchmarksLabel} ({display().benchmarkCharts.length})
          </summary>
          <div class="pt-2">
            <Show when={display().benchmarkNote}>
              <p data-slot="melange-benchmark-note" class="mb-2 text-12-regular text-text-weak">
                {display().benchmarkNote}
              </p>
            </Show>
            <For each={display().benchmarkCharts}>
              {(chart) => (
                <figure data-slot="melange-benchmark-chart" class="mt-2 rounded-md bg-surface-base p-3">
                  <figcaption class="text-13-medium">{chart.displayTitle ?? chart.title}</figcaption>
                  <Show when={chart.quantization}>
                    <div class="mt-1 text-12-regular text-text-weak">{chart.quantization}</div>
                  </Show>
                  <div class="mt-2 flex flex-col gap-2">
                    <For each={chart.points}>
                      {(point) => (
                        <div data-slot="melange-benchmark-point" class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                          <span class="truncate text-12-regular">{point.label} · {point.accelerator}</span>
                          <span class="text-12-medium">{point.value.toLocaleString()} {chart.unit}</span>
                          <span class="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-weak">
                            <span
                              class="block h-full rounded-full bg-icon-brand-base"
                              style={{ width: `${Math.max(0, (point.value / max(chart.points)) * 100)}%` }}
                            />
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </figure>
              )}
            </For>
          </div>
        </details>
      </Show>
    </div>
  )
}

export function MelangePlanDetails(props: { plan: MelangeAppPlan }) {
  const i18n = useI18n()
  const display = createMemo(() => melangeAppPlanDisplay(props.plan, i18n.t))
  return (
    <div data-component="melange-app-plan" class="flex flex-col gap-4 px-3 pb-3 text-14-regular">
      <div data-slot="melange-plan-status" class="rounded-md bg-surface-raised-base px-3 py-2 text-text-weak">
        {display().stopBeforeBuild}
      </div>
      <section>
        <h3 class="text-12-medium text-text-weak">{display().summary.label}</h3>
        <p class="mt-1 whitespace-pre-wrap">{display().summary.text}</p>
      </section>
      <section>
        <h3 class="text-12-medium text-text-weak">{display().features.label}</h3>
        <ul class="mt-1 list-disc pl-5"><For each={display().features.items}>{(feature) => <li>{feature}</li>}</For></ul>
      </section>
      <section>
        <h3 class="text-12-medium text-text-weak">{display().screens.label}</h3>
        <ul class="mt-1 list-disc pl-5"><For each={display().screens.items}>{(screen) => <li>{screen}</li>}</For></ul>
      </section>
      <section>
        <h3 class="text-12-medium text-text-weak">{display().deviceRoles.label}</h3>
        <For each={display().deviceRoles.items}>
          {(role) => (
            <div data-slot="melange-plan-device-role" class="mt-2">
              <strong>{role.device}</strong>
              <ul class="mt-1 list-disc pl-5">
                <For each={role.responsibilities}>{(responsibility) => <li>{responsibility}</li>}</For>
              </ul>
            </div>
          )}
        </For>
      </section>
      <section data-slot="melange-plan-model">
        <h3 class="text-12-medium text-text-weak">{display().selectedModel.label}</h3>
        <MelangeModelDetails model={display().selectedModel.model} includeName benchmarkGraphs={false} />
      </section>
    </div>
  )
}
