# ADR-0008: بازطراحی RBAC (scope × accessLevel × functionalRole)

- Status: Accepted
- Date: 2026-09-10
- Sprint: ۱

## Context
ده نقش سلسله‌مراتبی (SUPER_ADMIN … READ_ONLY) سه بعد مستقل را با یک ابزار حل می‌کنند: سطح سازمانی (ALL/ORGANIZATION)، سطح دسترسی اداری (ADMIN/EXECUTIVE/STANDARD/READ_ONLY) و تخصص کاری (مدیر رابطه/مدیر پروژه/تحلیلگر). ترکیب‌های معتبر (مثلاً «مدیر روابطِ در سطح کل هلدینگ») با مدل فعلی قابل بیان نیست.

## Decision
مدل `UserAccess(scope, scopeOrgIds, accessLevel, functionalRole, permissionOverrides)` کنار مدل `Role` فعلی اضافه می‌شود (نه جایگزین فوری). نگاشت ۱۰→۳بعد در `user-access.service.ts` (جدول فاز ۴ پلن) پیاده شد. مجوزها از (`accessLevel` + `functionalRole` + `overrides`) محاسبه می‌شوند؛ لیست مجوزها سلسله‌مراتبی `resource.action` با وراثت `resource.*` می‌شود. سوییچ تدریجی `can()` در Sprint 2؛ ستون `Role` بعداً فقط deprecated علامت می‌خورد — حذف نمی‌شود.

## Consequences
- ✅ پیچیدگی از O(۱۰ نقش مستقل) به O(۲×۴×۳) شفاف؛ ترکیب‌های جدید بدون نقش تازه.
- ⚠️ دورهٔ دوگانه‌ی Role/UserAccess تا Sprint 2؛ تست تطابق رفتار قدیم/جدید روی همان داده الزامی است.
- Rollback: مدل additive؛ کافی است خواندن از Role قدیمی ادامه یابد.
