#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_S3_URI:?BACKUP_S3_URI is required for WAL archiving}"
file="${1:?archive source path required}"
name="${2:?WAL filename required}"
args=(s3 cp "$file" "$BACKUP_S3_URI/wal/$name")
if [[ -n "${BACKUP_S3_SSE:-AES256}" ]]; then args+=(--sse "${BACKUP_S3_SSE:-AES256}"); fi
if [[ -n "${BACKUP_S3_KMS_KEY_ID:-}" ]]; then args+=(--sse aws:kms --sse-kms-key-id "$BACKUP_S3_KMS_KEY_ID"); fi
aws "${args[@]}"
