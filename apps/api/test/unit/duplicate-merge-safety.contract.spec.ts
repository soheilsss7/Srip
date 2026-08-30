import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('duplicate merge safety contract', () => {
  const source = readFileSync(join(__dirname, '../../src/data-management/duplicate-detection.service.ts'), 'utf8');

  it('records the canonical merge target independently of the lifecycle organization scope', () => {
    expect(source).toContain('mergedIntoId: mergedIntoId ?? null');
    expect(source).toContain("'duplicate-merge-self-relationship', null");
    expect(source).toContain("'duplicate-merge-self-person-relationship', null");
  });

  it('moves relationship references before archiving duplicate organization records', () => {
    expect(source.indexOf('await this.mergeOrganizationRelations')).toBeGreaterThan(-1);
    expect(source.indexOf('await this.mergeOrganizationRelations')).toBeLessThan(source.indexOf("'duplicate-merged'"));
    expect(source).toContain('moveRelationshipLinks(db, relationship.id, conflict.id)');
    expect(source).toContain('clearRelationshipLinks(db, relationship.id)');
  });
});
