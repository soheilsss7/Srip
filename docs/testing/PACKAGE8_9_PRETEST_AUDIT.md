# Package 8.9 — Pre-Test Hardening Audit

Baseline: Package 8.8. No previous repository entry is removed.

## Re-audit findings and corrections

1. **Network query completeness** — graph search previously paged organizations first and searched people/projects only inside that page. A matching person/project could therefore be omitted. The graph now searches organization/person/project candidates independently with bounded limits and expands only through the matched organization IDs.
2. **Explicit Search scope correctness** — FTS candidate selection could return the global top-100 IDs before an explicit organization filter was applied. For an explicit organization filter, the FTS query now applies the tenant filter inside PostgreSQL before LIMIT. The Organization FTS expression is aligned with the canonical four-field expression (`name`, `legalName`, `englishName`, `displayName`).
3. **Import progress observability** — the worker processed batches but only persisted the final summary. Progress is now durably written after every batch, including processed count, percentage and partial-failure counters. Queue retry/idempotent claim behavior remains unchanged.
4. **Pre-test static gate** — the gate now verifies the corrected Network/Search/Import invariants, in addition to the prior unsafe-SQL, storage, sanitizer, cache, DB-latency and EXPLAIN checks.

## Preserved controls

- Data Quality bounded counts/evidence and bounded duplicate grouping
- Duplicate Detection bounded candidates
- Dedicated Import queue, batch processing, idempotent claim and transactional row mutation
- Actual Storage readiness probe
- Central Sensitive Data Sanitizer
- CI lint/security/integration gates
- Repository governance/security/dependency automation
- Monitoring alarm infrastructure path
- Backup/Restore verification contract
- DB latency and slow-query instrumentation
- Network/Search/Reporting EXPLAIN tooling
- Connection-pool verification
- Application-level cache invalidation verification

## Runtime gates still required

The following are intentionally not marked runtime-PASS without the real environment: PostgreSQL EXPLAIN ANALYZE on representative high-cardinality data, P50/P95/P99 load results, Redis multi-instance/concurrent invalidation, BullMQ crash/retry/duplicate-delivery behavior, real S3 probe, CloudWatch→SNS delivery, and actual Backup→Restore→DR drill.
