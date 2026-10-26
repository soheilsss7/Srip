# ADR-0005: تفکیک بازاری/غیربازاری روابط (marketKind)

- Status: Accepted
- Date: 2026-09-10
- Sprint: ۱ (ثبت تصمیم موجود)

## Context
روابط سازمانی دو جنس متفاوت دارند: زنجیرهٔ بازار مستقیم (مشتری/تأمین‌کننده/شراکت) و نهادهای غیربازاری (تنظیم‌گر، نهاد حاکمیتی، دانشگاه). آستانه‌های هشدار و نقش آن‌ها در ورود به بازار یکی نیست — سلامت ۴۵ برای رابطهٔ بازاری بحران است، برای رابطهٔ تنظیم‌گر معنای دیگری دارد.

## Decision
فیلد `marketKind` (MARKET | NON_MARKET | HYBRID) + `isMarketEntry` + `marketSegment` روی مدل `Relationship` نگه داشته می‌شود و ۸ نوع هشدار بازار (MARKET_HEALTH، MARKET_RISK، NONMARKET_HEALTH، HYBRID_RISK، ENTRY_STALE، MARKET_STALE، CADENCE_BREAK، MISSING_ENTRY) عیناً به همین سه فیلد متصل می‌مانند. این منطق در فاز ۳ به رکوردهای `Alert` با `module: RELATIONSHIP` نگاشت می‌شود ولی آستانه‌ها و kindها تغییر نمی‌کنند.

## Consequences
- ✅ هشدارهای بازار بدون بازنویسی به مرکز هشدار می‌آیند.
- ⚠️ `apps/api` هنوز آستانه‌های بازار را در سرویس خودش دارد؛ در Sprint 2 به بستهٔ مشترک `domain-rules` منتقل می‌شود (تسک ۱-۳).
- Rollback: هیچ تغییری در ساختار داده لازم نیست.
