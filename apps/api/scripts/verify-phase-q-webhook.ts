import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const controller = fs.readFileSync(path.join(root, 'src/integrations/integration-webhook.controller.ts'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/integrations/integrations.service.ts'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');
const constants = fs.readFileSync(path.join(root, 'src/event-bus/event-bus.constants.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'prisma/migrations/20260824220000_phase_q_webhook_security/migration.sql'), 'utf8');

const checks: Array<[string, boolean]> = [
  ['Nest rawBody enabled', /rawBody:\s*true/.test(main)],
  ['Controller does not use @Body()', !/@Body\(\)/.test(controller)],
  ['Controller reads req.rawBody', /req\.rawBody/.test(controller)],
  ['HMAC signs timestamp + exact raw Buffer', /Buffer\.concat\(\[Buffer\.from\(`\$\{timestampSeconds\}\.`, 'utf8'\), rawBody\]\)/.test(service) && /createHmac\('sha256', secret\)\.update\(signedPayload\)/.test(service)],
  ['Timing-safe signature comparison', /timingSafeEqual/.test(service)],
  ['Timestamp replay protection', /WEBHOOK_MAX_SKEW_SECONDS/.test(service) && /Webhook timestamp outside replay window/.test(service)],
  ['Webhook event model exists', /model IntegrationWebhookEvent/.test(schema)],
  ['Webhook unique provider/eventId', /@@unique\(\[provider, eventId\]\)/.test(schema)],
  ['Signature validity persisted', /signatureValid Boolean/.test(schema)],
  ['Payload persisted', /payload Json/.test(schema)],
  ['Event is persisted before processed', /integrationWebhookEvent\.create/.test(service) && /integrationWebhookEvent\.update/.test(service)],
  ['Idempotency lookup', /integrationWebhookEvent\.findFirst\(\{ where: \{ provider, eventId: normalizedEventId \}/.test(service)],
  ['Canonical integration webhook domain event', /INTEGRATION_WEBHOOK_RECEIVED/.test(constants) && /publishInTransaction/.test(service)],
  ['No JSON.stringify(body) signature path', !/JSON\.stringify\(body\)/.test(controller)],
  ['Migration creates webhook event table', /CREATE TABLE "IntegrationWebhookEvent"/.test(migration)],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log('PHASE_Q_WEBHOOK_VERIFICATION=PASS');
