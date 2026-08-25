# Phase 24 — Screen Map + GDPR/Data Governance + File Security

## Source alignment
This phase reconciles the source checklist sections 49, 53, 54, 55–63 and the newer phase plan's Mobile and Enterprise requirements.

## Web + Mobile Screen Map
Implemented screen inventory and route/screen shells for all source-listed Web and Mobile screens, plus explicit Privacy, Data Management and Documents security surfaces. The canonical map is `docs/ux/SCREEN_MAP.md`.

## GDPR / Data Governance
- DataClassification includes Public/Internal/Confidential/Highly Confidential while preserving legacy Restricted/Private values.
- DataProcessingPolicy stores purpose, lawful basis, classification, retention, exportability and erasability.
- PrivacyRequest supports ACCESS, EXPORT and ERASURE.
- ConsentRecord supports grant/revoke and versioning.
- DataLifecycleRecord supports Creation → Active → Archived → Retention → Deletion.
- Data export is permission-aware and creates DataExportLog + AuditLog records.
- Access requests return the user's authorized personal-data package.
- Erasure uses controlled anonymization/session revocation and reports legal-retention exceptions rather than silently destroying legally retained records.
- Retention preview and controlled soft-delete execution are available behind `privacy.manage`.
- Privacy audit endpoint is permission-protected.

## File Security
- Extension allowlist.
- MIME validation.
- Magic/content validation.
- Maximum size enforced both at interceptor and service layer.
- SHA-256 hashing.
- Random generated storage keys.
- Quarantine before release.
- ClamAV INSTREAM scanning; fail-closed when required scanner is unavailable.
- S3 server-side encryption header.
- Private object access through short-lived signed URLs.
- Downloads forced as attachments.
- Authorization before read/download.
- File upload/download audit records.
- A document cannot be downloaded until the security scan is CLEAN or scanning is explicitly disabled for a controlled environment.

## Runtime gates not falsely marked as complete
- PostgreSQL migration execution still requires a real database.
- ClamAV must be running in the target environment for production malware scanning.
- E2E, security/pentest and staging/UAT remain runtime gates.
- Legal approval of retention/legal-basis configuration remains a governance gate.
