# Runtime Environment Blocker: Prisma Native Engine on Android/Termux

## Status: ENVIRONMENT BLOCKER — not a source defect

The SRIP API, its migrations, and its **runtime/DB-backed integration tests** cannot be
executed natively on this Android/Termux host. This is a **host/toolchain limitation**, not a
bug in the application source, and the source must **not** be modified to "work around" it.

## Root cause (verified)

Prisma ships prebuilt native engine binaries linked against **glibc** (the GNU C Library):

| Engine file | Arch | ELF interpreter (PT_INTERP) |
|---|---|---|
| `libquery_engine-debian-openssl-1.1.x.so.node` | x86_64 | `dlopen` → arch mismatch on aarch64 Node |
| `libquery_engine-linux-arm64-openssl-3.0.x.so.node` | AArch64 | `/lib/ld-linux-aarch64.so.1` |
| `schema-engine-linux-arm64-openssl-3.0.x` | AArch64 | `/lib/ld-linux-aarch64.so.1` |

Observations on this host:

1. `uname -m` → `aarch64`; `process.arch` → `arm64`.
2. Prisma's platform detection on Termux reports `debian-openssl-1.1.x`, so the **x86_64**
   query engine is loaded first and fails with
   `dlopen failed: ... is for EM_X86_64 (62) instead of EM_AARCH64 (183)`.
3. Forcing the correct ARM64 engine via
   `PRISMA_SCHEMA_ENGINE_BINARY` / `PRISMA_QUERY_ENGINE_LIBRARY` gets further but fails to
   spawn with `ENOENT`, because the engine needs `/lib/ld-linux-aarch64.so.1` (glibc dynamic
   loader). Termux uses **bionic libc** and does not provide that loader.

## Why the check scripts fail here

- `scripts/verify-backend-complete.sh` (the canonical backend gate) requires a real
  Postgres + Redis + Prisma engine run (steps: prisma generate → migrate deploy → seed →
  `jest` → `nest build`). Its header explicitly instructs: **"این اسکریپت را روی سیستم
  خودتان (نه در چت) اجرا کنید"** (run on your own machine, not in chat).
- `pnpm --filter @srip/api test` instantiates services that load the Prisma engine, so it
  cannot go green natively here.

## Host / runtime solution (documented workaround — no source change)

Run the API and its checks in a glibc-based Linux environment:

- **Docker Compose** (recommended): `infra`/`docker-compose.yml` /
  `docker-compose.production.yml` already define Postgres + Redis. Build/run the API inside
  a Linux container (x86_64 or arm64-glibc) where glibc loaders exist:
  `bash scripts/verify-backend-complete.sh`
- **WSL / a real Linux host**: clone, `pnpm install`, then run the same script.
- **CI**: the `.github/` workflows target a standard Linux runner.

## Source-level gates verified on this host (no runtime/DB)

These do **not** require the Prisma native engine and are verified passing locally:

- API `tcs --noEmit` (typecheck) — PASS
- `nest build` (API build) — verifiable PASS
- Web `tsc --noEmit` (typecheck) — PASS
- Frontend audit (`frontend-audit.mjs`) — PASS
- Repository→Web contract audit (`repository-contract-audit.mjs`) — PASS
- Web production build — verifiable PASS

## Relevant source pointers

- `apps/api/src/prisma/prisma.service.ts` — PrismaService extends `PrismaClient` (engine load).
- `apps/api/prisma/schema.prisma` — generator `client` (no `binaryTargets`; uses native detect).
- `scripts/verify-backend-complete.sh` — canonical runtime gate.
- `docker-compose.yml`, `docker-compose.production.yml` — target runtime.
