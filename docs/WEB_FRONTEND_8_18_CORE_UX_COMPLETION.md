# Web Frontend 8.18 — Core UX Completion

Baseline: Package 8.17 Web Frontend Role/Scope/Executive Unified Baseline.

## Scope
- Shared Page UI primitives and admin navigation.
- Administrative workspaces for users, roles, permissions, tags, custom fields, scoring rules, notification rules, integrations and audit.
- Data Management quality dashboard and production import wizard wired to the existing `/data/*` API contract.
- Privacy/GDPR workspace wired to the existing `/privacy/*` contract.
- Sessions & Devices UI wired to `/sessions`.
- Reporting UI wired to the existing report kinds and export-capable API surface.
- User settings for theme/locale preference.

## Preservation
No repository file is deleted by this extension. Existing code remains the canonical baseline unless explicitly reconciled.

## Runtime verification
Dependency installation is not available in the offline build environment, so TypeScript/Next.js runtime PASS is not claimed. Static repository/archive verification is performed; live API/DB PASS is not claimed.
