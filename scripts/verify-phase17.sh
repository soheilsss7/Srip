#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
required=(
  apps/api/jest.config.js
  apps/api/test/unit/access-policy.spec.ts
  apps/api/test/unit/workflows.spec.ts
  apps/api/test/unit/score-bounds.spec.ts
  apps/api/test/unit/api-contract.spec.ts
  apps/api/test/unit/permission-catalog.spec.ts
  apps/api/test/unit/controller-security-matrix.spec.ts
  docs/PHASE_17_QA_TESTING_HARDENING.md
)
for f in "${required[@]}"; do test -f "$root/$f" || { echo "MISSING: $f"; exit 1; }; done

grep -q "@RequirePermission('security.read')" "$root/apps/api/src/security/security.controller.ts"
grep -q "assertAnyOrganizationAccess" "$root/apps/api/src/common/authorization/authorization.service.ts"
grep -q "workflow.execute" "$root/apps/api/src/workflows/workflows.service.ts"
grep -q "action.write" "$root/apps/api/src/workflows/workflows.service.ts"
grep -q "commitment.write" "$root/apps/api/src/workflows/workflows.service.ts"
grep -q "opportunity.write" "$root/apps/api/src/workflows/workflows.service.ts"

node - <<'NODE' "$root"
const fs=require('fs'), path=require('path');
const root=process.argv[2];
const files=[
 'apps/api/src/common/authorization/access-policy.spec.ts',
 'apps/api/test/unit/access-policy.spec.ts',
 'apps/api/test/unit/workflows.spec.ts',
 'apps/api/test/unit/score-bounds.spec.ts',
 'apps/api/test/unit/api-contract.spec.ts'
];
for(const f of files){
  const s=fs.readFileSync(path.join(root,f),'utf8');
  if(!s.includes('describe(')||!s.includes('it(')) throw new Error(`Invalid test suite: ${f}`);
}
console.log('Phase 17 static QA contract verification OK');
NODE
