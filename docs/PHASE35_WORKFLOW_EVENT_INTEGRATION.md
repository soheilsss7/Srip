# Phase 35 — Event-driven Workflow Integration

Workflow triggers are now wired to the canonical Domain Event Bus. All event families defined by the domain event contract are accepted as workflow triggers: Organization, Person, Relationship, Interaction, Meeting, Commitment, Action, Score, Opportunity and Recommendation.

Workflow trigger definitions may match the exact event type (for example `organization.created`), the aggregate type (`Organization`) or `*`. Optional `entityType` remains enforced.

The bridge is `WorkflowEventListener -> EventBusService -> WorkflowsService.triggerFromDomainEvent`. Delivery is persisted in `WorkflowEventDelivery` with a unique `(workflowId,eventId)` key so the same event cannot execute the same workflow twice when the queue retries or redelivers it.

Domain events are dispatched asynchronously by the existing outbox/BullMQ worker. `EventBusService.publish()` persists and queues the event; `dispatch()` emits it to subscribers. Workflow event failures leave the outbox failed and are therefore retryable by the existing pending-event mechanism.

Automated event-triggered workflows use a system execution path after the workflow itself has been selected within its organization scope. The event actor is preferred for action ownership; an active organization member is used as a deterministic fallback when a provider-generated/system event has no actor.

WAIT now stops the action loop immediately so subsequent actions do not run before resume.
