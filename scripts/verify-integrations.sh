#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"

test -f "$API/src/integrations/integration-reconciliation.service.ts"
test -f "$API/src/integrations/google.integration-provider.ts"
test -f "$API/src/integrations/microsoft.integration-provider.ts"
test -f "$API/src/integrations/integrations.service.ts"
test -f "$API/prisma/migrations/20260824_integrations_reconciliation/migration.sql"

grep -q "IntegrationExternalRecord" "$API/prisma/schema.prisma"
grep -q "IntegrationSyncRun" "$API/prisma/schema.prisma"
grep -q "DRIVE TEAMS SHAREPOINT" "$API/prisma/schema.prisma"
grep -q "threadId" "$API/src/integrations/google.integration-provider.ts"
grep -q "conversationId" "$API/src/integrations/microsoft.integration-provider.ts"
grep -q "cancelled" "$API/src/integrations/integration-reconciliation.service.ts"
grep -q "meetingParticipant" "$API/src/integrations/integration-reconciliation.service.ts"
grep -q "relationshipFor" "$API/src/integrations/integration-reconciliation.service.ts"
grep -q "refresh" "$API/src/integrations/integrations.service.ts"

echo "INTEGRATIONS_STATIC_CHECK=PASS"
