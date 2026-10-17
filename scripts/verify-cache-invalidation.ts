import { PerformanceCacheService } from '../apps/api/src/common/performance/performance-cache.service';
import Redis from 'ioredis';

const prefix = `perf:cache-runtime:${Date.now()}:`;
const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 2, enableReadyCheck: true });
const cache = new PerformanceCacheService();

async function main() {
  await redis.set(`${prefix}a`, '1', 'EX', 60);
  await redis.set(`${prefix}b`, '2', 'EX', 60);
  const before = await redis.keys(`${prefix}*`);
  if (before.length !== 2) throw new Error(`Expected 2 seeded cache keys, found ${before.length}`);
  const removed = await cache.invalidatePrefix(prefix);
  if (removed !== 2) throw new Error(`Expected canonical invalidation to remove 2 keys, removed ${removed}`);
  const after = await redis.keys(`${prefix}*`);
  if (after.length !== 0) throw new Error(`Cache keys remain after canonical invalidation: ${after.join(',')}`);
  console.log(`CACHE_INVALIDATION_RUNTIME_CHECK=PASS removed=${removed}`);
}

main().finally(async () => { await cache.close(); await redis.quit().catch(() => undefined); });
