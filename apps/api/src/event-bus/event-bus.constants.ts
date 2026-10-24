export const DOMAIN_EVENT_TYPES = {
  ORGANIZATION_CREATED: 'organization.created', ORGANIZATION_UPDATED: 'organization.updated', ORGANIZATION_DELETED: 'organization.deleted',
  PERSON_CREATED: 'person.created', PERSON_UPDATED: 'person.updated', PERSON_DELETED: 'person.deleted',
  RELATIONSHIP_CREATED: 'relationship.created', RELATIONSHIP_UPDATED: 'relationship.updated', RELATIONSHIP_DELETED: 'relationship.deleted',
  INTERACTION_CREATED: 'interaction.created', INTERACTION_UPDATED: 'interaction.updated', INTERACTION_DELETED: 'interaction.deleted',
  MEETING_CREATED: 'meeting.created', MEETING_UPDATED: 'meeting.updated', MEETING_DELETED: 'meeting.deleted',
  MEETING_COMPLETED: 'meeting.completed',
  COMMITMENT_CREATED: 'commitment.created', COMMITMENT_UPDATED: 'commitment.updated', COMMITMENT_DELETED: 'commitment.deleted',
  COMMITMENT_COMPLETED: 'commitment.completed', COMMITMENT_OVERDUE: 'commitment.overdue',
  ACTION_CREATED: 'action.created', ACTION_UPDATED: 'action.updated', ACTION_DELETED: 'action.deleted', ACTION_COMPLETED: 'action.completed',
  PROJECT_CREATED: 'project.created', PROJECT_UPDATED: 'project.updated', PROJECT_DELETED: 'project.deleted',
  SCORE_UPDATED: 'score.updated',
  RELATIONSHIP_SCORE_CHANGED: 'relationship.score.changed', RELATIONSHIP_STATUS_CHANGED: 'relationship.status.changed', RELATIONSHIP_LIFECYCLE_CHANGED: 'relationship.lifecycle.changed',
  OPPORTUNITY_CREATED: 'opportunity.created', OPPORTUNITY_UPDATED: 'opportunity.updated', OPPORTUNITY_DELETED: 'opportunity.deleted',
  OPPORTUNITY_STATUS_CHANGED: 'opportunity.status.changed',
  RECOMMENDATION_CREATED: 'recommendation.created', RECOMMENDATION_UPDATED: 'recommendation.updated', RECOMMENDATION_DELETED: 'recommendation.deleted',
  RECOMMENDATION_VIEWED: 'recommendation.viewed', RECOMMENDATION_ACCEPTED: 'recommendation.accepted',
  RECOMMENDATION_ACTION_CREATED: 'recommendation.action.created', RECOMMENDATION_ACTION_COMPLETED: 'recommendation.action.completed', RECOMMENDATION_OUTCOME: 'recommendation.outcome',
  INTEGRATION_WEBHOOK_RECEIVED: 'integration.webhook.received',
  APPROVAL_REQUESTED: 'approval.requested', APPROVAL_APPROVED: 'approval.approved', APPROVAL_REJECTED: 'approval.rejected',
  DATA_IMPORT_APPROVED: 'data.import.approved', DATA_IMPORT_COMPLETED: 'data.import.completed',
  INTEGRATION_SYNC_COMPLETED: 'integration.sync.completed', INTEGRATION_SYNC_FAILED: 'integration.sync.failed',
} as const;
export type DomainEventType = typeof DOMAIN_EVENT_TYPES[keyof typeof DOMAIN_EVENT_TYPES];
export const DOMAIN_EVENT_QUEUE_JOB = 'domain-events.dispatch';

export function isDomainEventType(value: string): value is DomainEventType {
  return (Object.values(DOMAIN_EVENT_TYPES) as string[]).includes(value);
}
