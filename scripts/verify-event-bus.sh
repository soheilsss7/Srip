#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
required=(
  "event-bus/event-bus.service.ts"
  "event-bus/event-bus.module.ts"
  "event-bus/event-bus.worker.ts"
  "event-bus/event-bus.constants.ts"
)
for f in "${required[@]}"; do test -f "$API/src/$f" || { echo "missing $f"; exit 1; }; done
for e in organization person relationship interaction meeting commitment action score opportunity recommendation; do
  grep -Rqi "eventType:.*${e}\." "$API/src" || { echo "missing event family: $e"; exit 1; }
done
grep -q "model DomainEventOutbox" "$API/prisma/schema.prisma"
grep -q "enum DomainEventStatus" "$API/prisma/schema.prisma"
grep -q "domainEventsDispatch" "$API/src/jobs/queue.constants.ts"
echo "EVENT_BUS_STATIC_CHECK=PASS"
