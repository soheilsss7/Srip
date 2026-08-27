#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
for f in \
  "$API/src/workflows/workflow-event.listener.ts" \
  "$API/src/workflows/workflows.service.ts" \
  "$API/src/workflows/workflows.module.ts" \
  "$API/src/event-bus/event-bus.service.ts" \
  "$API/src/event-bus/event-bus.constants.ts" \
  "$API/prisma/migrations/20260110120000_workflow_event_integration/migration.sql"; do
  test -f "$f" || { echo "MISSING: $f"; exit 1; }
done
for ev in organization person relationship interaction meeting commitment action score opportunity recommendation; do
  grep -q "${ev}\." "$API/src/event-bus/event-bus.constants.ts" || { echo "MISSING EVENT FAMILY: $ev"; exit 1; }
done
grep -q 'triggerFromDomainEvent' "$API/src/workflows/workflows.service.ts"
grep -q 'WorkflowEventDelivery' "$API/prisma/schema.prisma"
grep -q 'WorkflowEventListener' "$API/src/workflows/workflows.module.ts"
grep -q 'await this.emit(event)' "$API/src/event-bus/event-bus.service.ts"
grep -q 'systemExecution' "$API/src/workflows/workflows.service.ts"
echo 'WORKFLOW_EVENT_INTEGRATION_STATIC_CHECK=PASS'
