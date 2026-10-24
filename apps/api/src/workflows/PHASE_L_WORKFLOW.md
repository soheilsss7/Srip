# PHASE L — Workflow Entity Context Integrity

Canonical workflow event listener is preserved.

CREATE_ACTION, CREATE_COMMITMENT and CREATE_OPPORTUNITY resolve entity context from:
- explicit workflow action fields
- workflow execution context
- canonical domain event context (`event.aggregateType`, `event.aggregateId`, `event.organizationId`)
- workflow organization fallback

CREATE_ACTION persists relationshipId, meetingId, projectId, personId, organizationId and recommendationId when available.

Workflow-created Action/Commitment/Opportunity mutations use the Phase K transactional Outbox contract:
Prisma transaction -> domain mutation -> audit -> transactional outbox -> commit -> queue delivery.

Workflow entity authorization is enforced for linked Relationship, Meeting, Project and Person resources for non-system executions.
