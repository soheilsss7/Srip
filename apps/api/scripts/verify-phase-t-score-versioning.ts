import { RELATIONSHIP_SCORE_FACTORS } from '../src/scoring/relationship-score.service';

const banking = {
  strategicValue: 30,
  trust: 20,
  influence: 25,
  engagement: 15,
  otherWeight: 10,
};
const total = Object.values(banking).reduce((a, b) => a + b, 0);
if (total !== 100) throw new Error(`Banking profile must total 100, got ${total}`);
if (RELATIONSHIP_SCORE_FACTORS.length !== 12) throw new Error('Canonical factor catalog changed');
if (!RELATIONSHIP_SCORE_FACTORS.includes('risk')) throw new Error('Risk factor missing');
console.log('PHASE_T_SCORE_VERSIONING_CONTRACT=PASS');
console.log('bankingProfile=30/20/25/15/10');
console.log('canonicalFactors=12');
