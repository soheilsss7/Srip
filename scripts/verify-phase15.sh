#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/apps/api/prisma/schema.prisma"
[[ -f "$S" ]] || { echo "schema missing"; exit 1; }
grep -q 'enum SecurityEventSeverity' "$S"
grep -q 'model SecurityEvent' "$S"
grep -q 'model DataExportLog' "$S"
grep -q "security.read" "$ROOT/apps/api/prisma/seed.ts"
grep -q "SecurityController" "$ROOT/apps/api/src/security/security.controller.ts"
grep -q "SecurityModule" "$ROOT/apps/api/src/app.module.ts"
[[ -f "$ROOT/apps/api/prisma/migrations/20260823_phase15_security_compliance/migration.sql" ]]
[[ -f "$ROOT/docs/PHASE_15_SECURITY_AUDIT_COMPLIANCE.md" ]]
echo "PHASE 15 STATIC VERIFICATION OK"
