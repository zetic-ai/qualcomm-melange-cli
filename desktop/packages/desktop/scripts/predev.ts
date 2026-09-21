import { $ } from "bun"
import { downloadCliToResources } from "./utils"
import { prepareMelangeQcom } from "./melange-qcom"
import { ensureNativeDependencies } from "./native-deps"
import { resolveTarget } from "./target"

const target = resolveTarget()

await $`bun run install-electron`

await $`bun ./scripts/copy-icons.ts ${process.env.OPENCODE_CHANNEL ?? "dev"}`
await ensureNativeDependencies(target)
await prepareMelangeQcom(target)

await $`cd ../opencode && bun script/build-node.ts`
await downloadCliToResources()
