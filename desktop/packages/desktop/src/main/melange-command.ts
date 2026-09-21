import { join } from "node:path"

export function getMelangeBinDirectory(resourceRoot: string, platform = process.platform) {
  return join(resourceRoot, platform === "win32" ? "bin" : "launcher")
}

export function getMelangeCommandPath(resourceRoot: string, platform = process.platform) {
  return join(
    getMelangeBinDirectory(resourceRoot, platform),
    platform === "win32" ? "melange-qcom.exe" : "melange-qcom",
  )
}
