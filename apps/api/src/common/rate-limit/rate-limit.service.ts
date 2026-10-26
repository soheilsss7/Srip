import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { TooManyRequestsException } from '../exceptions';
import Redis from 'ioredis';

export type RateLimitCategory = 'default'|'login'|'password-reset'|'mfa'|'export'|'search'|'bulk-import'|'webhook'|'sensitive';
export type RateLimitContext = { ip?: string; userId?: string; endpoint: string; category?: RateLimitCategory };
export type RateLimitResult = { allowed:boolean; limit:number; remaining:number; retryAfterSeconds:number; resetAt:number; key:string };
type Policy = { limit:number; windowMs:number };

const INCR_EXPIRE_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`;

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly policies: Record<RateLimitCategory, Policy> = {
    default: this.policy('RATE_LIMIT_ENDPOINT_MAX','RATE_LIMIT_ENDPOINT_WINDOW_MS',120,60000),
    login: this.policy('RATE_LIMIT_LOGIN_MAX','RATE_LIMIT_LOGIN_WINDOW_MS',10,900000),
    'password-reset': this.policy('RATE_LIMIT_PASSWORD_RESET_MAX','RATE_LIMIT_PASSWORD_RESET_WINDOW_MS',5,900000),
    mfa: this.policy('RATE_LIMIT_MFA_MAX','RATE_LIMIT_MFA_WINDOW_MS',10,300000),
    export: this.policy('RATE_LIMIT_EXPORT_MAX','RATE_LIMIT_EXPORT_WINDOW_MS',20,600000),
    search: this.policy('RATE_LIMIT_SEARCH_MAX','RATE_LIMIT_SEARCH_WINDOW_MS',120,60000),
    'bulk-import': this.policy('RATE_LIMIT_BULK_IMPORT_MAX','RATE_LIMIT_BULK_IMPORT_WINDOW_MS',10,600000),
    webhook: this.policy('RATE_LIMIT_WEBHOOK_MAX','RATE_LIMIT_WEBHOOK_WINDOW_MS',300,60000),
    sensitive: this.policy('RATE_LIMIT_SENSITIVE_MAX','RATE_LIMIT_SENSITIVE_WINDOW_MS',30,60000),
  };
  private readonly globalPolicy = this.policy('RATE_LIMIT_GLOBAL_MAX','RATE_LIMIT_GLOBAL_WINDOW_MS',10000,60000);
  private readonly ipPolicy = this.policy('RATE_LIMIT_IP_MAX','RATE_LIMIT_IP_WINDOW_MS',500,60000);
  private readonly userPolicy = this.policy('RATE_LIMIT_USER_MAX','RATE_LIMIT_USER_WINDOW_MS',1000,60000);

  async onModuleDestroy(): Promise<void> { await this.redis.quit().catch(() => undefined); }

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 1, enableReadyCheck: true, lazyConnect: true, enableOfflineQueue: false, connectTimeout: 1500 });
    this.redis.on('error', () => undefined);
  }

  async consume(context: RateLimitContext): Promise<RateLimitResult[]> {
    const checks = [
      { key:'rate:global', policy:this.globalPolicy },
      { key:`rate:ip:${this.normalize(context.ip ?? 'unknown')}`, policy:this.ipPolicy },
      { key:`rate:endpoint:${this.normalize(context.endpoint)}`, policy:this.policies[context.category ?? 'default'] },
    ];
    if (context.userId) checks.push({ key:`rate:user:${this.normalize(context.userId)}`, policy:this.userPolicy });
    if (context.category === 'login') checks.push({ key:`rate:login:${this.normalize(context.ip ?? 'unknown')}`, policy:this.policies.login });
    if (context.category === 'sensitive' && context.userId) checks.push({ key:`rate:sensitive:${this.normalize(context.userId)}`, policy:this.policies.sensitive });
    const results: RateLimitResult[] = [];
    for (const check of checks) results.push(await this.increment(check.key, check.policy));
    const denied = results.find(r => !r.allowed);
    if (denied) throw new TooManyRequestsException({ code:'RATE_LIMIT_EXCEEDED', message:'rate limit exceeded', details:{ retryAfterSeconds:denied.retryAfterSeconds, limit:denied.limit, resetAt:denied.resetAt } });
    return results;
  }

  private async increment(key:string, policy:Policy):Promise<RateLimitResult> {
    try {
      const timeout = new Promise<never>((_resolve, reject) => { setTimeout(() => reject(new Error('rate-limit backend timeout')), 1500); });
      const raw = await Promise.race([this.redis.eval(INCR_EXPIRE_SCRIPT, 1, key, String(policy.windowMs)), timeout]) as [number|string, number|string];
      const count = Number(raw[0]); const ttlMs = Math.max(1, Number(raw[1])); const allowed = count <= policy.limit;
      return { allowed, limit:policy.limit, remaining:Math.max(0,policy.limit-count), retryAfterSeconds:Math.max(1,Math.ceil(ttlMs/1000)), resetAt:Date.now()+ttlMs, key };
    } catch {
      if (process.env.RATE_LIMIT_FAIL_OPEN === 'true') return { allowed:true, limit:policy.limit, remaining:policy.limit, retryAfterSeconds:0, resetAt:Date.now()+policy.windowMs, key };
      throw new TooManyRequestsException({ code:'RATE_LIMIT_BACKEND_UNAVAILABLE', message:'rate limit service unavailable' });
    }
  }

  private policy(maxEnv:string, windowEnv:string, defaultMax:number, defaultWindow:number):Policy {
    return { limit:Math.max(1,Number(process.env[maxEnv] ?? defaultMax)), windowMs:Math.max(1000,Number(process.env[windowEnv] ?? defaultWindow)) };
  }
  private normalize(value:string):string { return encodeURIComponent(value).replace(/%/g,'_'); }
}
