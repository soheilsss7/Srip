/**
 * Prisma client factory for the engine-less (driver-adapter) build.
 * The sandbox/offline deployment cannot download Prisma's native engines,
 * so the client is generated with `prisma generate --no-engine` and talks to
 * PostgreSQL through the `@prisma/adapter-pg` driver adapter (WASM engine).
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export function makeAdapter() {
  const url = process.env.DATABASE_URL ?? 'postgresql://srip:srip@127.0.0.1:5432/srip';
  return new PrismaPg({ connectionString: url });
}

export function makePrisma(): PrismaClient {
  return new PrismaClient({ adapter: makeAdapter() } as any);
}
