#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
need(){ test -f "$ROOT/$1" || { echo "MISSING: $1"; fail=1; }; }
need apps/api/src/common/performance/performance-cache.service.ts
need apps/api/src/common/performance/performance.module.ts
need apps/api/prisma/migrations/20260225120000_phase_al_performance/migration.sql
need tests/load/performance-benchmark.mjs
need docs/PHASE_AL_PERFORMANCE.md
need scripts/verify-phase-al.sh
grep -q 'DB_SLOW_QUERY_MS' "$ROOT/apps/api/src/prisma/prisma.service.ts" || { echo 'MISSING slow-query threshold'; fail=1; }
grep -q 'skip: (page - 1) \* pageSize' "$ROOT/apps/api/src/organizations/organizations.service.ts" || { echo 'MISSING organization pagination'; fail=1; }
grep -q 'skip: (page - 1) \* pageSize' "$ROOT/apps/api/src/people/people.service.ts" || { echo 'MISSING people pagination'; fail=1; }
grep -q 'skip: (page - 1) \* pageSize' "$ROOT/apps/api/src/relationships/relationships.service.ts" || { echo 'MISSING relationship pagination'; fail=1; }
grep -q 'P95' "$ROOT/docs/PHASE_AL_PERFORMANCE.md" || { echo 'MISSING P95 contract'; fail=1; }
grep -q 'P99' "$ROOT/docs/PHASE_AL_PERFORMANCE.md" || { echo 'MISSING P99 contract'; fail=1; }
if [ "$fail" -ne 0 ]; then exit 1; fi
echo 'PHASE AL STATIC CONTRACT=PASS'
