# ADR-0007: یکپارچه‌سازی هشدارها (Alert مرکزی)

- Status: Accepted
- Date: 2026-09-10
- Sprint: ۱

## Context
۸ ماژول (روابط، عموم‌ها، اقدام/تعهد، جلسات، گردش کار، داده و کیفیت، امنیت، پایش) هر کدام سیستم هشدار مستقل با severity و محل نمایش خودشان دارند. هیچ جا فهرست واحد «همهٔ هشدارهای فعال» وجود ندارد و افزودن ماژول نهم یعنی طراحی UI هشدار جدید.

## Decision
جدول واحد `Alert(module, severity, entityType, entityId, title, reason, actionLabel, actionUrl, resolvedAt)` با `AlertModule ∈ {RELATIONSHIP, PUBLICS, ACTION, COMMITMENT, MEETING, WORKFLOW, DATA_QUALITY, SECURITY, MONITORING}` و `AlertSeverity ∈ {CRITICAL, WARNING, INFO}`. `reason` (چرا) الزامی است. نگاشت هشدارهای موجود در `INTEGRATION-PLAN.md` (فاز ۳) قفل شده — هیچ منطق تشخیصی حذف یا تغییر نمی‌کند، فقط خروجی‌اش به شکل واحد می‌نشیند. UI: صفحهٔ مرکزی `/alerts` فیلترپذیر + کامپوننت واحد `<AlertBanner>` + زنگولهٔ شمارنده.

## Consequences
- ✅ ماژول دهم بدون طراحی UI جدید فقط با افزودن enum + detector اضافه می‌شود.
- ⚠️ صفحات ماژول تا Sprint 2 همچنان نوار اختصاصی خودشان را هم نشان می‌دهند (دورهٔ گذار)؛ سپس فقط `AlertBanner` فیلترشده به ماژول.
- Rollback: additive؛ endpointهای قدیمی (مثل `/relationships/alerts`) سر جایشان می‌مانند.
