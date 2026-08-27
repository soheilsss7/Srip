import { ActionsService } from './actions.service';

describe('ActionsService Phase 9 contracts', () => { it('exports service', () => expect(ActionsService).toBeDefined()); });

describe('ActionsService.listOverdue / listDueSoon (Phase 26 follow-up views)', () => {
  it('listOverdue filters to OPEN/IN_PROGRESS actions with a past dueAt', async () => {
    const prisma: any = { action: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) }, $transaction: jest.fn((queries: any[]) => Promise.all(queries)) };
    const authorization: any = { accessibleOrganizationIds: jest.fn().mockResolvedValue(null) };
    const service = new ActionsService(prisma, authorization, {} as any, {} as any, {} as any);
    await service.listOverdue('u1');
    const args = prisma.action.findMany.mock.calls[0][0];
    expect(args.where.status).toEqual({ in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] });
    expect(args.where.dueAt.lt).toBeInstanceOf(Date);
  });

  it('listDueSoon computes a horizon N days in the future', async () => {
    const prisma: any = { action: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) }, $transaction: jest.fn((queries: any[]) => Promise.all(queries)) };
    const authorization: any = { accessibleOrganizationIds: jest.fn().mockResolvedValue(['org1']) };
    const service = new ActionsService(prisma, authorization, {} as any, {} as any, {} as any);
    await service.listDueSoon('u1', 5);
    const args = prisma.action.findMany.mock.calls[0][0];
    const horizon = args.where.dueAt.lte as Date;
    const diffDays = Math.round((horizon.getTime() - Date.now()) / 86400000);
    expect(diffDays).toBeGreaterThanOrEqual(4);
    expect(diffDays).toBeLessThanOrEqual(5);
  });
});
