import { expect, test } from "bun:test"
import type { Configuration } from "electron-builder"
import config from "./electron-builder.config"

const value = config as Configuration

test("packages a stable unsigned Apple Silicon Melange Agent", () => {
  expect(value.appId).toBe("ai.zetic.melange-agent")
  expect(value.productName).toBe("Melange Agent")
  expect(value.artifactName).toBe("melange-agent-${os}-${arch}.${ext}")
  expect(value.protocols).toEqual({ name: "Melange Agent", schemes: ["melange-agent"] })
  expect(value.mac?.identity).toBeNull()
  expect(value.mac?.target).toEqual([
    { target: "dmg", arch: ["arm64"] },
    { target: "zip", arch: ["arm64"] },
  ])
  expect(value.publish).toBeUndefined()
})

test("packages the verified CLI and skill outside the app archive", () => {
  expect(value.files).toContain("!resources/melange-qcom/**")
  expect(value.extraResources).toContainEqual({ from: "resources/melange-qcom", to: "melange-qcom" })
})
