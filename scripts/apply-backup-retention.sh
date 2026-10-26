#!/usr/bin/env bash
set -euo pipefail

backup_dir="${1:-./backups}"
retention_days="${BACKUP_RETENTION_DAYS:-35}"
find "$backup_dir" -type f \( -name '*.dump.enc' -o -name 'pitr-base-*.tar.gz.enc' \) -mtime "+$retention_days" -print -delete
if [[ -n "${BACKUP_S3_URI:-}" ]]; then
  echo "S3 lifecycle policy must enforce the same retention remotely; see infra/backup/s3-lifecycle.json."
fi
