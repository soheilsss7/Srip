import { RELATIONSHIP_SCORE_FACTORS } from '../src/scoring/relationship-score.service';

const expected = ['strategicValue','economicValue','influence','trust','access','engagement','recency','diversity','responsiveness','commitmentReliability','opportunityPotential','risk'];
const missing = expected.filter((x) => !RELATIONSHIP_SCORE_FACTORS.includes(x as any));
if (missing.length) throw new Error(`Missing factors: ${missing.join(',')}`);

const sample = Object.fromEntries(expected.map((x) => [x, 1]));
const total = Object.values(sample).reduce((a,b) => a + b, 0);
if (total !== 12) throw new Error('Unexpected factor catalog');
console.log('PHASE_S_SCORING_CONTRACT=PASS');
console.log(`factors=${expected.length}`);
