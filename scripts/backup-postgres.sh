#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

out="${1:-./backups/srip-$(date -u +%Y%m%dT%H%M%SZ).dump.enc}"
mkdir -p "$(dirname "$out")"
tmp="${out%.enc}.dump"
cleanup() { rm -f "$tmp"; }
trap cleanup EXIT

pg_dump "$DATABASE_URL" --format=custom --no-owner --file="$tmp"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -pass env:BACKUP_ENCRYPTION_KEY -in "$tmp" -out "$out"
sha256sum "$out" > "$out.sha256"
cat > "$out.metadata" <<META
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
format=postgres-custom
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

echo "Encrypted backup written to $out"
