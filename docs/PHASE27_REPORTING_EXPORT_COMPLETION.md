# Phase 27 — Reporting / Export Completion

## Scope

Implements Master Technical Spec sections 144–146 without deleting or replacing previous phases.

### Data Export
- CSV
- Excel XLSX
- PDF
- JSON
- report.export permission
- export audit via DataExportLog + AuditLog
- organization/tenant authorization
- ABAC classification gate

### Reporting Engine
- Relationship health
- Relationship risk
- Network
- Meeting
- Opportunity
- Project
- Company
- Executive
- Holding

### Executive Report
- Summary
- KPI
- Trends
- Risks
- Opportunities
- Recommendations
- Supporting data

## API

- `GET /api/v1/reports/:kind`
- `GET /api/v1/reports/:kind/export/csv`
- `GET /api/v1/reports/:kind/export/xlsx`
- `GET /api/v1/reports/:kind/export/pdf`
- `GET /api/v1/reports/:kind/export/json`

The application already mounts API v1 globally; the controller route is `reports/...` and therefore resolves under the existing `/api/v1` prefix.

## Security

Exports require `report.export`, organization scope, and the existing ABAC classification gate. Every successful export creates a `DataExportLog` and an `AuditLog` event with action `EXPORT`.

## Verification

Static verification is available at `scripts/verify-reporting-export.sh`.
Runtime tests requiring installed npm dependencies and a PostgreSQL database must be executed in the project runtime environment; this sandbox does not contain the project's node_modules/database.
