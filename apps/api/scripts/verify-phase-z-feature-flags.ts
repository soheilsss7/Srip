import { readFileSync } from 'node:fs';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const service = readFileSync('src/common/feature-flags/feature-flag.service.ts', 'utf8');
const module = readFileSync('src/common/feature-flags/feature-flag.module.ts', 'utf8');
const app = readFileSync('src/app.module.ts', 'utf8');

const required = [
  'model FeatureFlag',
  'rolloutOrganizationIds String[]',
  'rolloutUserIds String[]',
  'isEnabled(',
  'organizationId',
  'userId',
  'rollout',
  'createHash',
];
for (const token of required) {
  if (![schema, service].some((text) => text.includes(token))) throw new Error(`Missing PHASE Z contract: ${token}`);
}
if (!module.includes('FeatureFlagService') || !module.includes('exports')) throw new Error('FeatureFlagModule contract missing');
if (!app.includes('FeatureFlagModule')) throw new Error('FeatureFlagModule is not wired into AppModule');
console.log('PHASE_Z_FEATURE_FLAGS_CONTRACT=PASS');
