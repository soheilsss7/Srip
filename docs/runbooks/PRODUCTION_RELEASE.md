# Production Release Runbook

1. Freeze the release commit and record the SHA.
2. Confirm all required CI checks are green in a network-enabled environment.
3. Confirm staging deployment and UAT are approved.
4. Take and verify a production database backup before risky migrations.
5. Apply backward-compatible migrations first.
6. Deploy API and Web containers.
7. Verify readiness/liveness, authentication, authorization and critical workflows.
8. Verify metrics, error tracking and alert routing.
9. Run post-deploy smoke tests.
10. Monitor error rate and latency during the observation window.
11. If any release gate fails, stop rollout and follow `PRODUCTION_ROLLBACK.md`.
12. Record evidence and final GO/NO-GO decision in `RELEASE_CHECKLIST.md`.
