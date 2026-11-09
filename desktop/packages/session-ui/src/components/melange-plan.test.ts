import { describe, expect, test } from "bun:test"
import {
  melangeAppPlanDisplay,
  melangeModelDisplay,
  readMelangeAppPlan,
  readMelangeSelectedModel,
} from "./melange-plan"

describe("Melange demo metadata", () => {
  test("reads the planned app fields used by the review card", () => {
    expect(
      readMelangeAppPlan({
        phase: "planned",
        appName: "Home appliance manager",
        summary: "Control home devices from a phone.",
        features: ["Toggle a room light"],
        screens: ["Home", "Room controls"],
        deviceRoles: [{ device: "Phone", responsibilities: ["Send requests"] }],
        selectedModel: {
          id: "zetic/LFM3-1.7B",
          name: "LFM3-1.7B",
          description: "Local text model",
          benchmarkStatus: "available",
          benchmarkCharts: [
            {
              title: "Throughput",
              metric: "throughput",
              unit: "tokens/s",
              quantization: "Q4_K_M",
              points: [{ label: "NPU", accelerator: "Snapdragon X Elite", value: 28.5 }],
            },
          ],
        },
      }),
    ).toEqual({
      appName: "Home appliance manager",
      summary: "Control home devices from a phone.",
      features: ["Toggle a room light"],
      screens: ["Home", "Room controls"],
      deviceRoles: [{ device: "Phone", responsibilities: ["Send requests"] }],
      selectedModel: {
        id: "zetic/LFM3-1.7B",
        name: "LFM3-1.7B",
        description: "Local text model",
        capabilities: [],
        benchmarkStatus: "available",
        benchmarkCharts: [
          {
            title: "Throughput",
            metric: "throughput",
            unit: "tokens/s",
            quantization: "Q4_K_M",
            points: [{ label: "NPU", accelerator: "Snapdragon X Elite", value: 28.5 }],
          },
        ],
        benchmarkNote: undefined,
      },
    })
  })

  test("waits for a planned phase with complete selected-model data", () => {
    expect(readMelangeAppPlan({ phase: "planning", appName: "Home appliance manager" })).toBeUndefined()
    expect(
      readMelangeAppPlan({ phase: "planned", appName: "Home appliance manager", summary: "Ready", selectedModel: {} }),
    ).toBeUndefined()
  })

  test("retains the selected deployed model name, description, and capabilities", () => {
    expect(
      readMelangeSelectedModel({
        phase: "selected",
        model: "zetic/LFM3-1.7B",
        modelName: "LFM3-1.7B",
        description: "On-device instruction following.",
        capabilities: ["Text generation", "Tool use"],
        benchmarkStatus: "unavailable",
        benchmarkNote: "Benchmark report unavailable.",
      }),
    ).toEqual({
      id: "zetic/LFM3-1.7B",
      name: "LFM3-1.7B",
      description: "On-device instruction following.",
      capabilities: ["Text generation", "Tool use"],
      benchmarkStatus: "unavailable",
      benchmarkCharts: [],
      benchmarkNote: "Benchmark report unavailable.",
    })
  })

  test("prefers the full deployed model identifier over an internal key", () => {
    expect(
      readMelangeSelectedModel({ phase: "selected", model: "zetic/d1-2B", modelKey: "internal-version-hash" }),
    ).toMatchObject({ id: "zetic/d1-2B", name: "zetic/d1-2B" })
  })

  test("maps the full plan into translated review sections and preserves reported charts", () => {
    const plan = readMelangeAppPlan({
      phase: "planned",
      appName: "Home appliance manager",
      summary: "Phone control for home devices.",
      features: ["Toggle a light"],
      screens: ["Home"],
      deviceRoles: [{ device: "Phone", responsibilities: ["Send commands"] }],
      selectedModel: {
        id: "zetic/LFM3-1.7B",
        name: "LFM3-1.7B",
        description: "On-device text model.",
        benchmarkStatus: "available",
        benchmarkCharts: [
          {
            title: "Throughput",
            metric: "throughput",
            unit: "tokens/s",
            quantization: "Q4_K_M",
            points: [{ label: "NPU", accelerator: "Snapdragon X Elite", value: 28.5 }],
          },
        ],
      },
    })!
    const labels = {
      "ui.melange.plan.stopBeforeBuild": "Before build",
      "ui.melange.plan.summary": "Summary",
      "ui.melange.plan.features": "Features",
      "ui.melange.plan.screens": "Screens",
      "ui.melange.plan.deviceRoles": "Device roles",
      "ui.melange.plan.selectedModel": "Selected model",
      "ui.melange.model.description": "Description",
      "ui.melange.model.capabilities": "Capabilities",
      "ui.melange.model.benchmark": "Verified performance report",
      "ui.melange.model.viewBenchmarks": "View benchmark measurements",
      "ui.melange.model.benchmarkUnavailable": "No verified benchmark report is available for this model.",
    }
    const display = melangeAppPlanDisplay(plan, (key) => labels[key])
    const modelDisplay = melangeModelDisplay(plan.selectedModel, (key) => labels[key])

    expect(display).toMatchObject({
      stopBeforeBuild: "Before build",
      summary: { label: "Summary", text: "Phone control for home devices." },
      features: { label: "Features", items: ["Toggle a light"] },
      screens: { label: "Screens", items: ["Home"] },
      deviceRoles: { label: "Device roles", items: [{ device: "Phone", responsibilities: ["Send commands"] }] },
      selectedModel: { label: "Selected model", model: { name: "LFM3-1.7B", id: "zetic/LFM3-1.7B" } },
    })
    expect(modelDisplay.benchmarkLabel).toBe("Verified performance report")
    expect(modelDisplay.benchmarkCharts).toHaveLength(1)
    expect(modelDisplay.benchmarkCharts[0]?.points[0]).toEqual({
      label: "NPU",
      accelerator: "Snapdragon X Elite",
      value: 28.5,
    })
  })

  test("does not create a chart when the model has no report", () => {
    const model = readMelangeSelectedModel({
      phase: "selected",
      model: "zetic/d1-2B",
      modelName: "d1-2B",
      description: "On-device reasoning model.",
      benchmarkStatus: "unavailable",
      benchmarkNote: "No performance data is available for this model.",
    })!
    const labels = {
      "ui.melange.plan.stopBeforeBuild": "Before build",
      "ui.melange.plan.summary": "Summary",
      "ui.melange.plan.features": "Features",
      "ui.melange.plan.screens": "Screens",
      "ui.melange.plan.deviceRoles": "Device roles",
      "ui.melange.plan.selectedModel": "Selected model",
      "ui.melange.model.description": "Description",
      "ui.melange.model.capabilities": "Capabilities",
      "ui.melange.model.benchmark": "Verified performance report",
      "ui.melange.model.viewBenchmarks": "View benchmark measurements",
      "ui.melange.model.benchmarkUnavailable": "No verified benchmark report is available for this model.",
    }
    const display = melangeModelDisplay(model, (key) => labels[key])

    expect(display.benchmarkNote).toBe("No performance data is available for this model.")
    expect(display.benchmarkCharts).toEqual([])
  })
})
