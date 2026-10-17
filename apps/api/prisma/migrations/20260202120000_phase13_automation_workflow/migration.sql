CREATE TABLE "WorkflowApproval" (
  "id" TEXT NOT NULL,
  "workflowExecutionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT,
  "decidedById" TEXT,
  "decisionReason" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "WorkflowApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkflowApproval_workflowExecutionId_fkey" FOREIGN KEY ("workflowExecutionId") REFERENCES "WorkflowExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkflowApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WorkflowApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "WorkflowApproval_status_createdAt_idx" ON "WorkflowApproval"("status", "createdAt");
CREATE INDEX "WorkflowApproval_workflowExecutionId_idx" ON "WorkflowApproval"("workflowExecutionId");
