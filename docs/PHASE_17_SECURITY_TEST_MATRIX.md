# Phase 17 Security & Regression Test Matrix

## Static contract gates

| Area | Coverage | Status |
|---|---|---|
| Permission catalog | Referenced permission exists | PASS |
| Permission catalog | No duplicate keys | PASS |
| Controllers | AuthGuard present | PASS |
| Controllers | AuthorizationGuard present | PASS |
| Controllers | RequirePermission present | PASS |
| ABAC | Department/classification/ownership regression | PASS |
| Workflow | Supported actions only | PASS |
| Workflow | Nested conditions | PASS |
| Scoring | 0..100 contract | PASS |
| AI | PII redaction | PASS |
| AI | Prompt-injection defense | PASS |
| Network | Component/bridge algorithm contract | PASS |

## Runtime gates still required

- PostgreSQL migration/integration suite
- Cross-tenant IDOR matrix for every protected resource
- Authentication/session expiry/refresh tests
- Web E2E
- Mobile E2E
- AI provider failure and prompt-injection E2E
- Workflow idempotency/retry/WAIT-resume tests
- External integration OAuth/sync/webhook tests
- Load/performance tests
- OWASP ASVS/Top 10 review and penetration test
- Backup/restore/disaster-recovery test

A PASS in the static section is a repository contract result and is not a claim that runtime infrastructure was executed.
