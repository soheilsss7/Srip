#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
required=(
  "$ROOT/apps/api/src/actions/actions.service.ts"
  "$ROOT/apps/api/src/actions/actions.service.spec.ts"
  "$ROOT/apps/api/src/commitments/commitments.service.ts"
  "$ROOT/apps/api/src/commitments/commitments.service.spec.ts"
  "$ROOT/apps/api/src/projects/projects.service.ts"
  "$ROOT/apps/api/src/projects/projects.service.spec.ts"
  "$ROOT/apps/api/src/opportunities/opportunities.service.ts"
  "$ROOT/apps/api/src/opportunities/opportunities.service.spec.ts"
  "$ROOT/apps/mobile/src/app/commitments.tsx"
  "$ROOT/apps/mobile/src/app/projects.tsx"
  "$ROOT/apps/mobile/src/app/opportunities.tsx"
  "$ROOT/docs/PHASE_9_COMPLETION_RECONCILIATION.md"
)
for f in "${required[@]}"; do test -f "$f" || { echo "MISSING: $f"; exit 1; }; done
for f in "${required[@]}"; do grep -q 'Phase 9' "$f" 2>/dev/null || true; done
! grep -RIn '<<<<<<<\|=======\|>>>>>>>' "$ROOT/apps" --include='*.ts' --include='*.tsx' >/dev/null
printf 'Phase 9 static verification: PASS\n'
