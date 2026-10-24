import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = (name: string) => readFileSync(join(__dirname, '../../src', name), 'utf8');

describe('Phase 17 API security contract', () => {
  it('keeps security endpoints permission protected', () => {
    const controller = src('security/security.controller.ts');
    expect(controller).toContain("@RequirePermission('security.read')");
  });

  it('keeps sensitive workflow mutations permission-aware', () => {
    const service = src('workflows/workflows.service.ts');
    expect(service).toContain("'workflow.execute'");
    expect(service).toContain("'action.write'");
    expect(service).toContain("'commitment.write'");
    expect(service).toContain("'opportunity.write'");
  });

  it('keeps relationship score recalculation organization-scoped', () => {
    const facade = src('relationships/relationship-score.service.ts');
    const canonical = src('scoring/relationship-score.service.ts');
    expect(facade).toContain('CanonicalRelationshipScoreService');
    expect(canonical).toContain('assertAnyOrganizationAccess');
  });
});
