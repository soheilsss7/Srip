#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SVC="$ROOT/apps/api/src/common/rate-limit/rate-limit.service.ts"
INT="$ROOT/apps/api/src/common/rate-limit/rate-limit.interceptor.ts"
MOD="$ROOT/apps/api/src/common/rate-limit/rate-limit.module.ts"
HARD="$ROOT/apps/api/src/production-hardening.ts"
for f in "$SVC" "$INT" "$MOD"; do test -f "$f"; done
grep -q "rate:global" "$SVC"
grep -q "rate:ip:" "$SVC"
grep -q "rate:user:" "$SVC"
grep -q "rate:endpoint:" "$SVC"
grep -q "rate:login:" "$SVC"
grep -q "rate:sensitive:" "$SVC"
for x in password-reset mfa export search bulk-import webhook sensitive; do grep -q "$x" "$SVC"; done
grep -q "redis.eval" "$SVC"
if grep -q "new Map<string, Bucket>" "$HARD"; then echo "PHASE_AA_PROCESS_LOCAL_RATE_LIMIT=FAIL"; exit 1; fi
grep -q "RateLimitModule" "$ROOT/apps/api/src/app.module.ts"
grep -q "APP_INTERCEPTOR" "$MOD"
echo "PHASE_AA_RATE_LIMIT_CONTRACT=PASS"
