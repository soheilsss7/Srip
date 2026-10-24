# SRIP Phase Status

| Phase | Scope | Repository status | Runtime verification |
|---|---|---|---|
| 0 | Baseline & stabilization | Complete | Baseline checks reproducible |
| 1 | Repository & monorepo foundation | Complete | Static verification passed |
| 2 | Infrastructure foundation | Implemented | Runtime execution pending in CI/dev environment |
| 3 | Database & ERD foundation | Implemented | Static migration/schema verification passed; PostgreSQL runtime pending environment |
| 4 | Authentication | Implemented | Static verification passed; runtime auth/integration tests pending PostgreSQL + installed dependencies |

## Phase 2 deliverables

- PostgreSQL and Redis Docker Compose services with health checks.
- Prisma migration for the current 29-model schema.
- Prisma PostgreSQL migration lock.
- Development seed command.
- `/api/v1/health`, `/api/v1/health/live`, `/api/v1/health/ready`.
- Local bootstrap script.
- Phase 2 documentation and checklist updates.

## Phase 3 deliverables

- Expanded Prisma schema with governance fields and missing foreign-key relations.
- Additive PostgreSQL migration for Phase 3.
- Soft-delete fields and deletion actor references.
- Organization scope anchors for audit/workflow.
- Idempotent seed fixtures across the core domain.
- ERD companion document.
- Phase 3 implementation checklist and verification notes.


## Phase 4 deliverables

- Local registration/login with password policy and bcrypt hashing.
- Failed-login lockout controls.
- JWT access tokens bound to server-side sessions.
- Rotating opaque refresh tokens with reuse detection.
- Logout and session revocation.
- Password reset and email verification token flows.
- Account model for LOCAL/OIDC/SAML identities.
- IdentityProvider configuration foundation for future enterprise OIDC/SSO.
- Authenticated session validation on every protected request.
- Phase 4 documentation and checklist updates.


## Phase 5 — Authorization و Multi-Tenancy
- [x] RBAC permission catalog and role matrix
- [x] API permission guard
- [x] Organization and tenant isolation foundation
- [x] ABAC foundation (department/classification/ownership/sensitivity)
- [x] Resource authorization on core write paths
- [x] Permission-aware search/network/audit/workflow
- [x] Phase 5 migration and idempotent seed updates

## Phase 16 — Mobile
- Implemented mobile foundation and authenticated domain shell.
- Runtime/device validation remains pending.
