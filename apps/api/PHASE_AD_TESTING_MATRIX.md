# PHASE AD — Testing Matrix

Canonical backend test matrix. AI and frontend are intentionally not expanded here; this matrix covers the backend scope requested for the current implementation phase.

## UNIT
- Score Engine
- Permission Engine
- Relationship Logic
- Workflow
- Recommendation
- Validation
- Date/Time Logic

## INTEGRATION
- API
- PostgreSQL
- Auth
- Redis
- Queue
- Storage

## E2E
- Login
- Create Organization
- Create Person
- Create Relationship
- Create Meeting
- Complete Meeting
- Create Action
- Create Commitment
- Follow-up
- Recommendation
- Permission Denial

## SECURITY
- See PHASE AE — Security Testing.

The existing runtime PostgreSQL/Redis integration suite remains opt-in (`RUN_INTEGRATION=1`). The E2E suite is opt-in (`RUN_E2E=1`) and requires a deployed API and seeded test credentials.
