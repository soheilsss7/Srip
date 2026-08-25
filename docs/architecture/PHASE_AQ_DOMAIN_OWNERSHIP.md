# PHASE AQ — Domain Ownership

This phase freezes explicit ownership boundaries in the modular monolith.

## Canonical boundaries

- RelationshipService owns relationship CRUD, invariants and lifecycle.
- RelationshipScoreService/ScoringModule owns relationship scoring formulas and configurable weights.
- WorkflowsService owns workflow definition, execution and resume.
- WorkflowApprovalService owns WorkflowApproval persistence and approval state transitions.
- NotificationRuleEngineService owns notification rule evaluation, recipient resolution and channel selection.
- NotificationsService owns notification persistence/provider delivery.
- AuditService owns AuditLog persistence and redaction.
- EventBusService owns domain-event outbox persistence and dispatch.
- QueueService owns queue transport.

## Rule

A service may orchestrate another domain capability through its public service contract, but it must not duplicate that capability's implementation.

Existing correct code is retained. Compatibility facades remain where needed; there is no phase-driven destructive rewrite.
