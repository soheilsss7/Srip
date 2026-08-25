#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
required=(
  "$API/src/notifications/notification-rule-engine.service.ts"
  "$API/src/notifications/canonical-business-alerts.ts"
  "$API/src/notifications/canonical-business-alerts.service.ts"
  "$API/src/notifications/notification-alerts.controller.ts"
  "$API/src/workflows/workflows.service.ts"
  "$API/src/workflows/workflow-approval.service.ts"
  "$API/src/approvals/approval.service.ts"
  "$API/src/data-management/data-import.service.ts"
  "$API/src/reporting/reporting.service.ts"
  "$API/src/integrations/integrations.service.ts"
  "$API/src/integrations/integration-webhook.controller.ts"
  "$API/src/integrations/integrations.module.ts"
)
for f in "${required[@]}"; do test -f "$f" || { echo "missing: $f"; exit 1; }; done

grep -q "EventBusModule" "$API/src/integrations/integrations.module.ts"
grep -q "APPROVAL_ACTIONS.DATA_IMPORT" "$API/src/data-management/data-import.service.ts"
grep -q "assertApproved" "$API/src/reporting/reporting.service.ts"
grep -q "notificationRuleDelivery" "$API/src/notifications/notification-rule-engine.service.ts"
grep -q "timingSafeEqual" "$API/src/integrations/integrations.service.ts"
grep -q "oauthStateHash" "$API/src/integrations/integrations.service.ts"
grep -q "approval.decide" "$API/src/approvals/approval.service.ts"
grep -q "Requester cannot approve their own request" "$API/src/approvals/approval.service.ts"
gn=$(grep -Ec 'RELATIONSHIP_DECAY|COMMITMENT_OVERDUE|MEETING_WITHOUT_OUTCOME|LONG_INACTIVITY|PERSON_POSITION_CHANGE|SCORE_DECREASE|SINGLE_POINT_OF_CONTACT_RISK|NEW_OPPORTUNITY|PROJECT_WITHOUT_SUFFICIENT_RELATIONSHIP' "$API/src/notifications/canonical-business-alerts.ts")
test "$gn" -ge 9

echo "Package 4 static verification: PASS"
