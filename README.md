# SRIP — Strategic Relationship Intelligence Platform

Enterprise foundation for a holding company operating strategic relationships across subsidiaries, customers, partners and external stakeholders.

## Stack
- Web: Next.js + React + TypeScript
- Mobile: Expo / React Native
- API: NestJS + TypeScript
- Data: PostgreSQL + Prisma
- Cache/infra: Redis (development foundation)
- Architecture: Modular Monolith + shared API

## Quick start

1. Copy `.env.example` to `.env` and replace secrets.
2. Start infrastructure: `docker compose up -d postgres redis`.
3. Install dependencies with pnpm 10.12.4.
4. Generate Prisma client: `pnpm db:generate`.
5. Create migration: `pnpm db:migrate`.
6. Optional seed: `pnpm --filter @srip/api prisma:seed`.
7. Run `pnpm dev`.

## Verification
Run `./scripts/verify.sh` for repository checks. Dependency installation/build/typecheck must be performed in a network-enabled development environment.

## Security warning
The development login is a foundation only. Do not deploy it as-is. Production requires OIDC, MFA, session revocation, RBAC/ABAC enforcement, rate limiting, secret management, audit controls, security testing, backup/restore, monitoring and penetration testing.

## Source of truth
`docs/IMPLEMENTATION_CHECKLIST.md` is the live implementation checklist. `docs/MASTER_TECHNICAL_SPEC.md` preserves the full technical specification. The original checklist DOCX is retained separately in the conversation/source archive.

## Phase status — 0 / 1 / 2

- **Phase 0:** baseline/stabilization artifacts retained; repository verification is reproducible and source DOCX filenames are normalized.
- **Phase 1:** repository/monorepo foundation documented and preserved.
- **Phase 2:** infrastructure foundation added: PostgreSQL/Redis health checks, committed Prisma migration, seed path, API dependency health/readiness, and local bootstrap script.

Runtime migration, seed, typecheck, build, and integration tests still require a network-enabled environment with workspace dependencies and Docker. They are intentionally not marked as executed when this environment cannot run them.

## Current delivery

- Phase 0 — Baseline: complete
- Phase 1 — Repository foundation: complete
- Phase 2 — Infrastructure foundation: implemented
- Phase 3 — Database & ERD foundation: implemented in the current delivery

Phase 3 runtime database verification remains environment-dependent; the repository does not claim PostgreSQL execution without a running database and installed Node dependencies.


## Phase 5 — Authorization و Multi-Tenancy
Security Access Layer شامل RBAC، permission guard، organization/tenant isolation، ABAC foundation و resource authorization.
See `docs/PHASE_5_AUTHORIZATION_MULTITENANCY.md`.

## Canonical source-aligned roadmap

The authoritative implementation roadmap is documented in `docs/BUILD_ROADMAP.md`. The repository has been reconciled to the uploaded Master Technical Build Plan; later-phase foundations are present where practical, while runtime/staging/production verification is explicitly not claimed without the required infrastructure.

## Pre-Test Hardening Baseline
Package 8.4 is the current pre-test backend hardening baseline. See `docs/testing/PACKAGE8_4_PRETEST_AUDIT.md`.
