const NODE_PTY_TARGETS: Record<string, string> = {
  "aarch64-apple-darwin": "@lydell/node-pty-darwin-arm64",
  "x86_64-apple-darwin": "@lydell/node-pty-darwin-x64",
  "aarch64-pc-windows-msvc": "@lydell/node-pty-win32-arm64",
  "x86_64-pc-windows-msvc": "@lydell/node-pty-win32-x64",
  "aarch64-unknown-linux-gnu": "@lydell/node-pty-linux-arm64",
  "x86_64-unknown-linux-gnu": "@lydell/node-pty-linux-x64",
}

export function getNodePtyPackage(target = process.env.RUST_TARGET, platform = process.platform, arch = process.arch) {
  if (target) {
    const packageName = NODE_PTY_TARGETS[target]
    if (!packageName) throw new Error(`PTY package is not available for target '${target}'`)
    return packageName
  }
  return `@lydell/node-pty-${platform}-${arch}`
}
