#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
version="${RELEASE_VERSION:-$(node -p "require('$root/apps/api/package.json').version")}" 
[[ "$version" =~ ^0\.[0-9]+\.[0-9]+$|^[1-9][0-9]*\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid semantic version: $version" >&2; exit 1; }
test -f "$root/CHANGELOG.md" || { echo 'CHANGELOG.md missing' >&2; exit 1; }
test -f "$root/docs/RELEASE_NOTES_TEMPLATE.md" || { echo 'Release notes template missing' >&2; exit 1; }
printf 'RELEASE_VERSION=%s\nSEMVER=PASS\n' "$version"
