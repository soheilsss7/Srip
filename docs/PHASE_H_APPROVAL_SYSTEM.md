# PHASE H — Approval System

Canonical approval boundary for sensitive domain mutations.

Supported action types:
- SENSITIVE_RELATIONSHIP_CREATE
- STRATEGIC_SCORE_CHANGE
- DATA_SHARING
- EXPORT
- DELETE

Flow:
Request -> PENDING -> APPROVED/REJECTED.
For mutations requiring execution, approval is applied before the final mutation, followed by Audit and Domain Event.

Endpoints:
- GET /approvals
- POST /approvals
- POST /approvals/:id/approve
- POST /approvals/:id/reject

Export:
- POST /approvals with actionType=EXPORT, entityType=Report, entityId=<report-kind>, after={format,organizationId}
- /reports/:kind/export/:format requires approvalId.

Delete:
- DataLifecycleService creates the canonical generic ApprovalRequest.
- Permanent deletion can only be executed by the lifecycle service after an approved DELETE request.
- Legacy data-lifecycle approval endpoints were removed as duplicate execution paths; /approvals is canonical.

Legacy WorkflowApproval remains workflow-execution-specific and is not used as the domain approval store.
Legacy DataDeletionApproval remains schema-compatible for historical migrations but is no longer used by the canonical deletion flow.
