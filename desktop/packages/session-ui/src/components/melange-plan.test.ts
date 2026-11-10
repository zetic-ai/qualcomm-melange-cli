import { describe, expect, test } from "bun:test"
import {
  melangeAppPlanDisplay,
  melangeImplementationApprovalDisplay,
  melangeModelDisplay,
  readMelangeAppPlan,
  readMelangeImplementationApproval,
  readMelangeSelectedModel,
} from "./melange-plan"

describe("Melange demo metadata", () => {
  test("projects only approval state and app name without exposing internal bindings", () => {
    expect(readMelangeImplementationApproval({
      phase: "implementation_approved",
      planId: "internal-plan-id",
      featureConfirmationId: "internal-confirmation-id",
      selectionId: "internal-selection-id",
      model: "zetic/d1-2B",
      appName: "Home appliance manager",
    })).toEqual({ phase: "approved", appName: "Home appliance manager" })
    expect(readMelangeImplementationApproval({ phase: "implementation_declined" })).toEqual({ phase: "declined" })
    expect(readMelangeImplementationApproval({}, "running")).toEqual({ phase: "pending" })
    expect(readMelangeImplementationApproval({ phase: "planned" }, "error")).toEqual({ phase: "unavailable" })
  })

  test("uses phase-accurate approval copy for approval, decline, pending, and failure", () => {
    const labels = {
      "ui.melange.implementation.approved": "App implementation approved",
      "ui.melange.implementation.approvedDescription":
        "Implementation and building follow the approved app plan.",
      "ui.melange.implementation.declined": "App implementation not started",
      "ui.melange.implementation.declinedDescription": "You can revise the app plan before approving implementation.",
      "ui.melange.implementation.pending": "Confirm app implementation",
      "ui.melange.implementation.pendingDescription": "Waiting for confirmation to start app implementation.",
      "ui.melange.implementation.unavailable": "Implementation approval not confirmed",
      "ui.melange.implementation.unavailableDescription": "The approval result is unavailable.",
    }
    const t = (key: string) => labels[key as keyof typeof labels]
    expect(melangeImplementationApprovalDisplay({ phase: "approved" }, t)).toEqual({
      title: "App implementation approved",
      description: "Implementation and building follow the approved app plan.",
    })
    expect(melangeImplementationApprovalDisplay({ phase: "declined" }, t).title).toBe("App implementation not started")
    expect(melangeImplementationApprovalDisplay({ phase: "pending" }, t).title).toBe("Confirm app implementation")
    expect(melangeImplementationApprovalDisplay({ phase: "unavailable" }, t).title).toBe("Implementation approval not confirmed")
  })

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
      "ui.melange.plan.stopBeforeBuild": "Implementation starts only after approval",
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
    const display = melangeAppPlanDisplay(plan, (key) => labels[key as keyof typeof labels])
    const modelDisplay = melangeModelDisplay(plan.selectedModel, (key) => labels[key as keyof typeof labels])

    expect(display).toMatchObject({
      stopBeforeBuild: "Implementation starts only after approval",
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
      "ui.melange.plan.stopBeforeBuild": "Implementation starts only after approval",
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
    const display = melangeModelDisplay(model, (key) => labels[key as keyof typeof labels])

    expect(display.benchmarkNote).toBe("No performance data is available for this model.")
    expect(display.benchmarkCharts).toEqual([])
  })

  test("uses localized model summaries and benchmark presentation without replacing source metadata", () => {
    const description =
      "Liquid AI LFM3 text model for local agents and specialized applications, with a 256K-token context window and tool calling. Learn more on: https://huggingface.co/LiquidAI/LFM3-1.7B"
    const model = readMelangeSelectedModel({
      phase: "selected",
      model: "zetic/LFM3-1.7B",
      modelName: "LFM3-1.7B",
      description,
      capabilities: ["text-generation"],
      benchmarkStatus: "available",
      benchmarkCharts: [
        {
          title: "LFM3-1.7B — Qualcomm throughput · Q4_0",
          metric: "throughput",
          unit: "tokens/s",
          quantization: "Q4_0",
          points: [{ label: "SM8650", accelerator: "NPU", value: 51 }],
        },
      ],
      benchmarkNote:
        "Each chart keeps a reported quantization separate; each point is the highest returned tokens/s measurement per Qualcomm SoC and accelerator type.",
    })!
    const translate = (key: string, params?: Record<string, string | number | boolean>) => {
      const labels: Record<string, string> = {
        "ui.melange.model.description": "모델 설명",
        "ui.melange.model.capabilities": "지원 기능",
        "ui.melange.model.benchmark": "검증된 성능 측정 결과",
        "ui.melange.model.viewBenchmarks": "벤치마크 결과 보기",
        "ui.melange.model.description.source": "원본 모델 카드 설명",
        "ui.melange.model.benchmark.note.available": "양자화 방식별 측정 결과입니다.",
      }
      if (key === "ui.melange.model.benchmark.title.throughput")
        return `${params?.model} — Qualcomm 처리량 · ${params?.quantization}`
      return labels[key] ?? key
    }
    const tOptional = (key: string) => {
      if (key === "ui.melange.model.summary.lfm3_17b") return "256K 토큰 컨텍스트 창과 도구 호출을 지원하는 텍스트 모델입니다."
      if (key === "ui.melange.model.benchmark.note.available") return "양자화 방식별 측정 결과입니다."
      if (key === "ui.melange.model.benchmark.title.throughput")
        return "LFM3-1.7B — Qualcomm 처리량 · Q4_0"
      return undefined
    }
    const display = melangeModelDisplay(model, translate, tOptional)

    expect(display.description).toBe("256K 토큰 컨텍스트 창과 도구 호출을 지원하는 텍스트 모델입니다.")
    expect(display.sourceDescription).toBe(description)
    expect(display.sourceDescriptionLabel).toBe("원본 모델 카드 설명")
    expect(display.benchmarkNote).toBe("양자화 방식별 측정 결과입니다.")
    expect(display.benchmarkCharts[0]).toMatchObject({
      title: "LFM3-1.7B — Qualcomm throughput · Q4_0",
      displayTitle: "LFM3-1.7B — Qualcomm 처리량 · Q4_0",
      quantization: "Q4_0",
      points: [{ label: "SM8650", accelerator: "NPU", value: 51 }],
    })
    expect(model.description).toBe(description)
  })

  test("localizes known benchmark unavailability reasons and leaves English source values unchanged", () => {
    const model = readMelangeSelectedModel({
      phase: "selected",
      model: "zetic/d1-2B",
      modelName: "d1-2B",
      description: "Canonical model-card description.",
      benchmarkStatus: "unavailable",
      benchmarkNote: "A Melange performance report could not be retrieved; no benchmark claim is available.",
    })!
    const t = (key: string) => key === "ui.melange.model.benchmarkUnavailable" ? "No verified benchmark report is available for this model." : key
    const translated = melangeModelDisplay(model, t, (key) =>
      key === "ui.melange.model.benchmark.note.reportUnavailable"
        ? "Melange 성능 보고서를 가져오지 못했습니다."
        : undefined,
    )
    const english = melangeModelDisplay(model, t, () => undefined)

    expect(translated.benchmarkNote).toBe("Melange 성능 보고서를 가져오지 못했습니다.")
    expect(english.benchmarkNote).toBe(model.benchmarkNote)
    expect(english.description).toBe(model.description)
    expect(english.sourceDescription).toBeUndefined()
    expect(model.benchmarkNote).toBe("A Melange performance report could not be retrieved; no benchmark claim is available.")
  })
})
