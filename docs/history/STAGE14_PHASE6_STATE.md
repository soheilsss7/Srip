# STAGE 14 PHASE 6 STATE — WORKING STATE / RECOVERY LOG

Project:
SRIP

Stage:
14 — Network Graph Upgrade

Current Phase:
6 — Full Verification / Security

Phase 6 status:
IN_PROGRESS (2 genuine defects found & fixed; final regression matrix in progress)

Current branch:
main

Current HEAD (before Phase 6 commits):
740854a

Working tree:
Has uncommitted Phase 6 fixes (API network.service.ts + spec, web _nodes.ts) pending focused commit.
State file itself is untracked.

## Runtime environment
- API: rebuilt + restarted as persistent proot daemon, node dist/main.js PID 23339.
  - launch: proot-distro login ubuntu -- bash -c '... node dist/main.js' + nohup/setsid
  - global prefix api/v1; all network routes under /api/v1/network/...
  - PRISMA_QUERY_ENGINE_LIBRARY arm64 engine env var required (libgcc_s present only in proot)
- Jest/node/tsx in-proot only (Prisma engine lib path); host shell lacks libgcc_s.
- fresh admin token: /data/data/com.termux/files/usr/tmp/opencode/admin-token-fresh (MFA TOTP login).
- DB fixture: 3 orgs (Holding root ...001, Subsidiary ...002, Customer ...003, all descendants of Holding),
  1 person Example Contact (...020, org3), 1 project Phase 3 Seed Project (...070, org3),
  1 relationship org1<->org3 STRATEGIC (...030, risk 72 health, riskScore=0).
  0 person-relationships. Only user: admin (HOLDING_ADMIN in org1 -> accessible orgs = descendants(org1) = all 3).

## Completed checks (Phase 6)
- Baseline: HEAD 740854a clean; ee08b52/release-v1 untouched.
- Repo audit (web/mobile/api): all Stage 14 files + auth/authz/scope/detail routes audited.
- Build/type/test gates: API typecheck PASS, nest build PASS, jest 59 suites/219 tests PASS (3 new);
  Web tsc+next-build PASS; Mobile tsc+expo export android --no-bytecode PASS; verify-network-complete.sh PASS.
- Authentication: all 8 network endpoints 401 unauth; invalid/empty/non-bearer token 401; login without OTP 401 (MFA enforced).
- Authorization/scope: in-scope org 200; out-of-scope/nonexistent/malformed org 403; detail routes scope-checked.
- Graph leakage: no orphan edges; node/edge ids unique; meta counts match payloads; type/status/q filters don't widen scope;
  focus is 1-hop only; pagination bounded (min limit 25 -> live multi-page NOT TESTABLE, 3 orgs).
- ID/prefix: focus/path prefixed handling rejects out-of-scope/unknown/double-prefix (404); detail routes strip prefixes;
  web+mobile nodeEntityRoute strip/nil-guard correctly; mobile relationship edge route uses bare-id verified safe.
- Pathfinding: in->in found (1 hop); out-of-scope/nonexistent/malformed/person-prefix endpoints 404; missing from/to 403.
- Analytics: all 5 analytics 200, .node ids all in graph, connectors strips person: + finite scores (regression PASS).
- Person-relationships: list 200; create same-person 403, nonexistent 404, missing fields 403; update/delete nonexistent 404;
  no DB mutation (count stays 0). Write success requires >=2 distinct people (only 1 exists -> NOT TESTABLE).
- Detail routes: in-scope 200, not-found 404, prefixed 404; org route checks scope first (403) by design.
- Input validation: empty/very-long q 200; invalid type 200; negative/non-numeric limit handled (clamp/400);
  invalid status -> 400 now (was 500); no crash/stack-leak/SQL-leak observed.

## Discovered defects
1. [HIGH/correctness-robustness] invalid ?status= returns 500 INTERNAL_ERROR (was) on
   GET /network/graph and GET /network/person-relationships. Root cause: raw status cast to any
   into Prisma RelationshipStatus enum filter -> PrismaClientValidationError -> 500.
   (Same latent pre-existing pattern also present in out-of-scope relationships controller - NOT modified per scope.)
2. [LOW/correctness] web _nodes.ts edgeStrokeWidth/edgeStrokeColor/edgeDisplayLabel lacked NaN/Infinity
   guards that the mobile graph-model.ts has (Phase 5 hardening parity gap). Latent; would render NaN on malformed payload.

## Fixed defects
1. network.service.ts: added relationshipStatus() validator -> BadRequestException (400) for invalid values,
   applied to all 3 status filter sites (graph x2, listPersonRelationships). + 3 unit tests. RUNTIME VERIFIED 400.
2. web _nodes.ts: added toFinite() + Number.isFinite guards to edgeStrokeWidth/edgeStrokeColor/edgeDisplayLabel.

## Post-fix regression (ALL GATES)
- API: typecheck PASS, nest build PASS, jest 59 suites/219 tests PASS.
- Web: tsc PASS, next build PASS.
- Mobile: tsc PASS, expo export android --no-bytecode PASS.
- Contract: verify-network-complete.sh PASS.
- Runtime: status=bogus/lowercase -> 400; valid PROSPECTIVE/ACTIVE/AT_RISK -> 200;
  person-relationships status bogus -> 400; auth 13/13 PASS; search-scoping+analytics 23/23 PASS.

## Tests executed (counts/commands)
- API: npx jest --runInBand (in proot) 59 suites/219 tests PASS; npx tsc --noEmit PASS; nest build PASS.
- Web: npx tsc --noEmit PASS; node scripts/next-build.mjs PASS.
- Mobile: npx tsc --noEmit PASS; npx expo export --platform android --no-bytecode PASS.
- Contract: scripts/verify-network-complete.sh PASS (NETWORK_STATIC_CHECK=PASS).
- Runtime security harness: 13/13 auth PASS.
- Data-consistency + leakage + search-scoping + analytics: PASS (harness-level 404/limit artifacts reclassified).
- No DB mutation confirmed (person-relationship count 0).

## Database state
- UNCHANGED (read-only inspection + rejected-write verification only). admin is HOLDING_ADMIN in org1 (accessible orgs = all 3 descendants).

## Known limitations (retained)
- risk>=60: NOT TESTABLE (only relationship has riskScore 0; no safe fixture with risk>=60).
- live multi-page pagination: NOT TESTABLE (3 orgs; pageSize floor 25).
- native mobile gestures/native a11y: NOT DEVICE-RUN (no Android device/emulator).
- person-relationship write success: NOT TESTABLE (only 1 person; needs 2 distinct in-scope).
- out-of-scope person/project positive-leak test: NOT TESTABLE at runtime (no out-of-scope real rows; unit-tested).
- Web/mobile browser/emulator functional regression: SOURCE VERIFIED / BUNDLE VERIFIED (no browser/device automation).

## Exact next action
- Commit the 2 focused Phase 6 fixes (API status validation + web NaN guards) in repo style.
- Produce final regression matrix + security report + git report + acceptance decision.

Do NOT start Phase 7 or any post-Stage-14 work.
