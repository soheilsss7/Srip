export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HOLDING_ADMIN: 'HOLDING_ADMIN',
  HOLDING_EXECUTIVE: 'HOLDING_EXECUTIVE',
  SUBSIDIARY_ADMIN: 'SUBSIDIARY_ADMIN',
  SUBSIDIARY_EXECUTIVE: 'SUBSIDIARY_EXECUTIVE',
  RELATIONSHIP_MANAGER: 'RELATIONSHIP_MANAGER',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  ANALYST: 'ANALYST',
  STANDARD_USER: 'STANDARD_USER',
  READ_ONLY: 'READ_ONLY',
} as const;

export const PERMISSIONS = [
  'org.read','org.write','org.admin','entity.read','entity.write','tag.read','tag.write',
  'person.read','person.write','person.delete','person.sensitive_contacts.read',
  'relationship.read','relationship.write','relationship.delete','relationship.notes.read','relationship.strategic.read','relationship.risk.read','relationship.internal.read','relationship.sensitive_contacts.read',
  'interaction.read','interaction.write',
  'meeting.read','meeting.write',
  'action.read','action.write',
  'commitment.read','commitment.write',
  'project.read','project.write','document.read','document.write',
  'opportunity.read','opportunity.write',
  'audit.read','workflow.read','workflow.write','workflow.execute',
  'search.read','search.write','analytics.read','ai.executive_brief','analytics.write','network.read','security.read','metrics.read','integration.read','integration.write','recommendation.read','recommendation.write',
  'data.restore','data.permanent_delete','data.lifecycle_status',
  'enterprise.read','enterprise.admin','enterprise.export','report.read','report.export','enterprise.security','feature_flag.read','feature_flag.write',
  'access.manage','role.manage','admin.users','scoring.admin','data.import','data.import.approve','data.quality.read','data.quality.execute','approval.request','approval.read','approval.decide','privacy.read','privacy.export','privacy.access','privacy.erase','privacy.manage','privacy.audit',
] as const;

const classificationRank: Record<string, number> = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, RESTRICTED: 3, PRIVATE: 4, HIGHLY_CONFIDENTIAL: 5 };
export function classificationAllows(scope: string, requested: string) {
  return (classificationRank[scope] ?? 0) >= (classificationRank[requested] ?? 5);
}
