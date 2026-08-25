# PHASE AL — Backend Performance

## Source contract
The technical checklist requires fast Dashboard, an explicit API P95 target, fast Search, pagination, lazy loading, code splitting, image optimization, cache and DB indexing; database optimization must include EXPLAIN ANALYZE, indexes/composite indexes, query optimization, connection pooling and slow-query logging. fileciteturn33file4L1-L22 The production performance targets are API P95 < 500ms and Search P95 < 1s under normal conditions, with load-test revision based on real data volume. fileciteturn33file16L1-L12

## Backend implementation
- Organization, People and Relationship list APIs now support bounded page/pageSize pagination and return total/totalPages.
- Existing detail queries keep bounded child collections (lazy loading at the API boundary); no unbounded nested relation is introduced.
- Redis-backed `PerformanceCacheService` is available for short-lived non-authoritative read caches. Dashboard/analytics summary is cached for 30 seconds. Mutations must invalidate or bypass cached authoritative state; sensitive relationship detail is not cached by this phase.
- Additive composite indexes cover common organization/person/relationship/timeline/analytics/dashboard/reporting paths.
- Prisma query events now emit structured slow-query warnings when `DB_SLOW_QUERY_MS` is reached (default 250ms).
- PostgreSQL connection pooling is deployment-configurable through Prisma `DATABASE_URL` parameters such as `connection_limit` and `pool_timeout`; sizing is intentionally environment-specific rather than hardcoded.

## Benchmark
`tests/load/performance-benchmark.mjs` is a real HTTP benchmark. It records P50/P95/P99 and failure count for:

1. Organization list
2. People list
3. Relationship list
4. Relationship detail
5. Search
6. Network
7. Dashboard metrics
8. Reporting

Default gates: API-family P95 < 500ms; Search P95 < 1s. The benchmark requires a running API and real authentication token; it never treats static inspection as a runtime performance pass.

Example:

```bash
API_URL=http://127.0.0.1:4000/api/v1 \
PERF_AUTH_TOKEN="$TOKEN" \
PERF_ORGANIZATION_ID="$ORG_ID" \
PERF_RELATIONSHIP_ID="$REL_ID" \
PERF_CONCURRENCY=10 \
PERF_REQUESTS=100 \
node tests/load/performance-benchmark.mjs
```

## Database validation
Before production promotion, run `EXPLAIN (ANALYZE, BUFFERS)` on the benchmark queries with representative data, inspect index usage and tune pool size/slow-query threshold using staging telemetry. The target numbers are initial requirements and must be revalidated with real dataset scale.

## Scope boundary
Frontend-only code splitting/image optimization and AI performance are not changed in AL because the current backend audit explicitly excludes frontend and AI development. The backend exposes pagination/cache/indexing/observability hooks required for those clients.
