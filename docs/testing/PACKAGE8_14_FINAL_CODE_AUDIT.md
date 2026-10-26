# Package 8.14 — Final Code-Level Audit

Baseline: Package 8.13

## Changes in this audit

1. Approval permanent-delete transaction correctness
   - Approval validation now reads through the active Prisma transaction when a transaction client is supplied.
   - Prevents the approval status updated inside a transaction from being invisible to the delete step.

2. Approval decision concurrency
   - Approve/reject now atomically claim only `PENDING` rows with `updateMany(... status: PENDING)`.
   - Prevents two concurrent deciders from both applying the same approval.

3. Pending approval creation concurrency
   - Added a PostgreSQL partial unique index for `(entityType, entityId, actionType)` while `status = 'PENDING'`.
   - Request path handles the unique-race and returns the canonical pending approval.

4. Push subscription ownership
   - A known endpoint cannot be reassigned from one user to another.

5. Authorization membership listing
   - Organization membership administration is now paginated and bounded at 200 records per page.

6. Regression contract coverage
   - Added `package8-14-concurrency-and-bounds.contract.spec.ts` covering all five corrections.

## Static verification

- PRETEST_BACKEND_HARDENING_STATIC: PASS
- PACKAGE8_FINAL_AUDIT_STATIC_CHECK: PASS
- DATA_IMPORT_QUALITY_STATIC_CHECK: PASS
- NETWORK_STATIC_CHECK: PASS
- Reporting / Export structural verification: PASS
- PHASE37_OBSERVABILITY_STATIC_CHECK: PASS
- PHASE39_TESTING_STATIC_CHECK: PASS
- PACKAGE82_TS_SYNTAX: PASS
- Changed TypeScript transpilation: PASS
- Unsafe Prisma raw SQL in production source: 0

## Repository integrity

- No baseline files deleted.
- No baseline implementation replaced merely because it originated in an earlier phase.
- Changes follow keep / complete / reconcile / canonicalize governance.

## Remaining evidence gates

These are not additional code-audit findings; they require external/runtime evidence:

- real `pnpm-lock.yaml` generated with the pinned package manager and authoritative registry
- database migration execution against PostgreSQL
- integration/E2E/security runtime execution
- EXPLAIN ANALYZE against representative datasets
- connection-pool/slow-query runtime verification
- load tests and P95/P99 measurements
- real backup/restore and disaster-recovery drill
- external/internal penetration testing

Until those runtime gates execute, no responsible audit can claim that production has literally zero possible defects. Package 8.14 is the final Code-Level Pre-Test baseline unless new evidence produces a reproducible defect or a documented requirement gap.
