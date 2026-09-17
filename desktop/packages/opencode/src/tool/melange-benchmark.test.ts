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
