#!/usr/bin/env bash
set -euo pipefail
for f in apps/api/src/common/security/sensitive-data-sanitizer.ts apps/api/src/data-management/data-import.worker.ts scripts/explain-benchmark.sh scripts/load-gate-network-search-reporting.sh scripts/verify-cache-invalidation.sh;do test -f "$f"||exit 1;done
node -e "const fs=require('fs'),ts=require('typescript');let bad=0;for(const f of fs.readdirSync('apps/api/src',{recursive:true}).filter(x=>x.endsWith('.ts')).map(x=>'apps/api/src/'+x)){try{ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},fileName:f})}catch(e){console.error(f,e.message);bad++}}console.log('TS_TRANSPILE_COMPLETE');process.exit(bad?1:0)"
printf 'PACKAGE84_PRETEST_STATIC=PASS\n'
