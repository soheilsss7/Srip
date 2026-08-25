import { AnalyticsService } from './analytics.service';
import { SYSTEM_USER_ID } from '../common/system-actor';

describe('AnalyticsService.recompute (Phase 26: real, non-throwing scheduled job)', () => {
  it('computes and persists a per-organization dashboard snapshot for every active organization', async () => {
    const orgs = [{ id: 'org1' }, { id: 'org2' }];
    const prisma: any = {
      organization: { findMany: jest.fn().mockResolvedValue(orgs) },
      relationship: { count: jest.fn().mockResolvedValue(2) },
      commitment: { count: jest.fn().mockResolvedValue(1) },
      action: { count: jest.fn().mockResolvedValue(3) },
      opportunity: { count: jest.fn().mockResolvedValue(4) },
      analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const authorization: any = {};
    const service = new AnalyticsService(prisma, authorization);
    const result = await service.recompute();
    expect(result.organizationsProcessed).toBe(2);
    expect(prisma.analyticsEvent.create).toHaveBeenCalledTimes(2);
    const firstCallArgs = prisma.analyticsEvent.create.mock.calls[0][0];
    expect(firstCallArgs.data.type).toBe('DASHBOARD_SNAPSHOT');
    expect(firstCallArgs.data.metadata).toEqual(expect.objectContaining({ atRiskRelationships: 2, overdueCommitments: 1, overdueActions: 3, openOpportunities: 4 }));
  });

  it('defaults to the system actor id when no actor is provided', async () => {
    const prisma: any = { organization: { findMany: jest.fn().mockResolvedValue([{ id: 'org1' }]) }, relationship: { count: jest.fn().mockResolvedValue(0) }, commitment: { count: jest.fn().mockResolvedValue(0) }, action: { count: jest.fn().mockResolvedValue(0) }, opportunity: { count: jest.fn().mockResolvedValue(0) }, analyticsEvent: { create: jest.fn().mockResolvedValue({}) } };
    const service = new AnalyticsService(prisma, {} as any);
    await service.recompute();
    const args = prisma.analyticsEvent.create.mock.calls[0][0];
    expect(args.data.userId).toBe(SYSTEM_USER_ID);
  });

  it('returns zero when there are no active organizations', async () => {
    const prisma: any = { organization: { findMany: jest.fn().mockResolvedValue([]) }, analyticsEvent: { create: jest.fn() } };
    const service = new AnalyticsService(prisma, {} as any);
    const result = await service.recompute();
    expect(result.organizationsProcessed).toBe(0);
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
  });
});
