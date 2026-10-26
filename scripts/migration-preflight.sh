#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
backup_dir="${BACKUP_DIR:-$root/backups/migration-preflight}"
mkdir -p "$backup_dir"
backup="$backup_dir/pre-migration-$(date -u +%Y%m%dT%H%M%SZ).dump.enc"
"$root/scripts/backup-postgres.sh" "$backup"
"$root/scripts/create-backup-manifest.sh" "$backup"
"$root/scripts/verify-backup-integrity.sh" "$backup"
printf 'MIGRATION_PREFLIGHT_BACKUP=%s\nMIGRATION_PREFLIGHT=PASS\n' "$backup"
