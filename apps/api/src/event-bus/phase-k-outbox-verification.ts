import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const required = [
  'relationships/relationships.service.ts',
  'meetings/meetings.service.ts',
  'actions/actions.service.ts',
  'commitments/commitments.service.ts',
  'opportunities/opportunities.service.ts',
  'recommendations/recommendations.service.ts',
  'organizations/organizations.service.ts',
  'people/people.service.ts',
  'interactions/interactions.service.ts',
];

const failures: string[] = [];
for (const file of required) {
  const source = readFileSync(join(root, file), 'utf8');
  if (/eventBus\.publish\s*\(/.test(source)) failures.push(`${file}: non-transactional eventBus.publish remains`);
  if (!/eventBus\.transaction\s*\(/.test(source)) failures.push(`${file}: no transaction boundary`);
  if (!/publishInTransaction\s*\(/.test(source)) failures.push(`${file}: no transactional outbox write`);
}

const bus = readFileSync(join(root, 'event-bus/event-bus.service.ts'), 'utf8');
if (!/async publishInTransaction\(tx: Prisma\.TransactionClient/.test(bus)) failures.push('EventBus: publishInTransaction missing');
if (!/tx\.domainEventOutbox\.create/.test(bus)) failures.push('EventBus: outbox is not written through tx');
if (!/async transaction<T>/.test(bus) || !/this\.prisma\.\$transaction\(work\)/.test(bus)) failures.push('EventBus: Prisma transaction wrapper missing');
if (!/await this\.enqueue\(result\.id\)/.test(bus)) failures.push('EventBus: non-transactional enqueue contract missing');

const audit = readFileSync(join(root, 'audit/audit.service.ts'), 'utf8');
if (!/tx\?: Prisma\.TransactionClient/.test(audit)) failures.push('AuditService: transaction client support missing');
if (!/\(tx \?\? this\.prisma\)\.auditLog\.create/.test(audit)) failures.push('AuditService: audit is not transaction-aware');

const lifecycle = readFileSync(join(root, 'common/data-lifecycle/data-lifecycle.service.ts'), 'utf8');
if (!/softDelete\([^\n]*tx\?: Prisma\.TransactionClient/.test(lifecycle)) failures.push('Lifecycle: softDelete transaction support missing');
if (!/permanentDelete\([^\n]*tx\?: Prisma\.TransactionClient/.test(lifecycle)) failures.push('Lifecycle: permanentDelete transaction support missing');

const result = failures.length ? 'FAIL' : 'PASS';
console.log(`PHASE_K_OUTBOX_VERIFICATION=${result}`);
console.log(`REQUIRED_DOMAIN_SERVICES=${required.length}`);
console.log(`FAILURES=${failures.length}`);
for (const failure of failures) console.log(`- ${failure}`);
if (failures.length) process.exitCode = 1;
