# Melange QCOM CLI

`melange-qcom` is the Qualcomm-focused edition of the
[ZETIC Melange CLI](https://github.com/zetic-ai/melange-cli). It keeps model
management familiar while curating benchmark reports, converted targets, and
Android/Flutter deployment guidance for the reviewed Qualcomm device fleet.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/zetic-ai/qualcomm-melange-cli/main/install.sh | sh
```

The installer delegates to the signed upstream release authority and installs
the matching `melange-qcom` binary and agent skill. Pass installer options after
`sh -s --`, for example:

```sh
curl -fsSL https://raw.githubusercontent.com/zetic-ai/qualcomm-melange-cli/main/install.sh | \
  sh -s -- --require-signature
```

## What is mirrored here

The CLI release mirror in this repository is not a source fork.
[`zetic-ai/melange-cli`](https://github.com/zetic-ai/melange-cli) remains the
only CLI source, build, signing, version, npm, and Homebrew authority.

Each release copies, without rebuilding:

- six `melange-qcom` platform archives and their SBOMs;
- the complete upstream checksum manifest and Sigstore bundle;
- the tagged `skills/melange-qcom` skill; and
- [`UPSTREAM.json`](UPSTREAM.json) provenance linking the exact upstream tag,
  commit, and release.

The mirror verifies the upstream release-workflow certificate identity and all
QCOM asset hashes before publishing a draft.

## Melange Agent desktop

[`desktop/`](desktop/) contains Melange Agent, a desktop coding agent for
Apple Silicon Macs and Windows on Arm (Snapdragon X) PCs, based on the pinned
OpenCode source recorded in
[`desktop/OPENCODE_UPSTREAM.json`](desktop/OPENCODE_UPSTREAM.json). The OpenCode
MIT license and attribution remain in the vendored tree.

There is no Melange Agent GitHub Release yet. Coworkers can build and install
the current production app directly from this repository on an Apple Silicon
Mac, which also produces the Windows installers. Run `xcode-select --install`
first and finish the macOS prompt, then run:

```sh
brew install bun cosign
git clone https://github.com/zetic-ai/qualcomm-melange-cli.git
cd qualcomm-melange-cli
cd desktop
bun install --frozen-lockfile
cd packages/desktop
OPENCODE_CHANNEL=prod bun run dist:mac
open dist/melange-agent-mac-arm64.dmg
```

Drag **Melange Agent** to **Applications**. Sign-in is optional and can be
skipped on first launch. The build is currently unsigned.

For a Windows on Arm laptop (for example an HP OmniBook with a Snapdragon X
Elite), build the installer on the same Mac and copy it over:

```sh
OPENCODE_CHANNEL=prod bun run dist:win
# → dist/melange-agent-win-arm64.exe   (add --arch x64 for Windows x64 PCs)
```

Do not package a Windows installer from an `out/` directory that was built for
macOS. The `dist:win` script keeps both stages on the same target, and
`electron-builder` now rejects a mismatch; the symptom of the old mistake was
`A JavaScript error occurred in the main process: Cannot find module
'./windowsTerminal'` at launch.

The build requires network access and `cosign`. It downloads the Qualcomm
`melange-qcom` v0.10.0 archive for the target platform from this repository's
release mirror, verifies the signed checksum manifest and archive hash, and
packages the CLI and skill in the app. It does not run the global installer or
modify user executable paths.

Verify each locally built artifact after packaging:

```sh
shasum -a 256 \
  dist/melange-agent-mac-arm64.dmg \
  dist/melange-agent-mac-arm64.zip
```

The SHA-256 value is generated after the build because each local archive can
have a different checksum. A fixed checksum should be published with the DMG
and ZIP when a GitHub Release is created. See
[`desktop/README.md`](desktop/README.md) for complete build, installation, and
verification instructions.

## Support and development

Open Qualcomm product, device, benchmark, or deployment issues in this
repository. Submit source fixes and code changes to
[`zetic-ai/melange-cli`](https://github.com/zetic-ai/melange-cli/issues).

The curated experience is not a security boundary. `melange-qcom api` is an
intentional raw escape hatch and can return data that bypasses Qualcomm
filtering.

Licensed under [Apache-2.0](LICENSE). See [SECURITY.md](SECURITY.md) for private
vulnerability reporting.
