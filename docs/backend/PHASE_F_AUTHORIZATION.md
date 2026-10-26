# Phase F — Authorization Contract Baseline

## Scope
This phase reconciles the Backend authorization layer without deleting earlier Phase 0–E code.

### Canonical contract
`AuthorizationService.assertPermission(userId, permission, context)` accepts only `AuthorizationContext`.

The context carries organization scope, ownership, classification/sensitivity, resource identity, department scope and optional field identity.

### Resource authorization
When `entityType` and `entityId` are present, the authorization service resolves the resource's organization scope and fails closed if any required organization is outside the caller's accessible scope. Relationships require both source and target organization scope.

### Field-level security
`FieldSecurityService` applies explicit permission policies after resource authorization. Relationship-sensitive fields include Notes, Strategic Assessment, Risk, Internal Opinion and Sensitive Contacts; score fields are mapped to the corresponding protected field permission. Missing fields are never fabricated: policies only act when the property exists in a response object.

### DTO boundary
Relationship responses are produced through `RelationshipPresenter`; raw Prisma Relationship objects are not returned by the service. Nested organization/project data is explicitly selected to avoid accidental data leakage.

### Compatibility rule
No legacy `assertPermission(userId, permission, organizationId, attributes)` implementation remains. All Backend call sites use the context object contract.

### Important source alignment
The product specification explicitly requires field-level restrictions for Relationship Notes, Sensitive Contacts, Strategic Assessment, Risk and Internal Opinion, in addition to RBAC/ABAC, organization scope, ownership and classification. See the source specification. fileciteturn9file1L1-L15
