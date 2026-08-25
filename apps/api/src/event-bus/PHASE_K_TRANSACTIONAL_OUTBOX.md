# PHASE K — Transactional Outbox

The canonical domain-mutation contract is now:

1. Authorize and validate the mutation.
2. Enter one Prisma interactive transaction.
3. Mutate the domain entity through the transaction client.
4. Write the AuditLog through the same transaction client.
5. Write every resulting DomainEventOutbox row through `publishInTransaction(tx, ...)`.
6. Commit the database transaction.
7. Enqueue/dispatch the committed outbox row asynchronously. If the queue is unavailable, the durable PENDING row is retried by the outbox flush worker.

The required domain services covered by Phase K are:
Relationship, Meeting, Action, Commitment, Opportunity, Recommendation, Organization, Person, Interaction.

`EventBusService.publish()` remains only for legacy/non-aggregate callers. Domain mutations in the required services no longer call it directly.
