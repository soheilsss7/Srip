# Phase 28 — Data Import / Duplicate Detection / Data Quality

## Scope
Implements Master Technical Spec sections 113–115 without changing or deleting previous phases.

## Data Import
- CSV upload with quoted-field/newline-safe parsing.
- XLSX/XLS upload through the `xlsx` parser.
- Explicit column mapping plus alias-based auto mapping.
- Row-level validation and error/warning persistence.
- Preview persisted before mutation.
- Explicit approval required before database mutation.
- Organization and Person imports.
- Organization resolution for people by ID, exact name or domain.
- Owner resolution by ID/email for organizations.
- Import report with per-row status, errors and duplicate candidates.
- Duplicate strategy: SKIP, UPDATE, CREATE.
- Import audit trail.
- File metadata is stored; raw source file bytes are not retained after preview.

## Duplicate Detection
### Organization
- Name similarity.
- Domain.
- Registration ID.
- Phone.
- Country corroboration.

### Person
- Name similarity.
- Email.
- Organization.
- Phone.

### In-file duplicates
Duplicate rows within the same import batch are explicitly flagged before approval.

## Data Quality Dashboard
- Duplicate organizations and people.
- Missing owners.
- Missing contacts.
- Stale relationships using configurable `DATA_QUALITY_STALE_DAYS` (default 90 days; operational default, not a Master Spec threshold).
- Invalid emails.
- Missing organizations.
- Missing dates.
- Incomplete profiles.
- Persisted `DataQualitySnapshot` with scope and coverage metrics.

## API
- `POST /api/v1/data/import/preview`
- `GET /api/v1/data/import/:id/report`
- `POST /api/v1/data/import/:id/approve`
- `GET /api/v1/data/quality`
- `POST /api/v1/data/quality/scan`
- `GET /api/v1/data/duplicates`

## Security
- Organization scope checked before preview, report, approval and quality operations.
- Import approval is permission protected.
- No automatic mutation during preview.
- Audit entries for preview and approval/quality snapshot creation.
- Maximum import size controlled by `IMPORT_MAX_BYTES` (default 25 MiB).

## Verification
- Changed TypeScript transpilation/static syntax check: PASS.
- CSV/domain/phone/name utility runtime tests: PASS.
- Prisma relation structural checks: PASS.
- ZIP integrity: PASS after packaging.
- Full Prisma migration execution, PostgreSQL integration, XLSX runtime, Jest/E2E and load/security tests require the project's real dependency/database/runtime environment and are not claimed as executed in the sandbox.
