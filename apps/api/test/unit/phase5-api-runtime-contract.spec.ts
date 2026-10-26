import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = (name: string) => readFileSync(join(__dirname, '../../src', name), 'utf8');

describe('Phase 5 API Contract / Error / Idempotency / Health / Runtime', () => {
  it('exposes canonical health endpoints and retains compatibility aliases', () => {
    const controller = src('health/health.controller.ts');
    expect(controller).toContain("@Get('liveness')");
    expect(controller).toContain("@Get('readiness')");
    expect(controller).toContain("@Get('live')");
    expect(controller).toContain("@Get('ready')");
  });

  it('keeps required stable error codes and operational fallbacks', () => {
    const contract = src('common/api-contract/error-contract.ts');
    for (const code of [
      'AUTH_REQUIRED','AUTH_INVALID','ACCESS_DENIED','ORG_SCOPE_DENIED',
      'FIELD_ACCESS_DENIED','VALIDATION_ERROR','RESOURCE_NOT_FOUND',
      'DUPLICATE_RESOURCE','APPROVAL_REQUIRED','RATE_LIMITED',
      'IDEMPOTENCY_CONFLICT','INTEGRATION_ERROR','INTERNAL_ERROR',
      'SERVICE_UNAVAILABLE',
    ]) expect(contract).toContain(`${code}: '${code}'`);
  });

  it('enforces idempotency for mutation/export/webhook contracts', () => {
    const interceptor = src('common/api-contract/api-contract.interceptor.ts');
    expect(interceptor).toContain("const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])");
    expect(interceptor).toContain('isWebhook(path)');
    expect(interceptor).toContain('isExport(path)');
    expect(interceptor).toContain("rawKey = req.headers['idempotency-key']");
    expect(interceptor).toContain('hashBytes(req.rawBody)');
    expect(interceptor).toContain('transformReadResponse');
  });

  it('does not expose raw dependency errors from health checks', () => {
    const health = src('health/health.service.ts');
    expect(health).toContain("error: 'dependency unavailable'");
    expect(health).not.toContain("error: error.message");
  });

  it('documents canonical API v1 and stable error envelope', () => {
    const main = src('main.ts');
    expect(main).toContain("document.openapi = '3.1.0'");
    expect(main).toContain('ErrorResponse');
    expect(main).toContain('Idempotency-Key');
    expect(main).toContain('X-Request-Id');
    expect(main).toContain('X-Correlation-Id');
    expect(main).toContain("'/health'");
  });
});
