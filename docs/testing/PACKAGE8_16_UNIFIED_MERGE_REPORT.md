# Package 8.16 Unified Merge Report

## Sources
- Package 8.11: `srip-starter-2_PACKAGE8_11_FINAL_CODE_AUDIT_BASELINE.zip`
- Package 8.15: `srip-starter-2_PACKAGE8_15_FINAL_CODE_AUDIT_BASELINE.zip`

- Common regular files: 830
- Unique 8.11 regular files preserved: 2
- Unique 8.15 regular files preserved: 8

## Canonicalization rule
For every path present in both baselines, Package 8.15 is canonical because it is the later audited baseline. Unique files from 8.11 are preserved. No existing repository path was deleted. Legacy source documents with filesystem-incompatible mojibake filenames were retained under normalized descriptive filenames and recorded in the merge manifest.

## Common paths with content differences

- `.github/workflows/ci.yml` — 8.11: 2379 bytes; 8.15: 2415 bytes; canonical: 8.15
- `apps/api/src/admin/admin.service.ts` — 8.11: 16225 bytes; 8.15: 16247 bytes; canonical: 8.15
- `apps/api/src/approvals/approval.service.ts` — 8.11: 13556 bytes; 8.15: 15555 bytes; canonical: 8.15
- `apps/api/src/authorization/authorization-admin.controller.ts` — 8.11: 1897 bytes; 8.15: 2000 bytes; canonical: 8.15
- `apps/api/src/authorization/authorization-admin.service.ts` — 8.11: 7388 bytes; 8.15: 7862 bytes; canonical: 8.15
- `apps/api/src/common/data-lifecycle/data-lifecycle.service.ts` — 8.11: 10160 bytes; 8.15: 10931 bytes; canonical: 8.15
- `apps/api/src/documents/documents.module.ts` — 8.11: 952 bytes; 8.15: 962 bytes; canonical: 8.15
- `apps/api/src/documents/s3.storage.ts` — 8.11: 7838 bytes; 8.15: 7811 bytes; canonical: 8.15
- `apps/api/src/health/health.service.ts` — 8.11: 4260 bytes; 8.15: 3207 bytes; canonical: 8.15
- `apps/api/src/integrations/integrations.service.ts` — 8.11: 15981 bytes; 8.15: 15998 bytes; canonical: 8.15
- `apps/api/src/jobs/job.worker.ts` — 8.11: 8417 bytes; 8.15: 8650 bytes; canonical: 8.15
- `apps/api/src/jobs/jobs.module.ts` — 8.11: 1135 bytes; 8.15: 1272 bytes; canonical: 8.15
- `apps/api/src/jobs/queue.constants.ts` — 8.11: 1873 bytes; 8.15: 2029 bytes; canonical: 8.15
- `apps/api/src/notifications/notification-rule-engine.service.ts` — 8.11: 10253 bytes; 8.15: 10270 bytes; canonical: 8.15
- `apps/api/src/notifications/notifications.service.ts` — 8.11: 11090 bytes; 8.15: 11356 bytes; canonical: 8.15
- `apps/api/src/observability/queue-monitoring.service.ts` — 8.11: 1593 bytes; 8.15: 1643 bytes; canonical: 8.15
- `apps/api/src/privacy/privacy.controller.ts` — 8.11: 2481 bytes; 8.15: 2657 bytes; canonical: 8.15
- `apps/api/src/privacy/privacy.module.ts` — 8.11: 733 bytes; 8.15: 907 bytes; canonical: 8.15
- `apps/api/src/privacy/privacy.service.ts` — 8.11: 12066 bytes; 8.15: 16142 bytes; canonical: 8.15
- `apps/api/src/scoring/connector-score.service.ts` — 8.11: 3405 bytes; 8.15: 3499 bytes; canonical: 8.15
- `apps/api/src/scoring/network-score.service.ts` — 8.11: 2831 bytes; 8.15: 2862 bytes; canonical: 8.15
- `apps/api/src/scoring/relationship-score.service.ts` — 8.11: 10987 bytes; 8.15: 11061 bytes; canonical: 8.15
- `apps/api/src/sessions/sessions.service.ts` — 8.11: 8271 bytes; 8.15: 8282 bytes; canonical: 8.15
- `package.json` — 8.11: 2033 bytes; 8.15: 2102 bytes; canonical: 8.15
- `scripts/verify-pretest-hardening.sh` — 8.11: 660 bytes; 8.15: 677 bytes; canonical: 8.15

## 8.11-only files preserved

- `docs/source/reference-live-build-03.docx` (source: 8.11)
- `docs/source/reference-master-original.docx` (source: 8.11)

## 8.15-only files preserved

- `apps/api/prisma/migrations/20260825050000_approval_concurrency_guard/migration.sql`
- `apps/api/test/unit/package8-14-concurrency-and-bounds.contract.spec.ts`
- `apps/api/test/unit/package8-15-final-audit.contract.spec.ts`
- `docs/testing/PACKAGE8_12_PRETEST_AUDIT.md`
- `docs/testing/PACKAGE8_13_DEEP_AUDIT.md`
- `docs/testing/PACKAGE8_14_FINAL_CODE_AUDIT.md`
- `docs/testing/PACKAGE8_15_FINAL_CODE_AUDIT.md`
- `scripts/verify-package8-15-final.sh`

## Validation
- ZIP test: PASS
- No duplicate archive paths: PASS
- Common-path conflicts resolved deterministically: PASS
- No file from either baseline was silently omitted except directory-only ZIP entries (directories are reconstructed by archive paths).
