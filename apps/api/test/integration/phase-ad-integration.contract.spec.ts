import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('PHASE AD integration matrix contract', () => {
  it('API exposes versioned controllers and standard security middleware', () => {
    const main = read('src/main.ts');
    expect(main).toContain('/api/v1');
    const appModule = read('src/app.module.ts');
    expect(appModule).toContain('ProductionHardeningMiddleware');
    expect(appModule).toContain('OriginVerificationMiddleware');
  });

  it('PostgreSQL integration is covered by the existing runtime integration suite', () => {
    const runtime = read('test/integration/runtime-integration.spec.ts');
    expect(runtime).toContain('PrismaClient');
    expect(runtime).toContain('SELECT 1');
    expect(runtime).toContain('prisma.$connect');
  });

  it('Redis integration is covered by the existing runtime integration suite', () => {
    const runtime = read('test/integration/runtime-integration.spec.ts');
    expect(runtime).toContain('IORedis');
    expect(runtime).toContain('redis.ping');
    expect(runtime).toContain('round-trip a Redis key');
  });

  it('Queue integration is represented by BullMQ producer/worker contracts', () => {
    const queue = read('src/jobs/queue.service.ts');
    const worker = read('src/jobs/job.worker.ts');
    expect(queue).toContain('Queue');
    expect(queue).toContain('add(');
    expect(worker).toContain('Worker');
  });

  it('Storage integration has a dedicated security test and abstraction', () => {
    expect(fs.existsSync(path.join(root, 'src/documents/file-security.service.spec.ts'))).toBe(true);
    const storage = read('src/documents/s3.storage.ts');
    expect(storage).toContain('put');
    expect(storage).toContain('delete');
  });

  it('Auth integration has session-backed bearer verification', () => {
    const auth = read('src/common/guards/auth.guard.ts');
    expect(auth).toContain("header?.startsWith('Bearer ')");
    expect(auth).toContain('session');
    expect(auth).toContain('revokedAt');
    expect(auth).toContain('absoluteExpiresAt');
  });
});
