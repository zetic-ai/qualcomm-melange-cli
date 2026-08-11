#!/bin/sh
# Delegates installation to the signed upstream Melange release authority.
set -eu

upstream_installer="https://raw.githubusercontent.com/zetic-ai/melange-cli/main/script/install-qcom.sh"
tmp=$(mktemp "${TMPDIR:-/tmp}/melange-qcom-install.XXXXXX")
trap 'rm -f "$tmp"' EXIT HUP INT TERM

curl -fsSL -o "$tmp" "$upstream_installer"
sh "$tmp" "$@"
