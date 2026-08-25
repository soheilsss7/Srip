
# Phase 39 — Production Verification Test Plan

## Required runtime gates

1. Full integration
2. Real PostgreSQL
3. Redis integration
4. Queue integration
5. Storage integration
6. Full E2E
7. IDOR matrix
8. OWASP ASVS runtime verification
9. Load test
10. Professional penetration test

## Commands

### Unit/static
`pnpm --filter @srip/api test:unit`

### PostgreSQL + Redis
`RUN_INTEGRATION=1 pnpm --filter @srip/api test:integration`

### IDOR
`API_URL=... USER_A_TOKEN=... USER_B_TOKEN=... RESOURCE_ID=... node tests/security/idor-matrix.mjs`

### ASVS runtime smoke
`API_URL=... node tests/security/owasp-asvs-runtime.mjs`

### Load smoke
`API_URL=... LOAD_CONCURRENCY=20 LOAD_REQUESTS=200 node tests/load/smoke-load.mjs`

### Storage
`S3_TEST_ENDPOINT=... S3_TEST_BUCKET=... S3_TEST_ACCESS_KEY=... S3_TEST_SECRET_KEY=... node tests/storage/storage-integration.mjs`

## Production evidence policy

A test is only marked PASS when the command actually executes against the target runtime. Static code inspection is never promoted to a runtime PASS.

Pentesting remains an external security activity and must be performed against an authorized staging/production-like environment.

## Acceptance

Production verification is complete only when all runtime gates have evidence artifacts, except provider-dependent tests explicitly marked N/A with an approved rationale.

## PHASE AG — Queue + E2E smoke integration gates

### Queue integration
`RUN_QUEUE_INTEGRATION=1 pnpm --filter @srip/api test -- test/integration/queue-integration.spec.ts`

This test requires a real Redis instance and verifies the complete runtime path:
`Create Job → Redis → Worker → Process → Success`. Static inspection is not a runtime PASS.

### E2E smoke
`API_URL=... E2E_USER_EMAIL=... E2E_USER_PASSWORD=... E2E_USER_ID=... node tests/e2e/e2e-smoke.mjs`

The smoke flow is real and fail-closed:
`Login → Organization → Person → Relationship → Meeting → Action → Commitment → Follow-up`.

Phase AG does not replace the broader Phase 39 E2E suite; it adds the explicit queue and smoke gates required for the Phase 39 acceptance path.
