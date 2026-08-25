import { ExecutionContext } from '@nestjs/common';
import { InternalMetricsGuard } from './internal-metrics.guard';

function ctx(ip: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ ip, socket: { remoteAddress: ip } }) }),
  } as unknown as ExecutionContext;
}

describe('InternalMetricsGuard', () => {
  const original = process.env.METRICS_ALLOWED_CIDRS;

  afterEach(() => {
    if (original === undefined) delete process.env.METRICS_ALLOWED_CIDRS;
    else process.env.METRICS_ALLOWED_CIDRS = original;
  });

  it('allows explicitly configured internal CIDRs', () => {
    process.env.METRICS_ALLOWED_CIDRS = '10.20.0.0/16,::1/128';
    const guard = new InternalMetricsGuard();
    expect(guard.canActivate(ctx('10.20.4.10'))).toBe(true);
    expect(guard.canActivate(ctx('::1'))).toBe(true);
  });

  it('denies public addresses', () => {
    process.env.METRICS_ALLOWED_CIDRS = '10.20.0.0/16';
    const guard = new InternalMetricsGuard();
    expect(() => guard.canActivate(ctx('203.0.113.10'))).toThrow();
  });

  it('fails closed when configuration contains no valid network', () => {
    process.env.METRICS_ALLOWED_CIDRS = 'not-a-network';
    expect(() => new InternalMetricsGuard()).toThrow();
  });
});
