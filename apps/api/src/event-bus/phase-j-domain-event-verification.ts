import { DOMAIN_EVENT_TYPES, isDomainEventType } from './event-bus.constants';

const REQUIRED = {
  MEETING_COMPLETED: 'meeting.completed', ACTION_COMPLETED: 'action.completed', COMMITMENT_COMPLETED: 'commitment.completed',
  COMMITMENT_OVERDUE: 'commitment.overdue', RELATIONSHIP_SCORE_CHANGED: 'relationship.score.changed',
  RELATIONSHIP_STATUS_CHANGED: 'relationship.status.changed', OPPORTUNITY_STATUS_CHANGED: 'opportunity.status.changed',
  RECOMMENDATION_VIEWED: 'recommendation.viewed', RECOMMENDATION_ACCEPTED: 'recommendation.accepted',
  RECOMMENDATION_ACTION_CREATED: 'recommendation.action.created', RECOMMENDATION_ACTION_COMPLETED: 'recommendation.action.completed',
} as const;
for (const [key, value] of Object.entries(REQUIRED)) {
  if ((DOMAIN_EVENT_TYPES as any)[key] !== value || !isDomainEventType(value)) throw new Error(`Missing canonical event: ${key}`);
}
console.log('PHASE_J_DOMAIN_EVENT_VERIFICATION=PASS');
