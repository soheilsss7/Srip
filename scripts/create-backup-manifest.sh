#!/usr/bin/env bash
set -euo pipefail

backup="${1:?usage: create-backup-manifest.sh <backup-file> [manifest-file]}"
test -f "$backup" || { echo "Backup not found: $backup" >&2; exit 1; }
out="${2:-$backup.manifest.json}"
mkdir -p "$(dirname "$out")"
checksum="$(sha256sum "$backup" | awk '{print $1}')"
size="$(stat -c '%s' "$backup")"
created="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

python3 - "$backup" "$out" "$checksum" "$size" "$created" <<'PY'
import json, pathlib, sys
backup, out, checksum, size, created = sys.argv[1:]
meta = pathlib.Path(backup + '.metadata')
metadata = {}
if meta.exists():
    for line in meta.read_text().splitlines():
        if '=' in line:
            k, v = line.split('=', 1)
            metadata[k] = v
payload = {
    'backup': pathlib.Path(backup).name,
    'sha256': checksum,
    'size_bytes': int(size),
    'manifest_created_at': created,
    'metadata': metadata,
    'integrity': 'checksum-recorded'
}
pathlib.Path(out).write_text(json.dumps(payload, indent=2) + '\n')
PY
printf 'BACKUP_MANIFEST=%s\n' "$out"
