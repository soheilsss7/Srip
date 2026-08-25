#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail(){ echo "PHASE0-6 VERIFICATION FAILED: $1" >&2; exit 1; }
req(){ test -e "$1" || fail "missing $1"; }

for f in \
  docs/Final_Product_Requirements_Document.md \
  docs/Final_System_Architecture.md \
  docs/Complete_Database_ERD.md \
  docs/Complete_API_Contract.md \
  docs/UI_UX_Design_System_Screen_Map.md \
  docs/MASTER_TECHNICAL_SPEC.md \
  docs/RECONCILIATION_BASELINE.md \
  docs/PHASE_STATUS_CANONICAL.md \
  docs/PHASE_0_6_EXECUTION_CONTRACT.md \
  docs/adr/ADR-0001-ARCHITECTURE.md \
  docs/adr/ADR-0002-DATABASE.md \
  docs/adr/ADR-0003-AUTH.md \
  docs/adr/ADR-0004-AI.md \
  .github/workflows/ci.yml \
  docker-compose.yml \
  apps/api/Dockerfile \
  apps/web/Dockerfile \
  apps/api/prisma/schema.prisma; do req "$f"; done

# Core API modules for Phase 0-6 baseline
for m in organizations people relationships interactions meetings actions commitments projects auth sessions permissions health; do
  req "apps/api/src/$m"
done

# Auth/authorization controls
for f in apps/api/src/common/guards/auth.guard.ts apps/api/src/common/guards/authorization.guard.ts apps/api/src/common/authorization/authorization.service.ts apps/api/src/common/mfa/mfa.service.ts; do req "$f"; done

grep -q "ValidationPipe" apps/api/src/main.ts || fail "global validation pipe missing"
grep -q "helmet" apps/api/src/main.ts || fail "helmet missing"
grep -q "Bearer" apps/api/src/common/guards/auth.guard.ts || fail "bearer authentication missing"
grep -q "Session is inactive" apps/api/src/common/guards/auth.guard.ts || fail "session-bound auth missing"
grep -q "classificationAllows" apps/api/src/common/authorization/authorization.service.ts || fail "classification authorization missing"
grep -q "rolePermission" apps/api/prisma/schema.prisma || fail "RBAC schema missing"
grep -q "AuthorizationPolicy" apps/api/prisma/schema.prisma || fail "ABAC policy schema missing"
grep -q "deletedAt" apps/api/prisma/schema.prisma || fail "soft delete schema missing"
grep -q "MfaDevice" apps/api/prisma/schema.prisma || fail "MFA schema missing"

echo "PHASE 0-6 STATIC VERIFICATION OK"
