import { RateLimitService } from './rate-limit.service';

describe('RateLimitService PHASE AA contract', () => {
  it('declares the required distributed keys and separate categories', () => {
    const source = require('fs').readFileSync(require.resolve('./rate-limit.service.ts'), 'utf8');
    expect(source).toContain('rate:global');
    expect(source).toContain('rate:ip:');
    expect(source).toContain('rate:user:');
    expect(source).toContain('rate:endpoint:');
    expect(source).toContain('rate:login:');
    expect(source).toContain('rate:sensitive:');
    for (const category of ['password-reset','mfa','export','search','bulk-import','webhook']) expect(source).toContain(category);
    expect(source).toContain('redis.eval');
    expect(RateLimitService).toBeDefined();
  });
});
