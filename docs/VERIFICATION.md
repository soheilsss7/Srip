# Verification Report

Generated as part of the starter package.

- [x] Repository structure exists.
- [x] Web app files exist.
- [x] API app files exist.
- [x] Mobile app files exist.
- [x] Shared packages exist.
- [x] Prisma schema exists.
- [x] Docker Compose exists.
- [x] CI workflow exists.
- [x] Security baseline document exists.
- [x] Full implementation checklist exists.
- [x] No production secrets are included.
- [ ] Dependencies have not been installed in this artifact environment.
- [ ] Full TypeScript/build/test execution is therefore pending until dependencies are installed.
- [ ] Production security controls are intentionally not marked complete.

## Double-check commands

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test
docker compose up -d
cp apps/api/.env.example apps/api/.env
pnpm db:generate
pnpm db:migrate
```

Then manually verify:
- Web: http://localhost:3000
- API: http://localhost:4000/api/v1/health
- PostgreSQL connection
- Redis connection
- Register/login flow

## External references checked during preparation
- Next.js current release/security guidance: https://nextjs.org/blog
- Expo current SDK reference: https://docs.expo.dev/versions/latest/
- OWASP ASVS 5.0: https://owasp.org/www-project-application-security-verification-standard/

## Latest build pass — 2026-08-23

- Repository structure: PASS
- JSON/package metadata parse: PASS
- Prisma schema present: PASS
- API controllers/modules present: PASS
- Live granular checklist generated from original source: PASS
- Original source DOCX copied into `docs/source/`: PASS
- ZIP integrity: verified after packaging
- Dependency installation: NOT RUN in this environment (pnpm package manager/dependencies unavailable offline)
- TypeScript/Nest/Next build: NOT RUN for the same reason

The repository therefore distinguishes **static repository verification** from **runtime/build verification**.
