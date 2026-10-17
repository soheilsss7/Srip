# Phase 34 — Canonical Domain Event Bus

Implemented a persistent, canonical Domain Event Bus on top of the existing Queue/BullMQ infrastructure.

## Required event families
- Organization
- Person
- Relationship
- Interaction
- Meeting
- Commitment
- Action
- Score
- Opportunity
- Recommendation

## Architecture
Domain mutation -> DomainEventOutbox -> EventBusService -> local subscriber stream -> BullMQ `domain-events.dispatch` -> EventBusWorker -> DISPATCHED state.

The outbox is persistent and retryable; BullMQ remains transport/background infrastructure rather than being treated as the domain event bus itself.

## Guarantees
- Event has stable UUID.
- Aggregate type/id are explicit.
- Organization and actor scope are carried when available.
- Version is explicit.
- Payload is JSON.
- Pending/failed events are retryable.
- Duplicate queue job IDs are deterministic (`domain-event:<eventId>`).
- Existing polling/queue infrastructure is preserved.
- Domain event families are emitted from core mutation services.

## Verification
`bash scripts/verify-event-bus.sh` => `EVENT_BUS_STATIC_CHECK=PASS`.

Full TypeScript compilation is still subject to pre-existing baseline syntax errors in `network.service.ts`; no TypeScript diagnostics were emitted for the new Event Bus files or the services modified in this phase.
