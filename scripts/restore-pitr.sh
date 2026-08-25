#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${PITR_TARGET_TIME:?PITR_TARGET_TIME is required (UTC ISO-8601)}"
: "${PITR_WAL_SOURCE:?PITR_WAL_SOURCE is required, e.g. s3://bucket/prefix/wal}"
base="${1:?usage: restore-pitr.sh <pitr-base.tar.gz.enc> [target-data-dir]}"
test -f "$base" || { echo "PITR base backup not found: $base" >&2; exit 1; }
test -f "$base.sha256" && sha256sum -c "$base.sha256"

data_dir="${2:-./pitr-restore-data}"
rm -rf "$data_dir"
mkdir -p "$data_dir"
tmp="$(mktemp --suffix=.base.tar.gz)"
cleanup() { rm -f "$tmp"; }
trap cleanup EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY -in "$base" -out "$tmp"
tar -xzf "$tmp" -C "$data_dir"
base_dir="$data_dir/base"

cat > "$base_dir/postgresql.auto.conf" <<CONF
restore_command = 'aws s3 cp ${PITR_WAL_SOURCE}/%f %p'
recovery_target_time = '${PITR_TARGET_TIME}'
recovery_target_action = 'pause'
CONF
touch "$base_dir/recovery.signal"

echo "PITR restore data prepared at $base_dir"
echo "Start PostgreSQL with this data directory and verify recovery_target_time=${PITR_TARGET_TIME}."
