import {
  PrismaClient,
  OrganizationType,
  RelationshipStatus,
  InteractionKind,
  Priority,
  ProjectStatus,
  RequirementStatus,
  OpportunityStatus,
  NotificationType,
  AuditAction,
  DataClassification,
  LegalBasis,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const IDS = {
  admin: '00000000-0000-0000-0000-000000000010',
  holding: '00000000-0000-0000-0000-000000000001',
  subsidiary: '00000000-0000-0000-0000-000000000002',
  customer: '00000000-0000-0000-0000-000000000003',
  person: '00000000-0000-0000-0000-000000000020',
  relationship: '00000000-0000-0000-0000-000000000030',
  interaction: '00000000-0000-0000-0000-000000000040',
  meeting: '00000000-0000-0000-0000-000000000050',
  action: '00000000-0000-0000-0000-000000000060',
  commitment: '00000000-0000-0000-0000-000000000061',
  project: '00000000-0000-0000-0000-000000000070',
  requirement: '00000000-0000-0000-0000-000000000071',
  opportunity: '00000000-0000-0000-0000-000000000080',
  note: '00000000-0000-0000-0000-000000000090',
  document: '00000000-0000-0000-0000-000000000091',
  notification: '00000000-0000-0000-0000-0000000000a0',
  recommendation: '00000000-0000-0000-0000-0000000000b0',
  workflow: '00000000-0000-0000-0000-0000000000c0',
  execution: '00000000-0000-0000-0000-0000000000c1',
  audit: '00000000-0000-0000-0000-0000000000d0',
  snapshot: '00000000-0000-0000-0000-0000000000e0',
  score: '00000000-0000-0000-0000-0000000000e1',
  scoreSnapshot: '00000000-0000-0000-0000-0000000000e2',
};

async function main() {
  const permissions = [
    'org.read', 'org.write', 'org.admin', 'entity.read', 'entity.write', 'tag.read', 'tag.write', 'person.read', 'person.write', 'person.delete',
    'relationship.read', 'relationship.write', 'metrics.read', 'relationship.delete', 'relationship.notes.read', 'relationship.strategic.read', 'relationship.risk.read', 'relationship.internal.read', 'relationship.sensitive_contacts.read', 'person.sensitive_contacts.read', 'interaction.read', 'interaction.write',
    'meeting.read', 'meeting.write', 'action.read', 'action.write', 'commitment.read', 'commitment.write',
    'project.read', 'project.write', 'document.read', 'document.write', 'opportunity.read', 'opportunity.write', 'audit.read', 'security.read', 'workflow.read',
    'workflow.write', 'workflow.execute', 'integration.read', 'integration.write', 'search.read', 'analytics.read', 'analytics.write', 'ai.executive_brief', 'network.read', 'recommendation.read', 'recommendation.write', 'data.restore', 'data.permanent_delete',
    'access.manage', 'role.manage', 'data.import', 'data.import.approve', 'data.quality.read', 'data.quality.execute', 'approval.request', 'approval.read', 'approval.decide', 'privacy.read', 'privacy.export', 'privacy.access', 'privacy.erase', 'privacy.manage', 'privacy.audit', 'session.admin.revoke', 'enterprise.read', 'enterprise.admin', 'enterprise.export', 'enterprise.security', 'report.read', 'report.export', 'feature_flag.read', 'feature_flag.write', 'admin.users', 'admin.organizations', 'admin.catalog', 'admin.custom_fields', 'scoring.admin', 'admin.scoring_rules', 'admin.notification_rules', 'admin.ai_settings', 'admin.integrations', 'admin.audit',
  ];
  const rolePermissions: Record<string,string[]> = {
    SUPER_ADMIN: permissions,
    HOLDING_ADMIN: permissions,
    HOLDING_EXECUTIVE: ['metrics.read','approval.request','approval.read','approval.decide','org.read','entity.read','tag.read','person.read','relationship.read','relationship.strategic.read','relationship.risk.read','interaction.read','meeting.read','action.read','commitment.read','project.read','opportunity.read','audit.read','security.read','workflow.read','report.read','workflow.execute','search.read','analytics.read','analytics.write','ai.executive_brief','network.read','recommendation.read','recommendation.write','integration.read','integration.write'],
    SUBSIDIARY_ADMIN: permissions.filter(x => !['access.manage','role.manage','data.permanent_delete'].includes(x)),
    SUBSIDIARY_EXECUTIVE: ['metrics.read','approval.request','approval.read','approval.decide','org.read','entity.read','tag.read','person.read','relationship.read','relationship.strategic.read','relationship.risk.read','interaction.read','meeting.read','action.read','commitment.read','project.read','opportunity.read','workflow.read','search.read','analytics.read','analytics.write','ai.executive_brief','network.read','report.read','data.quality.read'],
    RELATIONSHIP_MANAGER: ['approval.request','approval.read','org.read','entity.read','entity.write','tag.read','tag.write','person.read','person.write','person.sensitive_contacts.read','relationship.read','relationship.write','relationship.notes.read','relationship.strategic.read','relationship.risk.read','relationship.internal.read','relationship.sensitive_contacts.read','interaction.read','interaction.write','meeting.read','meeting.write','action.read','action.write','commitment.read','commitment.write','project.read','opportunity.read','search.read','analytics.read','analytics.write','ai.executive_brief','network.read','report.read','recommendation.read','recommendation.write','integration.read','integration.write'],
    PROJECT_MANAGER: ['approval.request','approval.read','org.read','entity.read','entity.write','tag.read','tag.write','person.read','relationship.read','interaction.read','meeting.read','action.read','action.write','commitment.read','commitment.write','project.read','project.write','opportunity.read','search.read','analytics.read','analytics.write','ai.executive_brief','network.read','report.read','recommendation.read','recommendation.write','integration.read','integration.write'],
    ANALYST: ['approval.request','approval.read','org.read','entity.read','tag.read','person.read','relationship.read','relationship.strategic.read','relationship.risk.read','interaction.read','meeting.read','action.read','commitment.read','project.read','opportunity.read','search.read','analytics.read','analytics.write','ai.executive_brief','network.read','report.read','recommendation.read','recommendation.write','integration.read','integration.write'],
    STANDARD_USER: ['approval.request','approval.read','report.read','org.read','entity.read','tag.read','person.read','relationship.read','interaction.read','meeting.read','action.read','commitment.read','project.read','search.read','analytics.read','ai.executive_brief','recommendation.read','integration.read'],
    READ_ONLY: ['approval.request','approval.read','report.read','org.read','entity.read','tag.read','person.read','relationship.read','interaction.read','meeting.read','action.read','commitment.read','project.read','opportunity.read','search.read','analytics.read','ai.executive_brief','recommendation.read','integration.read'],
  };
  const roles = [
    ['SUPER_ADMIN','Super Admin','Global platform administrator'],
    ['HOLDING_ADMIN','Holding Admin','Administrator across a holding and its subsidiaries'],
    ['HOLDING_EXECUTIVE','Holding Executive','Executive read/access role across a holding'],
    ['SUBSIDIARY_ADMIN','Subsidiary Admin','Administrator within a subsidiary'],
    ['SUBSIDIARY_EXECUTIVE','Subsidiary Executive','Executive role within a subsidiary'],
    ['RELATIONSHIP_MANAGER','Relationship Manager','Relationship and network management role'],
    ['PROJECT_MANAGER','Project Manager','Project delivery management role'],
    ['ANALYST','Analyst','Analysis and reporting role'],
    ['STANDARD_USER','Standard User','Standard application user'],
    ['READ_ONLY','Read Only','Read-only application user'],
  ];
  for (const [key,name,description] of roles) { await prisma.role.upsert({ where: { key }, update: { name, description, isSystem: true, isActive: true }, create: { key, name, description, isSystem: true, isActive: true } }); }
  for (const key of permissions) { await prisma.permission.upsert({ where: { key }, update: { description: `SRIP permission: ${key}` }, create: { key, description: `SRIP permission: ${key}` } }); }
  for (const [role, keys] of Object.entries(rolePermissions)) { for (const key of keys) { const permission = await prisma.permission.findUniqueOrThrow({ where: { key } }); await prisma.rolePermission.upsert({ where: { role_permissionId: { role, permissionId: permission.id } }, update: {}, create: { role, permissionId: permission.id } }); } }

  const governancePolicies = [
    { entityType: 'User', purpose: 'account-operation', legalBasis: LegalBasis.CONTRACT, classification: DataClassification.CONFIDENTIAL, retentionDays: 3650, erasable: true },
    { entityType: 'Document', purpose: 'business-knowledge', legalBasis: LegalBasis.LEGITIMATE_INTEREST, classification: DataClassification.CONFIDENTIAL, retentionDays: 2555, erasable: true },
    { entityType: 'Interaction', purpose: 'relationship-history', legalBasis: LegalBasis.LEGITIMATE_INTEREST, classification: DataClassification.CONFIDENTIAL, retentionDays: 2555, erasable: true },
    { entityType: 'AuditLog', purpose: 'security-audit', legalBasis: LegalBasis.LEGAL_OBLIGATION, classification: DataClassification.HIGHLY_CONFIDENTIAL, retentionDays: 2555, erasable: false },
    { entityType: 'Note', purpose: 'organizational-memory', legalBasis: LegalBasis.LEGITIMATE_INTEREST, classification: DataClassification.CONFIDENTIAL, retentionDays: 2555, erasable: true },
    { entityType: 'Meeting', purpose: 'meeting-history', legalBasis: LegalBasis.LEGITIMATE_INTEREST, classification: DataClassification.CONFIDENTIAL, retentionDays: 2555, erasable: true },
    { entityType: 'Action', purpose: 'operational-followup', legalBasis: LegalBasis.CONTRACT, classification: DataClassification.INTERNAL, retentionDays: 1825, erasable: true },
    { entityType: 'Commitment', purpose: 'commitment-tracking', legalBasis: LegalBasis.CONTRACT, classification: DataClassification.CONFIDENTIAL, retentionDays: 2555, erasable: true },
    { entityType: 'Project', purpose: 'project-history', legalBasis: LegalBasis.CONTRACT, classification: DataClassification.CONFIDENTIAL, retentionDays: 2555, erasable: true },
    { entityType: 'Relationship', purpose: 'institutional-memory', legalBasis: LegalBasis.LEGITIMATE_INTEREST, classification: DataClassification.CONFIDENTIAL, retentionDays: 3650, erasable: false },
  ];
  for (const policy of governancePolicies) await prisma.dataProcessingPolicy.upsert({ where: { entityType_purpose: { entityType: policy.entityType, purpose: policy.purpose } }, update: { ...policy, active: true }, create: { ...policy, active: true } });

  const hash = await bcrypt.hash('ChangeMe!123456', 12);
  const user = await prisma.user.upsert({
    where: { id: IDS.admin },
    update: { email: 'admin@srip.local', name: 'SRIP Admin', passwordHash: hash, passwordChangedAt: new Date('2026-08-23T00:00:00Z'), emailVerifiedAt: new Date('2026-08-23T00:00:00Z'), isActive: true, deletedAt: null, deletedById: null, failedLoginCount: 0, lockedUntil: null },
    create: { id: IDS.admin, email: 'admin@srip.local', name: 'SRIP Admin', passwordHash: hash, passwordChangedAt: new Date('2026-08-23T00:00:00Z'), emailVerifiedAt: new Date('2026-08-23T00:00:00Z') },
  });

  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: 'LOCAL', providerAccountId: user.id } },
    update: { providerAccountId: user.id },
    create: { userId: user.id, provider: 'LOCAL', providerAccountId: user.id },
  });

  for (const t of [{key:'STRATEGIC',name:'Strategic'},{key:'COMMERCIAL',name:'Commercial'},{key:'PARTNER',name:'Partner'},{key:'SUPPLIER',name:'Supplier'},{key:'INVESTMENT',name:'Investment'}]) await prisma.relationshipType.upsert({ where:{key:t.key}, update:{name:t.name,isActive:true}, create:{key:t.key,name:t.name} });
  const defaultTags = ['Strategic','VIP','Banking','Government','High Risk','Investor','Energy','International'];
  for (const name of defaultTags) await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
  for (const t of [{key:InteractionKind.CALL,name:'Call'},{key:InteractionKind.EMAIL,name:'Email'},{key:InteractionKind.MEETING,name:'Meeting'},{key:InteractionKind.NOTE,name:'Note'},{key:InteractionKind.MESSAGE,name:'Message'},{key:InteractionKind.OTHER,name:'Other'}]) await prisma.interactionType.upsert({ where:{key:t.key}, update:{name:t.name,isActive:true}, create:{key:t.key,name:t.name} });

  const holding = await prisma.organization.upsert({
    where: { id: IDS.holding },
    update: { name: 'SRIP Holding', displayName: 'SRIP Holding', englishName: 'SRIP Holding', type: OrganizationType.HOLDING, strategicImportance: 95, deletedAt: null, deletedById: null },
    create: { id: IDS.holding, name: 'SRIP Holding', displayName: 'SRIP Holding', englishName: 'SRIP Holding', type: OrganizationType.HOLDING, strategicImportance: 95 },
  });
  const subsidiary = await prisma.organization.upsert({
    where: { id: IDS.subsidiary },
    update: { name: 'SRIP Subsidiary', type: OrganizationType.SUBSIDIARY, parentOrganizationId: holding.id },
    create: { id: IDS.subsidiary, name: 'SRIP Subsidiary', type: OrganizationType.SUBSIDIARY, parentOrganizationId: holding.id },
  });
  const customer = await prisma.organization.upsert({
    where: { id: IDS.customer },
    update: { name: 'Example Customer', type: OrganizationType.CUSTOMER, deletedAt: null, deletedById: null },
    create: { id: IDS.customer, name: 'Example Customer', type: OrganizationType.CUSTOMER },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: holding.id } },
    update: { role: 'HOLDING_ADMIN', isPrimary: true },
    create: { userId: user.id, organizationId: holding.id, role: 'HOLDING_ADMIN', isPrimary: true },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: subsidiary.id } },
    update: { role: 'RELATIONSHIP_MANAGER' },
    create: { userId: user.id, organizationId: subsidiary.id, role: 'RELATIONSHIP_MANAGER' },
  });

  const person = await prisma.person.upsert({
    where: { id: IDS.person },
    update: { firstName: 'Example', lastName: 'Contact', displayName: 'Example Contact', email: 'contact@example.local', organizationId: customer.id, department: 'Executive', country: 'DE', deletedAt: null, deletedById: null },
    create: { id: IDS.person, firstName: 'Example', lastName: 'Contact', displayName: 'Example Contact', email: 'contact@example.local', organizationId: customer.id, department: 'Executive', country: 'DE', influenceScore: 70, decisionPower: 65, accessibilityScore: 80 },
  });

  const strategicRelationshipType = await prisma.relationshipType.findUniqueOrThrow({ where: { key: 'STRATEGIC' } });

  const relationship = await prisma.relationship.upsert({
    where: { id: IDS.relationship },
    update: { status: RelationshipStatus.ACTIVE, ownerId: user.id, relationshipTypeId: strategicRelationshipType.id, relationshipType: 'STRATEGIC', deletedAt: null, deletedById: null },
    create: {
      id: IDS.relationship,
      sourceOrganizationId: holding.id,
      targetOrganizationId: customer.id,
      relationshipType: 'STRATEGIC',
      relationshipTypeId: strategicRelationshipType.id,
      status: RelationshipStatus.ACTIVE,
      healthScore: 72,
      strategicScore: 88,
      trustScore: 75,
      accessScore: 60,
      influenceScore: 70,
      opportunityScore: 90,
      resilienceScore: 65,
      engagementScore: 80,
      ownerId: user.id,
    },
  });

  await prisma.relationshipScoreSnapshot.upsert({
    where: { id: IDS.snapshot },
    update: { relationshipId: relationship.id, healthScore: 72, strategicScore: 88, riskScore: 0, trustScore: 75, accessScore: 60, influenceScore: 70, opportunityScore: 90, resilienceScore: 65, engagementScore: 80 },
    create: { id: IDS.snapshot, relationshipId: relationship.id, healthScore: 72, strategicScore: 88, riskScore: 0, trustScore: 75, accessScore: 60, influenceScore: 70, opportunityScore: 90, resilienceScore: 65, engagementScore: 80, reason: 'Phase 3 baseline seed' },
  });

  const noteInteractionType = await prisma.interactionType.findUniqueOrThrow({ where: { key: InteractionKind.NOTE } });

  await prisma.score.upsert({
    where: { id: IDS.score },
    update: { type: 'RELATIONSHIP', subjectType: 'RELATIONSHIP', subjectId: relationship.id, value: 72, version: 1, explanation: 'Phase 23 canonical Score entity seed' },
    create: { id: IDS.score, type: 'RELATIONSHIP', subjectType: 'RELATIONSHIP', subjectId: relationship.id, value: 72, version: 1, explanation: 'Phase 23 canonical Score entity seed' },
  });
  await prisma.scoreSnapshot.upsert({
    where: { id: IDS.scoreSnapshot },
    update: { scoreId: IDS.score, value: 72, version: 1, explanation: 'Phase 23 canonical ScoreSnapshot entity seed' },
    create: { id: IDS.scoreSnapshot, scoreId: IDS.score, value: 72, version: 1, explanation: 'Phase 23 canonical ScoreSnapshot entity seed' },
  });

  await prisma.interaction.upsert({
    where: { id: IDS.interaction },
    update: { subject: 'Seed interaction', type: InteractionKind.NOTE, interactionTypeId: noteInteractionType.id, userId: user.id, organizationId: customer.id, personId: person.id, relationshipId: relationship.id, deletedAt: null, deletedById: null },
    create: { id: IDS.interaction, type: InteractionKind.NOTE, interactionTypeId: noteInteractionType.id, subject: 'Seed interaction', summary: 'Phase 3 database fixture', importance: Priority.MEDIUM, userId: user.id, organizationId: customer.id, personId: person.id, relationshipId: relationship.id },
  });

  const meeting = await prisma.meeting.upsert({
    where: { id: IDS.meeting },
    update: { title: 'Phase 3 Seed Meeting', ownerId: user.id, organizationId: customer.id, relationshipId: relationship.id, deletedAt: null, deletedById: null },
    create: { id: IDS.meeting, title: 'Phase 3 Seed Meeting', objective: 'Database fixture', startAt: new Date('2026-08-23T10:00:00Z'), ownerId: user.id, organizationId: customer.id, relationshipId: relationship.id },
  });
  await prisma.meetingParticipant.upsert({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } }, update: {}, create: { meetingId: meeting.id, personId: person.id } });

  await prisma.action.upsert({
    where: { id: IDS.action },
    update: { title: 'Seed action', ownerId: user.id, relationshipId: relationship.id, meetingId: meeting.id, deletedAt: null, deletedById: null },
    create: { id: IDS.action, title: 'Seed action', ownerId: user.id, relationshipId: relationship.id, meetingId: meeting.id, priority: Priority.MEDIUM },
  });
  await prisma.commitment.upsert({
    where: { id: IDS.commitment },
    update: { description: 'Seed commitment', ownerId: user.id, relationshipId: relationship.id, meetingId: meeting.id, deletedAt: null, deletedById: null },
    create: { id: IDS.commitment, description: 'Seed commitment', ownerId: user.id, relationshipId: relationship.id, meetingId: meeting.id },
  });

  const project = await prisma.project.upsert({
    where: { id: IDS.project },
    update: { name: 'Phase 3 Seed Project', organizationId: customer.id, ownerId: user.id, status: ProjectStatus.ACTIVE, deletedAt: null, deletedById: null },
    create: { id: IDS.project, name: 'Phase 3 Seed Project', description: 'Database fixture', organizationId: customer.id, ownerId: user.id, status: ProjectStatus.ACTIVE, priority: Priority.MEDIUM },
  });
  await prisma.projectRequirement.upsert({
    where: { id: IDS.requirement },
    update: { title: 'Seed requirement', projectId: project.id, organizationId: customer.id, status: RequirementStatus.OPEN, deletedAt: null, deletedById: null },
    create: { id: IDS.requirement, title: 'Seed requirement', projectId: project.id, organizationId: customer.id, status: RequirementStatus.OPEN, priority: Priority.MEDIUM },
  });
  await prisma.opportunity.upsert({
    where: { id: IDS.opportunity },
    update: { name: 'Seed opportunity', organizationId: customer.id, projectId: project.id, status: OpportunityStatus.QUALIFYING, deletedAt: null, deletedById: null },
    create: { id: IDS.opportunity, name: 'Seed opportunity', description: 'Database fixture', organizationId: customer.id, projectId: project.id, status: OpportunityStatus.QUALIFYING, probability: 50 },
  });
  await prisma.projectRelationship.upsert({
    where: { projectId_relationshipId: { projectId: project.id, relationshipId: relationship.id } },
    update: { relevance: 80, required: true, status: 'ENGAGED' },
    create: { projectId: project.id, relationshipId: relationship.id, relevance: 80, required: true, status: 'ENGAGED' },
  });

  await prisma.note.upsert({
    where: { id: IDS.note },
    update: { title: 'Seed note', body: 'Phase 3 database fixture', organizationId: customer.id, personId: person.id, createdById: user.id, deletedAt: null, deletedById: null },
    create: { id: IDS.note, title: 'Seed note', body: 'Phase 3 database fixture', organizationId: customer.id, personId: person.id, createdById: user.id },
  });
  await prisma.document.upsert({
    where: { id: IDS.document },
    update: { name: 'phase3-fixture.txt', mimeType: 'text/plain', storageKey: 'seed/phase3-fixture.txt', sizeBytes: 23, organizationId: customer.id, createdById: user.id, deletedAt: null, deletedById: null },
    create: { id: IDS.document, name: 'phase3-fixture.txt', mimeType: 'text/plain', storageKey: 'seed/phase3-fixture.txt', sizeBytes: 23, organizationId: customer.id, createdById: user.id },
  });
  await prisma.tag.upsert({ where: { name: 'phase3' }, update: {}, create: { name: 'phase3' } });

  await prisma.notification.upsert({
    where: { id: IDS.notification },
    update: { userId: user.id, type: NotificationType.INFO, title: 'Phase 3 ready', body: 'Database foundation seed is active', deletedAt: null, deletedById: null },
    create: { id: IDS.notification, userId: user.id, type: NotificationType.INFO, title: 'Phase 3 ready', body: 'Database foundation seed is active' },
  });
  await prisma.recommendation.upsert({
    where: { id: IDS.recommendation },
    update: { userId: user.id, relationshipId: relationship.id, type: 'SEED', title: 'Review relationship', rationale: 'Phase 3 fixture', deletedAt: null, deletedById: null },
    create: { id: IDS.recommendation, userId: user.id, relationshipId: relationship.id, type: 'SEED', title: 'Review relationship', rationale: 'Phase 3 fixture', confidence: 50 },
  });

  await prisma.workflow.upsert({
    where: { id: IDS.workflow },
    update: { name: 'Phase 3 Seed Workflow', entityType: 'Relationship', organizationId: holding.id, definition: { version: 1, trigger: 'MANUAL', steps: [] }, deletedAt: null, deletedById: null },
    create: { id: IDS.workflow, name: 'Phase 3 Seed Workflow', entityType: 'Relationship', organizationId: holding.id, definition: { version: 1, trigger: 'MANUAL', steps: [] } },
  });
  await prisma.workflowExecution.upsert({
    where: { id: IDS.execution },
    update: { workflowId: IDS.workflow, entityType: 'Relationship', entityId: relationship.id, status: 'COMPLETED' },
    create: { id: IDS.execution, workflowId: IDS.workflow, entityType: 'Relationship', entityId: relationship.id, status: 'COMPLETED', finishedAt: new Date() },
  });

  const scoreVersionSeeds = [
    { name: 'relationship-default', weights: { default: { strategicValue: 1, economicValue: 1, influence: 1, trust: 1, access: 1, engagement: 1, recency: 1, diversity: 1, responsiveness: 1, commitmentReliability: 1, opportunityPotential: 1, risk: 1 }, industries: {} } },
    { name: 'opportunity-default', weights: { probability: 0.5, value: 0.3, relationshipPotential: 0.2 } },
    { name: 'risk-default', weights: { configuredRisk: 0.6, resilienceRisk: 0.2, recencyRisk: 0.2 } },
    { name: 'connector-default', weights: { connections: 0.2, quality: 0.25, organizationLevel: 0.2, influence: 0.15, referrals: 0.2 } },
    { name: 'network-default', weights: { strength: 0.45, resilience: 0.25, opportunityCoverage: 0.15, peopleCoverage: 0.15 } },
  ];
  for (const seed of scoreVersionSeeds) {
    await prisma.scoreVersion.upsert({
      where: { name_version: { name: seed.name, version: 1 } },
      update: { status: 'ACTIVE', weights: seed.weights, createdById: user.id },
      create: { name: seed.name, version: 1, status: 'ACTIVE', weights: seed.weights, createdById: user.id },
    });
  }

  await prisma.auditLog.upsert({
    where: { id: IDS.audit },
    update: { userId: user.id, organizationId: holding.id, action: AuditAction.CREATE, entityType: 'Phase3Seed', entityId: relationship.id, reason: 'Phase 3 database fixture' },
    create: { id: IDS.audit, userId: user.id, organizationId: holding.id, action: AuditAction.CREATE, entityType: 'Phase3Seed', entityId: relationship.id, reason: 'Phase 3 database fixture' },
  });

  console.log(`Phase 3 seed complete: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
