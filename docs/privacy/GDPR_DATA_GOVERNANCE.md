# GDPR / Data Governance — Phase 24

## Classification
Canonical policy levels are Public, Internal, Confidential and Highly Confidential. Legacy Restricted/Private values remain supported for backward compatibility.

## Privacy by Design
Every processing policy records entity type, purpose, lawful basis, classification, retention period, exportability and erasability.

## Data Subject Rights
- Access request
- Data export
- Erasure request with controlled anonymization and legal-retention exceptions
- Consent grant/revoke where consent is the lawful basis
- Privacy audit trail

## Lifecycle
Every governed entity may be tracked through Creation → Active → Archived → Retention → Deletion.

## Important operational gate
Legal retention rules must be configured and approved before destructive deletion jobs are enabled. The implementation intentionally uses anonymization/soft-delete controls instead of silently destroying legally retained records.
