#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail(){ echo "FAIL: $1" >&2; exit 1; }
pass(){ echo "PASS: $1"; }

schema="$ROOT/prisma/schema.prisma"
org="$ROOT/src/organizations/organizations.service.ts"
orgc="$ROOT/src/organizations/organizations.controller.ts"
person="$ROOT/src/people/people.service.ts"
personc="$ROOT/src/people/people.controller.ts"
rel="$ROOT/src/relationships/relationships.service.ts"
relc="$ROOT/src/relationships/relationships.controller.ts"
lifecycle="$ROOT/src/common/data-lifecycle/data-lifecycle.service.ts"

for f in "$schema" "$org" "$orgc" "$person" "$personc" "$rel" "$relc" "$lifecycle"; do [[ -f "$f" ]] || fail "missing $f"; done

grep -q 'model Organization {' "$schema" || fail 'Organization model missing'
grep -q 'model OrganizationPerson {' "$schema" || fail 'OrganizationPerson model missing'
grep -q 'model Person {' "$schema" || fail 'Person model missing'
grep -q 'model Relationship {' "$schema" || fail 'Relationship model missing'
grep -q 'organizationPeople OrganizationPerson\[\]' "$schema" || fail 'OrganizationPerson relation missing'
grep -q 'lifecycleStage RelationshipLifecycleStage' "$schema" || fail 'Relationship lifecycle missing'
grep -q 'ownerId String?' "$schema" || fail 'Owner fields missing'
grep -q 'backupOwnerId String?' "$schema" || fail 'Backup owner field missing'
pass 'core Prisma models and ownership/lifecycle fields'

grep -q "Number(page || 1), Number(pageSize || 50)" "$orgc" || fail 'Organization pagination parameters not forwarded'
grep -q "@Post(':id/restore')" "$orgc" || fail 'Organization restore endpoint missing'
grep -q "@Post(':id/restore')" "$personc" || fail 'Person restore endpoint missing'
grep -q "@Post(':id/restore')" "$relc" || fail 'Relationship restore endpoint missing'
pass 'core controller contracts'

grep -q 'tx.organizationPerson.create' "$person" || fail 'Person create does not create primary affiliation'
grep -q 'tx.organizationPerson.upsert' "$person" || fail 'Person affiliation reconciliation missing'
grep -q 'async addOrganization' "$person" || fail 'OrganizationPerson API service missing'
grep -q "PersonResponseDto.from('Person'" "$person" || fail 'Person DTO boundary missing'
pass 'Person/OrganizationPerson business logic and DTO boundary'

grep -q 'OR: \[{ sourceOrganizationId: organizationId }, { targetOrganizationId: organizationId }\]' "$rel" || fail 'Relationship organization filter still requires source=target'
grep -q 'A relationship requires two distinct organizations' "$rel" || fail 'Relationship self-link invariant missing'
grep -q 'const allowed=' "$rel" || fail 'Relationship update allowlist missing'
grep -q 'publishInTransaction' "$rel" || fail 'Relationship transactional event path missing'
pass 'Relationship invariants, authorization boundary and transactional events'

grep -q "async restore(userId:string,entityType:string,id:string,reason='restore',tx?: Prisma.TransactionClient)" "$lifecycle" || fail 'Transactional lifecycle restore missing'
pass 'Transactional restore lifecycle'

python3 - <<'PY'
from pathlib import Path
m=Path('apps/api/prisma/migrations/20260107120000_phase1_organization_person/migration.sql').read_text()
required=['CREATE TABLE "OrganizationPerson"','OrganizationPerson_organizationId_personId_key','OrganizationPerson_personId_status_idx','OrganizationPerson_organizationId_status_idx']
missing=[x for x in required if x not in m]
if missing: raise SystemExit('FAIL: migration missing '+', '.join(missing))
print('PASS: OrganizationPerson migration')
PY

echo 'PHASE 1 CORE DOMAIN STRUCTURAL VERIFICATION: PASS'
