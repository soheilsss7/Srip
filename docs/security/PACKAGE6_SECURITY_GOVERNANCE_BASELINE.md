# Package 6 — Security / Governance / Secrets / Data Lifecycle / Privacy

## Baseline
Derived exclusively from the complete Package 5 repository baseline and the project reference documents.

## Implemented / reconciled
- RBAC + ABAC authorization remains canonical; classification ceilings are now hard denies rather than silently skipped policies.
- Organization scope, ownership scope and field-level security remain enforced through the existing authorization services.
- Audit redaction remains canonical for secrets and sensitive document content.
- Integration secrets remain encrypted with AES-256-GCM and versioned keys; plaintext source-control storage is prohibited.
- Privacy requests support access/export/erasure flows and are user-scoped.
- Data lifecycle transitions now attribute the actor and emit an audit record from the privacy lifecycle endpoint.
- Retention execution continues to use the canonical DataLifecycleService and privacy authorization.
- Security governance preflight exposes production security configuration checks behind `enterprise.security`.
- File upload validation and optional/required malware scanning remain enforced by the existing canonical FileSecurityService.

## Reference requirements covered
- Advanced RBAC / ABAC
- Audit
- Data Governance
- Data Classification
- Relationship Sensitivity
- Department Scope
- Ownership Rules
- Export Controls
- Privacy/GDPR
- Retention
- Data Lifecycle
- Secrets Management
- API authorization and security boundaries

## Verification limitation
Static verification is executable in this artifact. Full typecheck/build/Jest integration requires the repository dependency set and backing services (PostgreSQL/Redis/ClamAV where configured). No runtime PASS is claimed without those dependencies.
