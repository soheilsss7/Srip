#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

grep -q "candidateLimit" apps/api/src/data-management/duplicate-detection.service.ts
grep -q "bounded: true" apps/api/src/data-management/data-quality.service.ts
grep -q "healthCheck" apps/api/src/documents/s3.storage.ts
grep -q "storageClient" apps/api/src/health/health.service.ts
grep -q "SensitiveDataSanitizer.sanitize" apps/api/src/observability/error-tracking.service.ts
grep -q "pnpm lint" .github/workflows/ci.yml
grep -q "pnpm audit --audit-level high" .github/workflows/ci.yml
grep -q "test:integration" .github/workflows/ci.yml

echo "PRETEST_BACKEND_HARDENING_STATIC=PASS"
