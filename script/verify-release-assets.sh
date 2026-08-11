#!/bin/sh
set -eu

die() {
    printf 'verify-release-assets: %s\n' "$*" >&2
    exit 1
}

[ "$#" -eq 2 ] || die "usage: $0 ASSET_DIRECTORY vX.Y.Z"
asset_dir=$1
tag=$2
[ -d "$asset_dir" ] || die "asset directory does not exist: $asset_dir"
printf '%s\n' "$tag" | grep -Eq '^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$' ||
    die "tag must be a v-prefixed semantic version"

version=${tag#v}
checksums="$asset_dir/checksums.txt"
bundle="$asset_dir/checksums.txt.sigstore.json"
[ -f "$checksums" ] || die "missing checksums.txt"
[ -f "$bundle" ] || die "missing checksums.txt.sigstore.json"

command -v cosign >/dev/null 2>&1 || die "cosign is required"
cosign verify-blob \
    --bundle "$bundle" \
    --certificate-identity "https://github.com/zetic-ai/melange-cli/.github/workflows/release.yml@refs/tags/$tag" \
    --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
    "$checksums" >/dev/null

expected_platforms='darwin_amd64.tar.gz
darwin_arm64.tar.gz
linux_amd64.tar.gz
linux_arm64.tar.gz
windows_amd64.zip
windows_arm64.zip'

archive_count=$(find "$asset_dir" -maxdepth 1 -type f \
    \( -name "melange-qcom_${version}_*.tar.gz" -o -name "melange-qcom_${version}_*.zip" \) |
    wc -l | tr -d ' ')
[ "$archive_count" -eq 6 ] || die "expected six QCOM archives, found $archive_count"

sbom_count=$(find "$asset_dir" -maxdepth 1 -type f \
    -name "melange-qcom_${version}_*.sbom.json" | wc -l | tr -d ' ')
[ "$sbom_count" -eq 6 ] || die "expected six QCOM SBOMs, found $sbom_count"

verify_checksum() {
    name=$1
    file="$asset_dir/$name"
    [ -f "$file" ] || die "missing asset: $name"

    expected=$(awk -v name="$name" '$2 == name { print $1 }' "$checksums")
    [ "$(printf '%s\n' "$expected" | wc -l | tr -d ' ')" -eq 1 ] ||
        die "checksum manifest must contain exactly one entry for $name"
    printf '%s\n' "$expected" | grep -Eq '^[0-9a-fA-F]{64}$' ||
        die "invalid checksum for $name"
    actual=$(shasum -a 256 "$file" | awk '{ print $1 }')
    [ "$actual" = "$expected" ] || die "checksum mismatch for $name"
}

printf '%s\n' "$expected_platforms" | while IFS= read -r platform; do
    archive="melange-qcom_${version}_${platform}"
    verify_checksum "$archive"
    verify_checksum "$archive.sbom.json"
done

printf 'verified %s QCOM release assets\n' "$tag"
