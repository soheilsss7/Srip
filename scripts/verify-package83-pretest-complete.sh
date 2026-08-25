#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
fail(){ echo "PACKAGE83_PRETEST=FAIL: $1" >&2; exit 1; }
req(){ test -f "$ROOT/$1" || fail "missing $1"; }
for f in \
  apps/api/src/data-management/data-quality.service.ts \
  apps/api/src/data-management/duplicate-detection.service.ts \
  apps/api/src/data-management/data-import.service.ts \
  apps/api/src/data-management/data-management.controller.ts \
  apps/api/src/analytics/analytics.service.ts \
  apps/api/src/health/health.service.ts \
  apps/api/src/documents/s3.storage.ts \
  apps/api/src/observability/error-tracking.service.ts \
  apps/api/src/observability/queue-monitoring.service.ts \
  apps/api/src/observability/metrics.service.ts \
  apps/api/src/common/api-contract/api-contract.interceptor.ts \
  apps/api/src/common/api-contract/api-contract.filter.ts \
  SECURITY.md LICENSE .github/CODEOWNERS .github/pull_request_template.md .github/dependabot.yml; do req "$f"; done
grep -Fq 'contacts: { none: {} }' "$API/src/data-management/data-quality.service.ts" || fail 'data quality contact counts missing'
grep -Fq 'Prisma.sql' "$API/src/analytics/analytics.service.ts" || fail 'analytics raw SQL is not parameterized'
grep -Fq 'organizationId is required for duplicate detection' "$API/src/data-management/data-management.controller.ts" || fail 'duplicate detection organization scope missing'
grep -Fq 'security-static:' "$ROOT/.github/workflows/ci.yml" || fail 'security CI gate missing'
node -e "const fs=require('fs'),ts=require('typescript'),path=require('path');let bad=0,n=0;function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.ts')&&!p.endsWith('.d.ts')){n++;const r=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});if(r.diagnostics?.length){bad++;console.error(p);}}}}walk(process.argv[1]);if(bad)process.exit(1);console.log('PACKAGE83_TS_SYNTAX='+n+'_FILES_PASS')" "$API/src"
echo 'PACKAGE83_PRETEST=PASS'
