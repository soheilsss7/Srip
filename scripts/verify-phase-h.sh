#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA="$ROOT/apps/api/prisma/schema.prisma"
SERVICE="$ROOT/apps/api/src/approvals/approval.service.ts"
REL="$ROOT/apps/api/src/relationships/relationships.service.ts"
LIFE="$ROOT/apps/api/src/common/data-lifecycle/data-lifecycle.service.ts"
REPORT="$ROOT/apps/api/src/reporting/reporting.service.ts"

grep -q "model ApprovalRequest" "$SCHEMA"
grep -q "SENSITIVE_RELATIONSHIP_CREATE" "$SERVICE"
grep -q "STRATEGIC_SCORE_CHANGE" "$SERVICE"
grep -q "DATA_SHARING" "$SERVICE"
grep -q "APPROVAL_ACTIONS.EXPORT" "$SERVICE"
grep -q "APPROVAL_ACTIONS.DELETE" "$SERVICE"
grep -q "APPROVAL_ACTIONS.SENSITIVE_RELATIONSHIP_CREATE" "$REL"
grep -q "APPROVAL_ACTIONS.STRATEGIC_SCORE_CHANGE" "$REL"
grep -q "approvalRequest" "$LIFE"
grep -q "APPROVAL_ACTIONS.EXPORT" "$REPORT"
if grep -q "dataDeletionApproval" "$LIFE"; then
  echo "FAIL: legacy DataDeletionApproval is still used by DataLifecycleService"
  exit 1
fi
echo "PHASE_H_APPROVAL_VERIFICATION=PASS"
