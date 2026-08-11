#!/bin/sh
set -eu

repo_root=$(cd -- "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

fail() {
    printf 'test: %s\n' "$*" >&2
    exit 1
}

test_installer_delegates_with_arguments() {
    fake_bin="$tmp/installer-bin"
    mkdir -p "$fake_bin"

    cat >"$fake_bin/curl" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >"$CURL_ARGS_FILE"
out=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        -o) out="$2"; shift 2 ;;
        *) shift ;;
    esac
done
cat >"$out" <<'SCRIPT'
#!/bin/sh
printf '%s\n' "$@" >"$FORWARDED_ARGS_FILE"
SCRIPT
EOF
    chmod +x "$fake_bin/curl"

    CURL_ARGS_FILE="$tmp/curl-args" \
    FORWARDED_ARGS_FILE="$tmp/forwarded-args" \
    PATH="$fake_bin:$PATH" \
        sh "$repo_root/install.sh" --version v1.2.3 --cli-only

    grep -Fq 'https://raw.githubusercontent.com/zetic-ai/melange-cli/main/script/install-qcom.sh' "$tmp/curl-args" ||
        fail "installer did not call the canonical upstream QCOM installer"
    expected=$(printf '%s\n' '--version' 'v1.2.3' '--cli-only')
    actual=$(cat "$tmp/forwarded-args")
    [ "$actual" = "$expected" ] || fail "installer did not forward arguments unchanged"
}

test_release_asset_verification() {
    assets="$tmp/assets"
    fake_bin="$tmp/verifier-bin"
    mkdir -p "$assets" "$fake_bin"

    for platform in \
        darwin_amd64.tar.gz \
        darwin_arm64.tar.gz \
        linux_amd64.tar.gz \
        linux_arm64.tar.gz \
        windows_amd64.zip \
        windows_arm64.zip
    do
        archive="melange-qcom_1.2.3_${platform}"
        printf 'archive %s\n' "$platform" >"$assets/$archive"
        printf '{"artifact":"%s"}\n' "$archive" >"$assets/$archive.sbom.json"
    done

    (
        cd "$assets"
        shasum -a 256 melange-qcom_* >checksums.txt
    )
    printf '{}\n' >"$assets/checksums.txt.sigstore.json"

    cat >"$fake_bin/cosign" <<'EOF'
#!/bin/sh
printf '%s\n' "$@" >"$COSIGN_ARGS_FILE"
EOF
    chmod +x "$fake_bin/cosign"

    COSIGN_ARGS_FILE="$tmp/cosign-args" PATH="$fake_bin:$PATH" \
        sh "$repo_root/script/verify-release-assets.sh" "$assets" v1.2.3
    grep -Fq 'https://github.com/zetic-ai/melange-cli/.github/workflows/release.yml@refs/tags/v1.2.3' "$tmp/cosign-args" ||
        fail "verifier did not bind the signature to the upstream tag workflow"

    missing="$assets/melange-qcom_1.2.3_windows_arm64.zip.sbom.json"
    mv "$missing" "$missing.saved"
    if COSIGN_ARGS_FILE="$tmp/cosign-args" PATH="$fake_bin:$PATH" \
        sh "$repo_root/script/verify-release-assets.sh" "$assets" v1.2.3 >/dev/null 2>&1
    then
        fail "verifier accepted an incomplete platform matrix"
    fi
    mv "$missing.saved" "$missing"

    printf 'tampered\n' >>"$assets/melange-qcom_1.2.3_linux_amd64.tar.gz"
    if COSIGN_ARGS_FILE="$tmp/cosign-args" PATH="$fake_bin:$PATH" \
        sh "$repo_root/script/verify-release-assets.sh" "$assets" v1.2.3 >/dev/null 2>&1
    then
        fail "verifier accepted a checksum mismatch"
    fi
}

test_installer_delegates_with_arguments
test_release_asset_verification
printf 'all tests passed\n'
