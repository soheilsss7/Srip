#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== SRIP baseline audit =="
for path in apps/api/prisma/schema.prisma apps/api/src/main.ts apps/web/app/page.tsx apps/mobile/src/app/index.tsx packages/design-system/src/index.ts docs/PHASE_0_6_EXECUTION_CONTRACT.md docs/RECONCILIATION_BASELINE.md; do
  test -f "$ROOT/$path" && echo "OK  $path" || { echo "MISS $path"; exit 1; }
done
models=$(grep -c '^model ' "$ROOT/apps/api/prisma/schema.prisma")
controllers=$(find "$ROOT/apps/api/src" -name '*.controller.ts' | wc -l | tr -d ' ')
modules=$(find "$ROOT/apps/api/src" -name '*.module.ts' | wc -l | tr -d ' ')
echo "Prisma models: $models"
echo "API controllers: $controllers"
echo "API modules: $modules"
if grep -RInE 'web tests placeholder|NotImplemented|TODO: REMOVE' "$ROOT/apps" "$ROOT/packages" >/tmp/srip-audit-matches 2>/dev/null; then
  echo "Potential placeholder markers:"; cat /tmp/srip-audit-matches
  exit 1
fi
echo "Baseline static audit OK"
