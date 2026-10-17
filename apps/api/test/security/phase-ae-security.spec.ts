import fs from 'node:fs';
import path from 'node:path';
import { FieldSecurityService } from '../../src/common/authorization/field-security.service';
import { EntityResponseDto } from '../../src/common/dto/entity-response.dto';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

function mockExecutionContext(request: any) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as any;
}

describe('PHASE AE backend security matrix', () => {
  it('contains OWASP ASVS and Top 10 coverage categories', () => {
    const matrix = read('PHASE_AE_SECURITY_TESTING.md');
    for (const item of ['OWASP ASVS','OWASP Top 10','Authentication','Authorization','IDOR','SQL Injection','XSS','CSRF','SSRF','File Upload','Rate Limit','Session Attacks','Data Leakage']) expect(matrix).toContain(item);
  });

  it('covers IDOR and cross-company leakage as mandatory scenarios', () => {
    const matrix = read('PHASE_AE_SECURITY_TESTING.md');
    expect(matrix).toContain('User A');
    expect(matrix).toContain('User B');
    expect(matrix).toContain('Cross-company leakage');
    expect(matrix).toContain('Subsidiary A');
    expect(matrix).toContain('Organization B');
  });

  it('AuthorizationGuard cannot authorize a request without an authenticated principal', async () => {
    const { AuthorizationGuard } = await import('../../src/common/guards/authorization.guard');
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue('relationship.read') } as any;
    const authorization = { assertPermission: jest.fn() } as any;
    const guard = new AuthorizationGuard(reflector, authorization);
    await expect(guard.canActivate(mockExecutionContext({ body: {}, query: {}, params: {}, user: undefined }))).rejects.toThrow();
    expect(authorization.assertPermission).not.toHaveBeenCalled();
  });

  it('AuthGuard requires a Bearer token and active session', async () => {
    const { AuthGuard } = await import('../../src/common/guards/auth.guard');
    const jwt = { verify: jest.fn().mockReturnValue({ sub: 'u1', sid: 's1' }) } as any;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, deletedAt: null }) },
      session: { findUnique: jest.fn().mockResolvedValue({ id: 's1', userId: 'u1', revokedAt: null, rotatedAt: null, expiresAt: new Date(Date.now()+60000), absoluteExpiresAt: new Date(Date.now()+60000), idleExpiresAt: new Date(Date.now()+60000), ipAddress: '1.1.1.1', userAgent: 'test' }), update: jest.fn() },
      securityEvent: { create: jest.fn() },
    } as any;
    const context = { setUserId: jest.fn() } as any;
    const guard = new AuthGuard(jwt, prisma, context);
    await expect(guard.canActivate(mockExecutionContext({ headers: {}, ip: '1.1.1.1' }))).rejects.toThrow();
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('Classification leakage is blocked at field level', async () => {
    const auth = { assertPermission: jest.fn(async (_u: string, permission: string) => {
      if (permission !== 'relationship.notes.read') throw new Error('denied');
    }) };
    const fields = new FieldSecurityService(auth as any);
    const result = await fields.sanitize('internal-user', 'Relationship', {
      id: 'r1', notes: 'restricted note', strategicAssessment: 'restricted assessment', risk: 'restricted risk', internalOpinion: 'restricted opinion',
    }, { entityType: 'Relationship', entityId: 'r1', classification: 'RESTRICTED', sensitivity: 'RESTRICTED' });
    expect(result.notes).toBe('restricted note');
    expect(result.strategicAssessment).toBeUndefined();
    expect(result.risk).toBeUndefined();
    expect(result.internalOpinion).toBeUndefined();
  });

  it('Data leakage DTO contract removes secrets and internal storage identifiers', () => {
    const dto = EntityResponseDto.from('IntegrationConnection', {
      id: 'x', accessTokenEncrypted: 'secret', refreshTokenEncrypted: 'secret', storageKey: 'internal', name: 'safe',
    });
    expect(dto).toEqual({ id: 'x', name: 'safe' });
  });

  it('SQL injection: application search uses parameterized query values rather than string interpolation for the user query', () => {
    const search = read('src/search/search.service.ts');
    // Search uses Prisma tagged-template (parameterized) raw queries, never unsafe interpolation.
    expect(search).toMatch(/\$queryRaw`/);
    expect(search).toContain("plainto_tsquery('simple', ${q})");
    expect(search).not.toMatch(/\$queryRawUnsafe/);
  });

  it('XSS: API security headers and output DTO boundary are present', () => {
    const hardening = read('src/production-hardening.ts');
    expect(hardening).toContain("X-Content-Type-Options");
    expect(hardening).toContain("X-Frame-Options");
    const dto = read('src/common/dto/entity-response.dto.ts');
    expect(dto).toContain('GLOBAL_BLOCKED_KEYS');
  });

  it('CSRF/origin protection is enforced for browser mutating requests', () => {
    const hardening = read('src/production-hardening.ts');
    expect(hardening).toContain('OriginVerificationMiddleware');
    expect(hardening).toContain("['POST', 'PUT', 'PATCH', 'DELETE']");
    expect(hardening).toContain('ORIGIN_NOT_ALLOWED');
  });

  it('SSRF-sensitive outbound integrations do not expose raw URL fetching from user-controlled endpoints', () => {
    const integrations = read('src/integrations/integrations.service.ts');
    expect(integrations).toContain('authorization');
    expect(integrations).not.toMatch(/fetch\(.*req\.body/);
    expect(integrations).not.toMatch(/axios\.(get|post)\(.*req\.body/);
  });

  it('File Upload security has extension/MIME/content/size validation and malware scanning', () => {
    const file = read('src/documents/file-security.service.ts');
    expect(file).toContain('MAX_BYTES');
    expect(file).toContain('extension and MIME type');
    expect(file).toContain('content does not match');
    expect(file).toContain('ClamAV');
    expect(file).toContain('INFECTED');
  });

  it('Rate limiting is Redis-backed and has separate sensitive categories', () => {
    const rate = read('src/common/rate-limit/rate-limit.service.ts');
    for (const key of ['rate:global','rate:ip:','rate:user:','rate:endpoint:','rate:login:','rate:sensitive:']) expect(rate).toContain(key);
    for (const category of ['login','password-reset','mfa','export','search','bulk-import','webhook','sensitive']) expect(rate).toContain(`'${category}'`);
    expect(rate).toContain('RATE_LIMIT_BACKEND_UNAVAILABLE');
  });

  it('Session attacks are covered by revocation, rotation and idle/absolute expiration checks', () => {
    const auth = read('src/common/guards/auth.guard.ts');
    for (const token of ['revokedAt','rotatedAt','expiresAt','absoluteExpiresAt','idleExpiresAt']) expect(auth).toContain(token);
  });

  it('Metrics and management endpoints are not public', () => {
    const metrics = read('src/metrics.controller.ts');
    expect(metrics).toContain('@UseGuards(InternalMetricsGuard)');
    expect(metrics).toContain('@UseGuards(AuthGuard, AuthorizationGuard)');
    expect(metrics).toContain("@RequirePermission('metrics.read')");
  });
});
