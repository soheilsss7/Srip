# PHASE U — Relationship Lifecycle

## Contract

`Relationship.status` remains the business/status field:

- PROSPECTIVE
- ACTIVE
- AT_RISK
- DORMANT
- ARCHIVED

`Relationship.lifecycleStage` is the lifecycle field:

- IDENTIFIED
- INTRODUCED
- INITIAL_CONTACT
- DEVELOPING
- ACTIVE
- STRATEGIC
- DORMANT
- AT_RISK
- LOST

The two fields are independent. In particular, `ACTIVE` is a status value and also a lifecycle stage; `STRATEGIC` is a lifecycle stage and is not forced into `status`.

Lifecycle transitions are reversible: the API does not impose a one-way state machine, so an authorized user can move a relationship back to an earlier stage.

## API

- `GET /relationships?lifecycleStage=...`
- `PATCH /relationships/:id/lifecycle` with `{ "lifecycleStage": "STRATEGIC" }`

Lifecycle changes perform resource authorization, audit logging, and publish `relationship.lifecycle.changed` transactionally.

Existing rows are migrated without deleting data:
`PROSPECTIVE→IDENTIFIED`, `ACTIVE→ACTIVE`, `AT_RISK→AT_RISK`, `DORMANT→DORMANT`, `ARCHIVED→LOST`.
