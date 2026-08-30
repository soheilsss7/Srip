
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';

const enabled = process.env.RUN_INTEGRATION === '1';
const describeIntegration = enabled ? describe : describe.skip;

describeIntegration('runtime integration: PostgreSQL + Redis', () => {
  let prisma: PrismaClient | undefined;
  let redis: IORedis | undefined;

  beforeAll(async () => {
    // Keep the suite genuinely skipped when RUN_INTEGRATION is not enabled.
    // Constructing PrismaClient at describe-time still executes for describe.skip
    // and used to crash the default test run before Jest could skip the suite.
    try {
      prisma = new PrismaClient();
      await prisma.$connect();
      redis = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        lazyConnect: false,
      });
      redis.on('error', () => undefined);
      await redis.ping();
    } catch (error) {
      redis?.disconnect();
      await prisma?.$disconnect().catch(() => undefined);
      throw error;
    }
  }, 15_000);

  afterAll(async () => {
    await redis?.quit().catch(() => redis?.disconnect());
    await prisma?.$disconnect().catch(() => undefined);
  }, 15_000);

  it('connects to PostgreSQL and executes a transaction', async () => {
    const result = await prisma!.$queryRaw<Array<{ value: number }>>`SELECT 1 AS value`;
    expect(Number(result[0].value)).toBe(1);
  });

  it('can read the Prisma schema-backed database', async () => {
    const result = await prisma!.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
      LIMIT 1
    `;
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('can round-trip a Redis key', async () => {
    const key = `srip:test:integration:${Date.now()}`;
    await redis!.set(key, 'ok', 'EX', 30);
    expect(await redis!.get(key)).toBe('ok');
    await redis!.del(key);
  });
});
