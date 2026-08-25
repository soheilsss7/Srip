#!/usr/bin/env bash
set -euo pipefail

backup="${1:?usage: verify-backup-integrity.sh <backup-file>}"
test -f "$backup" || { echo "Backup not found: $backup" >&2; exit 1; }
test -f "$backup.sha256" || { echo "Checksum missing: $backup.sha256" >&2; exit 1; }
sha256sum -c "$backup.sha256"
if [[ "$backup" == *.enc ]]; then
  : "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required for encrypted backups}"
  tmp="$(mktemp --suffix=.dump)"
  trap 'rm -f "$tmp"' EXIT
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -pass env:BACKUP_ENCRYPTION_KEY -in "$backup" -out "$tmp"
  if file "$tmp" | grep -qi 'PostgreSQL custom database dump'; then
    pg_restore --list "$tmp" >/dev/null
  else
    echo "Encrypted backup decrypted successfully; format validation is caller-specific." 
  fi
fi
echo "Backup integrity verification passed: $backup"
