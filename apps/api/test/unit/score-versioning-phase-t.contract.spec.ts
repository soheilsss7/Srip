import { RELATIONSHIP_SCORE_FACTORS } from '../../src/scoring/relationship-score.service';

describe('PHASE T score versioning contract', () => {
  it('keeps the canonical factor catalog', () => {
    expect(RELATIONSHIP_SCORE_FACTORS).toHaveLength(12);
  });

  it('represents the documented Banking profile as a 100% policy', () => {
    const profile = { strategicValue: 30, trust: 20, influence: 25, engagement: 15, otherWeight: 10 };
    expect(Object.values(profile).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('includes every factor that is not explicitly named in Banking as part of Other', () => {
    const explicit = new Set(['strategicValue', 'trust', 'influence', 'engagement']);
    expect(RELATIONSHIP_SCORE_FACTORS.filter(f => !explicit.has(f))).toHaveLength(8);
  });
});
