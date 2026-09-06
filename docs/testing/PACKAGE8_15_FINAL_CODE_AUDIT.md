# Package 8.15 — Final Code-Level Audit

Date: 2026-08-25
Baseline: Package 8.14

## Scope

This audit re-ran the backend code-level review against the repository baseline and the project reference documents. AI, Web and Mobile implementation were not expanded; the audit is limited to the current backend repository and pre-test infrastructure.

## New findings fixed

1. **Permanent-delete approval referenced an undefined transaction variable.**
   `approvePermanentDelete()` used `tx` even though that method has no `tx` parameter. The approval lookup now uses the service Prisma client. `permanentDelete()` retains its explicit optional transaction client and uses it for the approval/policy/deletion operations.

2. **Permanent-delete approval/rejection lacked resource organization authorization.**
   Both paths now verify `data.permanent_delete` against the approval's organization scope. The unsupported synthetic `DataLifecycle` resource type is intentionally not passed into the authorization resource resolver.

3. **Generic approval rejection did not re-check action/resource permission.**
   Reject now mirrors approve and verifies the normalized action permission before changing the approval. `DataLifecycle` approvals use organization-only context because it is not a delegate-backed resource type.

4. **Admin scoring-rule and notification-rule reads were unbounded.**
   Both are now bounded to 500 records, matching the existing administrative listing hardening pattern.

5. **Notification rule loading was bounded.**
   Canonical notification rule evaluation is bounded to 500 active matching rules per event.

## Existing controls re-verified

- Pre-test hardening gate: PASS
- Package 8 final audit static gate: PASS
- Infrastructure static gate: PASS
- Data import quality gate: PASS
- Network static gate: PASS
- Reporting/export structural gate: PASS
- Phase 39 testing static gate: PASS
- Focused Package 8.15 regression assertions: PASS
- Production API unsafe raw SQL scan: 0 occurrences

## Repository integrity

The Package 8.14 baseline was extracted and preserved. No baseline file was intentionally deleted. New files in this package are limited to the Package 8.15 regression contract, final audit document, and verification command.

## Verification limitation

A full dependency-backed TypeScript/Jest build could not be executed in this isolated runtime because the repository has no installed `node_modules` and no `pnpm-lock.yaml`; Corepack attempted to obtain pnpm 10.12.4 from the npm registry and network access was unavailable. The existing static gates and focused source assertions were executed successfully.

The absence of `pnpm-lock.yaml` remains a release/reproducibility prerequisite because the repository declares `pnpm@10.12.4` and CI uses frozen-lockfile installation. It must be generated with the authoritative registry in a connected build environment; it must not be fabricated.

## Code-level conclusion

No additional known backend code defect was identified in this audit that can responsibly be fixed from static repository evidence alone without inventing behavior. Package 8.15 is therefore the **final code-level pre-test baseline**.

From this point, repository changes should be evidence-driven by a real test failure, runtime security finding, EXPLAIN/performance evidence, restore/DR failure, or a newly demonstrated requirement gap.
