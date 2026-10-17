-- PHASE AC: persist request/correlation context across durable async boundaries
ALTER TABLE "WorkflowExecution" ADD COLUMN "requestId" TEXT;
ALTER TABLE "WorkflowExecution" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "DomainEventOutbox" ADD COLUMN "requestId" TEXT;
ALTER TABLE "DomainEventOutbox" ADD COLUMN "correlationId" TEXT;

CREATE INDEX "WorkflowExecution_requestId_createdAt_idx" ON "WorkflowExecution"("requestId", "startedAt");
CREATE INDEX "WorkflowExecution_correlationId_createdAt_idx" ON "WorkflowExecution"("correlationId", "startedAt");
CREATE INDEX "DomainEventOutbox_requestId_createdAt_idx" ON "DomainEventOutbox"("requestId", "createdAt");
CREATE INDEX "DomainEventOutbox_correlationId_createdAt_idx" ON "DomainEventOutbox"("correlationId", "createdAt");
