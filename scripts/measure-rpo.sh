#!/usr/bin/env bash
set -euo pipefail

backup="${1:?usage: measure-rpo.sh <backup-file> [last-known-good-utc] }"
last_good="${2:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
test -f "$backup.metadata" || { echo "Backup metadata missing" >&2; exit 1; }
created="$(awk -F= '$1=="created_at"{print $2}' "$backup.metadata")"
python3 - "$created" "$last_good" <<'PY'
import datetime, sys
fmt='%Y-%m-%dT%H:%M:%SZ'
a=datetime.datetime.strptime(sys.argv[1],fmt).replace(tzinfo=datetime.timezone.utc)
b=datetime.datetime.strptime(sys.argv[2],fmt).replace(tzinfo=datetime.timezone.utc)
print(f'RPO_seconds={max(0,int((b-a).total_seconds()))}')
PY
