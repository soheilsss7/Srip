# PHASE AR — Backend Reconciliation Contract

The backend is not being rewritten. Existing foundations are frozen as canonical implementation surfaces and later phases must reconcile and complete them.

See `docs/architecture/PHASE_AR_RECONCILIATION_FREEZE.md` for the full contract.

## Required canonical areas

- Prisma/PostgreSQL: `prisma/schema.prisma`
- Authentication/session: `src/auth/` + `Session` model
- MFA: `src/common/mfa/`
- Authorization: `src/common/authorization/` and `src/authorization/`
- Scoring: `src/scoring/`
- Network: `src/network/`
- Search: `src/search/`
- Notifications: `src/notifications/`
- Workflow: `src/workflows/`
- Event Outbox: `src/event-bus/`
- Import/data quality: `src/data-management/`
- Data lifecycle: `src/common/data-lifecycle/`
- Integration security: `src/common/security/`
- Observability: `src/observability/`

The verification script is intentionally structural. It checks that the foundations exist rather than asserting that no file may ever change. Later phases are expected to complete these areas.
