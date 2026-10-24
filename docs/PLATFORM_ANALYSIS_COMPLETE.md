# تحلیل کامل و دقیق پلتفرم SRIP — همهٔ ماژول‌ها با جزئیات

> **نسخه:** 2026-09-09 — منطبق با کد مستقر در `arena/01a04f6d-srip` و خروجی زندهٔ `https://soheilsss7.github.io/Srip/srip2`  
> **مبنای تحلیلی:** `apps/api` (NestJS + Prisma + PostgreSQL), `apps/web-ux` (Next.js 16 + Turbopack, استاتیک اکسپورت), `mock-api.mjs` (Service Worker دمو), `docs/*` و `prisma/schema.prisma`  
> **اصل معماری:** **رابطه‌محور · شبکه‌محور · هوش‌محور** — هر موجودیت فرعی (جلسه، اقدام، تعهد، پروژه، فرصت، عموم) به یک *رابطه* یا *سازمان* متصل است و از امتیاز سلامت/ریسک و شبکهٔ روابط تغذیه می‌کند.

---

## ۰) نمای کل و فهرست ماژول‌ها

```
app-shell (workspace, RBAC, Scope) 
  ├─ خانه: پیشخوان (داشبورد)
  ├─ مخاطب‌ها: سازمان‌ها، اشخاص
  ├─ روابط: روابط (بازاری/غیربازاری + نقطه ورود)، شبکهٔ روابط، عموم‌ها، تعاملات، معرفی‌ها
  ├─ کار و اجرا: جلسات، تقویم، اقدامات، تعهدات، پروژه‌ها، فرصت‌ها، نیازمندی‌ها
  ├─ هوش: هوشمندی و توصیه‌ها، هیئت‌مدیره (Board)، دستیار هوشمند، تحلیل راهبردی (Strategy)
  ├─ اتوماسیون و هماهنگی: گردش کار و تأییدها، مرکز دانش (اسناد)، داده و کیفیت، تبادل داده، تنظیمات من، نشست‌های من
  └─ سیستم (مرکز سیستم /admin): کاربران و مجوزها، ممیزی، پرچم‌ها، امتیازدهی، برچسب‌ها، فیلدهای سفارشی، معیارها، حاکمیت، امنیت، داده و یکپارچه‌سازی، پایش
```

**۶ خانهٔ کاری + مرکز سیستم** — منوی واحد بدون سوییچ ساده/کامل؛ هر نقش فقط موارد مجازش را می‌بیند (فیلترینگ بر اساس `permissions`).

---

## ۱) ستون فقرات — احراز هویت، فضای کاری و مجوزها

### ۱-۱. Auth & Session
*   **ماژول‌های API:** `auth`, `sessions`, `mfa`, `common/mfa`, `common/guards`, `common/security`  
*   **توکن:** Access JWT (کوتاه‌مدت) + Refresh JWT (httpOnly) + `jti` ثبت و ابطال (`revokedJtis` در DB/mock).  
*   **MFA:** TOTP (اختیاری) — صفحهٔ `/mfa`، صدور backup codes.  
*   **نشست‌ها:** `GET /sessions`, `DELETE /sessions/:id`, نمایش دستگاه/مرورگر/OS/IP.  
*   **فرانت:** `/login`, `/mfa`, `/forgot-password`, `/password-reset`, `/register` + `probeMe()` با timeout ۴.۵ ثانیه برای حالت استاتیک (اگر API پاسخ ندهد، veil «در حال بررسی نشست…» قفل نمی‌کند).

### ۱-۲. Workspace & Scope
*   **کامپوننت:** `app/_components/workspace.tsx` — `WorkspaceProvider` هویت (`/auth/me`)، نقش (`ROLE_LABELS`: SUPER_ADMIN … READ_ONLY)، محدودهٔ سازمانی (`scopeId`) و `can(permission)` را فراهم می‌کند.  
*   **مالک (`*`)** = `isOwner` — می‌تواند `scopeId='all'` ببیند؛ مستأجر فقط سازمان(های) عضویت خودش.  
*   **ScopeBadge / ScopeChip** در هدر و هر صفحه؛ فیلتر `?organizationId=` در همهٔ لیست‌ها اعمال می‌شود (server-side).  
*   **امنیت:** هر درخواست API مجوز را دوباره چک می‌کند؛ UI فقط فیلتر نمایش است.

### ۱-۳. RBAC — ده نقش + کاتالوگ مجوز
*   **نقش‌ها (ROLE_CATALOG):** `SUPER_ADMIN` (*), `HOLDING_ADMIN/EXECUTIVE`, `SUBSIDIARY_ADMIN/EXECUTIVE`, `RELATIONSHIP_MANAGER`, `PROJECT_MANAGER`, `ANALYST`, `STANDARD_USER`, `READ_ONLY`.  
*   **مجوزها (~۴۰ کلید):** `dashboard.read`, `organization.read/write`, `person.read/write`, `relationship.read/write`, `publics.read/write`, `strategy.read/write`, `network.read`, `interaction/meeting/action/commitment/project/opportunity.read/write`, `workflow/approval.read`, `data.*`, `analytics.read`, `ai.query`, `admin.users`, `audit.read`, …  
*   **گروه‌بندی فارسی:** `PERMISSION_GROUPS_FA` (عمومی، هسته، جلسات، …، عموم‌ها، تحلیل راهبردی).  
*   **UI:** مرکز سیستم → نقش‌ها/مجوزها با توضیح فارسی؛ واژه‌نامهٔ «؟» در سایدبار هر مسیر را یک‌خطی توضیح می‌دهد.

### ۱-۴. آلارم‌های این لایه
*   `runtime-banner` «اطلاعات نقش/محدوده از API دریافت نشد؛ سرور مرجع نهایی است.»  
*   `auth-gate` veil تا زمان probe؛ بنر `engine-card` (online/degraded/pending).

---

## ۲) هستهٔ دامنه — سازمان، شخص، رابطه، شبکه

### ۲-۱. سازمان‌ها (`/organizations`)
*   **موجودیت:** `Organization` (id, name, type, industry, country, strategicImportance, parentId → هلدینگ/تابعه, deletedAt, ownerId)  
*   **API:** `GET /organizations`, `GET /organizations/:id`, `POST`, `PATCH`, `DELETE` (soft), `GET /organizations/:id/health`, `GET /organizations/:id/relationships`.  
*   **UI:** فهرست با فیلتر نوع/صنعت، کارت سلامت، صفحهٔ جزئیات با تب روابط/اشخاص/پروژه‌ها/تعاملات، مودال ایجاد.  
*   **امتیاز سلامت سازمان:** میانگین سلامت روابط فعالش.

### ۲-۲. اشخاص (`/people`)
*   **موجودیت:** `Person` (نام، سمت، بخش، ایمیل، تلفن، organizationId, influenceScore, status) + `PersonRelationship` (نقش تصمیم: ECONOMIC_BUYER, CHAMPION, BLOCKER …)  
*   **API:** `GET /people`, `GET /people/:id`, `POST`, `PATCH`, `DELETE`, `GET /people/:id/relationships`.  
*   **UI:** فهرست با فیلتر سازمان/بخش، پروفایل با مسیرهای ارتباطی، پیشنهاد معرفی.

### ۲-۳. روابط (`/relationships`) — **به‌روزرسانی ۲۰۲۶-۰۹-۰۸: تفکیک بازاری/غیربازاری**
*   **موجودیت `Relationship`:** `sourceOrganizationId`, `targetOrganizationId`, `relationshipType` (STRATEGIC_PARTNERSHIP, BANKING, CUSTOMER, SUPPLY, INVESTMENT …), `status` (PROSPECTIVE/ACTIVE/WATCH/AT_RISK/DORMANT/ARCHIVED), `lifecycleStage`, `healthScore/strategicScore/riskScore/trustScore/influenceScore/opportunityScore/resilienceScore/engagementScore`, `lastInteractionAt`, `nextActionAt`, `cadenceDays`, **جدید:** `marketKind` (MARKET/NON_MARKET/HYBRID), `isMarketEntry` (Boolean), `marketSegment` (varchar 120).  
*   **مایگریشن:** `20260908120000_relationship_market_kind` — enum + ۶ ایندکس (`marketKind`, `isMarketEntry`, `marketSegment`, ترکیبی).  
*   **سرویس:** `list()` با `whereBase` شامل `marketKind` (exact), `isMarketEntry` (bool), `marketSegment` (contains insensitive) + `count` با همان `whereBase`؛ `create()` sanitizes با پیش‌فرض `MARKET`; `update()` whitelist شامل ۳ فیلد جدید با ولیدیشن.  
*   **کنترلر:** DTOها `marketKind?`, `isMarketEntry?`, `marketSegment?`؛ `GET /relationships?organizationId=&status=&lifecycleStage=&marketKind=&isMarketEntry=&marketSegment=`.  
*   **Mock:** ۸ رابطه نمونه (۵ MARKET، ۱ HYBRID، ۱ NON_MARKET ورودی، ۱ MARKET همکاری) + `GET /relationships/alerts` با انواع `MARKET_HEALTH/MARKET_RISK/NONMARKET_HEALTH/HYBRID_RISK/ENTRY_STALE/MARKET_STALE/CADENCE_BREAK/MISSING_ENTRY` و summary.  
*   **UI — فهرست:** استریپ هشدار (danger/warning/info)، آمارکارت‌های `کل/بازاری/غیربازاری/نقاط ورود/در معرض ریسک`، پنل **«نقشهٔ بازار — کجا ورود ما به بازار است؟»** (سگمنت‌ها، ورودی‌های بازاری/غیربازاری، هشدار ورودی‌ها)، جدول با ستون `جنسیت بازار` (Store/Landmark/Layers) + `ورودی` (DoorOpen) + `سگمنت`، فیلترهای چیپ بازاری/ورودی/سگمنت، مرتب‌سازی سلامت/ریسک/تعامل. مودال ایجاد شامل select جنسیت + چک ورودی + input سگمنت.  
*   **UI — جزئیات `[id]`:** هدر `... · بازاری · نقطهٔ ورود`، کارت بازار با نوار رنگی و هشدار «اختلال در گره غیربازاری کل سگمنت را می‌بندد.»، کنترل‌های PATCH inline، گرید اطلاعات شامل جنسیت/سگمنت/ورودی، تایم‌لاین، سرمایهٔ رابطه، پالس، برنامهٔ ۹۰ روزه، حافظهٔ نهادی.  
*   **آلارم‌ها:** استریپ فهرست، هشدار ورودی راکد (خطر)، سگمنت بدون ورودی (هشدار)، کیدنس شکسته، بدون اقدام بعدی.

### ۲-۴. شبکهٔ روابط (`/network`)
*   **API:** `GET /network/graph`, `GET /network/capital`, `GET /analytics/network` (networkCapital, strategicRelationshipIndex, resilience).  
*   **UI:** گراف تعاملی با رنگ دستهٔ عموم‌ها، حلقهٔ طلایی «خود شرکت»، فیلتر دسته، مسیرهای ارتباطی، پیشنهاد معرفی (deterministic, بدون سرویس خارجی).  
*   **آلارم:** گره‌های پرریسک با حلقهٔ قرمز.

### ۲-۵. تعاملات (`/interactions`) و معرفی‌ها (`/referrals`)
*   **Interaction:** نوع CALL/EMAIL/MEETING/NOTE/MESSAGE، subject/summary/outcome، sentiment، followUp.  
*   **Referral:** مسیر معرفی با وضعیت PENDING/ACCEPTED/COMPLETED و گردش‌کار خودکار.

---

## ۳) کار و اجرا — جلسه تا پروژه

### ۳-۱. جلسات (`/meetings`, `/calendar`)
*   **موجودیت:** `Meeting` (title, objective, agenda, outcome, startAt/endAt, organizationId, relationshipId, participants, attachments).  
*   **API:** `GET /meetings?upcoming=&organizationId=`, `POST`, `PATCH`, `GET /meetings/:id/participants`, `POST /meetings/:id/outcome`.  
*   **UI:** فهرست + تقویم، صفحهٔ جزئیات با بریف، شرکت‌کنندگان، اقدامات/تعهدات استخراج‌شده، خلاصهٔ AI.

### ۳-۲. اقدامات (`/actions`) و تعهدات (`/commitments`)
*   **Action:** title, status (OPEN/IN_PROGRESS/DONE/BLOCKED), priority, dueAt, relationshipId, owner.  
*   **Commitment:** description, status (OPEN/OVERDUE/FULFILLED), risk, dueAt, direction.  
*   **آلارم:** `overdue` (موعد گذشته) و `dueSoon` (۳ روز) در پیشخوان؛ `wf-alert` در جزئیات.

### ۳-۳. پروژه‌ها (`/projects`), فرصت‌ها (`/opportunities`), نیازمندی‌ها (`/requirements`)
*   **Project:** name, objective, description, status, priority, organizationId, owner, dates, milestones, requirements, risks.  
*   **Opportunity:** name, status (IDENTIFIED/QUALIFYING/WON/LOST), probability, value, expectedDate, relationshipId, projectId.  
*   **آلارم:** فرصت‌های باز با `valueAtRisk` در سرمایهٔ رابطه؛ پروژه‌های عقب‌افتاده.

---

## ۴) عموم‌ها (Publics) — شناسنامه، گروه‌ها، پوشش، شکاف‌ها

> **وضعیت پس از پاک‌سازی پارس:** تمام یادداشت‌های گروه‌ها از «مرجعیت AI کشور / ۱۲ VC پارس» به الگوی **عمومی و قابل‌تنظیم per-tenant** تبدیل شد؛ `docs/عموم‌ها-extracted.md` به‌عنوان **نمونهٔ موردیِ هلدینگِ چندبخشی** برچسب خورد و یک نسخهٔ عمومیِ بدون نامِ خاص ایجاد شد.

### ۴-۱. کاتالوگ و قالب‌ها
*   **کاتالوگ:** `PUBLIC_CATEGORY_FA` (۶ دسته: داخلی، نهادی و حاکمیتی، علمی/دانشگاهی، اقتصادی/سرمایه‌گذاری، رسانه‌ای/عمومی، اکوسیستم فناوری)، `PUBLIC_LINKAGE_FA` (فعال‌کننده، کارکردی-ورودی/خروجی، هنجاری، پراکنده)، `PUBLIC_STAGE_FA` (غیرعموم/نهفته/آگاه/فعال)، `PUBLIC_STANCE_FA` (بازیگر کلیدی/تأثیرگذار/حامی/ناظر).  
*   **قالب‌ها:** `PUBLICS_TEMPLATES` — پیش‌فرض `HOLDING` (هلدینگ چندبخشی) با ~۵۰ گروه نمونه در هر ۶ دسته + قالب `TECHNOLOGY` (شرکت فناور). **پس از اصلاح:** عبارت «۱۲ حوزهٔ کاری» به «حوزه‌های کاری (قابل تنظیم)» تغییر کرد؛ یادداشت‌ها از «سخنگویان مرجعیت» به «سخنگویان پیام کلیدی سازمان» عمومی شد.

### ۴-۲. شناسنامهٔ سازمان (`/publics/self/:orgId`)
*   **فیلدها:** `companyType` (الگوی شروع), `missionTopic` (مثلاً «پیشرو در فناوری‌های نوین» — **دیگر پیش‌فرضِ «مرجعیت AI کشور» ندارد**؛ placeholder عمومی «مثلاً: پیشرو در حوزهٔ فناوری»), `reviewIntervalDays`, `structure {sectors, subsidiaries, ownership}`.  
*   **UI:** تب «شناسنامه» با ویزارد ۳ قدمی، کارت «شناسنامهٔ سازمان» و جدول دسته‌ها.

### ۴-۳. گروه‌های نقشه (`/publics/groups/:orgId`)
*   **مدل:** هر گروه `id/cat/fa/link/stage/stance/kanal/note` + `source` (template/custom) + `overridden/active`.  
*   **قابلیت:** ویرایش per-org (override)، غیرفعال‌سازی (از پوشش خارج می‌شود)، بازگردانی به الگو، حذف گروه اختصاصی. یادداشت‌های گروه اکنون **عمومی و قابل ویرایش** هستند؛ «یادداشت الگو» به‌صورت جداگانه نمایش داده می‌شود.

### ۴-۴. اعضا و ارزیابی (`/publics/members`)
*   **عضو:** `groupId`, `sourceType` (organization/person/relationship/media), `sourceId`, `linkage/stage/stance`, `power/interest (۰-۱۰۰)`, `note`, `reviewDue`.  
*   **موتور پیشنهاد:** `pubSuggester` بر اساس گروه، linkage/stage/stance و قدرت/علاقه را پیشنهاد می‌دهد.  
*   **ماتریس قدرت × علاقه:** ۴ ربع (بازیگر کلیدی، تأثیرگذار، حامی، ناظر) با رنگ دسته.

### ۴-۵. پوشش (`/publics/coverage`) و شکاف‌ها (`/publics/gaps`)
*   **پوشش:** به‌تفکیک دسته، `expected/covered/members`, stages/stance, `coveragePct`, `criticalGaps`.  
*   **شکاف:** `missing` (گروه بدون عضو) / `lagging` (عضو با stage کم)، `severity` (CRITICAL…LOW)، `action`، `pathSuggestion` {route, hops, direct, note, candidates} روی شبکهٔ واقعی روابط.  
*   **خلاصهٔ مدیریتی:** متن یک‌صفحه‌ای برای هیئت‌مدیره از دادهٔ همین نقشه + دکمهٔ کپی.

### ۴-۶. آلارم‌های عموم‌ها
*   شکاف بحرانی (بازیگر کلیدیِ غایب)، عقب‌مانده، سررسید بازبینی (`reviewDue` گذشته)، پوشش < ۵۰٪. گردش‌کار خودکار: `PUBLIC_MEMBER_ADDED`, `PUBLIC_STAGE_CHANGED`, `PUBLIC_GAP_DETECTED`, `PUBLIC_REVIEW_DUE` → اقدام + اعلان.

---

## ۵) هوش — تحلیل، توصیه، هیئت‌مدیره و دستیار

### ۵-۱. هوشمندی (`/intelligence`)
*   موتور `risk-signals` (تحلیل ریسک رابطه)، `knowledge-transfer` (بریف جانشین + چه کسی چه کسی را می‌شناسد)، `pulse-survey` (۳ پرسش ۹۰ روزه با حلقهٔ بسته).

### ۵-۲. توصیه‌ها (`/recommendations`)
*   `GET /recommendations`, `GET /analytics/recommendations/funnel` (viewed→accepted→actionCreated→completed→outcome) + قیف تصویری در داشبورد.

### ۵-۳. هیئت‌مدیره (`/board`)
*   سرمایهٔ شبکه، شاخص رابطهٔ راهبردی، بازده سرمایهٔ رابطه (ROI)، تاب‌آوری پرتفوی، ریسک تک‌نقطه.

### ۵-۴. دستیار هوشمند (`/ai`)
*   **Gateway:** `POST /ai/query` با `intent` (MEETING_BRIEF, NETWORK_EXPLORER, RECOMMENDATION, …) و `deterministic` fallback (بدون مدل خارجی).  
*   **UI:** `/ai`, `/ai-executive-brief` با استریم پاسخ و ارجاع به شواهد.

### ۵-۵. تحلیل راهبردی (`/strategy`)
*   موجودیت `StrategyScenario` (مفروضات، عایدی‌ها، رقبا)، شبیه‌سازی تکراری، پیش‌بینی حرکت رقیب، ورود داده از پلتفرم خارجی، سناریوهای Gate 11 (از `docs/STRATEGY-GATE11-*.md`).

---

## ۶) دانش و اسناد

*   **ماژول‌ها:** `documents` (upload, signed-url, indexing, چانک‌بندی), `knowledge` (KB بر اساس `kb-publics`, `kb-strategy`, …), `search` (جستجوی سراسری با relevance).  
*   **UI:** `/documents`, `/documents/files`, `/knowledge`, `/search` (⌘K).

---

## ۷) اتوماسیون — گردش کار و تأییدها

*   **Workflows:** `GET /workflows`, `POST /workflows/:id/run`, `GET /workflows/executions`. ۲۳ گردش‌کار seed (از `seedWorkflowDefs`): از `PERSON_CREATED` تا `STRATEGY_SIMULATED` + ۴ مورد ویژهٔ عموم‌ها. هر کدام `trigger` + `conditions` + `actions` (CREATE_ACTION, CREATE_NOTIFICATION, CREATE_COMMITMENT, …).  
*   **Approvals:** `GET /approvals`, `POST /approvals/:id/approve|reject`.  
*   **آلارم:** `wfFailed` (FAILED/ERROR) در داشبورد.

---

## ۸) داده و کیفیت

*   **ماژول‌ها:** `data-management` (مرکز داده), `data-quality` (امتیاز کیفیت، dedup، lineage), `integrations` (sync با سامانه‌های بیرونی), `custom-fields` (فیلدهای پویا), `criteria` (۴۷ معیار ارزیابی با `sync-criteria-catalog`), `tags`, `scoring` (قواعد امتیازدهی مجدد).  
*   **Lifecycle & Privacy:** `data-lifecycle`, `privacy`, `retention` (برش زمانی، انتشار تدریجی)، `enterprise` (حاکمیت).  
*   **تبادل داده:** `/data-exchange` (ورود/خروج CSV/Excel/JSON).

---

## ۹) سازمان و امنیت

*   **Security:** `/security`, `/security-events` (login_success/failure, permission_denied, suspicious_access), `security` service با rate-limit و audit.  
*   **Governance & Enterprise:** `/governance`, `/enterprise` (سیاست‌ها، ریسک سازمانی).  
*   **Privacy:** `/privacy` (GDPR-like، درخواست حذف، erasure).  

---

## ۱۰) پایش و سلامت

*   **Monitoring:** `/monitoring` (events, prometheus text), `/metrics`, `/health`, `/observability`, `/analytics` (summary, network, funnel, workflows, holding).  
*   **آلارم:** `availabilityPercent`, `cpuPercent`, `queue lag` (>30s) در observability.

---

## ۱۱) پیشخوان (Dashboard) — «امروز چه کاری مهم است؟»

*   **Action Center:** اقدامات عقب‌افتاده، سررسید ۳ روز، جلسهٔ بعدی (با لینک مستقیم).  
*   **KPI Grid:** ۸ کارت (سازمان‌ها، اشخاص، روابط فعال، جلسات، اقدامات باز، تعهدات باز، پروژه‌ها، فرصت‌ها) با شمارش زنده.  
*   **نقشهٔ بازار (جدید):** `بازاری / غیربازاری / نقاط ورود / هیبرید` + آلارم هوشمند (خطر/هشدار/ورودی).  
*   **سرمایهٔ شبکه و SRI، قیف پیشنهادها، گردش‌کار، جلسات پیش رو، هلدینگ/سلامت.**

---

## ۱۲) معماری فنی

*   **API:** NestJS 10، Prisma 5، PostgreSQL، Redis + BullMQ (jobs), OpenAPI (`/docs-json`).  
*   **Web-UX:** Next.js 16 (Turbopack), React 19, `output: export` برای Pages، `basePath=/Srip/srip2`, `NEXT_PUBLIC_API_URL=/Srip/srip2/api/v1` (SW mock).  
*   **Design System:** `@srip/design-system` (Card, Badge, EmptyState, Button).  
*   **Mock:** `scripts/mock-api.mjs` + `public/sw.js` (۷۶۰KB) — همهٔ endpointهای بالا را deterministic شبیه‌سازی می‌کند؛ `DEMO_MOCK_VERSION` داخل bundle تزریق می‌شود تا SW کهنه خودکار به‌روز شود.  
*   **Build:** `SRIP_PAGES=1 SRIP_BASE_PATH=/Srip/srip2 NEXT_PUBLIC_MOCK_VERSION=... node scripts/next-build.mjs` → `out/` → `docs/srip2` + `.nojekyll`.

---

## ۱۳) پاک‌سازی «اختصاصیِ پارس» — چه چیزی عمومی شد؟

| محل | قبل (اختصاصیِ پارس) | بعد (عمومی / per-tenant) |
|---|---|---|
| `docs/عموم‌ها-extracted.md` | متن اصلی با «هلدینگ پارس، ۱۲ VC، مرجعیت AI کشور» | هدر جدید: «**نمونهٔ موردی — هلدینگ چندبخشی (۱۲ حوزه)**» + نسخهٔ عمومی `docs/PUBLICS-TEMPLATE-GENERIC.md` بدون نام خاص |
| `PUBLICS_TEMPLATES.HOLDING` note | «پوشش ۱۲ حوزهٔ کاری در هر ۶ دسته» | «پوشش حوزه‌های کاری در هر ۶ دسته (قابل تنظیم)» |
| گروه‌های `h-i3`, `h-i5`, `h-i9` | «۱۲ حوزهٔ کاری» | «حوزه‌های کاری» |
| `h-i2` note | «سخنگویان طبیعی مرجعیت» | «سخنگویان طبیعی پیام کلیدی سازمان» |
| `h-a6` note | «پوشش «مرجعیت ملی» نه فقط تهرانی» | «پوشش ملی نه فقط تهرانی» |
| `app/publics/page.tsx` placeholder | `placeholder="مثلاً: مرجعیت هوش مصنوعی کشور"` | `placeholder="مثلاً: پیشرو در فناوری‌های نوین کشور"` |
| `DB.publicsSelf` seed org-1/2 | `missionTopic: 'سرمایه‌گذاری پیشرو...'` (قبلاً عمومی بود، حفظ شد) | همان — **بدون تغییر** (قبلاً عمومی بود) |
| `mock-api` org-3 demo | `بانک ملّی پارس` (نام دمو) | حفظ به‌عنوان **دادهٔ دمو** با برچسب «(دمو)» در UI — در صورت نیاز per-tenant از طریق `PUT /publics/self/:orgId` قابل بازنویسی است |
| `docs/PUBLICS-MASTER-PLAN.md` | «مثل ۱۲ VC پارس» | «مثل حوزه‌های کاری هلدینگ (قابل تنظیم)» |

**اصل جدید:** هیچ رشتهٔ «پارس» یا «۱۲ VC» به‌صورت hard-coded در منطق باقی نماند؛ همه از `missionTopic` و `sectors/subsidiaries`ِ هر سازمان خوانده می‌شود. فایل `عموم‌ها-extracted.md` همچنان به‌عنوان مرجع تاریخیِ نگارش اولیه حفظ شد اما در صفحهٔ عموم‌ها دیگر به‌عنوان متن راهنما نمایش داده نمی‌شود؛ راهنمای داخل خود صفحه (tooltip/placeholder) اکنون عمومی است.

---

## ۱۴) پوشش هشدارها — چک‌لیست نهایی

| ماژول | هشدار فعال | مکان نمایش |
|---|---|---|
| روابط | سلامت <۵۵ / ریسک≥۴۰ / کیدنس شکسته / بدون اقدام بعدی / سگمنت بدون ورودی | استریپ فهرست + کارت بازار در جزئیات + داشبورد |
| عموم‌ها | شکاف بحرانی / عقب‌مانده / سررسید بازبینی / پوشش پایین | تب‌های پوشش/شکاف‌ها + استریپ داشبورد |
| اقدامات/تعهدات | overdue / dueSoon (۳ روز) | Action Center پیشخوان + wf-alert |
| جلسات | بدون نتیجه / بدون اقدام بعدی | تایم‌لاین رابطه |
| گردش کار | FAILED/ERROR | داشبورد (wfFailed) |
| داده و کیفیت | duplicate / missing owner / coverage gap | مرکز داده |
| امنیت | login_failure / suspicious_access | /security-events |
| پایش | queue lag, cpu, availability | /observability |

همهٔ هشدارها **دلیل‌دار** هستند (why) و به **اقدام** لینک می‌دهند (CTA).

---

## ۱۵) استقرار — چگونه مستقیم و قابل ویرایش بماند؟

*   برنچ `arena/01a04f6d-srip` متصل به Pages (`/docs`).  
*   هر انتشار: `bash scripts/release-ux.sh` (SW → build → `docs/srip2`) سپس `git push origin HEAD:arena/01a04f6d-srip` (fast-forward، بدون merge).  
*   نسخهٔ `DEMO_MOCK_VERSION` در هر انتشار عوض می‌شود تا مرورگر SW کهنه را دور بریزد.

---

*این تحلیل بر اساس خوانش مستقیم کد و خروجی زنده نوشته شده؛ هر بخش با لینک به فایل مرجع قابل راستی‌آزمایی است.*
