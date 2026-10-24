#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CTRL="$ROOT/apps/api/src/metrics.controller.ts"
GUARD="$ROOT/apps/api/src/common/guards/internal-metrics.guard.ts"
CONST="$ROOT/apps/api/src/common/authorization/access.constants.ts"
SEED="$ROOT/apps/api/prisma/seed.ts"

grep -q "InternalMetricsGuard" "$CTRL"
grep -q "UseGuards(AuthGuard, AuthorizationGuard)" "$CTRL"
test "$(grep -c "@RequirePermission('metrics.read')" "$CTRL")" -eq 5
grep -q "metrics.read" "$CONST"
grep -q "metrics.read" "$SEED"
grep -q "METRICS_ALLOWED_CIDRS" "$GUARD"

echo "PHASE_AB_METRICS_SECURITY_CONTRACT=PASS"
