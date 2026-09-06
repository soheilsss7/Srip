# Phase 13 — Automation & Workflow

## Implemented in this baseline
- Versioned workflow definitions are stored as JSON and validated before creation.
- Workflow execution supports manual and event-triggered execution with trigger/entity matching.
- Conditions support nested context paths, equality, inequality, and existence checks.
- Actions supported by the execution engine: in-app notification, Action creation, Commitment creation, Opportunity creation, and human approval request.
- Workflow execution records move through RUNNING → COMPLETED/FAILED and retain failure context.
- Human approvals are persisted and can be approved/rejected with actor, reason, and timestamp.
- Workflow execution and approval paths enforce organization-scoped authorization.
- Notifications now expose authenticated list/unread/read APIs; push delivery remains intentionally pending.
- Workflow trigger endpoint provides an application-level event bridge for domain services and future schedulers.

## Example definition
```json
{
  "trigger": {"type":"MEETING_COMPLETED", "entityType":"Meeting"},
  "conditions": [{"path":"outcome","exists":true}],
  "actions": [
    {"type":"CREATE_NOTIFICATION", "title":"Meeting follow-up", "body":"Review meeting follow-up items"},
    {"type":"CREATE_ACTION", "title":"Review meeting follow-up", "priority":"HIGH"},
    {"type":"REQUEST_APPROVAL", "payload":{"reason":"Create external commitment"}}
  ]
}
```

## Still required before production
- Durable background queue / worker and distributed scheduler.
- Retry/backoff/dead-letter policy and idempotency keys for external side effects.
- Workflow versioning UI and rollback/disable controls.
- Full notification preferences, email/push channels and delivery receipts.
- Domain event emitters wired from every mutation path (currently exposed through the trigger API).
- Full workflow builder UI, approval inbox UI, audit UI, and E2E/security/load tests.
