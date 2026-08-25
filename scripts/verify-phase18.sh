#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
required=(
  docker-compose.production.yml
  .env.production.example
  infra/docker/Dockerfile.api
  infra/docker/Dockerfile.web
  infra/prometheus/prometheus.yml
  infra/grafana/provisioning/datasources/datasource.yml
  infra/grafana/dashboards/dashboard.yml
  infra/grafana/dashboards/srip-overview.json
  scripts/backup-postgres.sh
  scripts/restore-postgres.sh
  docs/PHASE_18_PRODUCTION_HARDENING.md
  apps/api/src/metrics.service.ts
  apps/api/src/metrics.controller.ts
  apps/api/src/production-hardening.ts
)
for f in "${required[@]}"; do test -f "$root/$f" || { echo "MISSING: $f"; exit 1; }; done

grep -q "@Controller('metrics')" "$root/apps/api/src/metrics.controller.ts"
grep -q "srip_http_requests_total" "$root/apps/api/src/metrics.service.ts"
grep -q "prometheus:" "$root/docker-compose.production.yml"
grep -q "grafana:" "$root/docker-compose.production.yml"
grep -q "pg_dump" "$root/scripts/backup-postgres.sh"
grep -q "pg_restore" "$root/scripts/restore-postgres.sh"

echo "Phase 18 static production-hardening verification OK"

grep -q "ProductionHardeningMiddleware" "$root/apps/api/src/app.module.ts"
grep -q "SERVICE_UNAVAILABLE" "$root/apps/api/src/health/health.controller.ts"
grep -q "migrate:" "$root/docker-compose.production.yml"
grep -q "sha256sum" "$root/scripts/backup-postgres.sh"
