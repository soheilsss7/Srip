# Changelog

All notable repository releases are recorded here.

## [2026.10.11.01] — پایان مسترپلن v14 (فازهای ۱۲–۱۷)

نسخهٔ کامل: کامیت سورس b9ddb4101 · کامیت سایت 908624df8 · تگ بکاپ backup/2026.10.11-v11

### فاز ۱۲ — بازشماری v14 و چارت تیم
بازبرچسب‌گذاری همهٔ فرم‌ها به شماره‌گذاری سند v14 (۱۲.۱) · چارت تیم v14 جدول ۲۱.۳ با مهاجرت نگاشت نقش‌ها (۱۲.۲) · متون هشت‌گامی/هفت‌کاربردی و پاکسازی واژگانی «مالک»→«مسئول» (۱۲.۳+۱۲.۴).

### فاز ۱۳ — نقشهٔ عموم‌ها (۸.۳ سند v14)
وضعیت چهارم «میانجی» در چرخهٔ عموم‌ها (۱۳.۱) · فیلدهای نقشهٔ عموم‌ها روی عضو (۱۳.۲) · F04 گسترش‌یافته: کارت محیط، ذی‌نفع، عموم و رقیب (۱۳.۳) · پنل شناسایی و اولویت‌بندی عموم‌ها با شاخص ترکیبی (۱۳.۴) · نقشهٔ ۱۱ عموم سند v14 در جهان دمو + دستهٔ بین‌المللی (۱۳.۵).

### فاز ۱۴ — ارتباطات بین‌المللی (۱۰.۶)
ماژول F17/P17: مسیرهای /international (پرونده، ارجاع، پایش ماهانه، خروجی) + perms گروه بین‌المللی · چهار قاعدهٔ کنترل حقوقی ۴۰۰ (پیام محصول‌محور فقط با DD مصوب+تیم Y، اشتراک داده با هویت احرازشده، ترجمه با مرجع فارسی+بازبین، فروش فقط با مرجع مجاز F14) · صفحهٔ /international با مودال چهارتبی · باتری international-ui (۲۳ چک) · api +۲۱ چک.

### فاز ۱۵ — تکمیل پروندهٔ Due Diligence (۶.۲/۶.۳)
DD پانزده‌محوره (سه محور جدید v14: تعارض منافع، شکافت تیمی، وابستگی پلتفرمی) · تیم Y چهارگانه با بیانیهٔ مستقل · وضعیت «عدم امکان اظهارنظر» · کارت‌های متصل با وضعیت DD زنده (۱۵/۱۵ محور).

### فاز ۱۶ — رجیستری ریسک (بخش ۲۳ v14)
فرم ریسک با «نشانهٔ هشدار» الزامی + مهلت بازبینی آینده (اعتبارسنجی سرور ۴۰۰) · مودال جزئیات ریسک با نمایش نشانهٔ هشدار · جار هم‌ترازی متنی سند v6→v14 در UI · link-crawl ۶۸ صفحه/۷۳ لینک · API_CONTRACT.json (۳۳۱ روت).

### فاز ۱۷ — جار کامل، انتشار و بکاپ
- ۱۷.۱ جار کامل روی DB تازه: api 936/۰ دوبار (رفع باگ واقعی: resetDbInPlace با تصویر بذر خام SEED_PRISTINE + پاک‌سازی نرخ‌محدود) · tsc 0 · i18n 17/0 · locale 7/0 · ui-consistency 12/0 · real-data 105/0 · program 67/0 · ۲۳ باتری UI دیگر همه سبز · دکمه‌ها fail=0 (clicked=891 · pages=56).
- ۱۷.۲ bump نسخهٔ 2026.10.11.01 + بیلد کامل (تأیید در sw.js و /health).
- ۱۷.۳ انتشار ریشهٔ ساب‌دامین (کامیت 908624df8) + تأیید زندهٔ GitHub API + تگ بکاپ backup/2026.10.11-v11.
- ۱۷.۴ تیک مسترپلن + ردیف انتشار + همین CHANGELOG.

## [2026.10.05.01] — پایان برنامهٔ عملیاتی v6 (فازهای ۵–۱۱)

نسخهٔ کامل: کامیت سورس a75009ed3 · کامیت سایت 5c8335a89 · تگ بکاپ backup/2026.10.10-v10

### فاز ۵ — حاکمیت برنامه و راهبرد
چارت هدف ۳۴ نقش/۳۷ نفر (بخش ۲۱.۳) · اهداف راهبردی per-tenant با نُه مؤلفه · KPIهای مالک‌دار · دروازه‌های کنترل G0–G6 · ممیزی سه‌گانه + F11 مراحل ده‌گانهٔ انتقال سامانه.

### فاز ۶ — دادهٔ واقعی و عموم‌ها
سناریوی دمو هلدینگ پارس + محیط پارس (حساب pars) · عموم‌سازی یادداشت‌ها · حکمرانی دادهٔ per-tenant.

### فاز ۷ — هوش مصنوعی (ادغام‌یافته)
دروازهٔ AI با مسیریابی ارائه‌دهنده (لوکال/ابری، fallback) · موتور قطعی فارسی · دستیار جلسه · دستیار محتوا با کارت کامل F08 (C2PA، سهم AI، اثرانگشت انتشار).

### فاز ۸ — اصالت و منشأ
پروندهٔ اصالت F13 با سیاست اقدام چهارسطحی ۱۹.۵.۱ (بازبینی انسانی الزامی) · اثرانگشت SHA-256 سند + زنجیرهٔ منشأ + تطبیق F11.

### فاز ۹ — حکمرانی AI
F12 رجیستری هشت کاربرد ۱۹.۲ (سیزده ستون) · F17 دفتر ریسک AI با ستون‌های هشت‌گانه + شناسنامهٔ مدل · پالایش خروجی /ai/ask + هفت چک امنیتی ۱۹.۴ (تزریق، مرز، نشت، توقف ۵۰۳).

### فاز ۱۰ — فرم‌های حاکمیت
- F02 پروندهٔ Due Diligence: ۱۲ محور ۶.۲.۱/۶.۲.۲ + حق پاسخ + نظر مدیر تیم Y + گرهٔ تصویب G2
- F15 کارت آماده‌سازی سرمایه‌گذار/شریک: وضعیت DD و تعهدها زنده از مشارکت متصل
- F09 فرصت مناقصه: نتیجه فقط پس از ارسال + درس‌آموخته الزامی
- F18 کارت ورود به بازار: تصمیم GO فقط با DD تصویب‌شده
- F01 کنترل اجرا: «بلاک» نیازمند مانع، «تکمیل» نیازمند تصمیم؛ کد خودکار P01+
- F16 کارت نقش: عنوان از چارت + تأیید نهایی با اهداف ۳۰/۶۰/۹۰ و مسیر ورود
- F03 ممیزی ظرفیت فرد/دارایی: بلوغ «پیشرفته» نیازمند شاهد، ریسک «بالا» نیازمند اقدام
- F04 کارت محیط/ذی‌نفع/رقیب: ادغام عموم‌ها+رقیب + گردش F05 + هشدار فقط پس از تصویب
- F07 طرح پژوهش و داوری: دو داور مستقل الزام انتشار (حلقهٔ ۱۵.۳)، اصلاحات → نسخه+۱
- کاتالوگ فرم‌ها: ۱۶ موجود / ۲ در برنامه (ماژول‌های پلتفرمی)

### فاز ۱۱ — جار کامل، انتشار و بکاپ
جار کامل ۲۶ باتری روی بیلد تازه (همه سبز): api 877/0 · tsc 0 · i18n 17/0 · locale 7/0 · ui-consistency 12/0 · real-data 105/0 · program 65/0 · چهار باتری جدید فاز ۱۰ (dd 8 · tenders-gtm 8 · exec-role 7 · capacity-env-research 9) · ۱۵ باتری دیگر ALL GREEN · bump 2026.10.05.01 · انتشار ریشهٔ ساب‌دامین + تأیید زنده از راه GitHub API · تگ بکاپ backup/2026.10.10-v10.

### زیرساخت تست در این نسخه
preview-server: ۴۰۴ هوشمند هم‌رفتار با Pages/Plesk (سرو 404.html) + نگاشت /fonts/ + پورت از PREVIEW_PORT · باتری‌های E2E جدید فاز ۱۰ با assertionهای state-agnostic.

## [Unreleased]

### Added
- Package 7 infrastructure/DR/performance/scalability/release verification gates.
- Concurrent bounded scalability benchmark with P50/P95/P99 evidence.
- Migration preflight requiring encrypted, checksum-verified backup evidence.
- Backup scheduler locking and post-backup integrity verification.

### Hardened
- API runtime Docker image uses a non-root user and liveness health check consistently across Docker entrypoints.

## Package 8 — Testing Matrix / Security Tests / E2E / Final Audit
- Added canonical Package 8 testing and final-audit matrix.
- Added executable security regression smoke covering OWASP categories and prompt-injection controls.
- Added canonical real-backend E2E flow including meeting completion, recommendation and permission denial.
- Added final static verification gate chaining Phase 39 and Package 7 verification.
- Preserved the distinction between repository/static evidence and environment-dependent production evidence.

## Package 8.1 — Pre-Test Backend Hardening

- Bounded Data Quality diagnostics and database-side coverage counts.
- Candidate narrowing for duplicate detection before similarity scoring.
- Batched import approval processing and paginated import reports.
- Authenticated object-storage readiness probe.
- Recursive sensitive-data sanitization for error tracking.
- CI gates for lint, dependency audit and integration tests.
- Repository security policy, dependency automation and license metadata.
\n## 2026-08-25 — Web Foundation: Role/Scope-Aware Executive Workspace\n- Added server-backed `/auth/me` identity/role/permission/scope contract.\n- Added shared Web Application Shell with permission-aware navigation and organization scope selector.\n- Added Executive/Governance dashboard using real Analytics and Reporting endpoints.\n- Preserved all existing Web routes and backend/mobile artifacts; no prior feature was removed.\nEOF

cat > docs/WEB_FRONTEND_8_16_EXTENSION.md <<'EOF'
# Web Frontend Extension on Package 8.16

## Baseline rule
Package 8.16 remains the canonical baseline. This extension does not delete or replace prior Web, Mobile, API, infrastructure, documentation, tests, or manifests.

## Architecture
The Web layer is now Role/Scope-aware:
- Identity is fetched from `GET /api/v1/auth/me`.
- Navigation is filtered by returned permissions.
- The active organization scope is a UI filter only; Backend authorization remains authoritative.
- The Executive/Governance Dashboard consumes real Analytics and Reporting endpoints.
- AI is not activated by this extension; the dashboard explicitly treats AI as a future/provider-dependent capability.

## Product rules preserved
- Relationship First
- Network First
- Actionable Intelligence
- Explainable AI
- Institutional Memory
- Cross-Company Intelligence
- Executive Simplicity

## Web coverage retained
Login, MFA, Dashboard, Organizations, Organization Profile, People, Person Profile, Relationships, Relationship Profile, Network, Meetings, Calendar, Actions, Commitments, Projects, Opportunities, Intelligence, Recommendations, Reports, Notifications, Search, Knowledge, Admin, Privacy/Data Requests, Data Import/Quality, Integrations, Documents and Analytics remain in the repository.

## Verification boundary
Static TypeScript/build verification is required before this extension is considered a new baseline. Runtime API/DB verification must use an environment with dependencies and PostgreSQL/Redis available; no fake runtime PASS is reported.

## 8.18.0 — Web Core UX Completion
- Added shared Page UI primitives.
- Added admin sub-workspaces for users, roles, permissions, tags, custom fields, scoring, notification rules, integrations and audit.
- Added data-quality and production import UI against the existing `/data/*` contract.
- Added privacy, sessions and settings workspaces.
- Upgraded reporting UI to consume real report endpoints.
- Preserved all prior files; no deletion.
