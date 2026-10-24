import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class PerformanceCacheService {
  private readonly logger = new Logger(PerformanceCacheService.name);
  private readonly redis?: Redis;
  private readonly enabled: boolean;

  constructor() {
    const url = process.env.REDIS_URL;
    this.enabled = Boolean(url) && process.env.PERFORMANCE_CACHE_ENABLED !== 'false';
    if (this.enabled && url) {
      this.redis = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true, enableOfflineQueue: false, connectTimeout: 1500 });
      this.redis.on('error', () => undefined);
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.redis) return undefined;
    try { const value = await this.redis.get(key); return value ? JSON.parse(value) as T : undefined; }
    catch (error) { this.logger.warn(`cache get failed for ${key}: ${String(error)}`); return undefined; }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    try { await this.redis.set(key, JSON.stringify(value), 'EX', Math.max(1, ttlSeconds)); }
    catch (error) { this.logger.warn(`cache set failed for ${key}: ${String(error)}`); }
  }

  async invalidatePrefix(prefix:string):Promise<number>{ if(!this.redis||!prefix)return 0; try{let cursor='0',removed=0; do{const [next,keys]=await this.redis.scan(cursor,'MATCH',`${prefix}*`,'COUNT',100);cursor=next;if(keys.length)removed+=await this.redis.del(...keys);}while(cursor!=='0');return removed;}catch(error){this.logger.warn(`cache invalidate failed for ${prefix}: ${String(error)}`);return 0;} }
  async del(...keys: string[]): Promise<void> {
    if (!this.redis || !keys.length) return;
    try { await this.redis.del(...keys); } catch (error) { this.logger.warn(`cache delete failed: ${String(error)}`); }
  }

  async close(): Promise<void> { if (this.redis) await this.redis.quit().catch(() => undefined); }
}
