#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail(){ echo "PACKAGE82_HARDENING=FAIL: $1" >&2; exit 1; }
require(){ grep -Fq "$2" "$1" || fail "$3"; }
# Critical scalability paths must advertise bounded behavior or DB aggregation.
require "$ROOT/apps/api/src/data-management/data-quality.service.ts" "bounded: true" "data quality is not marked bounded"
require "$ROOT/apps/api/src/data-management/duplicate-detection.service.ts" "candidateLimit" "duplicate candidate bound missing"
require "$ROOT/apps/api/src/data-management/data-import.service.ts" "IMPORT_BATCH_SIZE" "import batch size missing"
require "$ROOT/apps/api/src/documents/s3.storage.ts" "head" "S3 storage probe implementation missing"
require "$ROOT/apps/api/src/privacy/privacy.service.ts" "totalPages" "privacy pagination missing"
require "$ROOT/apps/api/src/intelligence/intelligence.service.ts" "relationship.count" "intelligence strategic coverage is not DB aggregated"
require "$ROOT/apps/api/src/analytics/analytics.service.ts" "relationship.aggregate" "analytics strategic metrics are not DB aggregated"
require "$ROOT/apps/api/src/analytics/analytics.service.ts" "createMany" "analytics recompute is not batched"
require "$ROOT/apps/api/src/common/api-contract/api-contract.filter.ts" "httpException: HttpException | undefined" "error contract exception narrowing missing"
# Guard against accidental full-table reads in critical aggregate services.
if grep -n "relationship.findMany({ where: { deletedAt: null, OR:" "$ROOT/apps/api/src/intelligence/intelligence.service.ts" | grep -v "take:" >/dev/null 2>&1; then fail "unbounded intelligence relationship query detected"; fi
# All API source files must at least parse as TypeScript.
node - <<'NODE'
const fs=require('fs'),path=require('path'),ts=require('typescript');let bad=0,count=0;
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.ts')&&!p.endsWith('.d.ts')){count++;const r=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});if(r.diagnostics?.length){bad++;console.error(p,r.diagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join('; '));}}}}
walk(path.join(process.cwd(),'apps/api/src')); if(bad) process.exit(1); console.log(`PACKAGE82_TS_SYNTAX=${count}_FILES_PASS`);
NODE

echo "PACKAGE82_HARDENING=PASS"
