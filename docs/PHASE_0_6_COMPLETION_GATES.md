# Phase 0–6 Completion Gates

This document is the implementation gate for the current unified baseline. It distinguishes static/source readiness from runtime verification.

## Phase 0 — Architecture & Product Definition
- [x] Product requirements document present
- [x] System architecture present
- [x] Database ERD present
- [x] API contract present
- [x] UI/UX design-system and screen map present
- [x] ADR set present
- [ ] Final stakeholder sign-off

## Phase 1 — Repository & Development Foundation
- [x] Monorepo apps/packages structure
- [x] GitHub CI baseline
- [x] CODEOWNERS and PR template
- [x] Environment examples
- [x] Local development runbook
- [x] Node/pnpm baseline files
- [ ] Branch protection configured on the remote repository
- [ ] Dependency vulnerability scan executed in CI

## Phase 2 — Infrastructure & Runtime Foundation
- [x] PostgreSQL container definition
- [x] Redis container definition
- [x] API/Web container definitions
- [x] Health/liveness/readiness endpoints
- [x] Storage abstraction boundary
- [x] Queue/workflow module boundary
- [ ] Runtime Docker Compose verification on a host with Docker
- [ ] Real object-storage integration
- [ ] Production Terraform apply
- [ ] Production observability deployment

## Phase 3 — Database & Data Architecture
- [x] Prisma schema and migrations
- [x] Tenant hierarchy
- [x] Relationship-first model
- [x] Soft-delete fields and indexes
- [x] Data classification
- [x] RBAC/ABAC persistence foundations
- [x] Idempotent development seed
- [ ] Prisma generate/migrate/seed runtime verification
- [ ] Restore-from-backup verification
- [ ] Production performance benchmark

## Phase 4 — Authentication & Identity
- [x] Password policy and bcrypt hashing
- [x] Login/logout/refresh/reset/email-verification endpoints
- [x] Session-bound access tokens
- [x] Refresh rotation/revocation persistence
- [x] MFA/recovery-code persistence foundation
- [x] OIDC configuration foundation
- [ ] Production Identity Provider selected and connected
- [ ] TOTP challenge/verification runtime
- [ ] Email delivery runtime
- [ ] MFA E2E verification

## Phase 5 — Authorization Foundation
- [x] Base role catalog
- [x] Permission catalog
- [x] Role-permission persistence
- [x] Organization hierarchy scope
- [x] API authorization guard
- [x] Data-classification checks
- [x] Authorization unit test baseline
- [ ] Cross-tenant integration tests against PostgreSQL
- [ ] IDOR security test suite

## Phase 6 — Design System
- [x] Tokens
- [x] Core components
- [x] Semantic CSS baseline
- [x] Web shell/navigation baseline
- [x] RTL/LTR documentation
- [ ] Full component catalogue
- [ ] Accessibility automated checks
- [ ] Visual regression suite
- [ ] Storybook/component documentation

## Gate rule
A phase is `Complete` only when its source code, database, API, authorization, UI/mobile scope, tests, security checks, documentation, and required runtime verification are complete. A checkbox marked runtime pending is not a production-complete claim.
