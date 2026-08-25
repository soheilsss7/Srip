import { AnalyticsService } from '../../src/analytics/analytics.service';

describe('PHASE Y Recommendation Analytics contract', () => {
  it('exposes the required funnel stages and conversion model', async () => {
    const prisma:any = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        { type:'RECOMMENDATION_VIEWED', count:10n },
        { type:'RECOMMENDATION_ACCEPTED', count:6n },
        { type:'RECOMMENDATION_ACTION_CREATED', count:5n },
        { type:'RECOMMENDATION_ACTION_COMPLETED', count:4n },
        { type:'RECOMMENDATION_OUTCOME', count:3n },
      ]),
    };
    const auth:any = { accessibleOrganizationIds: jest.fn().mockResolvedValue(null) };
    const service = new AnalyticsService(prisma, auth);
    const result = await service.recommendationFunnel('u');
    expect(result.stages).toEqual({viewed:10,accepted:6,actionCreated:5,actionCompleted:4,outcome:3});
    expect(result.conversion).toEqual({viewedToAcceptedPct:60,acceptedToActionCreatedPct:83.33,actionCreatedToCompletedPct:80,completedToOutcomePct:75});
    expect(result.overall.outcomePct).toBe(30);
  });
});
