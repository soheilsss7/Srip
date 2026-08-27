#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo '[phase4] checking canonical files'
for f in \
  apps/api/src/notifications/notification-rule-engine.service.ts \
  apps/api/src/workflows/workflows.service.ts \
  apps/api/src/workflows/workflow-approval.service.ts \
  apps/api/src/approvals/approval.service.ts \
  apps/api/src/integrations/integrations.service.ts \
  apps/api/src/integrations/integration-webhook.controller.ts \
  apps/api/src/data-management/data-import.service.ts \
  apps/api/src/reporting/reporting.service.ts; do
  test -f "$f"
done

echo '[phase4] checking contracts'
grep -q "DATA_IMPORT" apps/api/src/approvals/approval.service.ts
grep -q "approvalRequestId" apps/api/src/data-management/data-import.service.ts
grep -q "DATA_IMPORT_COMPLETED" apps/api/src/event-bus/event-bus.constants.ts
grep -q "groupKey" apps/api/src/notifications/notifications.service.ts
grep -q "criticalOnly" apps/api/src/notifications/notification-rule-engine.service.ts
grep -q "rawBody" apps/api/src/integrations/integration-webhook.controller.ts
grep -q "assertApproved" apps/api/src/reporting/reporting.service.ts

echo '[phase4] checking schema/migration'
grep -q 'approvalRequestId String?' apps/api/prisma/schema.prisma
grep -q 'groupKey String?' apps/api/prisma/schema.prisma
grep -q 'criticalOnly Boolean' apps/api/prisma/schema.prisma
test -f apps/api/prisma/migrations/20260224120000_phase4_notifications_approval_import/migration.sql

echo '[phase4] PASS'
