#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
required=(
  "$API/src/scoring/scoring-base.service.ts"
  "$API/src/scoring/relationship-score.service.ts"
  "$API/src/scoring/opportunity-score.service.ts"
  "$API/src/scoring/risk-score.service.ts"
  "$API/src/scoring/connector-score.service.ts"
  "$API/src/scoring/network-score.service.ts"
  "$API/src/scoring/scoring.controller.ts"
  "$API/src/scoring/scoring.module.ts"
)
for f in "${required[@]}"; do test -s "$f" || { echo "missing:$f"; exit 1; }; done
for token in "CanonicalRelationshipScoreService" "OpportunityScoreService" "RiskScoreService" "ConnectorScoreService" "NetworkScoreService"; do grep -q "$token" "$API/src/scoring/scoring.module.ts" || { echo "missing-service:$token"; exit 1; }; done
for token in "score.updated" "scoreVersion" "scoreSnapshot" "relationship-default" "opportunity-default" "risk-default" "connector-default" "network-default"; do grep -R -q "$token" "$API/src/scoring" "$API/prisma/seed.ts" || { echo "missing-contract:$token"; exit 1; }; done
grep -q "ScoringModule" "$API/src/app.module.ts" || { echo "not-wired:app"; exit 1; }
grep -q "ScoringModule" "$API/src/intelligence/intelligence.module.ts" || { echo "not-wired:intelligence"; exit 1; }
grep -q "ScoringModule" "$API/src/network/network.module.ts" || { echo "not-wired:network"; exit 1; }
grep -q "CanonicalRelationshipScoreService" "$API/src/intelligence/intelligence.service.ts" || { echo "intelligence-duplicate-formula-risk"; exit 1; }
grep -q "ConnectorScoreService" "$API/src/network/network.service.ts" || { echo "network-connector-not-canonical"; exit 1; }
python3 - "$API/src/scoring" <<'PY'
import sys, pathlib
root=pathlib.Path(sys.argv[1])
for p in root.glob('*.ts'):
    s=p.read_text()
    if s.count('{') != s.count('}') or s.count('(') != s.count(')'):
        raise SystemExit(f'structure-fail:{p}')
print('SCORING_STRUCTURE_CHECK=PASS')
PY
echo "SCORING_ENGINE_STATIC_CHECK=PASS"
