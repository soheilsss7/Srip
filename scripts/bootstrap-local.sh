#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

echo "[1/4] Starting PostgreSQL and Redis..."
docker compose up -d postgres redis

echo "[2/4] Generating Prisma client..."
pnpm db:generate

echo "[3/4] Applying migrations..."
pnpm db:migrate

echo "[4/4] Seeding development data..."
pnpm --filter @srip/api prisma:seed

echo "SRIP local infrastructure is ready."
