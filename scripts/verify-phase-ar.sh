#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
fail=0

required=(
  "apps/api/prisma/schema.prisma"
  "apps/api/src/auth/auth.service.ts"
  "apps/api/src/common/mfa/mfa.service.ts"
  "apps/api/src/common/authorization/authorization.service.ts"
  "apps/api/src/common/authorization/field-security.service.ts"
  "apps/api/src/scoring/relationship-score.service.ts"
  "apps/api/src/scoring/opportunity-score.service.ts"
  "apps/api/src/scoring/risk-score.service.ts"
  "apps/api/src/scoring/connector-score.service.ts"
  "apps/api/src/scoring/network-score.service.ts"
  "apps/api/src/network/network.service.ts"
  "apps/api/src/search/search.service.ts"
  "apps/api/src/notifications/notification-rule-engine.service.ts"
  "apps/api/src/workflows/workflows.service.ts"
  "apps/api/src/event-bus/event-bus.service.ts"
  "apps/api/src/event-bus/event-bus.worker.ts"
  "apps/api/src/data-management/data-import.service.ts"
  "apps/api/src/data-management/data-quality.service.ts"
  "apps/api/src/data-management/duplicate-detection.service.ts"
  "apps/api/src/common/data-lifecycle/data-lifecycle.service.ts"
  "apps/api/src/common/security/secret-encryption.service.ts"
  "apps/api/src/observability/trace.service.ts"
  "apps/api/src/observability/metrics.service.ts"
  "apps/api/src/observability/observability.middleware.ts"
)

for f in "${required[@]}"; do
  if [[ ! -f "$ROOT/$f" ]]; then
    echo "FAIL missing canonical foundation: $f"
    fail=1
  else
    echo "PASS foundation present: $f"
  fi
done

# Schema contract checks for the established foundation.
for model in User Session Organization Person Relationship Interaction Meeting Action Commitment Project ProjectRequirement Opportunity Recommendation Notification AuditLog Permission Workflow DomainEventOutbox IdempotencyRecord FeatureFlag Tag TagAssignment IntegrationWebhookEvent; do
  if ! grep -qE "^model ${model}[[:space:]]*\{" "$API/prisma/schema.prisma"; then
    echo "FAIL schema model missing: $model"
    fail=1
  else
    echo "PASS schema model: $model"
  fi
done

# Canonical ownership checks. These prevent accidental parallel engines.
checks=(
  "apps/api/src/scoring/relationship-score.service.ts:Relationship scoring remains in scoring module"
  "apps/api/src/notifications/notification-rule-engine.service.ts:Notification rule engine remains canonical"
  "apps/api/src/event-bus/event-bus.service.ts:Event bus remains canonical"
  "apps/api/src/common/data-lifecycle/data-lifecycle.service.ts:Data lifecycle remains centralized"
)
for item in "${checks[@]}"; do
  file="${item%%:*}"; label="${item#*:}"
  [[ -f "$ROOT/$file" ]] && echo "PASS ownership: $label" || { echo "FAIL ownership: $label"; fail=1; }
done

if (( fail )); then
  echo "PHASE_AR_RECONCILIATION=FAIL"
  exit 1
fi

echo "PHASE_AR_RECONCILIATION=PASS"
