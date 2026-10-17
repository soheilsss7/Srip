#!/usr/bin/env bash
set -euo pipefail

# Non-destructive end-to-end DR gate. It never targets production directly.
: "${DRILL_ADMIN_DATABASE_URL:?DRILL_ADMIN_DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
backup="${1:?usage: backup-restore-smoke.sh <backup.dump.enc> [database-name]}"

"$(dirname "$0")/verify-backup-integrity.sh" "$backup"
DRILL_EVIDENCE_FILE="${DRILL_EVIDENCE_FILE:-./backups/backup-restore-smoke-$(date -u +%Y%m%dT%H%M%SZ).json}" \
  "$(dirname "$0")/restore-drill.sh" "$backup" "${2:-srip_restore_smoke_$(date -u +%Y%m%d%H%M%S)}"

printf 'BACKUP_RESTORE_SMOKE=PASS\n'
