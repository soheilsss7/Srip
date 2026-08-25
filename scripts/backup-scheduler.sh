#!/usr/bin/env bash
set -euo pipefail

interval="${BACKUP_INTERVAL_SECONDS:-86400}"
backup_dir="${BACKUP_DIR:-/backups}"
lock_file="${BACKUP_LOCK_FILE:-$backup_dir/.backup-scheduler.lock}"
mkdir -p "$backup_dir"
exec 9>"$lock_file"
if ! flock -n 9; then
  echo "Another backup scheduler is already running: $lock_file" >&2
  exit 1
fi

run_backup() {
  local stamp="$1"
  local logical="$backup_dir/srip-$stamp.dump.enc"
  local pitr="$backup_dir/pitr-base-$stamp.tar.gz.enc"
  /scripts/backup-postgres.sh "$logical"
  /scripts/create-backup-manifest.sh "$logical"
  /scripts/backup-base-pitr.sh "$pitr"
  /scripts/create-backup-manifest.sh "$pitr"
  /scripts/verify-backup-integrity.sh "$logical"
  /scripts/verify-backup-integrity.sh "$pitr"
  /scripts/apply-backup-retention.sh "$backup_dir"
}

while true; do
  run_backup "$(date -u +%Y%m%dT%H%M%SZ)"
  sleep "$interval"
done
