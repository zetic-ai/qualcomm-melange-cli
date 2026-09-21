#!/usr/bin/env bun
import { $ } from "bun"

import { downloadCliToResources, resolveChannel } from "./utils"
import { prepareMelangeQcom } from "./melange-qcom"
import { ensureNativeDependencies } from "./native-deps"
import { resolveTarget } from "./target"

const channel = resolveChannel()
const target = resolveTarget()
console.log(`Building Melange Agent (${channel}) for ${target.key} on ${process.platform}-${process.arch}`)

await $`bun ./scripts/copy-icons.ts ${channel}`
await ensureNativeDependencies(target)
await prepareMelangeQcom(target)

await $`cd ../opencode && bun script/build-node.ts`
if (channel === "dev") await downloadCliToResources()
