ALTER TABLE "WorkflowExecution" ADD COLUMN "currentActionIndex" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "WorkflowExecution_status_currentActionIndex_idx" ON "WorkflowExecution"("status", "currentActionIndex");
