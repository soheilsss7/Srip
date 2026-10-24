#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
required=(
  scripts/backup-postgres.sh
  scripts/backup-base-pitr.sh
  scripts/restore-postgres.sh
  scripts/restore-pitr.sh
  scripts/verify-backup-integrity.sh
  scripts/verify-restore.sh
  scripts/create-backup-manifest.sh
  scripts/apply-backup-retention.sh
  scripts/backup-scheduler.sh
  scripts/restore-drill.sh
  scripts/backup-restore-smoke.sh
  scripts/disaster-drill.sh
  scripts/measure-rpo.sh
  infra/docker/Dockerfile.postgres-dr
  infra/backup/archive-wal.sh
  infra/backup/s3-lifecycle.json
  docs/runbooks/DISASTER_RECOVERY.md
  tests/dr/backup-restore-smoke.sh
)
for f in "${required[@]}"; do test -f "$root/$f" || { echo "MISSING:$f"; exit 1; }; done
for f in "${required[@]}"; do
  [[ "$f" != *.json && "$f" != *.md && "$f" != *Dockerfile* ]] && bash -n "$root/$f"
done
for token in \
  'archive_mode=on' 'archive_command' 'wal_level=replica' 'archive_timeout' \
  'BACKUP_ENCRYPTION_KEY' 'BACKUP_RETENTION_DAYS' 'RPO_TARGET_MINUTES' 'RTO_TARGET_MINUTES' \
  'restore-drill.sh' 'disaster-drill.sh' 'verify-restore.sh' 'sha256sum' \
  'pg_restore --list' 'convalidated = false' 'DRILL_ADMIN_DATABASE_URL'
do
  grep -Rqs --exclude-dir=.git "$token" "$root/scripts" "$root/infra" "$root/docs/runbooks" "$root/tests/dr" \
    || { echo "MISSING_TOKEN:$token"; exit 1; }
done
python3 - <<PY
import json
json.load(open('$root/infra/backup/s3-lifecycle.json'))
PY
printf 'PHASE42_DR_STATIC_CHECK=PASS\n'
