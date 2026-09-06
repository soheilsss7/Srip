# Phase 5 — Authorization و Multi-Tenancy

## خروجی
ZIP v0.6 — Security Access Layer

## پیاده‌سازی کامل فاز
- RBAC: Super Admin, Holding Admin/Executive, Subsidiary Admin/Executive, Relationship Manager, Project Manager, Analyst, Standard User, Read Only.
- Permission catalog و role-permission matrix.
- API authorization با `RequirePermission` + `AuthorizationGuard`.
- Organization isolation و tenant isolation بر اساس Membership و hierarchy.
- ABAC foundation برای role + organization + department + data classification + ownership + sensitivity.
- Resource authorization برای core write paths و relationship/network/workflow access.
- Permission-aware search و audit.
- Soft-deleted records در scope queries حذف می‌شوند.
- Migration مستقل فاز 5 و seed idempotent.

## Verification note
Static/schema verification در این محیط انجام می‌شود. اجرای واقعی PostgreSQL migration/seed و E2E فقط در محیط دارای dependency و PostgreSQL فعال قابل ادعاست و به‌صورت جعلی گزارش نمی‌شود.
