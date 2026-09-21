#!/usr/bin/env bun
// Build and package Melange Agent for one target in a single, consistent run.
//
//   bun run dist:mac                 # darwin-arm64 (the build host)
//   bun run dist:win                 # win32-arm64 (Snapdragon X laptops)
//   bun run dist:win --arch x64      # win32-x64
//
// `bun run build` followed by `bun run package:win` also works, but both stages
// must then be given the same MELANGE_TARGET_OS / MELANGE_TARGET_ARCH values.
import { $ } from "bun"

import { TARGET_ARCH_ENV, TARGET_OS_ENV, targetFor } from "./target"

const [os = "", ...rest] = process.argv.slice(2)
const flag = rest.indexOf("--arch")
const arch = flag >= 0 ? (rest[flag + 1] ?? "") : os === "win32" ? "arm64" : process.arch
const target = targetFor(os, arch)

const env = { ...process.env, [TARGET_OS_ENV]: target.os, [TARGET_ARCH_ENV]: target.arch }
const script = target.os === "win32" ? "package:win" : "package:mac"

console.log(`Melange Agent: build + package for ${target.key}`)
await $`bun run build`.env(env)
await $`bun run ${script}`.env(env)
