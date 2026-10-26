# ADR-0006: مدل امتیازدهی واحد (EntityScore)

- Status: Accepted
- Date: 2026-09-10
- Sprint: ۱

## Context
مدل `Relationship` هشت امتیاز مجزا دارد (health, strategic, risk, trust, access, influence, opportunity, resilience, engagement) بدون فرمول ترکیبی؛ ماژول عموم‌ها مفاهیم مشابه (coveragePct, power/interest, stage/stance) کاملاً جدا دارد. کاربر و داشبورد نمی‌دانند «امتیاز کل» چیست؛ Alert Engine و BI باید برای هر دامنه جدا کد بزنند. API واقعی از قبل `Score`/`ScoreVersion`/`ScoreCalibration` دارد ولی composite واحدی برای نمایش تعریف نشده.

## Decision
جدول واحد `EntityScore(entityType, entityId, composite, factors:Json, formulaVersion)` با `entityType ∈ {RELATIONSHIP, PUBLIC_GROUP, PUBLIC_MEMBER}`. فرمول: `composite = Σ(value×weight)/Σweights` با پیش‌فرض‌های health .25، risk .20 (معکوس)، strategic .15، trust .15، engagement .10، influence .05، opportunity .05، resilience .05 — وزن‌ها از ساختار نسخه‌دار موجود (`ScoreVersion`) قابل تنظیم‌اند و `formulaVersion` ردیابی تغییر فرمول در طول زمان را ممکن می‌کند. ۸ ستون قدیمی حفظ می‌شوند و در Sprint 2 به generated/read-only از EntityScore تبدیل می‌شوند (migration نرم). UI فهرست فقط composite را نشان می‌دهد؛ جزئیات، تب «تفکیک امتیاز» از `factors` رندر می‌کند.

## Consequences
- ✅ یک جدول امتیاز برای همهٔ دامنه‌ها؛ Dashboard و Alert بدون کد تکراری هر دو دامنه را پوشش می‌دهند.
- ✅ هیچ فاکتوری حذف نمی‌شود — همه در `factors` با وزن live هستند.
- ⚠️ تا Sprint 2 دو منبع نوشتن (ستون‌های قدیمی + EntityScore) همزمان‌سنجی می‌خواهد؛ سرویس `EntityScoreService` تنها نقطهٔ نوشتن است.
- Rollback: مدل additive است؛ حذف جدول کافی است.
