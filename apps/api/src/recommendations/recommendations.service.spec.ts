import { RECOMMENDATION_TYPES } from './recommendations.service';
describe('Recommendation Engine contracts', () => {
  it('contains every source-defined recommendation type', () => {
    expect(RECOMMENDATION_TYPES).toEqual(expect.arrayContaining([
      'FOLLOW_UP','MEETING','INTRODUCTION','RELATIONSHIP_REPAIR','DIVERSIFICATION',
      'OPPORTUNITY','RISK_MITIGATION','PROJECT_CONNECTION','EXECUTIVE_ESCALATION',
    ]));
    expect(RECOMMENDATION_TYPES).toHaveLength(9);
  });
});
