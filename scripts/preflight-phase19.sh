#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
mode="${1:---static}"
required=(
  docs/PHASE_19_PRODUCTION_LAUNCH.md
  docs/PHASE_19_COMPLETION_RECONCILIATION.md
  docs/RELEASE_CHECKLIST.md
  docs/RELEASE_NOTES_TEMPLATE.md
  docs/release/RELEASE_EVIDENCE_MANIFEST.md
  docs/runbooks/PRODUCTION_RELEASE.md
  docs/runbooks/PRODUCTION_ROLLBACK.md
  docs/runbooks/PRODUCTION_GO_NO_GO.md
  docs/runbooks/MOBILE_RELEASE.md
  scripts/backup-postgres.sh
  scripts/restore-postgres.sh
  docker-compose.production.yml
  .env.production.example
)
for f in "${required[@]}"; do test -f "$root/$f" || { echo "MISSING: $f"; exit 1; }; done

for f in infra/docker/Dockerfile.api infra/docker/Dockerfile.web infra/prometheus/prometheus.yml; do
  test -f "$root/$f" || { echo "MISSING: $f"; exit 1; }
done

grep -q 'Production / Launch' "$root/docs/PHASE_19_PRODUCTION_LAUNCH.md"
grep -q 'NO-GO' "$root/docs/runbooks/PRODUCTION_GO_NO_GO.md"
grep -q 'PENDING' "$root/docs/release/RELEASE_EVIDENCE_MANIFEST.md"

echo "Repository release artifacts: OK"

if [[ "$mode" == "--static" ]]; then
  echo "External production validation intentionally not performed in static mode."
  exit 0
fi

if [[ "$mode" != "--production" ]]; then
  echo "Usage: $0 --static | --production" >&2
  exit 2
fi

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
: "${WEB_ORIGIN:?WEB_ORIGIN is required}"
: "${NEXT_PUBLIC_API_URL:?NEXT_PUBLIC_API_URL is required}"

for value_name in POSTGRES_PASSWORD JWT_SECRET GRAFANA_ADMIN_PASSWORD; do
  value="${!value_name:-}"
  if [[ -z "$value" || "$value" == *replace-with* ]]; then
    echo "Production secret is missing/default: $value_name" >&2
    exit 1
  fi
done

echo "Environment variable preflight: OK"
echo "This script does not deploy. Complete the evidence manifest and signed GO decision before deployment."
