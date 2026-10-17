import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Package 8.14 concurrency/bounds regression contracts', () => {
  const root = join(__dirname, '../../../..');
  const read = (p: string) => readFileSync(join(root, p), 'utf8');

  it('checks permanent-delete approval inside the active transaction', () => {
    const source = read('apps/api/src/common/data-lifecycle/data-lifecycle.service.ts');
    expect(source).toContain('const db:any=tx ?? this.prisma; const approval=await db.approvalRequest.findUnique');
    expect(source).toContain("const delegate=(db as any)[this.config(entityType).delegate]");
  });

  it('claims approval decisions atomically', () => {
    const source = read('apps/api/src/approvals/approval.service.ts');
    expect(source).toContain("updateMany({\n        where: { id: approval.id, status: 'PENDING' }");
    expect(source).toContain("if (claim.count !== 1) throw new ConflictException('Approval was already decided')");
  });

  it('prevents push endpoint ownership takeover', () => {
    const source = read('apps/api/src/notifications/notifications.service.ts');
    expect(source).toContain('existing.userId !== userId');
    expect(source).toContain("throw new ForbiddenException('Push subscription endpoint is already owned by another user')");
  });

  it('keeps authorization membership listing bounded and paginated', () => {
    const service = read('apps/api/src/authorization/authorization-admin.service.ts');
    const controller = read('apps/api/src/authorization/authorization-admin.controller.ts');
    expect(service).toContain('Math.min(200, Math.max(1, Math.trunc(Number(limit) || 100)))');
    expect(service).toContain('skip: (safePage - 1) * safeLimit, take: safeLimit');
    expect(controller).toContain("@Query('page') page?: string");
    expect(controller).toContain("@Query('limit') limit?: string");
  });
});
