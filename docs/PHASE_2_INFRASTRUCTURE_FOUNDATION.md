# Phase 2 — Infrastructure Foundation

## Objective
Turn the Phase 1 repository foundation into a reproducible local infrastructure baseline for PostgreSQL, Redis, Prisma migrations, seed data, and API dependency health checks.

## Implemented
- PostgreSQL 17 and Redis 8 local services with persistent named volumes.
- Container health checks for PostgreSQL and Redis.
- Prisma schema migration for the current 29-model domain schema.
- Prisma migration lock for PostgreSQL.
- Development seed path for permissions, admin user, holding/customer organizations, membership, and an initial relationship.
- API liveness (`/api/v1/health/live`) and dependency readiness (`/api/v1/health/ready`).
- Combined health status (`/api/v1/health`) reporting PostgreSQL and Redis state.
- Graceful NestJS shutdown hooks.
- Environment examples retained without production secrets.

## Verification boundary
This environment does not contain Docker or installed workspace dependencies and has no network access to install them. Therefore runtime migration/seed execution and TypeScript compilation are not falsely marked as executed here. The repository now contains the required commands and artifacts for execution in a network-enabled CI/development environment.

## Acceptance criteria
1. `docker compose up -d` starts PostgreSQL and Redis and both health checks become healthy.
2. `pnpm install` completes in a network-enabled environment.
3. `pnpm db:generate` completes.
4. `pnpm db:migrate` applies the committed migration.
5. `pnpm --filter @srip/api prisma:seed` completes.
6. API health reports both database and Redis as `ok` when services are available.
7. API readiness reports `ready` only when both dependencies are available.
