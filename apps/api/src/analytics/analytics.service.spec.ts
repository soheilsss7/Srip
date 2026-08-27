import { AnalyticsService } from './analytics.service';
import { SYSTEM_USER_ID } from '../common/system-actor';

describe('AnalyticsService.recompute (Phase 26: real, non-throwing scheduled job)', () => {
  const snapshots = [
    { organizationId: 'org1', atRiskRelationships: 2, overdueCommitments: 1, overdueActions: 3, openOpportunities: 4 },
    { organizationId: 'org2', atRiskRelationships: 2, overdueCommitments: 1, overdueActions: 3, openOpportunities: 4 },
  ];
  it('computes and persists a per-organization dashboard snapshot for every active organization', async () => {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue(snapshots),
      analyticsEvent: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const service = new AnalyticsService(prisma, {} as any, {} as any);
    const result = await service.recompute();
    expect(result.organizationsProcessed).toBe(2);
    expect(prisma.analyticsEvent.createMany).toHaveBeenCalledTimes(1);
    const data = prisma.analyticsEvent.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data[0].type).toBe('DASHBOARD_SNAPSHOT');
    expect(data[0].metadata).toEqual(expect.objectContaining({ atRiskRelationships: 2, overdueCommitments: 1, overdueActions: 3, openOpportunities: 4 }));
  });

  it('defaults to the system actor id when no actor is provided', async () => {
    const prisma: any = { $queryRaw: jest.fn().mockResolvedValue([snapshots[0]]), analyticsEvent: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new AnalyticsService(prisma, {} as any, {} as any);
    await service.recompute();
    const data = prisma.analyticsEvent.createMany.mock.calls[0][0].data;
    expect(data[0].userId).toBe(SYSTEM_USER_ID);
  });

  it('returns zero when there are no active organizations', async () => {
    const prisma: any = { $queryRaw: jest.fn().mockResolvedValue([]), analyticsEvent: { createMany: jest.fn() } };
    const service = new AnalyticsService(prisma, {} as any, {} as any);
    const result = await service.recompute();
    expect(result.organizationsProcessed).toBe(0);
    expect(prisma.analyticsEvent.createMany).not.toHaveBeenCalled();
  });
});