import { expect, test } from "bun:test"
import { benchmark } from "./melange-benchmark"

test("shows only the fastest Q4 result per SoC across accelerators", () => {
  const record = (soc: string, ap_type: string, value: number, quant_type = "q4_k_m") => ({
    device: { soc },
    ap_type,
    value,
    quant_type,
    metric: "tps",
  })
  const result = benchmark([
    record("SM6475", "cpu", 10),
    record("SM8550", "cpu", 20),
    record("SM8550", "npu", 30),
    record("SM8550", "gpu", 25),
    record("SM8550", "npu", 32),
    record("SM8550", "npu", 99, "q8_0"),
    record("OTHER", "cpu", 100),
    record("SM8750", "npu", NaN),
  ])
  expect(result.quantization).toBe("q4_k_m")
  expect(result.points).toEqual([
    { label: "SM6475", accelerator: "Q4 (q4_k_m)", value: 10 },
    { label: "SM8550", accelerator: "Q4 (q4_k_m)", value: 32 },
  ])
  expect(benchmark([]).points).toEqual([])
  expect(benchmark([record("SM8550", "npu", 99, "q8_0")]).points).toEqual([])
})

test("vision merges supplied SM8975 with CLI FP16 package TPS without changing other models", () => {
  const record = (soc: string, value: number, pkg = "tflite_fp16_test") => ({
    device: { soc }, value, metric: "tps", run_configuration: { package: pkg },
  })
  const records = [record("sm8750", 18), record("SM8750", 20), record("SM8550", 12),
    record("SM8975", 99), record("SM8750", 100, "tflite_q4_test"), record("Tensor G5", 30),
    { ...record("SM8650", 4.386262154229925e261), metric: "perplexity" }]
  const result = benchmark(records, "changgeun/LFM2.5-VL-450M")
  expect(result.quantization).toBe("fp16")
  expect(result.precision).toBe("FP16")
  expect(result.points).toEqual([
    { label: "SM8550", accelerator: "FP16", value: 12 },
    { label: "SM8750", accelerator: "FP16", value: 20 },
    { label: "SM8975", accelerator: "FP16", value: 25.41 },
    { label: "SM8975 - ZETIC Optimized", accelerator: "ZETIC Optimized · Decode TPS", value: 65.42 },
  ])
  expect(benchmark(records, "other/model").points).toEqual([])
  expect(benchmark(records, "other/model").quantization).toBe("q4_k_m")
  expect(result.optimized?.decodeTps).toBe(65.42)
  expect(result.q4DecodePoints.every((point) => point.accelerator.includes("ZETIC Optimized"))).toBe(true)
  expect(result.q4DecodePoints.map(({ label, value }) => [label, value])).toEqual([
    ["SM8250", 30.93], ["SM8550", 94.49], ["SM8650", 84.43],
    ["SM8750", 137.12], ["SM8850", 158.40], ["SM8975", 180.20],
  ])
  expect(benchmark(records, "other/model").q4DecodePoints).toEqual([])
})
