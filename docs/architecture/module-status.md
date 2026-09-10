# وضعیت واقعی ماژول‌ها — ممیزی ۲۰۲۶-۰۹-۱۰ (فاز ۰ پلن یکپارچه‌سازی)

> این سند **منبع واحد حقیقت** برای وضعیت واقعی ماژول‌هاست — نه ادعای فایل‌های manifest.
> منابع ممیزی: `apps/api/src/**` (کنترلرهای NestJS واقعی)، `apps/web-ux/scripts/mock-api.mjs` (دموی استاتیک)،
> `apps/web-ux/app/**` (UI)، `apps/api/test/unit/**` (تست‌ها)، `apps/API_CONTRACT.json`.
> قاعده: در پایان هر اسپرینت همین جدول به‌روزرسانی می‌شود؛ فایل جدید ساخته نمی‌شود.

راهنمای ستون «وضعیت واقعی»:
- **Done** = API واقعی + UI متصل به همان API + تست دارد (در دمو و production یکسان)
- **Partial** = یا فقط در mock است، یا API واقعی دارد ولی UI دمو از mock جداگانه استفاده می‌کند، یا تست/مستند ناقص است
- **Stub** = ادعا در manifest هست ولی پیاده‌سازی واقعی نیست

## جدول ممیزی

| # | ماژول | API واقعی (NestJS) | مسیر UI | Mock (دموی استاتیک) | تست خودکار | وضعیت واقعی | یادداشت |
|---|---|---|---|---|---|---|---|
| 1 | احراز هویت و نشست (Auth & Session) | ✅ `auth/`, `auth/mfa/`, `sessions/` | `/login`, `/mfa`, `/sessions` | ✅ همان قرارداد | ✅ ۴۰ فایل unit + api-tests | **Done** | JWT+refresh+MFA در هر دو طرف یکسان |
| 2 | محدودهٔ کاری (Workspace & Scope) | ✅ `common/authorization` (scoped) | سوییچ اسکوپ در هدر | ✅ OWNER/CLIENT | ⚠️ غیرمستقیم | **Partial** | منطق scope در دو پیاده‌سازی موازی؛ فاز ۴ |
| 3 | RBAC (نقش‌ها و مجوزها) | ✅ `permissions/`, `authorization/` (۱۰ نقش) | `/admin/roles`, `/admin/permissions` | ✅ `R_READ/R_WRITE` موازی | ✅ permission-catalog.spec | **Partial** | ۱۰ نقش سلسله‌مراتبی = ۳ بعد مخلوط؛ فاز ۴ |
| 4 | سازمان‌ها | ✅ `organizations/` | `/organizations` | ✅ | ✅ phase2-domain | **Done** | |
| 5 | اشخاص | ✅ `people/` | `/people` | ✅ | ✅ | **Done** | |
| 6 | روابط | ✅ `relationships/` + `relationships/relationship-score` | `/relationships` | ✅ | ✅ lifecycle-phase-u | **Done** | ۸ ستون امتیاز مجزا؛ composite ندارد؛ فاز ۲ |
| 7 | شبکهٔ روابط | ✅ `network/` (graph, path, sna, bridges…) | `/network` | ✅ | ✅ network.service.spec | **Done** | `pathSuggestion` عموم‌ها به همین وابسته است |
| 8 | تعاملات | ✅ `interactions/` | `/interactions` | ✅ | ✅ | **Done** | |
| 9 | معرفی‌ها (Referrals) | ✅ `core-domain/` | `/referrals` | ✅ | ✅ | **Done** | |
| 10 | جلسات | ✅ `meetings/` | `/meetings` | ✅ | ✅ | **Done** | |
| 11 | تقویم | ⚠️ نمای UI روی meetings | `/calendar` | ⚠️ مشتق از `/meetings` | — | **Partial** | API اختصاصی ندارد (طراحی درست: view است، نه دامنه) |
| 12 | اقدامات | ✅ `actions/` | `/actions` | ✅ | ✅ | **Done** | overdue/dueSoon در UI محاسبه می‌شود |
| 13 | تعهدات | ✅ `commitments/` | `/commitments` | ✅ | ✅ | **Done** | |
| 14 | پروژه‌ها | ✅ `projects/` | `/projects` | ✅ | ✅ | **Done** | |
| 15 | فرصت‌ها | ✅ `opportunities/` | `/opportunities` | ✅ | ✅ | **Done** | |
| 16 | نیازمندی‌ها | ✅ `requirements/`, `projects/` | `/requirements` | ✅ | ✅ requirement-matching-phase-r | **Done** | |
| 17 | **عموم‌ها (Publics)** | ❌ **وجود ندارد** | `/publics` | ✅ کاتالوگ + شناسنامه + گروه‌ها + اعضا + پوشش + شکاف + رسانه + export | ✅ e2e/publics-ui.mjs | **Partial — فقط دمو** | مهم‌ترین شکاف فاز ۰؛ فاز ۶ و Sprint 2 |
| 18 | هوشمندی | ✅ `intelligence/` (nba, risk, coverage…) | `/intelligence` | ✅ | ✅ | **Done** | |
| 19 | توصیه‌ها | ✅ `recommendations/` | `/recommendations` | ✅ | ✅ | **Done** | |
| 20 | **هیئت‌مدیره (Board)** | ❌ **وجود ندارد** | `/board` | ✅ `/board/overview` | ❌ | **Partial — فقط دمو** | فاز ۶: تصمیم مرز دامنه |
| 21 | دستیار AI | ✅ `ai/` (deterministic gateway) | `/ai`, `/ai-executive-brief` | ✅ همان موتور قطعی | ✅ ai-pipeline.spec | **Done** | |
| 22 | **تحلیل راهبردی (Strategy)** | ❌ **وجود ندارد** | `/strategy` | ✅ نظریهٔ بازی‌ها (archetypes/scenarios) | ✅ e2e/strategy-ui.mjs | **Partial — فقط دمو** | فاز ۶: تصمیم مرز دامنه |
| 23 | اسناد | ✅ `documents/` | `/documents` | ✅ | ✅ | **Done** | |
| 24 | **دانش (Knowledge)** | ❌ **وجود ندارد** (جداست از documents) | در `/documents` | ✅ `/knowledge` | ❌ | **Partial — فقط دمو** | فاز ۶ |
| 25 | جستجو | ✅ `search/` (+saved) | `/search` | ✅ | ✅ | **Done** | |
| 26 | گردش کار | ✅ `workflows/` | `/workflows` | ✅ | ✅ workflows.spec | **Done** | ۲۳ seed در دمو |
| 27 | تأییدها | ✅ `approvals/` | `/approvals` | ✅ | ✅ | **Done** | |
| 28 | داده و کیفیت | ✅ `data-management/` (quality, duplicates, import) | `/data-quality`, `/data-management` | ✅ | ✅ phase-vwx | **Done** | |
| 29 | تبادل داده | ✅ `data-management/` (import) + `reports/` (export) | `/data-exchange` | ✅ | ✅ | **Done** | |
| 30 | امنیت | ✅ `security/` | `/security`, `/security-events` | ✅ | ✅ security specs | **Done** | |
| 31 | حاکمیت | ⚠️ پخش در `security/` + `enterprise/` | `/governance`, `/enterprise` | ✅ `/governance/compliance` | ✅ package6 | **Partial** | مرز دامنه مبهم؛ فاز ۶ |
| 32 | حریم خصوصی | ✅ `privacy/` | `/privacy`, `/data-lifecycle` | ✅ | ✅ data-lifecycle.spec | **Done** | |
| 33 | پایش | ✅ `observability/`, `metrics`, `health` | `/monitoring`, `/observability`, `/metrics`, `/health` | ✅ | ✅ | **Done** | |
| 34 | **هشدارها (cross-cutting)** | ❌ جدول/سرویس مرکزی ندارد | نوارهای پراکنده در صفحات | ⚠️ ۸ پیاده‌سازی مجزا (روابط/عموم‌ها/اقدامات/جلسات/گردش‌کار/کیفیت/امنیت/پایش) | ❌ | **Partial** | فاز ۳ این پلن |
| 35 | **امتیازدهی (cross-cutting)** | ⚠️ `Score`/`ScoreVersion` دارد ولی ۸ ستون مجزا روی Relationship؛ عموم‌ها جداست | نمایش ستون‌های مجزا | ⚠️ همان ساختار موازی | ✅ scoring-phase-s | **Partial** | فاز ۲ این پلن |
| 36 | معیارهای ارزیابی (Criteria) | ✅ `criteria/` | `/admin/criteria` + intake در صفحات | ✅ همگام با `sync-criteria-catalog.mjs` | ✅ | **Done** | ۴۷ معیار؛ الگوی موجودِ «یک منبع داده» |

## جمع‌بندی ممیزی

- **Done کامل:** ۲۴ ماژول هسته‌ای (CRUD دامنه + شبکه + هوش + امنیت + گردش کار)
- **Partial — فقط دمو (API واقعی ندارد):** عموم‌ها، هیئت‌مدیره، تحلیل راهبردی، دانش ← این‌ها در GitHub Pages زنده‌اند ولی در استقرار واقعی NestJS وجود ندارند (ریسک واگرایی دمو/production)
- **Partial — ساختاری:** RBAC (۳ بعد مخلوط)، هشدارها (۸ سیستم پراکنده)، امتیازدهی (بدون composite واحد)، حاکمیت (مرز مبهم)
- **Stub:** هیچ ماژولی Stub مطلق نیست، اما فایل‌های `*_COMPLETION`/`*_BASELINE` ریشهٔ ریپو برای ماژول‌های «فقط دمو» ادعای تکمیل دارند ← فاز ۷ این‌ها را به `docs/history/` منتقل می‌کند.

## مسیر تکمیل (پیوند به پلن)

| شکاف | فاز پلن | Sprint |
|---|---|---|
| هشدار یکپارچه (Alert مرکزی) | فاز ۳ | ۱ (این اسپرینت) |
| امتیاز مرکب واحد (EntityScore) | فاز ۲ | ۱ (این اسپرینت) |
| ناوبری تک‌منبع (nav-structure) | فاز ۵ | ۱ (این اسپرینت) |
| RBAC سه‌بعدی (scope × access × function) | فاز ۴ | ۱ (مدل+سرویس) / ۲ (سوییچ کامل) |
| عموم‌ها در API واقعی | فاز ۱ + ۶ | ۲ |
| Board / Strategy / Knowledge در API واقعی | فاز ۶ | ۲-۳ (پشت feature flag) |
| حذف موازی‌کاری کامل mock | فاز ۱ | ۲-۳ (ADR-0010) |

*آخرین به‌روزرسانی: ۲۰۲۶-۰۹-۱۰ — اسپرینت ۱ پلن یکپارچه‌سازی.*
