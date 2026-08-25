import { PrismaClient, RelationshipLifecycleStage } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const required = ['IDENTIFIED','INTRODUCED','INITIAL_CONTACT','DEVELOPING','ACTIVE','STRATEGIC','DORMANT','AT_RISK','LOST'];
  const values = Object.values(RelationshipLifecycleStage);
  for (const stage of required) if (!values.includes(stage as any)) throw new Error(`Missing lifecycle stage: ${stage}`);

  const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Relationship' AND column_name = 'lifecycleStage'`,
  );
  if (columns.length !== 1) throw new Error('Relationship.lifecycleStage column missing');

  console.log('PHASE_U_RELATIONSHIP_LIFECYCLE=PASS');
}

main().finally(() => prisma.$disconnect());
