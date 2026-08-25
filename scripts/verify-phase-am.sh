#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0
check(){ if grep -q "$1" "$2"; then echo "PASS $3"; else echo "FAIL $3"; fail=1; fi; }
check "bounded:true" apps/api/src/network/network.service.ts "bounded network graph"
check "nextCursor" apps/api/src/network/network.service.ts "network cursor"
check "take: pageSize + 1" apps/api/src/network/network.service.ts "network pagination"
check "take: Math.max(1000" apps/api/src/requirements/requirement-matching.service.ts "bounded relationship frontier"
check "findPath(source, candidate.org.id, adjacency, 2)" apps/api/src/requirements/requirement-matching.service.ts "2-hop matching"
check "LIMIT 100" apps/api/src/search/search.service.ts "bounded FTS candidates"
check "pageLimit" apps/api/src/reporting/reporting.service.ts "bounded reporting"
check "scalability-benchmark" apps/api/PHASE_AM_SCALABILITY.md "scalability benchmark"
node --check tests/load/scalability-benchmark.mjs
if [[ $fail -ne 0 ]]; then exit 1; fi
echo "PHASE AM STATIC VERIFICATION = PASS"
