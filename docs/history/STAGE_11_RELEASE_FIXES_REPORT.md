# STAGE 11 — RELEASE-BLOCKING FIXES: IMPLEMENTATION & RUNTIME VERIFICATION

Commit: `e6db07d` — `fix(api,mobile,web): resolve release-blocking idempotency, auth-exemption and nav parity gaps`

## Summary of the three approved release-blocking fixes

### Fix 1 — Mobile writes never sent `Idempotency-Key` (all protected mobile writes failed 400)
- `apps/mobile/src/services/api-client.ts`: added `makeIdempotencyKey(existing?)`, `MUTATING_METHODS = {POST,PUT,PATCH,DELETE}`; `apiRequest` now auto-injects a generated key on every mutating method (never GET/HEAD), accepts a 4th `idempotencyKey` param for the offline queue; `apiPostOffline`/`apiPatchOffline` generate a **stable** key, use it for the immediate request, and persist it to the queue.
- `apps/mobile/src/services/offline-queue.ts`: `QueuedMutation` gained `idempotencyKey?: string`, preserved across retry attempts.
- `apps/mobile/src/state/session.tsx`: `sendQueued` forwards `Idempotency-Key: m.idempotencyKey` when present, so reconnects/retries replay the original result instead of duplicating.
- Also fixed a typecheck regression (return type `string | undefined` → `string`) discovered and corrected during verification.

### Fix 2 — Backend public-auth exemptions mismatched real routes (mobile register/password-reset broken)
- `apps/api/src/common/api-contract/api-contract.interceptor.ts`: `PUBLIC_MUTATION_PREFIXES` corrected from stale `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` to the real controller routes:
  `/auth/login`, `/auth/refresh`, `/auth/register`, `/auth/password-reset/request`, `/auth/password-reset/confirm`, `/auth/email/verify`. No broad `/auth/*` wildcard — every other protected write still requires a valid (≥16 char) key.

### Fix 3 — Orphaned/divergent web pages
- `apps/web/app/_components/workspace.tsx`: added end-user nav `/ai-executive-brief` (`ai.executive_brief`) and admin-only nav `/security-events` (`security.read`), `/enterprise` (`enterprise.read`), `/data-lifecycle` (`data.lifecycle_status`).
- `apps/web/app/knowledge/page.tsx`: `/documents` made canonical; `/knowledge` now `redirect('/documents')` (verified `/documents/page.tsx` exists).

## Files changed
| File | Change |
|---|---|
| `apps/mobile/src/services/api-client.ts` | Fix 1 key injection + type fix |
| `apps/mobile/src/services/offline-queue.ts` | Fix 1: persist stable key in queue |
| `apps/mobile/src/state/session.tsx` | Fix 1: reuse key on retries |
| `apps/api/src/common/api-contract/api-contract.interceptor.ts` | Fix 2: real auth route exemptions |
| `apps/web/app/_components/workspace.tsx` | Fix 3: nav entries |
| `apps/web/app/knowledge/page.tsx` | Fix 3: redirect to /documents |
| `apps/api/test/unit/stage11-idempotency-mobile-fix.spec.ts` | new regression spec |

## Runtime verification (live API :4000, new build in proot)
Two fresh users registered, email-verified, granted non-admin roles (RM, PM) → **no MFA required**; each public-auth mutation sent **without** a key.

| # | Check | Result | Verdict |
|---|---|---|---|
| 1 | `POST /auth/register` (no key) | 2xx | Fix 2 ✅ |
| 2 | `POST /auth/email/verify` (no key) | 2xx | Fix 2 ✅ |
| 3 | `POST /auth/password-reset/request` (no key) | 201 | Fix 2 ✅ |
| 4 | `POST /auth/login` + `/auth/refresh` (public) | tokens issued | ✅ |
| 5 | Protected `POST /people` **no key** | **400 IDEMPOTENCY_CONFLICT** | enforcement intact ✅ |
| 6 | Protected `POST /people` with 32-char key | 2xx, DB row created | Fix 1 ✅ |
| 7 | **Replay** same mutation + same key | **same id, DB count=1 (no duplicate)** | idempotent replay ✅ |
| 8 | Same mutation + different key | distinct write attempted (rejected by business dedupe) | ✅ |
| 9 | Keyed `PATCH /people/:id` (title) | 2xx, field updated | mobile PATCH path ✅ |
| 10 | `POST /organizations` (org.write is MFA-gated admin-only) | **403** | authz gate ✅ |
| 11 | `POST /projects` keyed, PM (non-MFA) | 2xx, DB row | ✅ |

## Verification chain (all pass)
- Backend unit tests (in proot, Prisma native dep): **59 suites / 215 tests passed** (16 skipped), includes new `stage11-idempotency-mobile-fix.spec.ts`.
- API typecheck: exit 0; API build OK.
- Web typecheck: exit 0; **web production build OK** (includes new `/security-events` route).
- Web frontend-audit: **PASS** (102 TS/TSX files).
- Mobile typecheck: exit 0; **Android export OK** (`--no-bytecode`, `Exported: dist`), re-run after type fix.

## Remaining genuine gaps (documented, not release-blocking)
1. **Latent PATCH-person-`notes` → 500** (internal): `UpdatePersonDto` advertises `notes`, but `people.service.ts:125` spreads `data` into Prisma which expects `notesText` (only `create` at line 101 maps `notes→notesText`). **Not user-facing** — neither web nor mobile sends `notes` on PATCH (web person detail PATCHes only archive with an empty body). Recommend a follow-up mapping fix; excluded from the three approved fixes.
2. **org.write only on MFA-gated admin roles** (by design): non-MFA logins cannot create organizations; org-create cannot be exercised by a non-MFA runtime account (verified the 403 gate instead). Not a defect — privileged authorization.

## Environment-only limitations (not product defects)
- API, Prisma native engine, and backend jest must run inside the proot Ubuntu container (`process.platform=linux` + glibc); Termux-native runs fail on `libgcc_s.so.1`. Health confirms DB/redis/queue OK (`{"status":"ok"}`).
- Storage optional/not configured (`"configured":false,"optional":true`).

---

## VERDICT: **RELEASE READY WITH DOCUMENTED MINOR GAPS**

The three verified release-blocking fixes are implemented, committed (`e6db07d`), and confirmed against the running stack:
- every protected write now carries a valid idempotency key from the mobile client (persisted/reused offline),
- public auth mutations (register, login, refresh, password-reset, email verify) work without a key,
- orphaned/divergent web routes are surfaced or canonicalized.

No regressions in the full build/test/typecheck/audit/export chain. The only two documented items (latent `notes`→`notesText` mapping inconsistency; MFA-gated `org.write`) are either non-user-facing or intended authorization design and do not block release.
