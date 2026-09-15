import { $ } from "bun"
import { downloadCliToResources } from "./utils"
import { prepareMelangeQcom } from "./melange-qcom"

await $`bun run install-electron`

await $`bun ./scripts/copy-icons.ts ${process.env.OPENCODE_CHANNEL ?? "dev"}`
await prepareMelangeQcom()

await $`cd ../opencode && bun script/build-node.ts`
await downloadCliToResources()
