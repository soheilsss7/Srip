# PHASE M — Approval resumes Workflow

- WorkflowExecution persists `currentActionIndex`.
- `REQUEST_APPROVAL` moves execution to `WAITING` and records the next action index.
- `APPROVED` resumes the same execution from the next action; it never creates a second execution.
- `REJECTED` transitions the execution to `REJECTED` and closes it.
- `WAIT` also persists the next action index so ordinary waits resume without replaying prior actions.
