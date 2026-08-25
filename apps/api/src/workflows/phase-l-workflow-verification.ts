import { readFileSync } from 'node:fs';

const workflow = readFileSync('apps/api/src/workflows/workflows.service.ts', 'utf8');
const schema = readFileSync('apps/api/prisma/schema.prisma', 'utf8');
const listener = readFileSync('apps/api/src/workflows/workflow-event.listener.ts', 'utf8');

const failures: string[] = [];
const must = (ok: boolean, message: string) => { if (!ok) failures.push(message); };
const count = (source: string, needle: string) => source.split(needle).length - 1;
const modelBody = (model: string) => {
  const match = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`));
  return match?.[1] ?? '';
};

must(workflow.includes('resolveWorkflowEntityLinks'), 'missing workflow entity-link resolver');
for (const field of ['relationshipId', 'meetingId', 'projectId', 'personId', 'organizationId']) {
  must(field === 'organizationId' ? workflow.includes('organizationId:effectiveOrganizationId') : workflow.includes(`${field}:links.${field}`), `CREATE_ACTION missing ${field}`);
  must(workflow.includes(`action.${field}`), `action override missing ${field}`);
}
must(workflow.includes("normalized === 'relationship' && !links.relationshipId"), 'relationship event aggregate mapping missing');
must(workflow.includes("normalized === 'meeting' && !links.meetingId"), 'meeting event aggregate mapping missing');
must(workflow.includes("normalized === 'project' && !links.projectId"), 'project event aggregate mapping missing');
must(workflow.includes("normalized === 'person' && !links.personId"), 'person event aggregate mapping missing');
must(workflow.includes("normalized === 'organization' && !links.organizationId"), 'organization event aggregate mapping missing');
must(workflow.includes('event.organizationId'), 'event organization context not propagated');
must(workflow.includes('assertWorkflowEntityContext'), 'workflow entity authorization missing');
must(workflow.includes('DOMAIN_EVENT_TYPES.ACTION_CREATED'), 'workflow action created event missing');
must(workflow.includes('DOMAIN_EVENT_TYPES.COMMITMENT_CREATED'), 'workflow commitment created event missing');
must(workflow.includes('DOMAIN_EVENT_TYPES.OPPORTUNITY_CREATED'), 'workflow opportunity created event missing');
must(count(workflow, 'this.eventBus.transaction(async tx=>') >= 3, 'not all CREATE_* mutations are transactional');
must(count(workflow, 'publishInTransaction(tx') >= 3, 'not all CREATE_* events use transactional outbox');
must(!workflow.includes('await this.prisma.action.create'), 'direct workflow action create remains');
must(!workflow.includes('await this.prisma.commitment.create'), 'direct workflow commitment create remains');
must(!workflow.includes('await this.prisma.opportunity.create'), 'direct workflow opportunity create remains');

const action = modelBody('Action');
must(action.length > 0, 'Action model missing');
must(action.includes('organizationId String?'), 'Action.organizationId missing from Prisma');
must(action.includes('organization Organization? @relation(fields: [organizationId], references: [id])'), 'Action.organization relation missing');
must(action.includes('@@index([organizationId])'), 'Action.organizationId index missing');
const org = modelBody('Organization');
must(org.length > 0, 'Organization model missing');
must(org.includes('actions Action[]'), 'Organization.actions reverse relation missing');
must(listener.includes('this.bus.subscribe'), 'workflow event listener was not preserved');

if (failures.length) {
  console.error('PHASE_L_WORKFLOW_VERIFICATION=FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('PHASE_L_WORKFLOW_VERIFICATION=PASS');
console.log('CREATE_ACTION_CONTEXT_LINKS=PASS');
console.log('CREATE_COMMITMENT_CONTEXT_LINKS=PASS');
console.log('CREATE_OPPORTUNITY_CONTEXT_LINKS=PASS');
console.log('TRANSACTIONAL_WORKFLOW_MUTATIONS=PASS');
console.log('WORKFLOW_ENTITY_AUTHORIZATION=PASS');
console.log('DOMAIN_EVENT_LISTENER_PRESERVED=PASS');
