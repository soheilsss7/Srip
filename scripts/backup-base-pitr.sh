#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
out="${1:-./backups/pitr-base-$(date -u +%Y%m%dT%H%M%SZ).tar.gz.enc}"
mkdir -p "$(dirname "$out")"
tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

pg_basebackup "$DATABASE_URL" -D "$tmpdir/base" -Ft -z -X stream --no-owner
printf 'created_at=%s\nbackup_type=pg_basebackup\npitr_ready=true\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$tmpdir/metadata"
tar -C "$tmpdir" -czf "$tmpdir/base.tar.gz" base metadata
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -pass env:BACKUP_ENCRYPTION_KEY -in "$tmpdir/base.tar.gz" -out "$out"
sha256sum "$out" > "$out.sha256"
cat > "$out.metadata" <<META
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
backup_type=pg_basebackup
pitr_ready=true
encrypted=true
cipher=aes-256-cbc
pbkdf2_iterations=200000
file=$out
META

if [[ -n "${BACKUP_S3_URI:-}" ]]; then
  command -v aws >/dev/null 2>&1 || { echo "aws CLI is required for BACKUP_S3_URI" >&2; exit 1; }
  aws s3 cp "$out" "$BACKUP_S3_URI/$(basename "$out")" ${BACKUP_S3_SSE:+--sse "$BACKUP_S3_SSE"} ${BACKUP_S3_KMS_KEY_ID:+--sse aws:kms --sse-kms-key-id "$BACKUP_S3_KMS_KEY_ID"}
  aws s3 cp "$out.sha256" "$BACKUP_S3_URI/$(basename "$out.sha256")"
  aws s3 cp "$out.metadata" "$BACKUP_S3_URI/$(basename "$out.metadata")"
fi

echo "PITR base backup written to $out"
