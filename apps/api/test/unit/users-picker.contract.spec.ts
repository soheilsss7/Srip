import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Users picker contract', () => {
  const source = (file: string) => readFileSync(join(__dirname, '../../src', file), 'utf8');

  it('exposes a protected, permission-aware picker route', () => {
    const controller = source('users/users.controller.ts');
    expect(controller).toContain("@Controller('users')");
    expect(controller).toContain("@Get('picker')");
    expect(controller).toContain("@RequirePermission('entity.read')");
    expect(controller).toContain('organizationId');
    expect(controller).toContain('search');
  });

  it('keeps organization scope and search in the service query', () => {
    const service = source('users/users.service.ts');
    expect(service).toContain("assertPermission(userId, 'entity.read', { organizationId })");
    expect(service).toContain('accessibleOrganizationIds(userId)');
    expect(service).toContain('where.memberships');
    expect(service).toContain('name: { contains: search.trim(), mode: \'insensitive\' }');
    expect(service).toContain('email: { contains: search.trim(), mode: \'insensitive\' }');
  });
});
