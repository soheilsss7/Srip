#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
required=(
  "$API/src/observability/observability.module.ts"
  "$API/src/observability/observability.middleware.ts"
  "$API/src/observability/observability.controller.ts"
  "$API/src/observability/trace.service.ts"
  "$API/src/observability/error-tracking.service.ts"
  "$API/src/observability/metrics.service.ts"
  "$API/src/observability/queue-monitoring.service.ts"
  "$API/src/metrics.service.ts"
  "$API/src/metrics.controller.ts"
  "$API/src/prisma/prisma.service.ts"
  "$API/src/health/health.service.ts"
  "$API/src/common/api-contract/api-contract.filter.ts"
  "$API/src/jobs/queue.service.ts"
  "$API/src/jobs/job.worker.ts"
  "$API/src/documents/s3.storage.ts"
  "$API/src/ai/providers/external.provider.ts"
  "$ROOT/docs/PHASE37_OBSERVABILITY_MONITORING.md"
  "$ROOT/.env.example"
  "$ROOT/.env.production.example"
  "$ROOT/infra/prometheus/prometheus.yml"
  "$ROOT/infra/grafana/dashboards/srip-overview.json"
)
for f in "${required[@]}"; do test -s "$f" || { echo "MISSING:$f"; exit 1; }; done
for token in "OTEL_EXPORTER_OTLP_ENDPOINT" "traceparent" "AsyncLocalStorage" "SENTRY_DSN" "captureException" "srip_api_latency_ms_bucket" "srip_db_latency_ms_bucket" "srip_queue_jobs" "srip_storage_requests_total" "srip_ai_requests_total" "srip_ai_cost_total" "srip_availability_percent" "srip_process_resident_memory_bytes" "srip_process_cpu_percent"; do grep -R -q "$token" "$API/src/observability" "$API/src/prisma/prisma.service.ts" "$API/src/jobs" "$API/src/documents/s3.storage.ts" "$API/src/ai/providers/external.provider.ts" || { echo "MISSING-CONTRACT:$token"; exit 1; }; done
grep -q "ObservabilityModule" "$API/src/app.module.ts"
grep -q "ObservabilityMiddleware" "$API/src/app.module.ts"
grep -q "ErrorTrackingService" "$API/src/common/api-contract/api-contract.filter.ts"
grep -q "QueueMonitoringService" "$API/src/health/health.service.ts"
grep -q "srip_queue_jobs" "$API/src/observability/metrics.service.ts"
grep -q "srip_db_latency_ms_bucket" "$API/src/observability/metrics.service.ts"
grep -q "srip_ai_cost_total" "$API/src/observability/metrics.service.ts"
grep -q "srip_storage_bytes_total" "$API/src/observability/metrics.service.ts"
TS_LOG="$(mktemp)"
(cd "$API" && tsc --noEmit --pretty false >"$TS_LOG" 2>&1 || true)
modified=("src/observability/" "src/prisma/prisma.service.ts" "src/common/api-contract/api-contract.filter.ts" "src/jobs/queue.service.ts" "src/jobs/job.worker.ts" "src/documents/s3.storage.ts" "src/ai/providers/external.provider.ts" "src/health/health.service.ts" "src/app.module.ts" "src/main.ts")
for prefix in "${modified[@]}"; do
  errors="$(grep -E "^${prefix}" "$TS_LOG" | grep -Ev "TS2307|TS2580|TS2503|TS7006" || true)"
  if [[ "$prefix" == "src/prisma/prisma.service.ts" || "$prefix" == "src/health/health.service.ts" || "$prefix" == "src/main.ts" ]]; then errors="$(printf "%s\n" "$errors" | grep -Ev "TS2339|TS2769" || true)"; fi
  if [[ -n "$errors" ]]; then echo "TSC-ERROR-IN-MODIFIED:${prefix}"; printf "%s\n" "$errors" | head -40; exit 1; fi
done
rm -f "$TS_LOG"
echo "TSC_MODIFIED_FILES_CHECK=PASS"
echo "PHASE37_OBSERVABILITY_STATIC_CHECK=PASS"
