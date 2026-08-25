/**
 * PHASE AQ - Domain Ownership Contract
 *
 * The modular monolith keeps explicit ownership boundaries. Domain services
 * orchestrate other domain capabilities but do not duplicate their rules.
 */
export const DOMAIN_OWNERSHIP = Object.freeze({
  RelationshipService: {
    owns: ['relationship CRUD', 'relationship invariants', 'relationship lifecycle'],
    delegatesTo: ['RelationshipScoreService', 'AuthorizationService', 'ApprovalService', 'DataLifecycleService', 'RelationshipPresenter'],
    forbidden: ['scoring formula implementation'],
  },
  ScoringModule: {
    owns: ['score formulas', 'score weights', 'score versioning'],
    delegatesTo: [],
    forbidden: ['relationship CRUD'],
  },
  WorkflowsService: {
    owns: ['workflow definition', 'workflow execution', 'workflow resume'],
    delegatesTo: ['WorkflowApprovalService', 'NotificationsService', 'AuditService', 'EventBusService'],
    forbidden: ['approval persistence/decision state machine'],
  },
  WorkflowApprovalService: {
    owns: ['WorkflowApproval persistence', 'approval decision state transition'],
    delegatesTo: ['AuditService', 'EventBusService'],
    forbidden: ['workflow action execution'],
  },
  NotificationRuleEngineService: {
    owns: ['notification rule matching', 'recipient resolution', 'channel selection'],
    delegatesTo: ['NotificationsService'],
    forbidden: ['workflow execution', 'score calculation'],
  },
  AuditService: {
    owns: ['AuditLog persistence', 'redaction'],
    delegatesTo: [],
    forbidden: ['domain mutation'],
  },
  EventBusService: {
    owns: ['domain event outbox', 'event dispatch'],
    delegatesTo: ['QueueService'],
    forbidden: ['domain business rules'],
  },
} as const);

export type DomainOwnership = typeof DOMAIN_OWNERSHIP;
