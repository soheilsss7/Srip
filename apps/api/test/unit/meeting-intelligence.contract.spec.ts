import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Meeting intelligence contract', () => {
  const source = (file: string) => readFileSync(join(__dirname, '../../src', file), 'utf8');

  it('supports a complete meeting-to-follow-up workflow', () => {
    const controller = source('meetings/meetings.controller.ts');
    expect(controller).toContain("@Get(':id/minutes')");
    expect(controller).toContain("@Post(':id/finalize')");
    expect(controller).toContain("@Post(':id/action-items/extract')");
    expect(controller).toContain("@Post(':id/action-items/apply')");
    expect(controller).toContain("@Get('follow-ups/list')");
  });

  it('requires owner scope validation before applying extracted work', () => {
    const service = source('meetings/meetings.service.ts');
    expect(service).toContain('Selected owner is outside the meeting organization scope');
    expect(service).toContain('contextOrganizationIds');
    expect(service).toContain('isActive: true');
    expect(service).toContain('memberships: { some: { organizationId: { in: contextOrganizationIds } } }');
  });
});
