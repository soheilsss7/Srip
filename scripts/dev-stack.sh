#!/usr/bin/env bash
# SRIP local dev stack launcher (Termux/Android):
# starts postgres -> redis -> api -> web, ordered and idempotent.
# Usage: bash scripts/dev-stack.sh [--restart]
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

logdir="${SRIP_STACK_LOG_DIR:-$HOME/.srip-stack}"
mkdir -p "$logdir"

timecode() { date '+%H:%M:%S'; }

pg_data="${PGDATA:-$PREFIX/var/lib/postgresql}"
pg_port=5432
redis_port=6379
api_port=4000
web_port=3000

pg_up()      { pg_isready -h 127.0.0.1 -p "$pg_port" -q 2>/dev/null; }
redis_up()   { [ "$(redis-cli -p "$redis_port" ping 2>/dev/null)" = "PONG" ]; }
http_any()   { local c; c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:$1/" 2>/dev/null || true); [ "$c" != "000" ] && [ -n "$c" ]; }
web_up()     { http_any "$web_port"; }
api_up()     { http_any "$api_port"; }

api_pids()   { pgrep -f 'node dist/main.js' | grep -v '^$$\b' || true; }
web_pids()   { pgrep -f 'next start' | grep -v '^$$\b' || true; }

stop() {
  echo "[$(timecode)] stopping existing api/web (incl. watchdog proots)..."
  for p in $(api_pids); do kill -9 "$p" 2>/dev/null || true; done
  for p in $(web_pids); do kill -9 "$p" 2>/dev/null || true; done
  sleep 2
}

start_pg() {
  if pg_up; then echo "[$(timecode)] postgres already up on :$pg_port"; return; fi
  echo "[$(timecode)] starting postgres ($pg_data)"
  pg_ctl -D "$pg_data" -l "$logdir/pg.log" start >/dev/null
  for ((i=1;i<=15;i++)); do pg_up && break; sleep 1; done
  pg_up && echo "[$(timecode)] postgres up" || { echo "[$(timecode)] postgres FAILED to start" >&2; tail -5 "$logdir/pg.log" >&2; exit 1; }
}

start_redis() {
  if redis_up; then echo "[$(timecode)] redis already up on :$redis_port"; return; fi
  echo "[$(timecode)] starting redis :$redis_port"
  redis-server --daemonize yes --port "$redis_port" --save '' --appendonly no
  for ((i=1;i<=15;i++)); do redis_up && break; sleep 1; done
  redis_up && echo "[$(timecode)] redis up" || { echo "[$(timecode)] redis FAILED to start" >&2; exit 1; }
}

launch_proot() { # $1=dir $2=cmd $3=logfile
  local dir=$1 cmd=$2 log=$3
  setsid proot-distro login ubuntu -- bash -lc "cd '$dir' && while true; do $cmd || true; echo '[watchdog] service exited; restarting in 3s'; sleep 3; done" \
    </dev/null >>"$log" 2>&1 &
  disown
}

start_api() {
  if api_up && [ "$(api_pids)" != "" ]; then echo "[$(timecode)] api already up on :$api_port"; return; fi
  echo "[$(timecode)] starting api :$api_port"
  launch_proot "$root/apps/api" 'node dist/main.js' "$logdir/api.log"
  for ((i=1;i<=25;i++)); do api_up && break; sleep 3; done
  api_up && echo "[$(timecode)] api up" || { echo "[$(timecode)] api NOT responding on :$api_port (see $logdir/api.log)" >&2; tail -5 "$logdir/api.log" >&2; exit 1; }
}

start_web() {
  if web_up && [ "$(web_pids)" != "" ]; then echo "[$(timecode)] web already up on :$web_port"; return; fi
  echo "[$(timecode)] starting web :$web_port"
  launch_proot "$root/apps/web" 'node node_modules/next/dist/bin/next start -p 3000' "$logdir/web.log"
  for ((i=1;i<=20;i++)); do web_up && break; sleep 3; done
  web_up && echo "[$(timecode)] web up" || { echo "[$(timecode)] web NOT responding on :$web_port (see $logdir/web.log)" >&2; tail -5 "$logdir/web.log" >&2; exit 1; }
}

if [ "${1:-}" = "--restart" ]; then stop; fi

start_pg
start_redis
start_api
start_web

echo ""
echo "SRIP dev stack is ready:"
echo "  web   -> http://localhost:3000"
echo "  api   -> http://localhost:4000"
echo "  pg    -> 127.0.0.1:$pg_port"
echo "  redis -> 127.0.0.1:$redis_port"
echo "  logs  -> $logdir"