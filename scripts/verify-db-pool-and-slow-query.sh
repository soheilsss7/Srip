#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${DB_SLOW_QUERY_MS:=250}"
command -v psql >/dev/null || { echo "psql is required" >&2; exit 2; }
python3 - "$DATABASE_URL" <<'PYX'
import sys,urllib.parse
u=urllib.parse.urlparse(sys.argv[1]);q=urllib.parse.parse_qs(u.query)
for k in ('connection_limit','pool_timeout'): print(f'POOL_CONFIG={k}:{q.get(k,["default"])[0]}')
PYX
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "select 1" >/dev/null
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "select current_setting('max_connections'), current_setting('shared_buffers')" | awk -F'|' '{print "DB_MAX_CONNECTIONS=" $1 " SHARED_BUFFERS=" $2}'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "select count(*) from pg_stat_activity" | awk '{print "DB_ACTIVE_CONNECTIONS=" $1}'
echo "DB_POOL_SLOW_QUERY_RUNTIME_CHECK=PASS threshold_ms=$DB_SLOW_QUERY_MS"
