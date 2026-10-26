# PHASE AC — Observability Correlation Contract

Canonical correlation chain:

X-Request-ID + X-Correlation-ID -> RequestContext/AsyncLocalStorage -> trace/span -> DomainEventOutbox.id + requestId/correlationId -> WorkflowExecution.id + requestId/correlationId -> BullMQ Job.id + propagated request/correlation IDs -> AuditLog.requestId/correlationId.

HTTP responses expose X-Request-ID, X-Correlation-ID and X-Trace-ID.
Domain events persist request/correlation identifiers and carry them through outbox retries.
Queue payloads carry traceparent, _requestId and _correlationId. Workers restore RequestContext before executing jobs.
Workflow event listeners restore the originating request/correlation context before triggering workflows.
No sensitive payload is placed in correlation identifiers.
