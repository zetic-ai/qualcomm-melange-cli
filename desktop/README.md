# Melange Agent

Melange Agent is the desktop coding agent for the Qualcomm Melange CLI. It
provides a graphical interface for coding, terminal, Git, file, model, and
agent workflows while making `melange-qcom` available to every agent session.

The desktop app is based on OpenCode. The pinned upstream repository and
commit are recorded in [`OPENCODE_UPSTREAM.json`](OPENCODE_UPSTREAM.json), and
the required MIT license remains in [`LICENSE`](LICENSE).

## Current support

- macOS on Apple Silicon (`arm64`)
- English user interface
- unsigned internal builds
- Qualcomm `melange-qcom` v0.10.0 bundled with the app

The app does not require a global Qualcomm Melange CLI installation and does
not write to `/usr/local/bin` or `~/.local/bin`.

## Build and install from this repository

There is no Melange Agent GitHub Release yet. Until one is published, build
and install the app from source on an Apple Silicon Mac.

### Prerequisites

Install the Xcode command-line tools, Bun, and Cosign:

```sh
xcode-select --install
brew install bun cosign
```

If the Xcode command-line tools are already installed, macOS reports that no
installation is needed.

### Build the production app

From the repository root:

```sh
cd desktop
bun install --frozen-lockfile
cd packages/desktop
OPENCODE_CHANNEL=prod bun run build
OPENCODE_CHANNEL=prod bun run package:mac
```

The build downloads Qualcomm `melange-qcom` from this repository's release
mirror, verifies its signed manifest and SHA-256 checksum, and packages the
verified binary, skill, and report templates inside Melange Agent.

Successful builds create:

```text
packages/desktop/dist/melange-agent-mac-arm64.dmg
packages/desktop/dist/melange-agent-mac-arm64.zip
packages/desktop/dist/mac-arm64/Melange Agent.app
```

### Install

Open the disk image from `desktop/packages/desktop`:

```sh
open dist/melange-agent-mac-arm64.dmg
```

Drag **Melange Agent** to **Applications**, then eject the disk image. Sign-in
is optional and can be skipped on first launch.

To install without opening the disk image:

```sh
ditto "dist/mac-arm64/Melange Agent.app" "/Applications/Melange Agent.app"
```

### Verify the local build

Print the checksums after each build:

```sh
shasum -a 256 \
  dist/melange-agent-mac-arm64.dmg \
  dist/melange-agent-mac-arm64.zip
```

A fixed artifact checksum is not stored in this README because the repository
does not publish the artifact yet and each rebuild can produce a different
archive. When a GitHub Release is added, publish that release's checksums with
the DMG and ZIP.

Verify the bundled Qualcomm CLI without signing in:

```sh
"dist/mac-arm64/Melange Agent.app/Contents/Resources/melange-qcom/launcher/melange-qcom" --version
```

## macOS security notice

Internal builds are not signed with an Apple Developer ID or notarized. A
shared build can therefore trigger a Gatekeeper warning. For public or broad
internal distribution, sign the complete app with a Developer ID certificate,
enable the hardened runtime, notarize the DMG, and staple the notarization
ticket before publishing it.

## Development

Run the desktop app from `desktop/packages/desktop`:

```sh
bun run dev
```

Run the focused checks:

```sh
bun run typecheck
bun test
```

Report Melange Agent issues in
[`zetic-ai/qualcomm-melange-cli`](https://github.com/zetic-ai/qualcomm-melange-cli/issues).
Use upstream OpenCode documentation only for unchanged OpenCode engine and
provider behavior.
