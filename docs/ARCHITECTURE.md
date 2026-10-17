# Architecture Decision Record — Foundation

## Decision
Use a TypeScript monorepo with Next.js Web, Expo/React Native Mobile, NestJS API, PostgreSQL/Prisma, Redis, and a modular-monolith backend.

## Rationale
- One domain model and API for web/mobile.
- PostgreSQL is the initial source of truth; graph storage can be added only after benchmarks justify it.
- AI is an intelligence layer, never the source of truth.
- Modules are isolated so later extraction into services remains possible.

## Security baseline
Use OWASP ASVS 5.0 as the verification baseline. Production identity should use a managed OIDC/SSO provider rather than treating the development password flow in this repository as production-ready.
