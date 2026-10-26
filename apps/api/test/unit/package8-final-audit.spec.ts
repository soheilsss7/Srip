import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const repo = path.resolve(root, '../..');
const readApi = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const readRepo = (p: string) => fs.readFileSync(path.join(repo, p), 'utf8');
const existsApi = (p: string) => fs.existsSync(path.join(root, p));
const existsRepo = (p: string) => fs.existsSync(path.join(repo, p));

describe('PACKAGE 8 final testing/security audit contract', () => {
  it('has all four canonical test levels and required unit domains', () => {
    const matrix = readApi('PHASE_AD_TESTING_MATRIX.md') + readRepo('docs/testing/PACKAGE8_TESTING_SECURITY_E2E_FINAL_AUDIT.md');
    for (const level of ['UNIT', 'INTEGRATION', 'E2E', 'SECURITY']) expect(matrix).toContain(level);
    for (const item of ['Score Engine','Permission Engine','Relationship Logic','Workflow','Recommendation','Validation','Date/Time Logic']) expect(matrix).toContain(item);
  });

  it('has integration coverage for every required runtime dependency', () => {
    const matrix = readRepo('docs/testing/PACKAGE8_TESTING_SECURITY_E2E_FINAL_AUDIT.md');
    for (const item of ['API + OpenAPI contract','PostgreSQL / Prisma','Authentication/session authorization','Redis/rate limiting','BullMQ queue/worker','Object storage/file security','AI Gateway boundary']) expect(matrix).toContain(item);
  });

  it('has the complete canonical E2E acceptance flow', () => {
    const matrix = readRepo('docs/testing/PACKAGE8_TESTING_SECURITY_E2E_FINAL_AUDIT.md');
    for (const item of ['Login','Create Organization','Create Person','Create Relationship','Create Meeting','Complete Meeting','Create Action','Create Commitment','Follow-up','Recommendation','Permission Denial']) expect(matrix).toContain(item);
    expect(existsApi('test/e2e/phase-ad.e2e.spec.ts')).toBe(true);
    expect(existsRepo('tests/e2e/package8-e2e.mjs')).toBe(true);
  });

  it('has executable security coverage and prompt-injection defense', () => {
    const matrix = readApi('PHASE_AE_SECURITY_TESTING.md') + readRepo('docs/testing/PACKAGE8_TESTING_SECURITY_E2E_FINAL_AUDIT.md');
    for (const item of ['OWASP ASVS','OWASP Top 10','Authentication','Authorization','IDOR','SQL Injection','XSS','CSRF','SSRF','File Upload','Rate Limit','Session Attacks','Data Leakage','prompt-injection defense']) expect(matrix).toContain(item);
    expect(existsApi('test/security/phase-ae-security.spec.ts')).toBe(true);
    const ai = readApi('src/ai/ai-pipeline.service.ts');
    expect(ai).toContain('BLOCKED_PROMPT_INJECTION');
    expect(ai).toContain('BLOCKED_SYSTEM_PROMPT_REFERENCE');
  });

  it('has final-audit evidence and explicitly separates environment-gated evidence', () => {
    const audit = readRepo('docs/testing/PACKAGE8_TESTING_SECURITY_E2E_FINAL_AUDIT.md');
    for (const item of ['Static syntax/contract verification: PASS','Live runtime evidence: ENVIRONMENT-GATED','External pentest: ENVIRONMENT-GATED','Production readiness: NOT falsely claimed']) expect(audit).toContain(item);
  });
});
