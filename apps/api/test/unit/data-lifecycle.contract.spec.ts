import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase E data lifecycle contract', () => {
  const root = join(__dirname, '..', '..');
  const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
  const service = readFileSync(join(root, 'src/common/data-lifecycle/data-lifecycle.service.ts'), 'utf8');
  const controller = readFileSync(join(root, 'src/common/data-lifecycle/data-lifecycle.controller.ts'), 'utf8');
  const migration = readFileSync(join(root, 'prisma/migrations/20260205120000_phase_e_data_lifecycle/migration.sql'), 'utf8');
  test('has lifecycle states, approval model and audit actions', () => {
    expect(schema).toContain('RESTORED PURGED');
    expect(schema).toContain('model DataDeletionApproval');
    for (const action of ['SOFT_DELETE','RESTORE','PERMANENT_DELETE','DELETE_APPROVAL_REQUESTED','DELETE_APPROVED','DELETE_REJECTED']) expect(schema).toContain(action);
  });
  test('central service owns all three lifecycle operations', () => {
    for (const method of ['async softDelete(', 'async restore(', 'async permanentDelete(']) expect(service).toContain(method);
    expect(service).toContain("'data.permanent_delete'");
    expect(service).toContain('isSuperAdmin');
    expect(service).toContain('DataDeletionApprovalStatus.APPROVED');
    expect(service).toContain("this.delegate(entityType).delete");
  });
  test('controller never calls Prisma directly and exposes restore/approval flow', () => {
    expect(controller).toContain("@Post(':entityType/:id/restore')");
    expect(controller).toContain("@Post(':entityType/:id/permanent-delete')");
    expect(controller).toContain("@Post('approvals/:id/approve')");
    expect(controller).toContain("@Post('approvals/:id/reject')");
    expect(controller).not.toContain('prisma.');
  });
  test('migration creates approval storage and lifecycle indexes', () => {
    expect(migration).toContain('CREATE TABLE "DataDeletionApproval"');
    expect(migration).toContain('DataLifecycleRecord_approvalId_idx');
    expect(migration).toContain('DataDeletionApproval_requestedById_fkey');
  });
});
