# پلن جامع یکپارچه‌سازی و کاهش پیچیدگی پلتفرم SRIP — سند زندهٔ اجرا

نسخه: ۲۰۲۶-۰۹-۱۰ (اسپرینت ۱) · مبتنی بر سند تحلیلی SRIP و ممیزی `module-status.md`
اصل راهنما: **هیچ داده، فیچر یا منطق کسب‌وکاری حذف نمی‌شود.** هدف: حذف تکرار، یکپارچه‌سازی نمایش، و یک منبع واحد حقیقت برای هر مفهوم.

> این سند مرجع زنده است. با پیشرفت هر فاز، فقط ستون «وضعیت» و بخش «گذشتهٔ اجرا» به‌روزرسانی می‌شود؛ نسخهٔ جدید فایل ساخته نمی‌شود.

## واقعیت‌های کدباز که پلن بر آن‌ها سوار می‌شود

| واقعیت | جزئیات | پیامد برای پلن |
|---|---|---|
| انتشار عمومی = GitHub Pages استاتیک | `web-ux` با `SRIP_PAGES=1` → `out/` → `docs/srip2/`؛ سرویس‌کارگر `sw.js` (تولیدشده از `mock-api.mjs`) تمام `/api/v1/*` را در مرورگر جواب می‌دهد | فاز ۱ نمی‌تواند «حذف کامل mock» را همین امروز اجرا کند؛ طبق بند ۱-۳ پلن، این محدودیت صریحاً در **ADR-0010** ثبت شد و مسیر همگرایی تعریف شد |
| API واقعی NestJS+Prisma موجود و پرمخاطب است | ۴۴ کنترلر، ۴۰ فایل تست unit، CI کامل (quality/api-tests/security-static) | فازهای ۲/۳/۴ روی API واقعی پیاده می‌شوند تا با حذف mock در آینده چیزی از دست نرود |
| ۴ ماژول فقط در mock زنده‌اند | عموم‌ها، هیئت‌مدیره، تحلیل راهبردی، دانش (ممیزی ردیف ۱۷/۲۰/۲۲/۲۴) | فاز ۶ برای هرکدام ADR مرز دامنه می‌خواهد؛ مهاجرت به API واقعی Sprint 2-3 |
| الگوی موفق «یک منبع داده» از قبل وجود دارد | `sync-criteria-catalog.mjs`: کاتالوگ ۴۷ معیار از `apps/api` → `criteria-data.json` → تزریق در SW | همان الگو برای دادهٔ دمو و منطق مشترک (امتیاز/هشدار) تکرار می‌شود |

## فهرست فازها و وضعیت اجرا

| فاز | عنوان | پیش‌نیاز | وضعیت | خروجی |
|---|---|---|---|---|
| ۰ | توقف و ممیزی کامل | — | ✅ **انجام شد (S1)** | `docs/architecture/module-status.md` |
| ۱ | حذف موازی‌کاری mock/real | فاز ۰ | 🔶 **S1: ADR-0010 + پرچم دمو · S2: استخراج دادهٔ دمو به منبع واحد** | یک منبع داده واحد |
| ۲ | یکپارچه‌سازی مدل امتیازدهی | فاز ۱ | 🔶 **S1: EntityScore در API + دمو · S2: مهاجرت کامل ستون‌ها** | `EntityScore` مشترک |
| ۳ | یکپارچه‌سازی Alerts | فاز ۲ | 🔶 **S1: مدل+سرویس+`/alerts`+`AlertBanner` · S2: مهاجرت ۸ تشخیص‌گر** | `AlertService` مرکزی |
| ۴ | بازطراحی RBAC | مستقل | 🔶 **S1: مدل `UserAccess`+سرویس+migration map · S2: سوییچ `can()`** | scope × access × function |
| ۵ | بازطراحی IA/ناوبری | فاز ۴ | ✅ **انجام شد (S1)** | `_lib/nav-structure.ts` تک‌منبع |
| ۶ | مرز دامنهٔ Publics و ماژول‌های بزرگ | فاز ۲ | ✅ **ADR-0009/0011 ثبت شد · مهاجرت کد: S2** | ADR مرز هر دامنه |
| ۷ | نظم مستندات ریشهٔ ریپو | مستقل | ✅ **انجام شد (S1)** | `/docs/adr`, `/docs/history` |
| ۸ | تست و Definition of Done | همه | 🔶 **S1: DoD هر تغییر رعایت شد · تکمیل رگرسیون رفتار: S2** | چک‌لیست پذیرش |

---

## فاز ۰ — ممیزی کامل ✅ (انجام شد — ۲۰۲۶-۰۹-۱۰)

خروجی: **`docs/architecture/module-status.md`** — جدول ۳۶ ردیفی با شواهد کد (نه ادعای manifest).
یافته‌های کلیدی:
1. **عموم‌ها، هیئت‌مدیره، تحلیل راهبردی، دانش فقط در mock وجود دارند** — در API واقعی کنترلری ندارند (خطر واگرایی دمو/production).
2. هشدارها ۸ پیاده‌سازی مجزا دارند؛ امتیازدهی composite واحد ندارد.
3. RBAC ده نقش سلسله‌مراتبی دارد که سه بعد مستقل را مخلوط می‌کند.
4. هیچ ماژولی Stub مطلق نیست؛ ادعاهای نادرست «COMPLETION» در فایل‌های ریشه ← فاز ۷.

**قاعدهٔ سخت‌گیرانه از این پس:** ماژولی که «فقط دمو» است، در هیچ سند جدیدی «تکمیل‌شده» نامیده نمی‌شود؛ وضعیت دقیقش فقط در `module-status.md` می‌آید.

## فاز ۱ — حذف موازی‌کاری mock/real 🔶

### Sprint 1 (انجام‌شده)
- **ADR-0010**: تصمیم صریح دربارهٔ استقرار استاتیک GitHub Pages + مسیر همگرایی (بدون mock ضمنیِ بی‌تصمیم).
- پرچم محیطی `SRIP_DEMO_MODE` روی `apps/api` (config + `/health` metadata) — زیرساخت حالت دمو روی API واقعی.

### Sprint 2 (تسک‌های فایل‌به‌فایل)
| # | تسک | فایل‌ها | DoD |
|---|---|---|---|
| 1-۱ | استخراج دادهٔ دمو به بستهٔ واحد | `packages/demo-data/` (جدید) + `apps/web-ux/scripts/demo-data.json` (تولیدشده) | هر رکورد دمو فقط یک‌جا تعریف شود؛ `seed-demo.ts` و `mock-api.mjs` هر دو از آن بخوانند |
| 1-۲ | seed واقعی از همان منبع | `apps/api/prisma/seed-demo.ts` | `pnpm prisma:seed:demo` روی Postgres واقعی همان محتوای دمو را بنویسد |
| 1-۳ | منطق مشترک امتیاز/هشدار در بستهٔ مشترک | `packages/domain-rules/` (جدید؛ pure TS) | فرمول composite و آستانه‌های هشدار فقط یک‌جا تعریف شوند؛ API و SW هر دو مصرف‌کننده باشند (الگوی `criteria-data`) |
| 1-۴ | حذف `mock-api.mjs`/`sw.js` | فقط پس از استقرار API دمو عمومی (Railway/Fly/Cloudflare Workers) و تأیید staging | چک‌لیست تک‌تک endpointها (از جمله `/relationships/alerts`, ۸ kind هشدار, `pubSuggester`) معادل واقعی داشته باشند |

## فاز ۲ — مدل امتیازدهی واحد (EntityScore) 🔶

### Sprint 1 (انجام‌شده)
- **Prisma**: مدل `EntityScore` + enum `EntityScoreType` (RELATIONSHIP / PUBLIC_GROUP / PUBLIC_MEMBER) + مهاجرت additive — `apps/api/prisma/schema.prisma`.
- **API**: `apps/api/src/entity-scores/` — سرویس محاسبهٔ composite با وزن‌های نسخه‌دار (`formulaVersion`)، endpoint‌های `GET /entity-scores` و `POST /entity-scores/recalculate`.
- **دمو**: `mock-api.mjs` همان فرمول را روی پاسخ‌های relationship (فیلدهای `compositeScore`/`scoreFactors` — افزودنی، بدون حذف ۸ ستون) و اعضای عموم‌ها اعمال می‌کند.
- **UI**: کارت/فهرست روابط فقط composite را نشان می‌دهد؛ جزئیات رابطه تب «تفکیک امتیاز» دارد.

فرمول (پیش‌فرض‌ها؛ قابل تنظیم از `ScoreVersion`):
```
composite = Σ (factor.value × factor.weight) / Σ weights     // risk معکوس وارد می‌شود
health .25 · risk .20 · strategic .15 · trust .15 · engagement .10 · influence .05 · opportunity .05 · resilience .05
```

### Sprint 2
| # | تسک | DoD |
|---|---|---|
| 2-۱ | ۸ ستون قدیمی `Relationship` به‌صورت generated/read-only از `EntityScore` پر شوند | migration نرم؛ هیچ داده‌ای گم نشود؛ رگرسیون: خروجی قدیم/جدید روی همان seed یکسان |
| 2-۲ | عموم‌ها: `coveragePct`/`power-interest` → `EntityScore(PUBLIC_GROUP/PUBLIC_MEMBER)` | داشبورد و Alert Engine هر دو دامنه را بدون کد تکراری پوشش دهند |
| 2-۳ | وزن‌ها per-tenant از `ScoreCalibration` (ساختار موجود) | تغییر وزن بدون انتشار کد |

## فاز ۳ — هشدار یکپارچه 🔶

### Sprint 1 (انجام‌شده)
- **Prisma**: مدل `Alert` + enum‌های `AlertModule` (۹ ماژول) و `AlertSeverity` — additive.
- **API**: `apps/api/src/alerts/` — `AlertService` (create/resolve/list با فیلتر module/severity) + تشخیص‌گرهای RELATIONSHIP/ACTION/COMMITMENT + `GET /api/v1/alerts`.
- **دمو**: endpoint تجمیعی `GET /api/v1/alerts` که همان منطق تشخیص پراکندهٔ موجود (روابط، شکاف عموم‌ها، اقدام/تعهد معوق، جلسه بدون نتیجه، گردش‌کار FAILED، کیفیت داده، پایش) را با شکل واحد برمی‌گرداند — **بدون حذف هیچ detector موجود**.
- **UI**: صفحهٔ مرکزی `/alerts` (فیلترپذیر بر اساس module/severity) + کامپوننت واحد `<AlertBanner>` + زنگولهٔ شمارنده در هدر.

نگاشت هشدارهای موجود (عیناً حفظ شد): سلامت<۵۵ → RELATIONSHIP/WARNING · ریسک≥۴۰ → RELATIONSHIP/CRITICAL · ۸ kind بازار (MARKET_HEALTH…) → RELATIONSHIP · شکاف بحرانی/عقب‌مانده/سررسید بازبینی → PUBLICS · overdue/dueSoon → ACTION/COMMITMENT · جلسه بدون نتیجه → MEETING · wfFailed → WORKFLOW/CRITICAL · duplicate → DATA_QUALITY · queue lag/cpu → MONITORING.

### Sprint 2
تشخیص‌گرهای باقی‌مانده (امنیت، پایش زنده) به رکورد `Alert` نوشته شوند (job زمان‌بندی‌شده/event) و صفحات ماژول به‌جای نوار اختصاصی، `AlertBanner` فیلترشده به ماژول خودشان را رندر کنند (رگرسیون رفتار قدیم الزامی).

## فاز ۴ — RBAC 🔶

### Sprint 1 (انجام‌شده)
- **Prisma**: مدل `UserAccess` + enum‌های `ScopeType`/`AccessLevel`/`FunctionalRole` — additive، بدون حذف `Role` قدیمی (rollback ممکن).
- **API**: `apps/api/src/authorization/user-access.service.ts` — `migrateRoleToAccess()` طبق جدول نگاشت ۱۰→۳بعد + محاسبهٔ مجوز از (`accessLevel` + `functionalRole` + `permissionOverrides`) + تست unit.

### Sprint 2
`can(permission)` به‌تدریج از `UserAccess` بخواند؛ پس از تأیید تطابق رفتار قدیم/جدید در staging، ستون `Role` فقط `deprecated` علامت می‌خورد (حذف نمی‌شود). UI مرکز سیستم فقط سطح `resource.*` را نشان دهد.

## فاز ۵ — IA/ناوبری ✅ (انجام شد — Sprint 1)

- **`apps/web-ux/app/_lib/nav-structure.ts`**: تنها فایل تعریف‌کنندهٔ ساختار منو (۶ خانهٔ کاری + مرکز سیستم + تب‌های موبایل) + `NAV_PERMISSION_MAP` متمرکز + `getVisibleNav()` (تابع خالص، فیلتر نمایشی بر اساس مجوز).
- `workspace.tsx` از این تک‌منبع مصرف می‌کند؛ URLها دست‌نخورده؛ حداکثر عمق ۳ سطح رعایت شده؛ Command Palette (⌘K) مسیر موازی باقی می‌ماند.
- قاعده: افزودن آیتم هشتم به «کار و اجرا» ممنوع تا شکستن به دو Workspace — در خود فایل مستند شده.

## فاز ۶ — مرز دامنهٔ ماژول‌های بزرگ ✅ (ADRها ثبت شد)

- **ADR-0009 مرز عموم‌ها**: namespace `/api/v1/publics/*` حفظ؛ امتیازها → EntityScore؛ هشدارها → Alert؛ کاتالوگ‌ها و قالب‌ها (کالای دامنه‌ای معتبر) دست‌نخورده؛ وابستگی `pathSuggestion` به `/network/graph` صریحاً ثبت شد؛ مهاجرت به API واقعی Sprint 2 پشت `FEATURE_PUBLICS`.
- **ADR-0011 هیئت‌مدیره/راهبرد/دانش**: هر سه ADR مرز + feature flag؛ هیچ کد حذف نمی‌شود.

## فاز ۷ — نظم مستندات ✅ (انجام شد — Sprint 1)

- همهٔ `PACKAGE*`, `PHASE_*`, `STAGE_*`, `WEB_FRONTEND_*` ریشه ← `docs/history/` با `git mv` (هیچ فایلی حذف نشد).
- `/docs/adr/`: ADR-0005 تا ADR-0011 + `template.md` (Context/Decision/Consequences/Status).
- `README.md` بازنویسی شد: فقط وضعیت فعلی + لینک به `docs/architecture`, `docs/adr`, `docs/history`.

## فاز ۸ — تست و Definition of Done 🔶

DoD هر تغییری از این پس (برای Sprint 1 رعایت شد):
| معیار | Sprint 1 |
|---|---|
| Unit تست برای منطق جدید | ✅ entity-scores, alerts, user-access (API) + api-tests دمو |
| Integration روی API واقعی | ✅ قرارداد همانند بقیهٔ ماژول‌ها (CI) |
| رگرسیون رفتار قدیم | 🔶 فیلدهای قدیمی حفظ شدند (افزودنی)؛ مقایسهٔ خروجی کامل: S2 |
| تست دستی UI ناوبری | ✅ build استاتیک + crawl محلی |
| Rollback plan | ✅ بکاپ `backup-platform-2026-09-10` + مهاجرت‌های additive |

## وابستگی‌ها

```
فاز ۰ ✅ ─► فاز ۱ 🔶 ─► فاز ۲ 🔶 ─► فاز ۳ 🔶 ─► فاز ۶ ✅(ADR)
                     └► فاز ۴ 🔶 ─► فاز ۵ ✅
فاز ۷ ✅ (مستقل)     فاز ۸ (همراه هر فاز)
```

## گذشتهٔ اجرا

| تاریخ | اتفاق |
|---|---|
| ۲۰۲۶-۰۹-۱۰ | Sprint 1: ممیزی ۳۶ ماژولی، nav تک‌منبع، EntityScore (API+دمو+UI)، Alert مرکزی (API+دمو+UI)، UserAccess، ADR-0005..0011، آرشیو مستندات، دادهٔ دمو غنی‌شده (عموم‌ها/روابط/تعاملات/…)، انتشار بدون merge روی `/srip2/` |
