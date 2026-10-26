#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
backup="${1:?usage: restore-postgres.sh <backup.dump.enc>}"
test -f "$backup" || { echo "Backup not found: $backup" >&2; exit 1; }
if test -f "$backup.sha256"; then sha256sum -c "$backup.sha256"; fi

tmp="$(mktemp --suffix=.dump)"
cleanup() { rm -f "$tmp"; }
trap cleanup EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY -in "$backup" -out "$tmp"
pg_restore --list "$tmp" >/dev/null
pg_restore "$DATABASE_URL" --clean --if-exists --no-owner "$tmp"
echo "Encrypted backup restore completed from $backup"
