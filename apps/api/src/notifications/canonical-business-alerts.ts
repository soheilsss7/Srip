/**
 * Canonical Package-4 business alert catalog.
 *
 * These keys are intentionally stable: NotificationRule records may be
 * customized per organization, but the product-level vocabulary remains
 * deterministic and auditable.
 */
export const CANONICAL_BUSINESS_ALERTS = [
  { key: 'RELATIONSHIP_DECAY', eventType: 'relationship.lifecycle.changed', priority: 'HIGH', title: 'Relationship is cooling', recipients: ['owner'] },
  { key: 'COMMITMENT_OVERDUE', eventType: 'commitment.overdue', priority: 'HIGH', title: 'Commitment overdue', recipients: ['owner'] },
  { key: 'MEETING_WITHOUT_OUTCOME', eventType: 'meeting.completed', priority: 'MEDIUM', title: 'Meeting completed without outcome', recipients: ['owner'] },
  { key: 'LONG_INACTIVITY', eventType: 'relationship.lifecycle.changed', priority: 'MEDIUM', title: 'Long relationship inactivity', recipients: ['owner'] },
  { key: 'PERSON_POSITION_CHANGE', eventType: 'person.updated', priority: 'MEDIUM', title: 'Person position changed', recipients: ['owner'] },
  { key: 'SCORE_DECREASE', eventType: 'relationship.score.changed', priority: 'HIGH', title: 'Relationship score decreased', recipients: ['owner'] },
  { key: 'SINGLE_POINT_OF_CONTACT_RISK', eventType: 'relationship.score.changed', priority: 'HIGH', title: 'Single Point of Contact risk', recipients: ['owner'] },
  { key: 'NEW_OPPORTUNITY', eventType: 'opportunity.created', priority: 'HIGH', title: 'New opportunity', recipients: ['owner'] },
  { key: 'PROJECT_WITHOUT_SUFFICIENT_RELATIONSHIP', eventType: 'project.created', priority: 'MEDIUM', title: 'Project lacks sufficient relationship coverage', recipients: ['owner'] },
] as const;

export type CanonicalBusinessAlertKey = typeof CANONICAL_BUSINESS_ALERTS[number]['key'];
