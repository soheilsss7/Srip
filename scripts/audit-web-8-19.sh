#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web"
required=("app/error.tsx" "app/loading.tsx" "app/not-found.tsx" "app/_components/route-state.tsx" "app/_components/preferences.tsx")
for f in "${required[@]}"; do test -f "$WEB/$f" || { echo "MISSING $f"; exit 1; }; done
# Guard against accidental raw secrets in web source.
if grep -RInE '(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|PRIVATE) KEY-----)' "$WEB" --exclude='*.tsbuildinfo"' 2>/dev/null; then
  echo "Potential secret detected in web source"; exit 1
fi
# Basic accessibility invariants.
grep -q 'id="main-content"' "$WEB/app/layout.tsx"
grep -q 'skip-link' "$WEB/app/globals.css"
grep -q 'prefers-reduced-motion' "$WEB/app/globals.css"
grep -q 'focus-visible' "$WEB/app/globals.css"
echo "WEB 8.19 STATIC AUDIT: PASS"
