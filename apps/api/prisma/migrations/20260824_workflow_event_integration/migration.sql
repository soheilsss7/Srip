CREATE TABLE "WorkflowEventDelivery" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "WorkflowEventDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkflowEventDelivery_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkflowEventDelivery_workflowId_eventId_key" ON "WorkflowEventDelivery"("workflowId", "eventId");
CREATE INDEX "WorkflowEventDelivery_eventId_status_idx" ON "WorkflowEventDelivery"("eventId", "status");
CREATE INDEX "WorkflowEventDelivery_workflowId_createdAt_idx" ON "WorkflowEventDelivery"("workflowId", "createdAt");
