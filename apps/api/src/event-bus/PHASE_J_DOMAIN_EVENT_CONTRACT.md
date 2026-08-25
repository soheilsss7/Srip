# PHASE J — Domain Event Contract

Canonical business events are defined in `event-bus.constants.ts` and enforced at runtime by `EventBusService.publish()`.

Required business events: meeting.completed, action.completed, commitment.completed, commitment.overdue, relationship.score.changed, relationship.status.changed, opportunity.status.changed, recommendation.viewed, recommendation.accepted, recommendation.action.created, recommendation.action.completed.

Lifecycle wiring: meeting completion, Action DONE transition, Commitment FULFILLED/OVERDUE transitions, Relationship score/status transitions (including approved strategic-score mutation), Opportunity status transition, Recommendation view/accept, and Recommendation-generated Action creation/completion.

All existing event literals are routed through the canonical catalog; WorkflowApproval/other unrelated internal state names remain separate from domain event names.
