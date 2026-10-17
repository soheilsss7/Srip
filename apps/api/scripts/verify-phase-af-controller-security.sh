#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST="$ROOT/test/unit/controller-security-matrix.spec.ts"
REG="$ROOT/test/unit/controller-security-matrix.ts"
for f in "$TEST" "$REG" "$ROOT/src/common/guards/webhook-signature.guard.ts" "$ROOT/src/users/users.controller.ts" "$ROOT/src/observability/observability.controller.ts" "$ROOT/src/integrations/integration-webhook.controller.ts"; do
  test -f "$f" || { echo "PHASE_AF_CONTROLLER_SECURITY_MATRIX=FAIL missing $f"; exit 1; }
done
node - <<'NODE' "$ROOT"
const fs=require('fs'); const path=require('path'); const root=process.argv[2];
const matrix=fs.readFileSync(path.join(root,'test/unit/controller-security-matrix.ts'),'utf8');
const src=fs.readFileSync(path.join(root,'test/unit/controller-security-matrix.spec.ts'),'utf8');
for(const token of ['PUBLIC','AUTHENTICATED','AUTHORIZED','INTERNAL','WEBHOOK_SIGNED','HEALTH']) if(!matrix.includes("'"+token+"'")) throw new Error('missing category '+token);
for(const token of ['AuthGuard','AuthorizationGuard','RequirePermission','InternalMetricsGuard','WebhookSignatureGuard']) if(!src.includes(token)) throw new Error('missing test contract '+token);
console.log('PHASE_AF_CONTROLLER_SECURITY_MATRIX=PASS');
NODE
