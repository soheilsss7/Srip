#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
req=(
 "$ROOT/src/common/request-context.ts"
 "$ROOT/src/observability/observability.middleware.ts"
 "$ROOT/src/observability/trace.service.ts"
 "$ROOT/src/event-bus/event-bus.service.ts"
 "$ROOT/src/workflows/workflow-event.listener.ts"
 "$ROOT/src/jobs/queue.service.ts"
 "$ROOT/src/jobs/job.worker.ts"
 "$ROOT/prisma/schema.prisma"
)
for f in "${req[@]}"; do test -f "$f" || { echo "MISSING:$f"; exit 1; }; done
grep -q "requestId String?" "$ROOT/prisma/schema.prisma"
grep -q "correlationId String?" "$ROOT/prisma/schema.prisma"
grep -q "_requestId" "$ROOT/src/jobs/queue.service.ts"
grep -q "_correlationId" "$ROOT/src/jobs/queue.service.ts"
grep -q "event.requestId" "$ROOT/src/workflows/workflow-event.listener.ts"
grep -q "X-Trace-ID" "$ROOT/src/observability/observability.middleware.ts"
echo "PHASE_AC_OBSERVABILITY_CORRELATION=PASS"
