# Phase 0-6 Execution Contract

This document is the working acceptance gate for the current unified archive. It follows the source roadmap rather than treating placeholder modules as completed product features.

## Phase 0 — Architecture & Product Definition
- [x] Product requirements and technical baseline documents are present.
- [x] System/database/API/design-system/screen-map documents are present.
- [x] ADR set exists for architecture, database, auth and AI boundaries.
- [ ] Final source-of-truth reconciliation against every checklist line must still be reviewed by the team.

## Phase 1 — Repository & Development Foundation
- [x] Monorepo structure with web/mobile/api/packages exists.
- [x] CI workflow, CODEOWNERS, PR template and contribution guidance exist.
- [x] Shared packages for types, validation, API client, auth/config and design-system exist.
- [ ] Dependency installation/build/typecheck must be executed in a real CI/runtime environment.

## Phase 2 — Infrastructure & Runtime Foundation
- [x] PostgreSQL/Redis/Docker configuration and health endpoints exist.
- [x] Queue/storage abstractions and local bootstrap documentation exist.
- [x] Health/readiness checks cover DB and Redis connectivity.
- [ ] Real Docker + PostgreSQL + Redis verification remains required.
- [ ] Terraform/deployed infrastructure remains required.

## Phase 3 — Database & Data Architecture
- [x] Prisma schema, migration history, ERD documentation and seed exist.
- [x] Tenant hierarchy, soft-delete metadata and core domain entities are represented.
- [ ] Complete runtime migration/seed verification remains required.
- [ ] Full data-quality/import/master-data implementation remains later work.

## Phase 4 — Authentication & Identity
- [x] Password authentication foundation, session binding, refresh rotation, reset and email verification exist.
- [x] MFA/recovery-code schema/service foundation exists.
- [ ] Production Identity Provider integration, real MFA challenge/recovery flows, delivery providers and security verification remain required.

## Phase 5 — Authorization Foundation
- [x] RBAC permission catalog, organization scope, ownership and attribute-policy foundations exist.
- [x] Guards and policy unit tests exist.
- [ ] Full endpoint/resource matrix, negative integration tests and enterprise ABAC remain required.

## Phase 6 — Design System
- [x] Tokens, base component primitives, semantic CSS variables and responsive UI foundation exist.
- [x] Core workspace navigation shells exist for the main product areas.
- [ ] Full component catalogue, accessibility audit, RTL/LTR validation, visual regression and page-by-page UI completion remain required.

## Non-negotiable rule
No phase is marked production-complete until its runtime tests, security controls, acceptance criteria and deployment evidence exist.
