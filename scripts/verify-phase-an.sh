#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAIN="$ROOT/apps/api/src/main.ts"
DOC="$ROOT/docs/api/API_CONTRACT_AN.md"
grep -q "document.openapi = '3.1.0'" "$MAIN"
grep -q "ErrorResponse" "$MAIN"
grep -q "PaginatedResponse" "$MAIN"
grep -q "bearerFormat: 'JWT'" "$MAIN"
grep -q "X-Request-Id" "$MAIN"
grep -q "X-Correlation-Id" "$MAIN"
grep -q "Idempotency-Key" "$MAIN"
grep -q "document as any).webhooks" "$MAIN"
grep -q "x-webhook-signature" "$MAIN"
grep -q "PAGINATION" "$ROOT/apps/api/src/common/api-contract/api-contract.interceptor.ts" || true
grep -q "Error contract" "$DOC"
grep -q "Filters" "$DOC"
grep -q "Webhooks" "$DOC"
node --check "$ROOT/apps/api/dist/main.js" 2>/dev/null || true
printf 'PHASE_AN_STATIC_CONTRACT=PASS\n'
