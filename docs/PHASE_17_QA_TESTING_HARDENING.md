# Phase 17 — QA / Testing / E2E / Hardening

Date: 2026-08-23

## Scope
Phase 17 establishes executable regression-test infrastructure and security contract checks across the implemented platform. It does not claim that unavailable external services or production environments have been tested.

## Implemented
- Jest/ts-jest API unit-test configuration.
- Authorization regression tests for permission catalog, role boundaries, department/classification/ownership checks.
- Workflow regression tests for supported action validation and nested condition evaluation.
- Scoring contract regression test for the documented 0..100 bounded output contract.
- API security contract tests for Security, Workflow, and Relationship Score authorization boundaries.
- Static Phase 17 verification script.
- Explicit separation between static/unit verification and runtime/database/E2E gates.

## Still required before production
- Install dependencies and run all unit tests in CI.
- PostgreSQL integration tests and migration tests.
- Redis/queue/storage integration tests where enabled.
- Full API E2E: login → organization → person → relationship → meeting → action → commitment → recommendation → permissions.
- Cross-tenant and IDOR test matrix for every protected resource.
- Web and mobile E2E.
- AI prompt-injection and provider-failure tests.
- Workflow idempotency/retry tests.
- OWASP ASVS/Top 10 verification, penetration test and remediation/retest.
- Load/performance tests and backup/restore/DR tests.

## Verification semantics
`check:phase17` is a static repository contract gate. A green result does not mean PostgreSQL, Redis, external AI providers, devices, browsers, or production infrastructure were executed.

## Phase 17 hardening additions
- Permission catalog reconciled with all protected application controllers (`security.read`, `integration.read`, `integration.write`, `search.write`).
- Permission-catalog regression test prevents missing or duplicate permission keys.
- Controller security matrix statically checks authentication, authorization, and permission requirements across application controllers (health/metrics are intentionally excluded because they are infrastructure endpoints).
- These checks are repository-contract tests; they do not replace runtime authorization, IDOR, E2E, or penetration testing.
