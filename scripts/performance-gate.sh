#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
: "${API_URL:=http://127.0.0.1:4000/api/v1}"
: "${PERF_AUTH_TOKEN:?PERF_AUTH_TOKEN is required for runtime performance gates}"
: "${PERF_ORGANIZATION_ID:?PERF_ORGANIZATION_ID is required for bounded network/report tests}"

api_json="$(API_URL="$API_URL" PERF_AUTH_TOKEN="$PERF_AUTH_TOKEN" node "$root/tests/load/performance-benchmark.mjs")"
scalability_json="$(API_URL="$API_URL" PERF_AUTH_TOKEN="$PERF_AUTH_TOKEN" PERF_ORGANIZATION_ID="$PERF_ORGANIZATION_ID" node "$root/tests/load/scalability-concurrency.mjs")"
python3 - "$api_json" "$scalability_json" <<'PY'
import json, sys
api=json.loads(sys.argv[1]); scale=json.loads(sys.argv[2])
if api.get('failures', 0): raise SystemExit('PERFORMANCE_GATE_FAIL: API benchmark failures')
# Source checklist target: normal API P95 < 500ms; search P95 < 1s.
if api.get('p95Ms', 10**9) >= 500: raise SystemExit(f"PERFORMANCE_GATE_FAIL: API P95={api['p95Ms']}ms")
if scale.get('failures', 0): raise SystemExit('PERFORMANCE_GATE_FAIL: scalability benchmark failures')
print(json.dumps({'api':api,'scalability':scale}, indent=2))
PY
printf 'PERFORMANCE_GATE=PASS\n'
