export type ReportRecord = {
  metric?: string
  value?: number
  quant_type?: string
  ap_type?: string
  run_configuration?: { package?: string }
  device?: { soc?: string; marketing_name?: string }
}

export function benchmark(records: ReportRecord[], model?: string) {
  const vision = model === "changgeun/LFM2.5-VL-450M"
  const tps = records.filter(
    (r) =>
      r.metric === "tps" &&
      typeof r.value === "number" &&
      Number.isFinite(r.value) &&
      r.value >= 0 &&
      /^SM\d+$/i.test(r.device?.soc ?? "") &&
      (/^(cpu|gpu|npu)$/i.test(r.ap_type ?? "") ||
        (vision && /(?:^|_)fp16(?:_|$)/i.test(r.run_configuration?.package ?? ""))),
  )
  const quantization = vision ? "fp16" : "q4_k_m"
  const precision = vision ? "FP16" : "Q4 (q4_k_m)"
  const optimized = vision ? {
    label: "SM8975 - ZETIC Optimized",
    ttftSeconds: 0.331,
    prefillTps: 3150,
    decodeTps: 65.42,
    visionOnlyMs: 45,
  } : undefined
  const details = model?.toLowerCase() === "zetic/hy-mt2-1.8b"
    ? { ttftSeconds: 0.597, prefillTps: 1714, decodeTps: 38.76 }
    : model?.toLowerCase() === "sj_zetic/lfm2.5-1.2b-instruct"
      ? { ttftSeconds: 0.221, prefillTps: 4635, decodeTps: 62.9 }
      : undefined
  const grouped = new Map<string, { label: string; accelerator: string; value: number }>()
  for (const record of tps.filter((r) => r.quant_type?.toLowerCase() === quantization ||
    (vision && /(?:^|_)fp16(?:_|$)/i.test(r.run_configuration?.package ?? "")))) {
    const label = record.device!.soc!.toUpperCase()
    const accelerator = precision
    const key = label
    if (!grouped.has(key) || record.value! > grouped.get(key)!.value)
      grouped.set(key, { label, accelerator, value: record.value! })
  }
  // Supplied demo measurement overrides this SoC only; all other points remain CLI results.
  if (vision) grouped.set("SM8975", { label: "SM8975", accelerator: precision, value: 25.41 })
  if (optimized) grouped.set(optimized.label, {
    label: optimized.label, accelerator: "ZETIC Optimized · Decode TPS", value: optimized.decodeTps,
  })
  if (details) grouped.set("SM8975 - ZETIC Optimized", {
    label: "SM8975 - ZETIC Optimized", accelerator: "ZETIC Optimized · Decode TPS", value: details.decodeTps,
  })
  const points = [...grouped.values()].sort(
    (a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }) || a.accelerator.localeCompare(b.accelerator),
  )
  const q4DecodePoints = vision ? [
    { label: "SM8250", value: 30.93 },
    { label: "SM8550", value: 94.49 },
    { label: "SM8650", value: 84.43 },
    { label: "SM8750", value: 137.12 },
    { label: "SM8850", value: 158.40 },
    { label: "SM8975", value: 180.20 },
  ].map((point) => ({ ...point, accelerator: "Q4 · ZETIC Optimized · Decode TPS" })) : []
  return { quantization, precision, points, optimized, details, q4DecodePoints }
}
