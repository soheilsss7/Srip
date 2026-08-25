#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
grep -q "document.openapi = '3.1.0'" "$ROOT/src/main.ts"
grep -q "ErrorResponse" "$ROOT/src/main.ts"
grep -q "Idempotency-Key" "$ROOT/src/main.ts"
grep -q "X-Request-Id" "$ROOT/src/main.ts"
grep -q "X-Correlation-Id" "$ROOT/src/main.ts"
grep -q "SENSITIVE_DETAIL_KEYS" "$ROOT/src/common/api-contract/error-contract.ts"
grep -q "status >= 500" "$ROOT/src/common/api-contract/error-contract.ts"
grep -q "crypto.randomUUID" "$ROOT/src/common/api-contract/api-contract.filter.ts"
grep -q "principalNamespace" "$ROOT/src/common/api-contract/api-contract.interceptor.ts"
grep -q "hashBytes(req.rawBody" "$ROOT/src/common/api-contract/api-contract.interceptor.ts"
grep -q "@Get('liveness')" "$ROOT/src/health/health.controller.ts"
grep -q "@Get('readiness')" "$ROOT/src/health/health.controller.ts"
grep -q "dependency unavailable" "$ROOT/src/health/health.service.ts"
grep -q "responseBodyBase64" "$ROOT/prisma/schema.prisma"
for f in "$ROOT/src/common/api-contract/api-contract.interceptor.ts" "$ROOT/src/common/api-contract/api-contract.filter.ts" "$ROOT/src/common/api-contract/api-contract.middleware.ts" "$ROOT/src/common/api-contract/error-contract.ts"; do
  node -e "const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8');if((s.match(/\{/g)||[]).length!==(s.match(/\}/g)||[]).length)process.exit(1)" "$f"
done
echo "PACKAGE5_API_RUNTIME_STATIC=PASS"
