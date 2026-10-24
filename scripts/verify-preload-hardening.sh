#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
for f in \
  "$root/apps/api/src/data-management/data-quality.service.ts" \
  "$root/apps/api/src/data-management/duplicate-detection.service.ts" \
  "$root/apps/api/src/data-management/data-import.service.ts" \
  "$root/apps/api/src/documents/s3.storage.ts" \
  "$root/apps/api/src/common/security/sensitive-data-sanitizer.ts" \
  "$root/apps/api/src/prisma/prisma.service.ts" \
  "$root/apps/api/src/network/network.service.ts" \
  "$root/apps/api/src/search/search.service.ts" \
  "$root/apps/api/src/reporting/reporting.service.ts" \
  "$root/apps/api/src/common/performance/performance-cache.service.ts"; do
  test -s "$f"
done
grep -q 'QUEUE_NAMES.dataImports' "$root/apps/api/src/data-management/data-import.worker.ts"
grep -q 'DB_SLOW_QUERY_MS' "$root/apps/api/src/prisma/prisma.service.ts"
grep -q 'EXPLAIN (ANALYZE, BUFFERS)' "$root/scripts/explain-benchmark.sh"
test -s "$root/scripts/verify-cache-invalidation.ts"
grep -q 'invalidatePrefix' "$root/apps/api/src/common/performance/performance-cache.service.ts"
# Raw SQL must remain parameterized. These two constant operations are the only intentional
# raw-SQL surfaces in the production source; ANALYZE uses a whitelisted identifier and
# health uses a constant SELECT 1. Dynamic query construction is rejected.
if grep -R "\$queryRawUnsafe\|\$executeRawUnsafe" -n "$root/apps/api/src" --include='*.ts' --exclude='*.spec.ts'; then
  echo 'UNSAFE_DYNAMIC_RAW_SQL_FOUND' >&2
  exit 1
fi
grep -q 'Prisma.sql`ANALYZE' "$root/apps/api/src/search/search.service.ts"
grep -q 'Prisma.join(unique)' "$root/apps/api/src/requirements/requirement-matching.service.ts"
grep -q 'const baseOrgScope: any' "$root/apps/api/src/network/network.service.ts"
grep -q 'Search each node type independently' "$root/apps/api/src/network/network.service.ts"
grep -q "this.ftsIds('Organization',q,organizationId,orgIds)" "$root/apps/api/src/search/search.service.ts"
grep -q 'progress:totalRows' "$root/apps/api/src/data-management/data-import.service.ts"
grep -q 'processingLeaseId' "$root/apps/api/src/data-management/data-import.service.ts"
grep -q 'processingHeartbeatAt' "$root/apps/api/src/data-management/data-import.service.ts"
grep -q 'scopedIds' "$root/apps/api/src/search/search.service.ts"
grep -q 'organizationScope' "$root/apps/api/src/data-management/duplicate-detection.service.ts"
grep -q 'Organization outside import scope' "$root/apps/api/src/data-management/data-import.service.ts"
grep -q 'relationshipWhere' "$root/apps/api/src/data-management/data-quality.service.ts"
grep -q 'requestedById!==userId' "$root/apps/api/src/data-management/data-import.service.ts"
grep -q 'if (people.length)' "$root/apps/api/src/meetings/meetings.service.ts"
echo PRELOAD_HARDENING_STATIC=PASS
