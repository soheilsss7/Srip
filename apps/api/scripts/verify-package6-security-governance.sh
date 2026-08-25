#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
API="$ROOT/apps/api"

echo "[1/6] Package 6 files"
test -f "$API/src/security/security-governance.service.ts"
test -f "$API/test/unit/package6-security-governance.spec.ts"

echo "[2/6] ABAC classification ceiling"
grep -q "classification ceiling denied access" "$API/src/common/authorization/authorization.service.ts"

echo "[3/6] Lifecycle actor attribution"
grep -q "actorId: userId" "$API/src/privacy/privacy.service.ts"
grep -q "DataLifecycleRecord" "$API/src/privacy/privacy.service.ts"

echo "[4/6] Governance route protection"
grep -q "@RequirePermission('enterprise.security')" "$API/src/security/security.controller.ts"

echo "[5/6] Secret source-control policy"
grep -q "source-control" "$ROOT/docs/security/PACKAGE6_SECURITY_GOVERNANCE_BASELINE.md"

echo "[6/6] Source-control secret policy is documented"
grep -q "source-control" "$ROOT/docs/security/PACKAGE6_SECURITY_GOVERNANCE_BASELINE.md"

echo "PACKAGE6_SECURITY_GOVERNANCE_STATIC=PASS"
