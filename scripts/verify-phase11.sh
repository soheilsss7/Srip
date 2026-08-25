#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
test -f apps/api/src/intelligence/intelligence.module.ts
test -f apps/api/src/intelligence/intelligence.service.ts
test -f apps/api/src/intelligence/intelligence.controller.ts
grep -q "IntelligenceModule" apps/api/src/app.module.ts
grep -q "relationships/:id/explain" apps/api/src/intelligence/intelligence.controller.ts
grep -q "risk-signals" apps/api/src/intelligence/intelligence.controller.ts
grep -q "relationship-decay" apps/api/src/intelligence/intelligence.service.ts
grep -q "relationshipScoreSnapshot" apps/api/src/intelligence/intelligence.service.ts
echo "PHASE 11 STATIC VERIFICATION OK"
grep -q "model ScoreVersion" apps/api/prisma/schema.prisma
grep -q "model ScoreCalibration" apps/api/prisma/schema.prisma
grep -q "score-versions" apps/api/src/intelligence/intelligence.controller.ts
grep -q "opportunity-detection" apps/api/src/intelligence/intelligence.controller.ts
grep -q "strategic-coverage" apps/api/src/intelligence/intelligence.controller.ts
grep -q "networkIntelligence" apps/api/src/intelligence/intelligence.service.ts
grep -q "scoreVersion" apps/api/src/intelligence/intelligence.service.ts
