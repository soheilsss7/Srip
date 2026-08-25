# PHASE S — Scoring Engine

The canonical Relationship Score now contains all twelve factors required by the product specification:

- Strategic Value
- Economic Value
- Influence
- Trust
- Access
- Engagement
- Recency
- Diversity
- Responsiveness
- Commitment Reliability
- Opportunity Potential
- Risk

Weights are normalized at runtime and are data-driven. They can be supplied by the active `ScoreVersion` using direct weights or industry-specific weights, and can be overridden by active admin `ScoringRule` records without a code deployment.

Risk is represented as a positive contribution factor using `100 - relationship.riskScore`, so a high underlying risk reduces the final score.

Score versions remain immutable historical records; activating a new version does not rewrite old snapshots.
