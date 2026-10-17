#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
: "${DRILL_ADMIN_DATABASE_URL:?DRILL_ADMIN_DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
backup="${1:?usage: tests/dr/backup-restore-smoke.sh <backup.dump.enc> }"

"$root/scripts/backup-restore-smoke.sh" "$backup"
echo 'BACKUP_RESTORE_DR_TEST=PASS'
