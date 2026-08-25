import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(root, p));

describe('PHASE AD testing matrix contract', () => {
  it('declares all four required test levels', () => {
    const matrix = read('PHASE_AD_TESTING_MATRIX.md');
    for (const level of ['UNIT', 'INTEGRATION', 'E2E', 'SECURITY']) expect(matrix).toContain(level);
  });

  it('covers every required unit domain', () => {
    const matrix = read('PHASE_AD_TESTING_MATRIX.md');
    for (const item of ['Score Engine','Permission Engine','Relationship Logic','Workflow','Recommendation','Validation','Date/Time Logic']) expect(matrix).toContain(item);
  });

  it('covers every required integration domain', () => {
    const matrix = read('PHASE_AD_TESTING_MATRIX.md');
    for (const item of ['API','PostgreSQL','Auth','Redis','Queue','Storage']) expect(matrix).toContain(item);
  });

  it('covers the complete backend E2E business flow', () => {
    const matrix = read('PHASE_AD_TESTING_MATRIX.md');
    for (const item of ['Login','Create Organization','Create Person','Create Relationship','Create Meeting','Complete Meeting','Create Action','Create Commitment','Follow-up','Recommendation','Permission Denial']) expect(matrix).toContain(item);
  });

  it('has executable suites for each level', () => {
    expect(exists('test/unit/phase-ad-core-logic.spec.ts')).toBe(true);
    expect(exists('test/integration/phase-ad-integration.contract.spec.ts')).toBe(true);
    expect(exists('test/e2e/phase-ad.e2e.spec.ts')).toBe(true);
    expect(exists('test/security/phase-ae-security.spec.ts')).toBe(true);
  });
});
