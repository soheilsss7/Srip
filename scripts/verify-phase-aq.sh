#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/apps/api/src/common/domain-ownership.contract.ts"
test -f "$ROOT/apps/api/src/workflows/workflow-approval.service.ts"
grep -q "WorkflowApprovalService" "$ROOT/apps/api/src/workflows/workflows.service.ts"
grep -q "WorkflowApprovalService" "$ROOT/apps/api/src/workflows/workflows.module.ts"
! grep -Eq "DEFAULT_RELATIONSHIP_WEIGHTS|RELATIONSHIP_SCORE_FACTORS|normalizeWeights|resolveWeights" "$ROOT/apps/api/src/relationships/relationships.service.ts"
! grep -Eq "workflowApproval\.(create|update|updateMany|findUnique|findUniqueOrThrow)" "$ROOT/apps/api/src/workflows/workflows.service.ts"
grep -q "ScoringModule" "$ROOT/apps/api/src/common/domain-ownership.contract.ts"
grep -q "NotificationRuleEngineService" "$ROOT/apps/api/src/common/domain-ownership.contract.ts"
grep -q "AuditService" "$ROOT/apps/api/src/common/domain-ownership.contract.ts"
grep -q "EventBusService" "$ROOT/apps/api/src/common/domain-ownership.contract.ts"
echo "PHASE_AQ_DOMAIN_OWNERSHIP_STATIC=PASS"
