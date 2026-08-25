import { Reflector } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { PERMISSION_KEY } from './common/decorators/require-permission.decorator';

describe('MetricsController security contract', () => {
  const metrics = {
    prometheus: jest.fn(),
    snapshot: jest.fn(() => ({ apiLatency: {}, dbLatency: {}, ai: {}, storage: {} })),
  } as any;

  it('keeps Prometheus behind the internal-network guard', () => {
    const metadata = Reflect.getMetadata('__guards__', MetricsController.prototype.prometheus);
    expect(metadata).toBeDefined();
    expect(metadata.some((guard: any) => guard.name === 'InternalMetricsGuard')).toBe(true);
  });

  it('requires metrics.read on management endpoints', () => {
    for (const method of ['summary', 'apiLatency', 'dbLatency', 'ai', 'storage']) {
      expect(Reflect.getMetadata(PERMISSION_KEY, MetricsController.prototype[method])).toBe('metrics.read');
      const guards = Reflect.getMetadata('__guards__', MetricsController.prototype[method]);
      expect(guards.map((g: any) => g.name)).toEqual(expect.arrayContaining(['AuthGuard', 'AuthorizationGuard']));
    }
  });
});
