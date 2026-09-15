#!/usr/bin/env bun
import { $ } from "bun"

import { downloadCliToResources, resolveChannel } from "./utils"
import { prepareMelangeQcom } from "./melange-qcom"

const channel = resolveChannel()
await $`bun ./scripts/copy-icons.ts ${channel}`
await prepareMelangeQcom()

await $`cd ../opencode && bun script/build-node.ts`
if (channel === "dev") await downloadCliToResources()
