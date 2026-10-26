#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
required=(
  "$ROOT/PHASE_AD_TESTING_MATRIX.md"
  "$ROOT/test/unit/phase-ad-testing-matrix.contract.spec.ts"
  "$ROOT/test/unit/phase-ad-core-logic.spec.ts"
  "$ROOT/test/integration/phase-ad-integration.contract.spec.ts"
  "$ROOT/test/e2e/phase-ad.e2e.spec.ts"
  "$ROOT/test/security/phase-ae-security.spec.ts"
)
for f in "${required[@]}"; do test -s "$f" || { echo "MISSING:$f"; exit 1; }; done
for token in 'UNIT' 'INTEGRATION' 'E2E' 'SECURITY' 'Score Engine' 'Permission Engine' 'Relationship Logic' 'Workflow' 'Recommendation' 'Validation' 'Date/Time Logic' 'API' 'PostgreSQL' 'Auth' 'Redis' 'Queue' 'Storage' 'Permission Denial'; do grep -Fq "$token" "$ROOT/PHASE_AD_TESTING_MATRIX.md" || { echo "MISSING_MATRIX:$token"; exit 1; }; done
echo 'PHASE_AD_TESTING_MATRIX=PASS'
