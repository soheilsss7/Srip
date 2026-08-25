import { RELATIONSHIP_SCORE_FACTORS } from '../../src/scoring/relationship-score.service';

describe('PHASE S relationship scoring contract', () => {
  it('contains every required factor', () => {
    expect(RELATIONSHIP_SCORE_FACTORS).toEqual(expect.arrayContaining([
      'strategicValue','economicValue','influence','trust','access','engagement',
      'recency','diversity','responsiveness','commitmentReliability','opportunityPotential','risk',
    ]));
    expect(RELATIONSHIP_SCORE_FACTORS).toHaveLength(12);
  });

  it('keeps risk as an explicit canonical factor', () => {
    expect(RELATIONSHIP_SCORE_FACTORS).toContain('risk');
  });
});
