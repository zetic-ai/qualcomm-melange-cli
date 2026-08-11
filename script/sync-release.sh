#!/bin/sh
set -eu

upstream_repo=${UPSTREAM_REPO:-zetic-ai/melange-cli}
downstream_repo=${DOWNSTREAM_REPO:-zetic-ai/qualcomm-melange-cli}
requested_tag=${1:-}
repo_root=$(cd -- "$(dirname "$0")/.." && pwd)

info() { printf 'sync-release: %s\n' "$*"; }
die() { printf 'sync-release: %s\n' "$*" >&2; exit 1; }

for command_name in gh git jq cosign shasum tar; do
    command -v "$command_name" >/dev/null 2>&1 || die "$command_name is required"
done

is_vsemver() {
    printf '%s\n' "$1" | grep -Eq '^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$'
}

release_by_tag() {
    gh api --paginate "repos/$1/releases?per_page=100" 2>/dev/null |
        jq -c --arg tag "$2" '.[] | select(.tag_name == $tag)'
}

sync_one() {
    tag=$1
    is_vsemver "$tag" || die "invalid release tag: $tag"
    upstream_release=$(release_by_tag "$upstream_repo" "$tag")
    [ -n "$upstream_release" ] || die "upstream release does not exist: $tag"
    [ "$(printf '%s' "$upstream_release" | jq -r .draft)" = false ] ||
        die "upstream release is still a draft: $tag"

    if ! printf '%s' "$upstream_release" | jq -e \
        '.assets | any(.name | startswith("melange-qcom_"))' >/dev/null
    then
        info "skipping $tag: no melange-qcom assets"
        return
    fi

    downstream_release=$(release_by_tag "$downstream_repo" "$tag")
    if [ -n "$downstream_release" ] &&
        [ "$(printf '%s' "$downstream_release" | jq -r .draft)" = false ]
    then
        info "$tag is already published"
        return
    fi

    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT HUP INT TERM
    assets="$tmp/assets"
    source_dir="$tmp/source"
    mirror="$tmp/mirror"
    mkdir -p "$assets" "$source_dir" "$mirror"

    gh release download "$tag" --repo "$upstream_repo" --dir "$assets" --clobber \
        --pattern 'melange-qcom_*' \
        --pattern 'checksums.txt' \
        --pattern 'checksums.txt.sigstore.json'
    sh "$repo_root/script/verify-release-assets.sh" "$assets" "$tag"
    source_count=$(find "$assets" -maxdepth 1 -type f | wc -l | tr -d ' ')
    [ "$source_count" -eq 14 ] || die "expected 14 upstream mirror assets, found $source_count"

    gh api -H 'Accept: application/vnd.github+json' \
        "repos/$upstream_repo/tarball/$tag" >"$tmp/source.tar.gz"
    tar -xzf "$tmp/source.tar.gz" -C "$source_dir" --strip-components=1
    [ -f "$source_dir/skills/melange-qcom/SKILL.md" ] ||
        die "upstream tag does not contain skills/melange-qcom"

    upstream_commit=$(gh api "repos/$upstream_repo/commits/$tag" --jq .sha)
    upstream_url=$(printf '%s' "$upstream_release" | jq -r .html_url)
    prerelease=$(printf '%s' "$upstream_release" | jq -r .prerelease)

    rm -rf "$repo_root/skills/melange-qcom"
    mkdir -p "$repo_root/skills"
    cp -R "$source_dir/skills/melange-qcom" "$repo_root/skills/melange-qcom"
    jq -n \
        --arg repository "https://github.com/$upstream_repo" \
        --arg tag "$tag" \
        --arg commit "$upstream_commit" \
        --arg release_url "$upstream_url" \
        '{schema_version: 1, upstream_repository: $repository, tag: $tag, commit: $commit, release_url: $release_url}' \
        >"$repo_root/UPSTREAM.json"

    git -C "$repo_root" add UPSTREAM.json skills/melange-qcom
    if ! git -C "$repo_root" diff --cached --quiet; then
        git -C "$repo_root" config user.name github-actions
        git -C "$repo_root" config user.email github-actions@github.com
        git -C "$repo_root" commit -m "Sync Melange QCOM $tag"
        git -C "$repo_root" push origin HEAD:main
    fi
    mirror_commit=$(git -C "$repo_root" rev-parse HEAD)

    if git -C "$repo_root" ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null 2>&1; then
        git -C "$repo_root" fetch --force origin "refs/tags/$tag:refs/tags/$tag"
        tag_commit=$(git -C "$repo_root" rev-list -n 1 "$tag")
        [ "$tag_commit" = "$mirror_commit" ] ||
            die "existing downstream tag $tag does not point to the synced provenance commit"
    else
        git -C "$repo_root" tag -a "$tag" -m "Melange QCOM $tag"
        git -C "$repo_root" push origin "refs/tags/$tag"
    fi

    notes="$tmp/release-notes.md"
    # The backticks are Markdown, not command substitutions.
    # shellcheck disable=SC2016
    printf 'Mirrored from [%s](%s).\n\nUpstream commit: [`%s`](https://github.com/%s/commit/%s)\n\nArtifacts are copied without rebuilding. Verify them with the included signed `checksums.txt` and `checksums.txt.sigstore.json`.\n' \
        "$tag" "$upstream_url" "$upstream_commit" "$upstream_repo" "$upstream_commit" >"$notes"

    if [ -z "$downstream_release" ]; then
        if [ "$prerelease" = true ]; then
            gh release create "$tag" --repo "$downstream_repo" --verify-tag --draft --prerelease \
                --title "Melange QCOM $tag" --notes-file "$notes"
        else
            gh release create "$tag" --repo "$downstream_repo" --verify-tag --draft \
                --title "Melange QCOM $tag" --notes-file "$notes"
        fi
    else
        gh release edit "$tag" --repo "$downstream_repo" --draft --prerelease="$prerelease" \
            --title "Melange QCOM $tag" --notes-file "$notes"
    fi

    gh release upload "$tag" "$assets"/* --repo "$downstream_repo" --clobber

    downstream_release=$(release_by_tag "$downstream_repo" "$tag")
    downstream_count=$(printf '%s' "$downstream_release" | jq '.assets | length')
    [ "$downstream_count" -eq 14 ] ||
        die "expected 14 downstream draft assets, found $downstream_count"
    for source_asset in "$assets"/*; do
        name=$(basename "$source_asset")
        asset_id=$(printf '%s' "$downstream_release" |
            jq -r --arg name "$name" '.assets[] | select(.name == $name) | .id')
        [ -n "$asset_id" ] || die "downstream draft is missing $name"
        gh api -H 'Accept: application/octet-stream' \
            "repos/$downstream_repo/releases/assets/$asset_id" >"$mirror/$name"
    done

    mirror_count=$(find "$mirror" -maxdepth 1 -type f | wc -l | tr -d ' ')
    [ "$source_count" -eq 14 ] || die "expected 14 upstream mirror assets, found $source_count"
    [ "$mirror_count" -eq "$source_count" ] ||
        die "downstream draft asset count does not match upstream"
    for source_asset in "$assets"/*; do
        name=$(basename "$source_asset")
        [ -f "$mirror/$name" ] || die "downstream draft is missing $name"
        source_hash=$(shasum -a 256 "$source_asset" | awk '{print $1}')
        mirror_hash=$(shasum -a 256 "$mirror/$name" | awk '{print $1}')
        [ "$source_hash" = "$mirror_hash" ] || die "downstream hash differs for $name"
    done
    sh "$repo_root/script/verify-release-assets.sh" "$mirror" "$tag"

    gh release edit "$tag" --repo "$downstream_repo" --draft=false \
        --prerelease="$prerelease" --title "Melange QCOM $tag" --notes-file "$notes"
    info "published $tag"
    rm -rf "$tmp"
    trap - EXIT HUP INT TERM
}

if [ -n "$requested_tag" ]; then
    sync_one "$requested_tag"
    exit 0
fi

gh api --paginate "repos/$upstream_repo/releases?per_page=100" \
    --jq '.[] | select(.draft == false) | .tag_name' | sort -V |
    while IFS= read -r tag; do
        sync_one "$tag"
    done
