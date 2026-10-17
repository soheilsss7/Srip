#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for f in \
  "$ROOT/src/main.ts" \
  "$ROOT/src/common/api-contract/error-contract.ts" \
  "$ROOT/src/common/api-contract/api-contract.filter.ts" \
  "$ROOT/src/common/api-contract/api-contract.interceptor.ts" \
  "$ROOT/src/common/api-contract/api-contract.middleware.ts" \
  "$ROOT/src/health/health.controller.ts" \
  "$ROOT/src/health/health.service.ts" \
  "$ROOT/test/unit/phase5-api-runtime-contract.spec.ts"; do
  test -f "$f"
done

grep -q "document.openapi = '3.1.0'" "$ROOT/src/main.ts"
grep -q "ErrorResponse" "$ROOT/src/main.ts"
grep -q "Idempotency-Key" "$ROOT/src/main.ts"
grep -q "X-Request-Id" "$ROOT/src/main.ts"
grep -q "X-Correlation-Id" "$ROOT/src/main.ts"
grep -q "const MUTATING_METHODS" "$ROOT/src/common/api-contract/api-contract.interceptor.ts"
grep -q "isWebhook(path)" "$ROOT/src/common/api-contract/api-contract.interceptor.ts"
grep -q "isExport(path)" "$ROOT/src/common/api-contract/api-contract.interceptor.ts"
grep -q "hashBytes(req.rawBody)" "$ROOT/src/common/api-contract/api-contract.interceptor.ts"
grep -q "transformReadResponse" "$ROOT/src/common/api-contract/api-contract.interceptor.ts"
grep -q "INTERNAL_ERROR: 'INTERNAL_ERROR'" "$ROOT/src/common/api-contract/error-contract.ts"
grep -q "SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'" "$ROOT/src/common/api-contract/error-contract.ts"
grep -q "@Get('liveness')" "$ROOT/src/health/health.controller.ts"
grep -q "@Get('readiness')" "$ROOT/src/health/health.controller.ts"
grep -q "error: 'dependency unavailable'" "$ROOT/src/health/health.service.ts"
grep -q "error: 'redis unavailable'" "$ROOT/src/health/health.service.ts"
grep -q "error: 'storage unavailable'" "$ROOT/src/health/health.service.ts"

echo "PHASE5_API_RUNTIME_STATIC=PASS"
