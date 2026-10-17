#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
required=(
  "$ROOT/docs/testing/PACKAGE8_TESTING_SECURITY_E2E_FINAL_AUDIT.md"
  "$ROOT/apps/api/test/unit/package8-final-audit.spec.ts"
  "$ROOT/tests/security/package8-security-regression.mjs"
  "$ROOT/tests/e2e/package8-e2e.mjs"
  "$ROOT/apps/api/PHASE_AD_TESTING_MATRIX.md"
  "$ROOT/apps/api/PHASE_AE_SECURITY_TESTING.md"
  "$ROOT/apps/api/test/e2e/phase-ad.e2e.spec.ts"
  "$ROOT/apps/api/test/integration/phase-ad-integration.contract.spec.ts"
  "$ROOT/apps/api/test/security/phase-ae-security.spec.ts"
)
for f in "${required[@]}"; do [[ -f "$f" ]] || { echo "MISSING: $f"; exit 1; }; done
for token in '### Unit' '### Integration' '### E2E acceptance flow' '### Security' 'Login' 'Complete Meeting' 'Recommendation' 'Permission Denial'; do grep -q "$token" "$ROOT/docs/testing/PACKAGE8_TESTING_SECURITY_E2E_FINAL_AUDIT.md"; done
for token in 'OWASP ASVS' 'OWASP Top 10' 'IDOR' 'SQL Injection' 'XSS' 'CSRF' 'SSRF' 'File Upload' 'Rate Limit' 'Session Attacks' 'Data Leakage'; do grep -q "$token" "$ROOT/apps/api/PHASE_AE_SECURITY_TESTING.md"; done
node --check "$ROOT/tests/security/package8-security-regression.mjs"
node --check "$ROOT/tests/e2e/package8-e2e.mjs"
bash "$ROOT/scripts/verify-phase39-testing.sh"
bash "$ROOT/scripts/verify-package7-infrastructure.sh"
echo 'PACKAGE8_FINAL_AUDIT_STATIC_CHECK=PASS'
