#!/usr/bin/env bash
set -euo pipefail

: "${DRILL_ADMIN_DATABASE_URL:?DRILL_ADMIN_DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
backup="${1:?usage: restore-drill.sh <backup.dump.enc> [database-name]}"
db_name="${2:-srip_restore_drill_$(date -u +%Y%m%d%H%M%S)}"
[[ "$db_name" =~ ^[a-zA-Z_][a-zA-Z0-9_]{0,62}$ ]] || { echo "Invalid drill database name" >&2; exit 1; }
start_epoch="$(date +%s)"

"$(dirname "$0")/verify-backup-integrity.sh" "$backup"

echo "Creating isolated restore database: $db_name"
createdb "$DRILL_ADMIN_DATABASE_URL" "$db_name"
cleanup() { dropdb --if-exists "$DRILL_ADMIN_DATABASE_URL" "$db_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

restore_url="${DRILL_RESTORE_DATABASE_URL:-$DRILL_ADMIN_DATABASE_URL/$db_name}"
tmp="$(mktemp --suffix=.dump)"
trap 'rm -f "$tmp"; cleanup' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY -in "$backup" -out "$tmp"
pg_restore --list "$tmp" >/dev/null
pg_restore "$restore_url" --clean --if-exists --no-owner "$tmp"

RESTORE_DATABASE_URL="$restore_url" "$(dirname "$0")/verify-restore.sh"

public_tables="$(psql "$restore_url" -Atqc "select count(*) from pg_tables where schemaname='public'")"
[[ "$public_tables" =~ ^[0-9]+$ && "$public_tables" -gt 0 ]] || { echo "Restore drill failed: no public tables" >&2; exit 1; }
end_epoch="$(date +%s)"
rto_seconds=$((end_epoch-start_epoch))

evidence="${DRILL_EVIDENCE_FILE:-./backups/restore-drill-$(date -u +%Y%m%dT%H%M%SZ).json}"
mkdir -p "$(dirname "$evidence")"
cat > "$evidence" <<JSON
{
  "backup": "$(basename "$backup")",
  "restore_database": "$db_name",
  "started_at": "$(date -u -d "@$start_epoch" +%Y-%m-%dT%H:%M:%SZ)",
  "completed_at": "$(date -u -d "@$end_epoch" +%Y-%m-%dT%H:%M:%SZ)",
  "rto_seconds": $rto_seconds,
  "public_table_count": $public_tables,
  "integrity": "passed",
  "schema_verification": "passed",
  "constraint_verification": "passed",
  "restore": "passed"
}
JSON

echo "Restore drill PASSED; measured RTO=${rto_seconds}s; public tables=${public_tables}"
