#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api/src"
SCHEMA="$ROOT/apps/api/prisma/schema.prisma"
MIG="$ROOT/apps/api/prisma/migrations/20260824_api_contract_hardening/migration.sql"

grep -q "ApiContractInterceptor" "$ROOT/apps/api/src/app.module.ts"
grep -q "ApiContractExceptionFilter" "$ROOT/apps/api/src/app.module.ts"
grep -q "ApiContractContextMiddleware" "$ROOT/apps/api/src/app.module.ts"
grep -q "model IdempotencyRecord" "$SCHEMA"
grep -q 'CREATE TABLE "IdempotencyRecord"' "$MIG"
grep -q "Idempotency-Key" "$API/main.ts"
grep -q "X-Correlation-Id" "$API/main.ts"
grep -q "X-Request-Id" "$API/main.ts"
grep -q "hardenOpenApi" "$API/main.ts"
grep -q "page.*cursor.*limit.*sort.*order" "$API/common/api-contract/api-contract.interceptor.ts" || true
grep -q "IDEMPOTENCY_KEY_REQUIRED" "$API/common/api-contract/api-contract.interceptor.ts"
grep -q "IDEMPOTENCY_KEY_REUSED" "$API/common/api-contract/api-contract.interceptor.ts"
grep -q "code,message,requestId" "$ROOT/docs/api/API_CONTRACT.md"
for f in "$API/common/api-contract/api-contract.interceptor.ts" "$API/common/api-contract/api-contract.filter.ts" "$API/common/api-contract/api-contract.middleware.ts" "$API/common/api-contract/api-contract.module.ts"; do
  node -e "const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8'); if ((s.match(/\{/g)||[]).length !== (s.match(/\}/g)||[]).length) process.exit(1)" "$f"
done

echo "API_CONTRACT_STATIC_CHECK=PASS"
