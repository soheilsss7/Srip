# PHASE R — Requirement Matching

This phase makes Requirement Matching a deterministic backend intelligence pipeline.

Pipeline:
Requirement → Requirement Keywords → Target Organizations → Direct Relationship → 1-Hop → 2-Hop → Connector Person → Path Strength → Relationship Health → Trust → Engagement → Success Probability → Rank.

Internal means the source and target organizations resolve to the same holding/root organization through `Organization.parentOrganizationId`; it does not mean source and target IDs are equal.

The service returns Direct, Indirect/Two-Hop, Internal, External, Relationship Gaps, Best Connection and explainable Recommendations. Paths are capped at three relationship edges to keep the API bounded while covering direct, 1-hop and 2-hop connector paths.

No AI or frontend dependency is introduced.
