import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase 4 backend contracts', () => {
  const root = join(__dirname, '..', '..');
  const read = (p: string) => readFileSync(join(root, p), 'utf8');

  it('keeps the canonical notification rule engine pipeline', () => {
    const s = read('src/notifications/notification-rule-engine.service.ts');
    expect(s).toContain('eventBus.subscribe');
    expect(s).toContain('matchesConditions');
    expect(s).toContain('resolveRecipients');
    expect(s).toContain('getPreferenceSnapshot');
    expect(s).toContain('recordDeliveryLog');
  });

  it('keeps workflow wait and approval resume contracts', () => {
    const s = read('src/workflows/workflows.service.ts');
    const a = read('src/workflows/workflow-approval.service.ts');
    expect(s).toContain("action.type==='WAIT'");
    expect(s).toContain('runExecutionFromIndex');
    expect(a).toContain("status: 'WAITING'");
    expect(a).toContain("status: 'REJECTED'");
  });

  it('requires an explicit approval request before import mutation', () => {
    const s = read('src/data-management/data-import.service.ts');
    expect(s).toContain('APPROVAL_ACTIONS.DATA_IMPORT');
    expect(s).toContain('approvalRequestId');
    expect(s).toContain('this.approvals.approve');
  });

  it('keeps export permission and approval gates', () => {
    const s = read('src/reporting/reporting.service.ts');
    expect(s).toContain("'report.export'");
    expect(s).toContain('assertApproved');
    expect(s).toContain('dataExportLog');
    expect(s).toContain("enterprise.admin");
  });

  it('keeps signed raw-body webhook verification and integration token decryption', () => {
    const s = read('src/integrations/integrations.service.ts');
    const c = read('src/integrations/integration-webhook.controller.ts');
    expect(s).toContain('timingSafeEqual');
    expect(s).toContain('this.encryption.decrypt');
    expect(s).toContain('integrationWebhookEvent');
    expect(s).toContain('INTEGRATION_SYNC_COMPLETED');
    expect(s).toContain("integration.read");
    expect(c).toContain('req.rawBody');
  });

  it('contains the Phase 4 migration', () => {
    expect(existsSync(join(root, 'prisma/migrations/20260824_phase4_notifications_approval_import/migration.sql'))).toBe(true);
  });

  it('keeps the canonical Package-4 business alert catalog', () => {
    const s = read('src/notifications/canonical-business-alerts.ts');
    for (const key of [
      'RELATIONSHIP_DECAY', 'COMMITMENT_OVERDUE', 'MEETING_WITHOUT_OUTCOME',
      'LONG_INACTIVITY', 'PERSON_POSITION_CHANGE', 'SCORE_DECREASE',
      'SINGLE_POINT_OF_CONTACT_RISK', 'NEW_OPPORTUNITY',
      'PROJECT_WITHOUT_SUFFICIENT_RELATIONSHIP',
    ]) expect(s).toContain(key);
  });

  it('keeps integration webhook provider validation and Nest error contracts', () => {
    const s = read('src/integrations/integrations.service.ts');
    const c = read('src/integrations/integration-webhook.controller.ts');
    expect(s).toContain("Unsupported integration webhook provider");
    expect(c).toContain('BadRequestException');
  });
});
