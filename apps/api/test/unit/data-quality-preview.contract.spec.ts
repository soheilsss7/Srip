import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Data quality duplicate preview contract', () => {
  const source = (file: string) => readFileSync(join(__dirname, '../../src', file), 'utf8');

  it('exposes an explicit, non-mutating merge preview route', () => {
    const controller = source('data-management/data-management.controller.ts');
    const service = source('data-management/duplicate-detection.service.ts');
    expect(controller).toContain("@Post('duplicates/merge-preview')");
    expect(controller).toContain("@RequirePermission('data.quality.execute')");
    expect(service).toContain('requiresExplicitConfirmation: true');
    expect(service).toContain('writePerformed: false');
    expect(controller).toContain("@Post('duplicates/merge')");
    expect(service).toContain("confirmation !== 'MERGE'");
    expect(service).toContain('$transaction(async tx');
    expect(service).toContain('duplicate-merged');
  });

  it('returns readable record labels while retaining auditable record references', () => {
    const service = source('data-management/data-quality.service.ts');
    expect(service).toContain('records: (group.ids ?? []).map(id => byId.get(id)).filter(Boolean)');
    expect(service).toContain('missingOwners.map(x => ({ id: x.id, name: x.name }))');
    expect(service).toContain('sourceOrganization: r.sourceOrganization');
  });
});
