# Melange Agent

Melange Agent is the desktop coding agent for the Qualcomm Melange CLI. It
provides a graphical interface for coding, terminal, Git, file, model, and
agent workflows while making `melange-qcom` available to every agent session.

The desktop app is based on OpenCode. The pinned upstream repository and
commit are recorded in [`OPENCODE_UPSTREAM.json`](OPENCODE_UPSTREAM.json), and
the required MIT license remains in [`LICENSE`](LICENSE).

## Current support

- macOS on Apple Silicon (`arm64`)
- Windows 11 on Arm (`arm64`, Snapdragon X series) and Windows x64, built
  from an Apple Silicon Mac
- English user interface
- unsigned internal builds
- Qualcomm `melange-qcom` v0.10.0 bundled with the app

The app does not require a global Qualcomm Melange CLI installation and does
not write to `/usr/local/bin` or `~/.local/bin`.

## Build and install from this repository

There is no Melange Agent GitHub Release yet. Until one is published, build
and install the app from source. Every target, including the Windows
installers, is built on an Apple Silicon Mac.

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
OPENCODE_CHANNEL=prod bun run dist:mac
```

`dist:mac` runs `bun run build` and `bun run package:mac` with a consistent
build target. The build downloads Qualcomm `melange-qcom` from this
repository's release mirror, verifies its signed manifest and SHA-256
checksum, and packages the verified binary, skill, and report templates inside
Melange Agent.

Successful builds create:

```text
packages/desktop/dist/melange-agent-mac-arm64.dmg
packages/desktop/dist/melange-agent-mac-arm64.zip
packages/desktop/dist/mac-arm64/Melange Agent.app
```

### Build the Windows installer

Windows builds are cross-built on the same Apple Silicon Mac. From
`desktop/packages/desktop`:

```sh
OPENCODE_CHANNEL=prod bun run dist:win              # Windows on Arm (Snapdragon X)
OPENCODE_CHANNEL=prod bun run dist:win --arch x64   # Windows x64
```

Successful builds create:

```text
packages/desktop/dist/melange-agent-win-arm64.exe
packages/desktop/dist/melange-agent-win-x64.exe
```

The installer is a per-user NSIS one-click setup that installs to
`%LOCALAPPDATA%\Programs\melange-agent`. It is unsigned, so SmartScreen shows
"Windows protected your PC" on first launch; choose **More info** and
**Run anyway**.

Every stage of a Windows build has to agree on the target. `dist:win` sets
`MELANGE_TARGET_OS` and `MELANGE_TARGET_ARCH` for both stages; if you run
`bun run build` and `bun run package:win` by hand, export the same two
variables for both commands. The target selects the matching
native packages such as `@lydell/node-pty-<os>-<arch>` and
`@parcel/watcher-<os>-<arch>` (Bun installs only the build host's copies, so
the prebuild fetches the target's) and the matching `melange-qcom` archive, and `electron-builder` refuses to package an `out/` directory built
for a different platform. Packaging a macOS `out/` into a Windows installer is
exactly what produced the launch error
`Cannot find module './windowsTerminal'`.

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

On Windows, after installing:

```powershell
& "$env:LOCALAPPDATA\Programs\melange-agent\resources\melange-qcom\launcher\melange-qcom.cmd" --version
```

## macOS security notice

Internal builds are not signed with an Apple Developer ID or notarized. A
shared build can therefore trigger a Gatekeeper warning. For public or broad
internal distribution, sign the complete app with a Developer ID certificate,
enable the hardened runtime, notarize the DMG, and staple the notarization
ticket before publishing it.

## Windows security notice

Windows installers are not Authenticode-signed, so SmartScreen warns on first
launch and some endpoint protection may quarantine the download. Sign the
installer and `Melange Agent.exe` with an EV or OV code-signing certificate
before broad distribution.

## Data isolation from other OpenCode installs

The bundled server keeps its database, config, auth, cache and state under the
app's own user-data directory (`%APPDATA%\ai.zetic.melange-agent\opencode` on
Windows, `~/Library/Application Support/ai.zetic.melange-agent/opencode` on
macOS) by setting `OPENCODE_STORAGE_ROOT` for the sidecar. It never opens the
shared `~/.local/share/opencode` or `~/.config/opencode` that an upstream
OpenCode CLI or desktop uses, so a different OpenCode version on the same
machine cannot break startup ("Database is not empty and has no session
table") or inject its global AGENTS.md and skills into a session.

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
