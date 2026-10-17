#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
required=(
  "$ROOT/PHASE_AE_SECURITY_TESTING.md"
  "$ROOT/test/security/phase-ae-security.spec.ts"
)
for f in "${required[@]}"; do test -s "$f" || { echo "MISSING:$f"; exit 1; }; done
for token in 'OWASP ASVS' 'OWASP Top 10' 'Authentication' 'Authorization' 'IDOR' 'SQL Injection' 'XSS' 'CSRF' 'SSRF' 'File Upload' 'Rate Limit' 'Session Attacks' 'Data Leakage' 'Cross-company leakage' 'Classification leakage'; do grep -Fq "$token" "$ROOT/PHASE_AE_SECURITY_TESTING.md" || { echo "MISSING_SECURITY_MATRIX:$token"; exit 1; }; done
grep -Fq "@UseGuards(InternalMetricsGuard)" "$ROOT/src/metrics.controller.ts"
grep -Fq "@UseGuards(AuthGuard, AuthorizationGuard)" "$ROOT/src/metrics.controller.ts"
grep -Fq "metrics.read" "$ROOT/src/metrics.controller.ts"
grep -Fq "rate:global" "$ROOT/src/common/rate-limit/rate-limit.service.ts"
grep -Fq "rate:sensitive:" "$ROOT/src/common/rate-limit/rate-limit.service.ts"
grep -Fq "OriginVerificationMiddleware" "$ROOT/src/production-hardening.ts"
grep -Fq "ClamAV" "$ROOT/src/documents/file-security.service.ts"
echo 'PHASE_AE_SECURITY_MATRIX=PASS'
