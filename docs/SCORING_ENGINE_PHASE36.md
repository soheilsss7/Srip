# Scoring Engine — Phase 36

This phase reconciles the scoring architecture so the five score families required by the technical specification are independent services while sharing one persistence/versioning contract.

## Independent services

- `CanonicalRelationshipScoreService`
- `OpportunityScoreService`
- `RiskScoreService`
- `ConnectorScoreService`
- `NetworkScoreService`

Each service owns its calculation formula, authorization boundary, score version lookup, canonical `Score` persistence, `ScoreSnapshot` history, and `score.updated` domain event through the shared `ScoringBaseService` infrastructure.

## Versioning

`ScoreVersion` is immutable by convention: creating a new formula creates the next integer version for the same score family. Activating a version archives the previous active version. Existing `ScoreSnapshot` rows retain the version that produced them.

Canonical version names:

- `relationship-default`
- `opportunity-default`
- `risk-default`
- `connector-default`
- `network-default`

## Canonical persistence identity

`Score.id = <score-type>:<subject-type>:<subject-id>`.

Every recalculation writes a `ScoreSnapshot`, preserving historical values even when the current `Score` is updated.

## API

- `POST /api/v1/scores/relationship/:id/recalculate`
- `POST /api/v1/scores/opportunity/:id/recalculate`
- `POST /api/v1/scores/risk/relationship/:id/recalculate`
- `POST /api/v1/scores/connector/person/:id/recalculate`
- `POST /api/v1/scores/network/organization/:id/recalculate`
- `GET /api/v1/scores/:type/:subjectType/:subjectId/history`
- `GET /api/v1/scores/versions`
- `POST /api/v1/scores/versions`
- `POST /api/v1/scores/versions/:id/activate`

## Reconciliation

Relationship and risk calculation is no longer duplicated in Intelligence. Network connector ranking delegates to the canonical Connector Score service. Existing relationship score endpoints remain available through a compatibility facade so existing clients do not break.

## Source alignment

The implementation follows the technical specification's Section 30 requirement for independent score services and Section 31 requirement for versioned formulas without destroying historical scores.
