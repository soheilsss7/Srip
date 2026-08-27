#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail(){ echo "FAIL: $1" >&2; exit 1; }
pass(){ echo "PASS: $1"; }

schema="$ROOT/prisma/schema.prisma"
for f in "$schema" "$ROOT/src/interactions/interactions.service.ts" "$ROOT/src/meetings/meetings.service.ts" "$ROOT/src/actions/actions.service.ts" "$ROOT/src/commitments/commitments.service.ts" "$ROOT/src/projects/projects.service.ts" "$ROOT/src/opportunities/opportunities.service.ts" "$ROOT/src/common/pagination.ts"; do [[ -f "$f" ]] || fail "missing $f"; done

[[ "$(grep -c '^model ProjectRisk {' "$schema")" == 1 ]] || fail 'duplicate ProjectRisk model'
[[ "$(grep -c '^model ProjectMilestone {' "$schema")" == 1 ]] || fail 'duplicate ProjectMilestone model'
[[ "$(grep -c '^model ActionDependency {' "$schema")" == 1 ]] || fail 'duplicate ActionDependency model'
[[ "$(grep -c '^model ConnectionPath {' "$schema")" == 1 ]] || fail 'duplicate ConnectionPath model'
[[ "$(grep -c '^model Referral {' "$schema")" == 1 ]] || fail 'duplicate Referral model'

grep -q 'enum MeetingStatus' "$schema" || fail 'MeetingStatus missing'
grep -q 'enum ActionStatus { OPEN IN_PROGRESS BLOCKED DONE CANCELLED }' "$schema" || fail 'Action BLOCKED status missing'
grep -q 'reminderAt DateTime?' "$schema" || fail 'reminderAt missing'
grep -q 'recommendationId String?' "$schema" || fail 'Commitment recommendation linkage missing'
grep -q 'createdById String?' "$schema" || fail 'Action creator missing'
pass 'Phase 2 schema contract'

grep -q 'parsePagination' "$ROOT/src/interactions/interactions.service.ts" || fail 'Interaction pagination missing'
grep -q 'publishInTransaction' "$ROOT/src/interactions/interactions.service.ts" || fail 'Interaction transactional outbox missing'
grep -q 'MeetingStatus.COMPLETED' "$ROOT/src/meetings/meetings.service.ts" || fail 'Meeting completion state missing'
grep -q 'meetingParticipant.deleteMany' "$ROOT/src/meetings/meetings.service.ts" || fail 'Meeting participant reconciliation missing'
grep -q 'publishInTransaction' "$ROOT/src/meetings/meetings.service.ts" || fail 'Meeting transactional event missing'
grep -q 'ActionDependency' "$ROOT/src/actions/actions.service.ts" || fail 'Action dependency API missing'
grep -q 'ActionStatus.DONE' "$ROOT/src/actions/actions.service.ts" || fail 'Action completion event logic missing'
grep -q 'COMMITMENT_OVERDUE' "$ROOT/src/commitments/commitments.service.ts" || fail 'Commitment overdue event missing'
grep -q 'PROJECT_CREATED' "$ROOT/src/projects/projects.service.ts" || fail 'Project created event missing'
grep -q 'addRisk' "$ROOT/src/projects/projects.service.ts" || fail 'Project risk API missing'
grep -q 'addMilestone' "$ROOT/src/projects/projects.service.ts" || fail 'Project milestone API missing'
grep -q 'OPPORTUNITY_STATUS_CHANGED' "$ROOT/src/opportunities/opportunities.service.ts" || fail 'Opportunity status event missing'
pass 'Phase 2 domain services'

grep -q "@Get(':id/dependencies/:dependsOnActionId')" "$ROOT/src/actions/actions.controller.ts" && fail 'dependency delete route incorrectly GET'
grep -q "@Post(':id/dependencies/:dependsOnActionId')" "$ROOT/src/actions/actions.controller.ts" || fail 'dependency POST route missing'
grep -q "@Post(':id/risks')" "$ROOT/src/projects/projects.controller.ts" || fail 'project risk endpoint missing'
grep -q "@Post(':id/milestones')" "$ROOT/src/projects/projects.controller.ts" || fail 'project milestone endpoint missing'
pass 'Phase 2 API contracts'

migration="$ROOT/prisma/migrations/20260201120000_phase2_interaction_domain_completion/migration.sql"
for x in 'MeetingStatus' 'ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "status"' 'ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "reminderAt"' 'ALTER TABLE "Commitment" ADD COLUMN IF NOT EXISTS "recommendationId"'; do grep -q "$x" "$migration" || fail "migration missing $x"; done
pass 'Phase 2 migration'

echo 'PHASE 2 DOMAIN COMPLETION STRUCTURAL VERIFICATION: PASS'
