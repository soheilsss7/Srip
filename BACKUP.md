# 🧷 BACKUP — پشتیبان کامل پلتفرم Srip (قبل از تغییرات جدی)

این سند، نقشهٔ «نقطهٔ بازگشت» پلتفرم است. اگر تغییرات آینده خوب از آب درنیامد،
با این راهنما کل پلتفرم (یا فقط سایت زنده) در چند دقیقه به همین نسخه برمی‌گردد.

## شناسنامهٔ پشتیبان

| مورد | مقدار |
| --- | --- |
| تاریخ پشتیبان | **2026-09-10** |
| کامیت (دقیقاً همین وضعیت) | `1e7bb4416727210f83ef32c4261294c6ce35477c` |
| تگ روی GitHub | **`backup-platform-2026-09-10`** |
| Release (دانلود zip) | https://github.com/soheilsss7/Srip/releases/tag/backup-platform-2026-09-10 |
| وضعیت زندهٔ همین کامیت | ✅ همان چیزی است که روی https://soheilsss7.github.io/Srip/srip2/ سرو می‌شود |

این پشتیبان **کل پلتفرم فعلی** را در بر دارد:

- کل سورس‌کد: `apps/` (api, web, web-ux, mobile)، `packages/`، `infra/`، `scripts/`، `tests/`
- خروجی build شدهٔ سایت زنده در `docs/srip2/` (۷۷۶ فایل — همان محتوای منتشرشده روی GitHub Pages)
- برنچ انتشار Pages برنچ `arena/01a04f6d-srip` از مسیر `/docs` است و هنگام گرفتن این پشتیبان دقیقاً روی همین کامیت `1e7bb44` قرار داشت.

> ⚠️ برای بازگردانی، کافی است در یک نشست Arena (یا کلون محلی) بگویید
> «پلتفرم را به بکاپ 2026-09-10 برگردان» و همین سند را ملاک قرار دهید.

## سناریو ۱ — بازگرداندن کل پلتفرم به این نسخه

اگر تغییرات آینده خراب بود و همه‌چیز (سورس + سایت) باید به همین نسخه برگردد:

```bash
git fetch origin --tags
git checkout arena/01a08a50-srip          # برنچ کاری (یا هر برنچ کاری فعال)
git reset --hard backup-platform-2026-09-10
git push origin arena/01a08a50-srip --force

# اگر نسخهٔ خراب روی سایت زنده هم منتشر شده بود، برنچ انتشار Pages را هم برگردانید:
git push origin backup-platform-2026-09-10:refs/heads/arena/01a04f6d-srip --force
```

بعد از دستور آخر، GitHub Pages دوباره build می‌شود و سایت `/srip2/` به همین نسخه برمی‌گردد.

## سناریو ۲ — بازگرداندن فقط سایت زنده (بدون دست زدن به سورس)

اگر فقط خروجی منتشرشده خراب است و سورس باید دست‌نخورده بماند:

```bash
git fetch origin --tags
git checkout arena/01a08a50-srip
git rm -r --ignore-unmatch docs/srip2
git checkout backup-platform-2026-09-10 -- docs/srip2
git commit -m "rollback: بازگرداندن docs/srip2 به بکاپ 2026-09-10"
git push origin arena/01a08a50-srip
bash scripts/publish-live.sh    # انتشار بدون merge روی همان URL
```

## سناریو ۳ — فقط یک فایل/پوشهٔ خاص را از بکاپ برداشتن

```bash
git fetch origin --tags
git checkout backup-platform-2026-09-10 -- <مسیر فایل یا پوشه>
git commit -m "rollback جزئی از بکاپ 2026-09-10"
```

## دانلود کپی کامل (بدون git)

از صفحهٔ Release در گیت‌هاب:
**Releases → `backup-platform-2026-09-10` → Source code (zip)**

این zip کل پلتفرم را همان‌طور که در 2026-09-10 بود (شامل `docs/srip2` زنده) در بر دارد.

---

*این فایل بعد از گرفتن پشتیبان به مخزن اضافه شده و خودش بخشی از تگ پشتیبان نیست؛
محتوای تگ، دقیقاً وضعیتِ زندهٔ پلتفرم در لحظهٔ بکاپ است.*
