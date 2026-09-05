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

## Frontend demo mode (بدون Backend — UI development)

The web app can run fully standalone against a **deterministic mock API** (no
PostgreSQL/Redis needed). The mock mirrors the real NestJS contracts and its
"AI" is a rule-based engine — exactly like the production
`deterministic-gateway` mode, so no external LLM is required anywhere.

```bash
# 1) start the mock API on :4000  (production-shaped: persistent, JWT, audit)
node apps/web/scripts/mock-api.mjs

# 2) start the web app on :3000 (proxies /api/v1 → :4000 automatically)
pnpm --filter @srip/web dev
```

Demo logins (any 6-digit OTP):
- **مالک (Owner)** — `demo` / `123456` (هم‌چنین `demo@srip.local` / `123456`) — sees everything.
- **مستأجر (Tenant)** — `client` / `123456` (هم‌چنین `client@arya-tech.ir` / `123456`) — only its own
  organization (آریا فناوری), everything else is 403.

### Mock backend capabilities (production-shaped)

- **Persistence** — all data is stored in `apps/web/scripts/.data/srip-db.json`
  and survives restarts. `node apps/web/scripts/mock-api.mjs --reset` (or
  `pnpm --filter @srip/web mock:reset`) wipes and reseeds the demo data.
- **Real authentication** — passwords hashed with **scrypt** (per-user salt,
  timing-safe compare, never stored in plaintext); **JWT HS256** access tokens
  (15 min) + rotating refresh tokens (7 days) with a persisted revocation list
  (logout / rotation). `POST /api/v1/auth/refresh` drives the frontend's
  automatic session refresh; expired/invalid tokens get 401 and the UI returns
  to login.
- **Audit log** — append-only, persisted, capped at 500 events; visible to the
  owner at `GET /admin/audit-log` and feeds `/security/events`.
- **Scope enforcement** — every endpoint filters by the caller's organization
  scope; out-of-scope reads/writes return 403 (organizations, people,
  relationships, recommendations, graph, CRUD creates…).
- **Deterministic AI** — the assistant and recommendations run on a built-in
  rule engine (`deterministic-gateway`), never an external LLM.
- **Jalali calendar** — `/calendar` renders meetings on a Persian month grid
  (Saturday-first, Persian digits/months, jalaali conversion in
  `app/_lib/jalali.ts`).
- **In-app user guide** — `/help` documents both roles, every section and FAQs.
- **Data exchange** — `/data-exchange` exports entity lists to Excel-compatible
  CSV (UTF-8 BOM) and imports people from a CSV template with preview +
  validation; `/reports/:kind` + `/reports/:kind/export/{csv,json}` now return
  real report payloads with a true BOM.

### Automated tests

```bash
pnpm --filter @srip/web test:api       # 58-assertion API suite (auth/JWT/scope/CRUD/lifecycle/audit/persistence)
pnpm --filter @srip/web crawl:links    # link-crawl: every route + every internal link must be 200
```

Both exit non-zero on any failure. Note: `test:api` mutates the store
(creates demo entities); run `pnpm --filter @srip/web mock:reset` afterwards
for a pristine demo dataset.

- When `NEXT_PUBLIC_API_URL` is unset or relative (`/api/v1`), Next.js proxies
  `/api/v1/*` to `API_PROXY_TARGET` (default `http://localhost:4000`).
- For a real backend, set `NEXT_PUBLIC_API_URL=https://your-api/api/v1` (or
  `API_PROXY_TARGET` + relative base).
