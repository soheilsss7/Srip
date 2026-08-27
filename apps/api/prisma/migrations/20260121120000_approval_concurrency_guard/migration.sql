-- Prevent concurrent creation of multiple pending approvals for the same logical action.
-- Historical APPROVED/REJECTED requests remain allowed.
CREATE UNIQUE INDEX "ApprovalRequest_pending_unique"
ON "ApprovalRequest" ("entityType", "entityId", "actionType")
WHERE "status" = 'PENDING';
