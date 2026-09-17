export type ReportRecord = {
  metric?: string
  value?: number
  quant_type?: string
  ap_type?: string
  device?: { soc?: string; marketing_name?: string }
}

export function benchmark(records: ReportRecord[]) {
  const tps = records.filter(
    (r) =>
      r.metric === "tps" &&
      typeof r.value === "number" &&
      Number.isFinite(r.value) &&
      r.value >= 0 &&
      /^SM\d+$/i.test(r.device?.soc ?? "") &&
      /^(cpu|gpu|npu)$/i.test(r.ap_type ?? ""),
  )
  // Q4 only: one best measured value per SoC across all accelerators.
  const quantization = "q4_k_m"
  const grouped = new Map<string, { label: string; accelerator: string; value: number }>()
  for (const record of tps.filter((r) => r.quant_type === quantization)) {
    const label = record.device!.soc!
    const accelerator = "Q4 (q4_k_m)"
    const key = label
    if (!grouped.has(key) || record.value! > grouped.get(key)!.value)
      grouped.set(key, { label, accelerator, value: record.value! })
  }
  const points = [...grouped.values()].sort(
    (a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }) || a.accelerator.localeCompare(b.accelerator),
  )
  return { quantization, points }
}
