import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Stage 11 release-blocking fixes — idempotency & auth public mutations', () => {
  const apiRoot = join(__dirname, '../..');
  const interceptor = readFileSync(join(apiRoot, 'src/common/api-contract/api-contract.interceptor.ts'), 'utf8');
  const mobileApiClient = readFileSync(join(apiRoot, '../../apps/mobile/src/services/api-client.ts'), 'utf8');
  const mobileOfflineQueue = readFileSync(join(apiRoot, '../../apps/mobile/src/services/offline-queue.ts'), 'utf8');
  const mobileSession = readFileSync(join(apiRoot, '../../apps/mobile/src/state/session.tsx'), 'utf8');

  const expectedPublic = [
    '/auth/login',
    '/auth/refresh',
    '/auth/password-reset/request',
    '/auth/password-reset/confirm',
    '/auth/register',
    '/auth/email/verify',
  ];

  it('exempts the exact real public auth mutation routes', () => {
    for (const route of expectedPublic) {
      expect(interceptor).toContain(`'${route}'`);
    }
  });

  it('removes the old mismatched public-auth prefixes', () => {
    expect(interceptor).not.toContain("'/auth/forgot-password'");
    expect(interceptor).not.toContain("'/auth/reset-password'");
    expect(interceptor).not.toContain("'/auth/verify-email'");
  });

  it('does NOT broadly exempt all of /auth/*', () => {
    // Only exact public mutation routes are exempted; no wildcard `/auth/*`.
    expect(interceptor).not.toContain("'/auth/'");
    expect(interceptor).not.toContain("'/auth/*'");
  });

  it('supports Idempotency-Key dedupe for protected mutation verbs (optional, mock parity)', () => {
    // Mock-parity contract: the key is no longer REQUIRED (absence must never
    // block a mutation), but dedupe still applies when a valid key is present.
    expect(interceptor).toContain("new Set(['POST', 'PUT', 'PATCH', 'DELETE'])");
    expect(interceptor).toContain("req.headers['idempotency-key']");
    expect(interceptor).toContain("this.prisma.idempotencyRecord.findUnique({ where: { keyHash } })");
    expect(interceptor).not.toContain("'Idempotency-Key header is required for this retry-sensitive operation.'");
  });

  it('mobile client auto-generates an Idempotency-Key for mutating methods', () => {
    expect(mobileApiClient).toContain("new Set(['POST', 'PUT', 'PATCH', 'DELETE'])");
    expect(mobileApiClient).toContain('MUTATING_METHODS.has(method) && !headers.has(\'Idempotency-Key\')');
    expect(mobileApiClient).toContain("headers.set('Idempotency-Key', makeIdempotencyKey(");
  });

  it('mobile key is >=16 chars and skips GET/HEAD', () => {
    // min length requirement satisfied + only mutating methods get a key
    expect(mobileApiClient).toContain("existing.trim().length >= 16");
    expect(mobileApiClient).toContain('MUTATING_METHODS.has(method)');
  });

  it('mobile offline queue persists a stable idempotency key per mutation', () => {
    expect(mobileOfflineQueue).toContain('idempotencyKey?: string');
    expect(mobileApiClient).toContain("enqueueMutation({ path, method: 'POST', body, idempotencyKey })");
    expect(mobileApiClient).toContain("enqueueMutation({ path, method: 'PATCH', body, idempotencyKey })");
  });

  it('mobile offline flush reuses the queued idempotency key across retries', () => {
    expect(mobileSession).toContain("if (m.idempotencyKey) headers['Idempotency-Key'] = m.idempotencyKey;");
  });

  it('mobile offline queue preserves attempts/idempotencyKey on retry', () => {
    expect(mobileOfflineQueue).toContain('remaining.push({...item,attempts:item.attempts+1})');
  });
});
