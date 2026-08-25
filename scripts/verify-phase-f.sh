#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"

grep -q "export type AuthorizationContext" "$API/src/common/authorization/authorization.service.ts"
grep -q "async assertPermission(userId: string, permission: string, context: AuthorizationContext" "$API/src/common/authorization/authorization.service.ts"
! grep -q "async assertPermission(userId: string, permission: string, organizationId" "$API/src/common/authorization/authorization.service.ts"
grep -q "relationship.notes.read" "$API/src/common/authorization/access.constants.ts"
grep -q "relationship.strategic.read" "$API/src/common/authorization/access.constants.ts"
grep -q "relationship.risk.read" "$API/src/common/authorization/access.constants.ts"
grep -q "relationship.internal.read" "$API/src/common/authorization/access.constants.ts"
grep -q "relationship.sensitive_contacts.read" "$API/src/common/authorization/access.constants.ts"
grep -q "person.sensitive_contacts.read" "$API/src/common/authorization/access.constants.ts"
grep -q "export class FieldSecurityService" "$API/src/common/authorization/field-security.service.ts"
grep -q "export class RelationshipPresenter" "$API/src/common/authorization/relationship-presenter.ts"
grep -q "this.presenter.present" "$API/src/relationships/relationships.service.ts"
grep -q "relationshipOrganizationIds" "$API/src/relationships/relationships.service.ts"
grep -q "entityType: 'Relationship'" "$API/src/relationships/relationships.service.ts"
grep -q "FieldSecurityService" "$API/src/permissions/permissions.module.ts"
grep -q "RelationshipPresenter" "$API/src/relationships/relationships.module.ts"
grep -q "relationship.notes.read" "$API/prisma/seed.ts"
grep -q "relationship.risk.read" "$API/prisma/seed.ts"

node - "$ROOT" <<'JS'
const fs=require('fs'),path=require('path'),ts=require('typescript');
const root=process.argv[2], dirs=[path.join(root,'apps/api/src'),path.join(root,'apps/api/test')]; let bad=[];
function walk(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n),s=fs.statSync(p);if(s.isDirectory())walk(p);else if(n.endsWith('.ts')){const sf=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true);if(sf.parseDiagnostics.length)bad.push(p);}}}
for(const d of dirs)walk(d); if(bad.length){console.error('TS_PARSE_ERRORS',bad);process.exit(1)}
console.log('TS_PARSE_ERRORS 0');
JS

echo 'PHASE_F_STATIC_VERIFICATION PASS'
