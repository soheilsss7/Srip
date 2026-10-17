#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
fail(){ echo "PHASE 20 QUEUE VERIFICATION: FAIL - $1"; exit 1; }
for f in \
  "$API/src/jobs/queue.constants.ts" \
  "$API/src/jobs/queue.service.ts" \
  "$API/src/jobs/job.service.ts" \
  "$API/src/jobs/job.worker.ts" \
  "$API/src/jobs/jobs.module.ts" \
  "$API/src/worker.ts"; do
  test -f "$f" || fail "missing $f"
done
grep -q 'bullmq' "$API/package.json" || fail 'bullmq dependency missing'
grep -q 'ioredis' "$API/package.json" || fail 'ioredis dependency missing'
grep -q 'QUEUE_WORKER_ENABLED' "$ROOT/docker-compose.yml" || fail 'local worker configuration missing'
grep -q 'QUEUE_WORKER_ENABLED' "$ROOT/docker-compose.production.yml" || fail 'production worker configuration missing'
grep -q 'deadLetter' "$API/src/jobs/queue.service.ts" || fail 'dead-letter queue missing'
grep -q 'attempts' "$API/src/jobs/queue.service.ts" || fail 'retry policy missing'
grep -q 'backoff' "$API/src/jobs/queue.service.ts" || fail 'backoff policy missing'
grep -q 'concurrency' "$API/src/jobs/job.worker.ts" || fail 'worker concurrency missing'
grep -q 'notificationDispatch' "$API/src/jobs/job.worker.ts" || fail 'notification processor missing'
grep -q 'integrationSync' "$API/src/jobs/job.worker.ts" || fail 'integration processor missing'
grep -q 'recommendationGenerate' "$API/src/jobs/job.worker.ts" || fail 'recommendation processor missing'
grep -q 'indexDocument' "$API/src/jobs/job.worker.ts" || fail 'AI/document processor missing'
# TypeScript syntax-only parse (no dependency resolution required).
for f in \
  "$API/src/jobs/queue.constants.ts" \
  "$API/src/jobs/queue.service.ts" \
  "$API/src/jobs/job.service.ts" \
  "$API/src/jobs/job.worker.ts" \
  "$API/src/jobs/jobs.module.ts" \
  "$API/src/worker.ts"; do
  F="$f" node - <<'NODE'
const fs = require('fs');
const ts = require('typescript');
const file = process.env.F;
const source = fs.readFileSync(file, 'utf8');
const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, emitDecoratorMetadata: true }, reportDiagnostics: true });
const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
if (errors.length) throw new Error(errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'));
NODE
done
echo 'PHASE 20 QUEUE VERIFICATION: PASS'
