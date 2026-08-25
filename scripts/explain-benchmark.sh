#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${EXPLAIN_ORGANIZATION_ID:?EXPLAIN_ORGANIZATION_ID is required}"
: "${EXPLAIN_QUERY:=srip}"
command -v psql >/dev/null || { echo "psql is required" >&2; exit 2; }
out="${EXPLAIN_OUTPUT:-./artifacts/explain-benchmark-$(date -u +%Y%m%dT%H%M%SZ).txt}"
mkdir -p "$(dirname "$out")"
{
  echo '=== NETWORK ==='
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v org="$EXPLAIN_ORGANIZATION_ID" <<'SQL'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, "sourceOrganizationId", "targetOrganizationId", "healthScore", "riskScore"
FROM "Relationship"
WHERE "deletedAt" IS NULL
  AND ("sourceOrganizationId" = :'org' OR "targetOrganizationId" = :'org')
ORDER BY "updatedAt" DESC
LIMIT 250;
SQL
  echo '=== SEARCH ==='
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v q="$EXPLAIN_QUERY" <<'SQL'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id
FROM "Organization"
WHERE "deletedAt" IS NULL
  AND to_tsvector('simple', coalesce("name",'') || ' ' || coalesce("legalName",'') || ' ' || coalesce("englishName",'') || ' ' || coalesce("displayName",''))
      @@ plainto_tsquery('simple', :'q')
LIMIT 100;
SQL
  echo '=== REPORTING ==='
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v org="$EXPLAIN_ORGANIZATION_ID" <<'SQL'
EXPLAIN (ANALYZE, BUFFERS)
SELECT CASE WHEN "sourceOrganizationId" = :'org' THEN "targetOrganizationId" ELSE "sourceOrganizationId" END AS neighbor_id,
       count(*)
FROM "Relationship"
WHERE "deletedAt" IS NULL
  AND ("sourceOrganizationId" = :'org' OR "targetOrganizationId" = :'org')
GROUP BY neighbor_id
ORDER BY count(*) DESC
LIMIT 100;
SQL
} | tee "$out"
echo "EXPLAIN_BENCHMARK=PASS output=$out"
