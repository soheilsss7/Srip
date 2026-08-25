# Canonical Phase Status — Source-Aligned

This status is based on the current unified archive and the completion gates in `docs/PHASE_0_6_COMPLETION_GATES.md`. Foundation is not equivalent to production completion.

| Phase | Scope | Status |
|---|---|---|
| 0 | Architecture & Product Definition | Foundation complete; stakeholder sign-off pending |
| 1 | Repository & Development Foundation | Foundation complete; remote controls/security automation pending |
| 2 | Infrastructure & Runtime Foundation | Implementation complete; runtime/production verification pending |
| 3 | Database & Data Architecture | Schema/migrations complete; runtime migration/restore/performance verification pending |
| 4 | Authentication & Identity | Local foundation complete; production IdP/MFA/email runtime pending |
| 5 | Authorization Foundation | Foundation complete; integration/IDOR security verification pending |
| 6 | Design System | Foundation complete; full component/accessibility/visual regression work pending |
| 7 | Core Domain | **Partial:** Organization/People/Relationship CRUD, profiles, tenant-scoped authorization and web flows implemented; runtime/integration/E2E/mobile completion pending |
| 8 | Interaction & Meeting | Core API implementation complete; runtime/E2E/mobile/staging gates pending |
| 9 | Actions / Commitments / Projects / Opportunities | Foundation exists; end-to-end feature completion pending |
| 10 | Network | Foundation exists; end-to-end graph/path functionality pending |
| 11 | Intelligence | Foundation exists; production scoring/intelligence pending |
| 12 | AI | Gateway/security boundary foundation only |
| 13 | Recommendation Engine | Foundation exists; production recommendation loop pending |
| 14 | Search / Notifications / Workflow / Analytics | Foundation exists; production feature completion pending |
| 15 | Integrations | Not started beyond architecture boundaries |
| 16 | Mobile | Foundation exists; end-to-end mobile functionality pending |
| 17 | Enterprise | Authorization/data-governance foundations only |
| 18 | Production Hardening | Not started; must be tested in staging |
| 19 | Production / Launch | Repository release gates implemented; external production validation pending |
| 26 | Backend Completion (Meetings Follow-up, Job Processing, Notification Delivery, DI/Bootstrap fixes) | Implementation + static/DI/unit-test verification complete on this machine (no network/DB available here); **runtime verification against a real Postgres/Redis instance still required — run `bash scripts/verify-backend-complete.sh`** |

## Phase 16 — Mobile
- Status: IMPLEMENTED FOUNDATION / RUNTIME GATES PENDING
- Unified ZIP includes Phase 0–16.
- Mobile auth/session, API client, domain tabs, detail routes, notifications, loading/error/empty states are implemented.
- Runtime/device E2E, offline/sync, push/deep links, richer domain workflows, and production validation remain pending.

## Phase 26 — Backend Completion (scope: backend only, explicitly excludes Web/Mobile UI and the AI module)

**What changed:**
1. **Meeting → Minutes → Follow-up**, end-to-end and deterministic (no AI/external service dependency):
   - `GET /meetings/:id/minutes` — structured meeting output (open/overdue/completed action items and commitments)
   - `POST /meetings/:id/finalize` — records outcome/notes/decisions and returns minutes + follow-up candidates in one call
   - `POST /meetings/:id/action-items/extract` — deterministic (regex/heuristic) candidate extraction from notes/transcript/outcome text
   - `POST /meetings/:id/action-items/apply` — converts confirmed candidates into real `Action`/`Commitment` records linked to the meeting
   - `GET /meetings/follow-ups/list` — cross-meeting follow-up view (overdue + due-soon)
2. **Automatic overdue follow-up**: `CommitmentsService.sweepOverdue()` and `ActionsService.listOverdue/listDueSoon`, wired to a BullMQ repeatable job (every 15 minutes) plus a real in-app `Notification` to the owner when something goes overdue.
3. **Job Worker placeholders removed.** `meetings.transcribe`, `search.reindex`, and `analytics.recompute` previously `throw`ed `"not configured"`. They now run real, deterministic logic (meeting follow-up candidate regeneration, `ANALYZE` on searchable tables, per-organization analytics snapshots into `AnalyticsEvent`).
4. **Notification delivery made real** (`SmtpNotificationProvider`, `WebPushNotificationProvider`) replacing the previous `NoopNotificationProvider`, with a non-throwing `LocalLogNotificationProvider` fallback and a new `NotificationDeliveryLog` table so every delivery attempt (accepted or not, and why) is queryable — nothing is silently dropped anymore. New `PushSubscription` model + endpoints for Web Push registration.
5. **Critical, pre-existing dependency-injection bugs fixed** (these would have crashed the app at boot): `AnalyticsModule`, `OpportunitiesModule`, `RecommendationsModule`, and `NotificationsModule` were missing `PrismaService`/`AuthorizationService` providers; `SearchModule` and `IntegrationsModule` were not exporting their services, which broke `JobsModule`'s ability to inject them. All confirmed fixed via an automated dependency-graph check across all 33 modules / 78 services+controllers (0 problems remaining).
6. **`classificationAllows` extracted and unit-tested** (previously inline ABAC logic that `scripts/verify-phase0-6.sh` expected as a named symbol but did not find).
7. **Refresh-token reuse detection made explicit**: a distinct `SecurityEvent` (severity `HIGH`, type `SUSPICIOUS_ACCESS`) is now recorded specifically when a rotated (already-used) refresh token is presented again — previously this case was folded into a generic "expired or revoked" branch with no dedicated audit trail.
8. **Origin verification middleware** added as CSRF defense-in-depth, with an explicit architectural note: this API authenticates via Bearer token in the `Authorization` header (not cookies), so classic CSRF does not apply the way it would to a cookie-session API — see `production-hardening.ts` for the full reasoning.
9. New migration `20260824_phase26_backend_completion`: system actor user (for audit-safe scheduled-job actors), `NotificationDeliveryLog`, `PushSubscription`, `Meeting.followUpCandidates`.
10. New/expanded unit tests: `meetings.service.spec.ts`, `commitments.service.spec.ts`, `actions.service.spec.ts`, `search.service.spec.ts`, `analytics.service.spec.ts`, `test/unit/job-worker.spec.ts`, `authorization.service.spec.ts`.

**What was verified on this machine (no network/DB access here):**
- All 142 backend `.ts` files parse without TypeScript syntax errors (via `ts.transpileModule`).
- A full dependency-injection graph check across all 33 NestJS modules / 78 providers found **0 unresolved dependencies** (after fixes).
- All 16 pre-existing `scripts/verify-phase*.sh` static checks pass, including `verify.sh`'s own DOCX checklist assertion (1564 unchecked items, 0 checked — matches the source spec exactly).

**What still requires your environment** (this sandbox has no internet access, no Postgres, no Redis, no Docker):
- `pnpm install` (fetch real dependencies, including the newly added `nodemailer` and `web-push`)
- `prisma migrate deploy` against a real Postgres instance
- `pnpm test` executing under real ts-jest with real type resolution
- `pnpm build`
- Run **`bash scripts/verify-backend-complete.sh`** — this is the authoritative, end-to-end confirmation. It is safe to re-run any number of times.
