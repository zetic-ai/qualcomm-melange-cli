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
  sh -s -- --version v0.6.0 --require-signature
```

## What is mirrored here

This is a product, release, and issue-intake repository—not a source fork.
[`zetic-ai/melange-cli`](https://github.com/zetic-ai/melange-cli) remains the
only source, build, signing, version, npm, and Homebrew authority.

Each release copies, without rebuilding:

- six `melange-qcom` platform archives and their SBOMs;
- the complete upstream checksum manifest and Sigstore bundle;
- the tagged `skills/melange-qcom` skill; and
- [`UPSTREAM.json`](UPSTREAM.json) provenance linking the exact upstream tag,
  commit, and release.

The mirror verifies the upstream release-workflow certificate identity and all
QCOM asset hashes before publishing a draft.

## Support and development

Open Qualcomm product, device, benchmark, or deployment issues in this
repository. Submit source fixes and code changes to
[`zetic-ai/melange-cli`](https://github.com/zetic-ai/melange-cli/issues).

The curated experience is not a security boundary. `melange-qcom api` is an
intentional raw escape hatch and can return data that bypasses Qualcomm
filtering.

Licensed under [Apache-2.0](LICENSE). See [SECURITY.md](SECURITY.md) for private
vulnerability reporting.
