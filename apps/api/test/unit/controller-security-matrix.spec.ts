import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { CONTROLLER_SECURITY_MATRIX, ControllerSecurityCategory } from './controller-security-matrix';

const controllersDir = join(__dirname, '../../src');

function controllerFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...controllerFiles(full));
    else if (entry.name.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

const sourceFor = (file: string) => readFileSync(file, 'utf8');
const has = (source: string, token: string) => source.includes(token);

describe('PHASE AF controller security matrix', () => {
  it('classifies every backend controller exactly once', () => {
    const files = controllerFiles(controllersDir);
    expect(files.length).toBeGreaterThan(10);
    const keys = files.map((f) => basename(f));
    const missing = keys.filter((k) => !CONTROLLER_SECURITY_MATRIX[k]);
    const stale = Object.keys(CONTROLLER_SECURITY_MATRIX).filter((k) => !keys.includes(k));
    expect(missing).toEqual([]);
    expect(stale).toEqual([]);
    for (const rule of Object.values(CONTROLLER_SECURITY_MATRIX)) {
      expect(['PUBLIC','AUTHENTICATED','AUTHORIZED','INTERNAL','WEBHOOK_SIGNED','HEALTH'] as ControllerSecurityCategory[]).toContain(rule.category);
    }
  });

  it('enforces category-specific controller contracts rather than one universal guard rule', () => {
    for (const file of controllerFiles(controllersDir)) {
      const name = basename(file);
      const source = sourceFor(file);
      const rule = CONTROLLER_SECURITY_MATRIX[name];
      expect(rule).toBeDefined();

      for (const guard of rule.requiredGuards ?? []) expect(source).toContain(guard);
      if (rule.requirePermission) expect(source).toContain('@RequirePermission(');

      switch (rule.category) {
        case 'PUBLIC':
          // Public controllers may contain narrow authenticated route exceptions.
          if (name === 'auth.controller.ts') expect(source).toContain("@UseGuards(AuthGuard)");
          break;
        case 'AUTHENTICATED':
          expect(source).toContain('AuthGuard');
          break;
        case 'AUTHORIZED':
          expect(source).toContain('AuthGuard');
          expect(source).toContain('AuthorizationGuard');
          expect(source).toContain('@RequirePermission(');
          break;
        case 'INTERNAL':
          expect(source).toContain('InternalMetricsGuard');
          break;
        case 'WEBHOOK_SIGNED':
          expect(source).toContain('WebhookSignatureGuard');
          break;
        case 'HEALTH':
          expect(source).toContain("@Controller('health')");
          expect(source).not.toContain('AuthGuard');
          expect(source).not.toContain('AuthorizationGuard');
          break;
      }
    }
  });

  it('keeps the intentional mixed AuthController contract explicit', () => {
    const rule = CONTROLLER_SECURITY_MATRIX['auth.controller.ts'];
    expect(rule.category).toBe('PUBLIC');
    expect(rule.exceptions).toContain('POST auth/email/resend requires AuthGuard');
  });

  it('does not permit the previously unprotected administrative UsersController or ObservabilityController', () => {
    const users = sourceFor(join(controllersDir, 'users/users.controller.ts'));
    const observability = sourceFor(join(controllersDir, 'observability/observability.controller.ts'));
    expect(users).toContain('@UseGuards(AuthGuard, AuthorizationGuard)');
    expect(users).toContain("@RequirePermission('admin.users')");
    expect(observability).toContain('@UseGuards(InternalMetricsGuard)');
  });
});
