# Phase C — Tag System

This phase completes the backend Tag System on top of the Phase A + B.1 baseline. Existing code is preserved; no frontend or AI code is changed.

## Contract
- `Tag` remains the canonical tag catalog.
- `TagAssignment` is the generic association for supported business entities.
- Duplicate assignment is prevented by `(tagId, entityType, entityId)`.
- `organizationId` is stored on an assignment when the entity has organization scope.
- Assignment requires `tag.write` plus `entity.write` and organization scope.
- Reading assignments requires `tag.read` plus `entity.read` and organization scope.
- Unsupported entity types are rejected instead of bypassing authorization.

## API
- `POST /tags`
- `GET /tags`
- `PATCH /tags/:id`
- `DELETE /tags/:id`
- `GET /entities/:entityType/:entityId/tags`
- `POST /entities/:entityType/:entityId/tags`
- `DELETE /entities/:entityType/:entityId/tags/:tagId`

## Supported business entities
Organization, Person, Relationship, Interaction, Meeting, Action, Commitment, Project, Requirement, Opportunity, Recommendation, Document, Note, Workflow, Referral, ConnectionPath, OrganizationUnit.

## Audit
- `TAG_CREATED`
- `TAG_UPDATED`
- `TAG_ASSIGNED`
- `TAG_REMOVED`

## Default catalog
Strategic, VIP, Banking, Government, High Risk, Investor, Energy, International.
