#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail(){ echo "PHASE 8 STATIC VERIFICATION FAILED: $1"; exit 1; }
for f in \
  apps/api/src/interactions/interactions.controller.ts \
  apps/api/src/interactions/interactions.service.ts \
  apps/api/src/meetings/meetings.controller.ts \
  apps/api/src/meetings/meetings.service.ts \
  apps/web/app/interactions/page.tsx \
  apps/web/app/meetings/page.tsx \
  docs/PHASE_8_INTERACTION_MEETING.md; do
  test -f "$ROOT/$f" || fail "missing $f"
done
grep -q "@Get(':id')" "$ROOT/apps/api/src/interactions/interactions.controller.ts" || fail "interaction detail endpoint missing"
grep -q "@Delete(':id')" "$ROOT/apps/api/src/interactions/interactions.controller.ts" || fail "interaction soft-delete endpoint missing"
grep -q "@Post(':id/outcome')" "$ROOT/apps/api/src/meetings/meetings.controller.ts" || fail "meeting outcome endpoint missing"
grep -q "@Put(':id/participants')" "$ROOT/apps/api/src/meetings/meetings.controller.ts" || fail "meeting participants endpoint missing"
grep -q "this.lifecycle.softDelete" "$ROOT/apps/api/src/meetings/meetings.service.ts" || fail "meeting soft delete missing"
grep -q "followUpRequired" "$ROOT/apps/api/src/interactions/interactions.controller.ts" || fail "follow-up validation missing"
echo "PHASE 8 STATIC VERIFICATION OK"
