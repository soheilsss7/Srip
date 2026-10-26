import { DOMAIN_OWNERSHIP } from '../../src/common/domain-ownership.contract';
import * as fs from 'node:fs';
import * as path from 'node:path';

const apiRoot = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(apiRoot, relative), 'utf8');

describe('PHASE AQ domain ownership', () => {
  it('keeps Relationship scoring in ScoringModule', () => {
    const source = read('relationships/relationships.service.ts');
    expect(source).not.toMatch(/DEFAULT_RELATIONSHIP_WEIGHTS|RELATIONSHIP_SCORE_FACTORS|normalizeWeights|resolveWeights/);
  });

  it('keeps WorkflowApproval persistence outside WorkflowsService', () => {
    const source = read('workflows/workflows.service.ts');
    expect(source).not.toMatch(/workflowApproval\.(create|update|updateMany|findUnique|findUniqueOrThrow)/);
    expect(source).toContain('WorkflowApprovalService');
  });

  it('declares the canonical boundaries', () => {
    expect(DOMAIN_OWNERSHIP.ScoringModule.owns).toContain('score formulas');
    expect(DOMAIN_OWNERSHIP.NotificationRuleEngineService.owns).toContain('notification rule matching');
    expect(DOMAIN_OWNERSHIP.AuditService.owns).toContain('AuditLog persistence');
    expect(DOMAIN_OWNERSHIP.EventBusService.owns).toContain('domain event outbox');
  });
});
