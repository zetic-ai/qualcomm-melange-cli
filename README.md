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

[`desktop/`](desktop/) contains Melange Agent, an Apple Silicon desktop coding
agent based on the pinned OpenCode source recorded in
[`desktop/OPENCODE_UPSTREAM.json`](desktop/OPENCODE_UPSTREAM.json). The OpenCode
MIT license and attribution remain in the vendored tree.

Build the unsigned DMG and ZIP on an Apple Silicon Mac:

```sh
cd desktop
bun install --frozen-lockfile
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package:mac
```

The build requires network access and `cosign`. It downloads Qualcomm
`melange-qcom` v0.10.0 from this repository's release mirror, verifies the
signed checksum manifest and archive hash, and packages the CLI and skill in
the app. It does not run the global installer or modify user executable paths.

## Support and development

Open Qualcomm product, device, benchmark, or deployment issues in this
repository. Submit source fixes and code changes to
[`zetic-ai/melange-cli`](https://github.com/zetic-ai/melange-cli/issues).

The curated experience is not a security boundary. `melange-qcom api` is an
intentional raw escape hatch and can return data that bypasses Qualcomm
filtering.

Licensed under [Apache-2.0](LICENSE). See [SECURITY.md](SECURITY.md) for private
vulnerability reporting.
