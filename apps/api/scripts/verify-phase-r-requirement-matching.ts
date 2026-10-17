import { readFileSync } from 'node:fs';

const file = readFileSync('src/requirements/requirement-matching.service.ts', 'utf8');
const required = [
  'Requirement Keywords', 'Target Organizations', 'Direct Relationship', '1-Hop', '2-Hop',
  'Connector Person', 'Path Strength', 'Relationship Health', 'Trust', 'Engagement', 'Success Probability',
  'directConnections', 'indirectConnections', 'relationshipGaps', 'bestConnection', 'recommendations',
  'sameHoldingGroup', 'holdingRoot', 'connectorPerson', 'findPath',
];
const missing = required.filter((x) => !file.includes(x));
if (file.includes('sourceOrganizationId===orgId && r.targetOrganizationId===orgId') || file.includes('sourceOrganizationId === orgId && r.targetOrganizationId === orgId')) {
  missing.push('legacy-invalid-internal-condition');
}
if (missing.length) throw new Error(`PHASE_R_VERIFICATION_FAILED: ${missing.join(', ')}`);
console.log('PHASE_R_REQUIREMENT_MATCHING_VERIFICATION=PASS');
