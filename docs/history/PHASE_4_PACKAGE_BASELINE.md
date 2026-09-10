# Package 4 — Notification / Workflow / Approval / Integration / Import / Export

## Baseline
This repository is based on the complete Package-5 API Contract / Error / Idempotency / Health / Runtime baseline ZIP supplied for Package 4.

## Repository preservation rule
- Correct previous implementation: KEEP.
- Incomplete implementation: COMPLETE.
- Architecture conflict: RECONCILE.
- Duplicate implementation: choose one CANONICAL path; deprecate/remove only the duplicate path.
- Never delete a previous Phase implementation merely because it was introduced in another Phase.

## Package 4 canonical scope
1. Notification Engine: in-app, email, push, realtime, preferences, delivery logs, rule evaluation, deduplication, canonical business-alert catalog.
2. Workflow: trigger/condition/action/wait/approval/resume with authorization, audit and event integration.
3. Approval: requester/approver separation, organization/resource scope, audit, event emission, sensitive operations including import/export.
4. Integration: Google/Microsoft OAuth, encrypted tokens, refresh, calendar/email/external-record reconciliation, webhook signature/replay protection and sync audit/events.
5. Import: CSV/XLS/XLSX parsing, mapping, validation, duplicate detection, preview, explicit approval gate, import/report stages and row-level failure handling.
6. Export: permission + approval gate, CSV/XLSX/PDF/JSON, sensitive-data boundary, export audit and request metadata.

## Verification
Run from repository root:

```bash
bash scripts/verify-package4.sh
```

The verification script is intentionally static when external dependencies are unavailable. Runtime build/typecheck/test must be run in an environment with the repository's pinned package manager and dependencies installed.
