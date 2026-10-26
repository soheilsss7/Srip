# Local Development Runbook

## Prerequisites
- Node.js 22
- pnpm 10.12.4
- Docker with Compose

## 1. Install
```bash
pnpm install
```

## 2. Start dependencies
```bash
docker compose up -d postgres redis
```

## 3. Configure environment
Copy `.env.example` to `.env` and set a local JWT secret of at least 32 characters.

## 4. Generate Prisma Client
```bash
pnpm db:generate
```

## 5. Apply migrations
```bash
pnpm db:deploy
```

## 6. Seed
```bash
pnpm db:seed
```

## 7. Start API + web
```bash
pnpm dev
```

## 8. Verify
```bash
pnpm check:phase0-6
```

API endpoints:
- `/api/v1/health`
- `/api/v1/health/live`
- `/api/v1/health/ready`
- `/api/v1/docs`

## Docker all-in-one
```bash
docker compose up --build
```

The current repository does not claim production readiness merely because the containers build. Production verification requires the source checklist's runtime, security, backup/restore, load and disaster-recovery gates.
