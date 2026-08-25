#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
req=(
  "$ROOT/apps/api/src/recommendations/recommendations.service.ts"
  "$ROOT/apps/api/src/recommendations/recommendations.controller.ts"
  "$ROOT/apps/api/src/recommendations/recommendations.service.spec.ts"
  "$ROOT/apps/api/prisma/migrations/20260823_phase13_recommendation_engine/migration.sql"
  "$ROOT/apps/web/app/recommendations/page.tsx"
)
for f in "${req[@]}"; do test -f "$f" || { echo "MISSING: $f"; exit 1; }; done
for t in FOLLOW_UP MEETING INTRODUCTION RELATIONSHIP_REPAIR DIVERSIFICATION OPPORTUNITY RISK_MITIGATION PROJECT_CONNECTION EXECUTIVE_ESCALATION; do grep -q "$t" "$ROOT/apps/api/src/recommendations/recommendations.service.ts" || exit 1; done
for op in approve reject snooze assign execute explain; do grep -q "${op}" "$ROOT/apps/api/src/recommendations/recommendations.controller.ts" || exit 1; done
grep -q 'recommendation.read' "$ROOT/apps/api/src/common/authorization/access.constants.ts"
grep -q 'recommendation.write' "$ROOT/apps/api/src/common/authorization/access.constants.ts"
if grep -RInE '<<<<<<<|=======|>>>>>>>' "$ROOT/apps/api/src/recommendations" "$ROOT/apps/web/app/recommendations" >/dev/null; then echo 'Conflict markers found'; exit 1; fi
echo 'Phase 13 Recommendation Engine static verification: PASS'
