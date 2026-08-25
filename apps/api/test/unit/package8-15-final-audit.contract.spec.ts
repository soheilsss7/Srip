import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Package 8.15 final audit regression contracts', () => {
  const root = join(process.cwd());
  const read = (p: string) => readFileSync(join(root, p), 'utf8');

  it('does not reference an out-of-scope transaction variable in permanent-delete approval', () => {
    const source = read('apps/api/src/common/data-lifecycle/data-lifecycle.service.ts');
    const approve = source.slice(source.indexOf('async approvePermanentDelete'), source.indexOf('async rejectPermanentDelete'));
    expect(approve).not.toContain('tx ?? this.prisma');
    expect(approve).toContain("const approval=await this.prisma.approvalRequest.findUnique({where:{id:approvalId}});");
    const permanentDelete = source.slice(source.indexOf('async permanentDelete'));
    expect(permanentDelete).toContain('const db:any=tx ?? this.prisma');
  });

  it('does not pass unsupported DataLifecycle as an authorization resource type', () => {
    const source = read('apps/api/src/common/data-lifecycle/data-lifecycle.service.ts');
    expect(source).not.toContain("entityType: 'DataLifecycle', entityId: approval.entityId");
    expect(source).toContain("assertPermission(approverId,'data.permanent_delete',{organizationId: approval.organizationId ?? undefined})");
  });

  it('rejects are resource-scoped like approvals', () => {
    const source = read('apps/api/src/approvals/approval.service.ts');
    expect(source).toContain('const actionContext = approval.entityType === \'DataLifecycle\'');
    expect(source).toContain('await this.authorization.assertPermission(deciderId, APPROVAL_PERMISSIONS[action], actionContext);');
    expect(source).toContain("where: { id: approval.id, status: 'PENDING' }");
  });

  it('keeps admin rule listings bounded', () => {
    const source = read('apps/api/src/admin/admin.service.ts');
    expect(source).toContain('scoringRule.findMany({ where: { ...(organizationId ? { organizationId } : {}) }, orderBy: { createdAt: \'desc\' }, take: 500 })');
    expect(source).toContain('notificationRule.findMany({ where: { ...(organizationId ? { organizationId } : {}) }, orderBy: { createdAt: \'desc\' }, take: 500 })');
  });
});
