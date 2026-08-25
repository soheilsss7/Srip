#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail(){ echo "FAIL: $1" >&2; exit 1; }
req(){ test -f "$ROOT/$1" || fail "missing $1"; }
req src/network/network.service.ts
req src/search/search.service.ts
req src/requirements/requirement-matching.service.ts
req src/scoring/relationship-score.service.ts
req src/scoring/opportunity-score.service.ts
req src/scoring/risk-score.service.ts
req src/scoring/connector-score.service.ts
req src/scoring/network-score.service.ts
req src/analytics/analytics.service.ts
req src/reporting/reporting.service.ts
grep -q "strategicNetworkMetrics" "$ROOT/src/analytics/analytics.service.ts" || fail "network analytics missing"
grep -q "RECOMMENDATION_OUTCOME" "$ROOT/src/analytics/analytics.service.ts" || fail "recommendation funnel missing"
grep -q "domainEventId String? @unique" "$ROOT/prisma/schema.prisma" || fail "analytics event idempotency field missing"
grep -q "relationship-health.*relationship-risk.*network.*meeting.*commitment.*action.*opportunity.*project.*company.*contact.*risk.*influence.*referral.*subsidiary-comparison" "$ROOT/src/reporting/reporting.service.ts" || fail "report catalog incomplete"
grep -q "DIRECT" "$ROOT/src/requirements/requirement-matching.service.ts" || fail "requirement direct matching missing"
grep -q "INTERNAL" "$ROOT/src/requirements/requirement-matching.service.ts" || fail "requirement internal matching missing"
grep -q "RELATIONSHIP_SCORE_FACTORS" "$ROOT/src/scoring/relationship-score.service.ts" || fail "relationship scoring factors missing"
grep -q "industries" "$ROOT/src/scoring/relationship-score.service.ts" || fail "industry scoring configuration missing"
grep -q "bounded" "$ROOT/src/network/network.service.ts" || fail "bounded network response missing"
echo "PHASE3_STATIC_VERIFICATION=PASS"
