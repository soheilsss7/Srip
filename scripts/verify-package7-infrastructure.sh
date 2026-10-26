#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
required=(
  apps/api/Dockerfile
  infra/docker/Dockerfile.api
  infra/docker/Dockerfile.web
  infra/docker/Dockerfile.postgres-dr
  docker-compose.production.yml
  scripts/backup-postgres.sh
  scripts/backup-base-pitr.sh
  scripts/backup-scheduler.sh
  scripts/verify-backup-integrity.sh
  scripts/restore-drill.sh
  scripts/disaster-drill.sh
  scripts/migration-preflight.sh
  scripts/performance-gate.sh
  tests/load/performance-benchmark.mjs
  tests/load/scalability-benchmark.mjs
  tests/load/scalability-concurrency.mjs
  scripts/release/validate-release-identity.sh
  CHANGELOG.md
  docs/infrastructure/PACKAGE7_INFRASTRUCTURE_BASELINE.md
  docs/runbooks/DISASTER_RECOVERY.md
  docs/runbooks/PRODUCTION_RELEASE.md
  docs/runbooks/PRODUCTION_ROLLBACK.md
)
for f in "${required[@]}"; do test -f "$ROOT/$f" || { echo "MISSING:$f"; exit 1; }; done
for f in scripts/backup-scheduler.sh scripts/migration-preflight.sh scripts/performance-gate.sh scripts/release/validate-release-identity.sh; do bash -n "$ROOT/$f"; done
node --check "$ROOT/tests/load/performance-benchmark.mjs"
node --check "$ROOT/tests/load/scalability-benchmark.mjs"
node --check "$ROOT/tests/load/scalability-concurrency.mjs"
grep -q 'USER srip' "$ROOT/apps/api/Dockerfile"
grep -q 'HEALTHCHECK' "$ROOT/apps/api/Dockerfile"
grep -q 'archive_mode=on' "$ROOT/docker-compose.production.yml"
grep -q 'migrate' "$ROOT/docker-compose.production.yml"
grep -q 'BACKUP_ENCRYPTION_KEY' "$ROOT/scripts/migration-preflight.sh"
grep -q 'P95' "$ROOT/docs/infrastructure/PACKAGE7_INFRASTRUCTURE_BASELINE.md"
grep -q 'RPO' "$ROOT/docs/infrastructure/PACKAGE7_INFRASTRUCTURE_BASELINE.md"
grep -qi 'rollback' "$ROOT/docs/infrastructure/PACKAGE7_INFRASTRUCTURE_BASELINE.md"
printf 'PACKAGE7_INFRASTRUCTURE_STATIC_CHECK=PASS\n'
