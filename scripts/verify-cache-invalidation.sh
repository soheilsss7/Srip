#!/usr/bin/env bash
set -euo pipefail
: "${REDIS_URL:?REDIS_URL is required}"
command -v pnpm >/dev/null || { echo "pnpm is required" >&2; exit 2; }
pnpm --filter @srip/api exec tsx ../../scripts/verify-cache-invalidation.ts
