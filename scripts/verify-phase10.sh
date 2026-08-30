#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
req=(
  "$ROOT/apps/api/src/network/network.service.ts"
  "$ROOT/apps/api/src/network/network.controller.ts"
  "$ROOT/apps/api/test/unit/network.service.spec.ts"
  "$ROOT/apps/web/app/network/page.tsx"
  "$ROOT/apps/mobile/src/app/network.tsx"
)
for f in "${req[@]}"; do test -f "$f" || { echo "FAIL missing $f"; exit 1; }; done
grep -q "single-points-of-failure" "$ROOT/apps/api/src/network/network.controller.ts"
grep -q "@RequirePermission('network.read')" "$ROOT/apps/api/src/network/network.controller.ts"
grep -q "focus" "$ROOT/apps/api/src/network/network.service.ts"
grep -qi "centrality" "$ROOT/apps/web/app/network/page.tsx"
grep -q "Network" "$ROOT/apps/mobile/src/app/(tabs)/more.tsx"
if grep -RInE '<<<<<<<|=======|>>>>>>>' "$ROOT/apps/api/src/network" "$ROOT/apps/web/app/network" "$ROOT/apps/mobile/src/app/network.tsx" >/dev/null; then echo "FAIL conflict markers"; exit 1; fi
echo "PHASE 10 STATIC VERIFICATION: PASS"
