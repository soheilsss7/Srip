#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail=0

required=(
  "$ROOT/apps/api/test/integration/runtime-integration.spec.ts"
  "$ROOT/tests/security/idor-matrix.mjs"
  "$ROOT/tests/security/owasp-asvs-runtime.mjs"
  "$ROOT/tests/load/smoke-load.mjs"
  "$ROOT/tests/storage/storage-integration.mjs"
  "$ROOT/tests/e2e/e2e-smoke.mjs"
  "$ROOT/apps/api/test/integration/queue-integration.spec.ts"
  "$ROOT/docs/testing/PHASE39_TESTING.md"
)
for f in "${required[@]}"; do
  [[ -f "$f" ]] || { echo "MISSING: $f"; fail=1; }
done

grep -q 'RUN_INTEGRATION' "$ROOT/apps/api/test/integration/runtime-integration.spec.ts" || fail=1
grep -q 'IDOR FAILURE' "$ROOT/tests/security/idor-matrix.mjs" || fail=1
grep -q 'security-headers' "$ROOT/tests/security/owasp-asvs-runtime.mjs" || fail=1
grep -q 'p95Ms' "$ROOT/tests/load/smoke-load.mjs" || fail=1
grep -q 'S3_TEST_ENDPOINT' "$ROOT/tests/storage/storage-integration.mjs" || fail=1
grep -q 'queue.add' "$ROOT/apps/api/test/integration/queue-integration.spec.ts" || fail=1
grep -q 'new Worker' "$ROOT/apps/api/test/integration/queue-integration.spec.ts" || fail=1
grep -q 'waitUntilFinished' "$ROOT/apps/api/test/integration/queue-integration.spec.ts" || fail=1
grep -q '/auth/login' "$ROOT/tests/e2e/e2e-smoke.mjs" || fail=1
grep -q '/organizations' "$ROOT/tests/e2e/e2e-smoke.mjs" || fail=1
grep -q '/people' "$ROOT/tests/e2e/e2e-smoke.mjs" || fail=1
grep -q '/relationships' "$ROOT/tests/e2e/e2e-smoke.mjs" || fail=1
grep -q '/meetings' "$ROOT/tests/e2e/e2e-smoke.mjs" || fail=1
grep -q '/actions' "$ROOT/tests/e2e/e2e-smoke.mjs" || fail=1
grep -q '/commitments' "$ROOT/tests/e2e/e2e-smoke.mjs" || fail=1
grep -q 'follow-up/due-soon' "$ROOT/tests/e2e/e2e-smoke.mjs" || fail=1

node --check "$ROOT/tests/security/idor-matrix.mjs"
node --check "$ROOT/tests/security/owasp-asvs-runtime.mjs"
node --check "$ROOT/tests/load/smoke-load.mjs"
node --check "$ROOT/tests/storage/storage-integration.mjs"
node --check "$ROOT/tests/e2e/e2e-smoke.mjs"

if [[ "$fail" -ne 0 ]]; then
  echo "PHASE39_TESTING_STATIC_CHECK=FAIL"
  exit 1
fi
echo "PHASE39_TESTING_STATIC_CHECK=PASS"
