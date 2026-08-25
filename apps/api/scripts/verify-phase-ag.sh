#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail(){ echo "PHASE AG VERIFICATION: FAIL - $1"; exit 1; }

QUEUE="$ROOT/test/integration/queue-integration.spec.ts"
E2E="$ROOT/../../tests/e2e/e2e-smoke.mjs"
DOC="$ROOT/../../docs/testing/PHASE39_TESTING.md"

[[ -f "$QUEUE" ]] || fail "queue integration test missing"
[[ -f "$E2E" ]] || fail "E2E smoke missing"
[[ -f "$DOC" ]] || fail "Phase 39 testing document missing"

grep -q "Create Job" "$QUEUE" || true
grep -q "queue.add" "$QUEUE" || fail "queue test does not create a BullMQ job"
grep -q "queue.getJob" "$QUEUE" || fail "queue test does not verify Redis persistence"
grep -q "new Worker" "$QUEUE" || fail "queue test does not use a real BullMQ Worker"
grep -q "waitUntilFinished" "$QUEUE" || fail "queue test does not wait for processing success"
grep -q "RUN_QUEUE_INTEGRATION" "$QUEUE" || fail "queue test is not runtime-gated"

grep -q "Login" "$E2E" || fail "E2E Login step missing"
grep -q "POST.*auth/login\|/auth/login" "$E2E" || fail "E2E login request missing"
for step in organizations people relationships meetings actions commitments; do
  grep -q "/$step" "$E2E" || fail "E2E $step request missing"
done
grep -q "follow-up/due-soon" "$E2E" || fail "E2E follow-up step missing"
grep -q "E2E_USER_EMAIL" "$E2E" || fail "E2E credentials contract missing"

grep -q "Queue integration" "$DOC" || fail "Phase 39 queue integration documentation missing"
grep -q "e2e-smoke.mjs" "$DOC" || fail "Phase 39 E2E command missing"

node --check "$E2E"

# TypeScript syntax-only check; no dependency resolution and no fake runtime PASS.
F="$QUEUE" node - <<'NODE'
const fs = require('fs');
const ts = require('typescript');
const source = fs.readFileSync(process.env.F, 'utf8');
const result = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
  },
  reportDiagnostics: true,
});
const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
if (errors.length) throw new Error(errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'));
NODE

echo 'PHASE AG STATIC CONTRACT=PASS'
