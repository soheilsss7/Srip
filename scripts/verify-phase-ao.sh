#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
ERROR_TS="$API/src/common/api-contract/error-contract.ts"
FILTER_TS="$API/src/common/api-contract/api-contract.filter.ts"
MAIN_TS="$API/src/main.ts"
TEST_TS="$API/test/unit/api-error-contract.spec.ts"
DOC="$ROOT/docs/api/API_ERROR_CONTRACT_AO.md"
for f in "$ERROR_TS" "$FILTER_TS" "$MAIN_TS" "$TEST_TS" "$DOC"; do test -f "$f" || { echo "MISSING: $f"; exit 1; }; done
for code in AUTH_REQUIRED AUTH_INVALID ACCESS_DENIED ORG_SCOPE_DENIED FIELD_ACCESS_DENIED VALIDATION_ERROR RESOURCE_NOT_FOUND DUPLICATE_RESOURCE APPROVAL_REQUIRED RATE_LIMITED IDEMPOTENCY_CONFLICT INTEGRATION_ERROR; do grep -q "$code" "$ERROR_TS" || { echo "MISSING CODE: $code"; exit 1; }; done
grep -q "error: {" "$FILTER_TS" || { echo "FILTER DOES NOT EMIT ERROR ENVELOPE"; exit 1; }
grep -q "required: \['error'\]" "$MAIN_TS" || { echo "OPENAPI ERROR ENVELOPE NOT DOCUMENTED"; exit 1; }
grep -q "ErrorResponse" "$MAIN_TS" || { echo "OPENAPI ERROR RESPONSE MISSING"; exit 1; }
echo "PHASE_AO_STATIC_CONTRACT=PASS"
