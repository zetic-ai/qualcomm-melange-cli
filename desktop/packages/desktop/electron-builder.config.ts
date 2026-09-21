import type { Configuration } from "electron-builder"

const config: Configuration = {
  appId: "ai.zetic.melange-agent",
  productName: "Melange Agent",
  artifactName: "melange-agent-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  files: [
    "out/**/*",
    "resources/**/*",
    "!resources/linux/**",
    "!resources/*.metainfo.xml",
    "!resources/opencode-cli*",
    "!resources/melange-qcom/**",
  ],
  extraResources: [
    {
      from: "resources/melange-qcom",
      to: "melange-qcom",
    },
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: "resources/icons/icon.icns",
    hardenedRuntime: false,
    gatekeeperAssess: false,
    identity: null,
    target: [
      { target: "dmg", arch: ["arm64"] },
      { target: "zip", arch: ["arm64"] },
    ],
  },
  win: {
    icon: "resources/icons/icon.ico",
    target: [{ target: "portable", arch: ["x64"] }],
  },
  dmg: { sign: false },
  protocols: {
    name: "Melange Agent",
    schemes: ["melange-agent"],
  },
}

export default config
