# Production Rollback Runbook

## Trigger conditions
- Critical regression
- Data integrity risk
- Authentication/authorization failure
- Sustained elevated 5xx/error rate
- Unacceptable latency
- Security incident

## Procedure
1. Declare incident and record timestamp/commit SHA.
2. Stop further rollout.
3. Route traffic to the last known-good application version where supported.
4. Do **not** blindly reverse database migrations. Assess compatibility first.
5. If data rollback is required, use the approved backup/restore procedure after incident approval.
6. Verify API readiness, authentication, authorization and critical workflows.
7. Verify monitoring and error tracking.
8. Run smoke tests.
9. Record impact, recovery time and follow-up actions.

Rollback must be rehearsed in staging before production approval.
