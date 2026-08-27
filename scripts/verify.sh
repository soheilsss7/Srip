#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
required=(
  package.json pnpm-workspace.yaml turbo.json docker-compose.yml
  apps/web/package.json apps/mobile/package.json apps/api/package.json
  apps/api/prisma/schema.prisma apps/api/prisma/migrations/migration_lock.toml apps/api/prisma/migrations/20260107120000_phase2_infrastructure_foundation/migration.sql apps/api/prisma/migrations/20260217120000_phase4_database_authentication/migration.sql apps/api/src/app.module.ts apps/api/src/health/health.service.ts
  docs/MASTER_TECHNICAL_SPEC.md docs/IMPLEMENTATION_CHECKLIST.md docs/SECURITY.md docs/BUILD_STATUS.md docs/SRIP_LIVE_CHECKLIST_0_197.md
)
for f in "${required[@]}"; do test -f "$root/$f" || { echo "MISSING: $f"; exit 1; }; done
node -e "JSON.parse(require('fs').readFileSync('$root/package.json'))"
grep -q '## 196' "$root/docs/MASTER_TECHNICAL_SPEC.md" || { echo 'MASTER spec 196 missing'; exit 1; }
test -f "$root/docs/SRIP_LIVE_CHECKLIST_0_197.md"
for f in apps/api/src/sessions/sessions.service.ts apps/api/src/permissions/permissions.service.ts apps/api/src/search/search.service.ts apps/api/src/network/network.service.ts apps/api/src/workflows/workflows.service.ts apps/api/src/relationships/relationship-score.service.ts; do test -f "$root/$f" || { echo "MISSING: $f"; exit 1; }; done
test -f "$root/docs/source/reference-master-original.docx"
test -f "$root/docs/source/reference-live-build-03.docx"
for f in apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.controller.ts apps/api/src/sessions/sessions.service.ts apps/api/src/common/guards/auth.guard.ts docs/PHASE_4_AUTHENTICATION.md; do test -f "$root/$f" || { echo "MISSING: $f"; exit 1; }; done
grep -q 'model Account' "$root/apps/api/prisma/schema.prisma" || { echo 'Account model missing'; exit 1; }
grep -q 'model IdentityProvider' "$root/apps/api/prisma/schema.prisma" || { echo 'IdentityProvider model missing'; exit 1; }
grep -q 'tokenFamilyId' "$root/apps/api/prisma/schema.prisma" || { echo 'Session rotation fields missing'; exit 1; }
grep -q "@Post('refresh')" "$root/apps/api/src/auth/auth.controller.ts" || { echo 'refresh endpoint missing'; exit 1; }
grep -q "@Post('email/verify')" "$root/apps/api/src/auth/auth.controller.ts" || { echo 'email verification endpoint missing'; exit 1; }
grep -q 'Refresh token reuse detected' "$root/apps/api/src/sessions/sessions.service.ts" || { echo 'refresh reuse detection missing'; exit 1; }
grep -q 'failedLoginCount' "$root/apps/api/prisma/schema.prisma" || { echo 'lockout fields missing'; exit 1; }
grep -q 'passwordChangedAt' "$root/apps/api/prisma/schema.prisma" || { echo 'passwordChangedAt missing'; exit 1; }
grep -q 'model AuthorizationPolicy' "$root/apps/api/prisma/schema.prisma" || { echo 'AuthorizationPolicy model missing'; exit 1; }
grep -q 'authorizationPolicies AuthorizationPolicy' "$root/apps/api/prisma/schema.prisma" || { echo 'AuthorizationPolicy relations missing'; exit 1; }
grep -q 'AuthorizationGuard' "$root/apps/api/src/common/guards/authorization.guard.ts" || { echo 'AuthorizationGuard missing'; exit 1; }
grep -q "@RequirePermission('person.read')" "$root/apps/api/src/people/people.controller.ts" || { echo 'person.read authorization missing'; exit 1; }
test -f "$root/apps/api/prisma/migrations/20260219120000_phase5_authorization_multitenancy/migration.sql" || { echo 'Phase 5 migration missing'; exit 1; }
test -f "$root/apps/api/src/common/authorization/access-policy.spec.ts" || { echo 'Phase 5 permission tests missing'; exit 1; }
python - <<PY2
from docx import Document
p="$root/docs/source/reference-live-build-03.docx"
d=Document(p)
text="\n".join([x.text for x in d.paragraphs]+[c.text for t in d.tables for r in t.rows for c in r.cells])
assert text.count("☑")==0 and text.count("☐")==1564
print("Live DOCX checklist verification OK: 0 checked / 1564 pending")
PY2
