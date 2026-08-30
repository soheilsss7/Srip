# SRIP — چک‌لیست اجرایی کامل ارتقای محصول ۲۰۲۶

**نسخه:** 1.0
**تاریخ:** ۳۰ اوت ۲۰۲۶
**منبع اصلی:** `docs/PRODUCT_UPGRADE_PLAN_2026.md`
**شاخه‌ی اجرایی:** `arena/01a04fd2-srip`

---

## ۰. نحوه‌ی استفاده از این سند

این فایل چک‌لیست اجرایی و قابل پیگیری برنامه‌ی ارتقای SRIP است. هر phase باید به‌ترتیب اجرا شود و تا زمانی که معیار قبولی آن کامل نشده، phase بعدی نباید به‌عنوان Done اعلام شود.

### وضعیت‌ها

- `[ ]` شروع نشده
- `[~]` در حال اجرا یا جزئی
- `[x]` تکمیل و verify شده
- `[!]` blocked یا نیازمند تصمیم/زیرساخت

### قیدهای غیرقابل مذاکره

- هیچ domain، endpoint یا workflow فعلی حذف نمی‌شود.
- route به‌تنهایی کافی نیست؛ workflow واقعی UI باید وجود داشته باشد.
- UUID، شناسه‌ی فنی و JSON خام در عملیات معمولی از کاربر خواسته نمی‌شود.
- Backend permission و scope همیشه source of truth هستند.
- هر mutation باید validation، loading، success، error، retry، forbidden و conflict state داشته باشد.
- `network-preview.html` protected است و نباید تغییر، rename، stage یا commit شود.
- ظاهر Network فقط با مقایسه‌ی تصویری با مرجع و در route اپلیکیشن تغییر می‌کند.
- AI هیچ write-back مستقیمی بدون preview، confidence، evidence، permission و human approval ندارد.

---

# ۱. وضعیت مبنا

## ۱.۱ بررسی repository

- `[x]` بررسی Web، Mobile، API، Prisma و shared components
- `[x]` inventory حدود ۸۲ Web page source
- `[x]` inventory حدود ۵۷ Mobile route/file
- `[x]` inventory ۸۹ مدل Prisma
- `[x]` inventory واقعی ۴۵ controller و ۳۴۲ endpoint با verifier رسمی Phase 0
- `[x]` شناسایی generic workspaceها
- `[x]` شناسایی pickerها و Quick Create
- `[x]` شناسایی browser `confirm()`های باقی‌مانده
- `[x]` شناسایی نقاط استفاده از JSON/payload فنی
- `[x]` ثبت وضعیت `network-preview.html` به‌عنوان protected reference

## ۱.۲ وضعیت فنی موجود

- `[x]` Web typecheck
- `[x]` Mobile typecheck
- `[x]` API typecheck
- `[x]` Web production build
- `[x]` Mobile Expo export
- `[x]` API unit/contract tests
- `[x]` API default integration tests
- `[x]` Redis/BullMQ runtime integration با Redis واقعی
- `[!]` PostgreSQL runtime integration در محیط فعلی؛ نیازمند PostgreSQL و native Prisma Query Engine
- `[!]` Prisma generate در محیط فعلی؛ download engine به‌دلیل محدودیت TLS انجام نشد

## ۱.۳ وضعیت محصول

- `[~]` App Shell و navigation: foundation موجود، نیازمند V2 و ساده‌سازی برای کاربر عادی
- `[~]` EntityPicker: موجود، نیازمند keyboard/recent/create-inline و استانداردسازی کامل
- `[~]` Quick Create: موجود، نیازمند context، feedback و typed forms کامل
- `[~]` Organization/Person/Relationship 360: foundation موجود، نیازمند unified workspace
- `[~]` Meeting intelligence: foundation موجود، نیازمند pre/during/post workflow
- `[~]` Network: graph موجود، نیازمند اتصال کامل insight به action
- `[~]` Data Quality: foundation موجود، نیازمند issue inbox و merge workflow
- `[~]` Enterprise/Admin: routeهای متعدد موجود، نیازمند Control Center منسجم
- `[ ]` browser workflow suite کامل
- `[ ]` visual regression suite کامل

---

# ۲. مدل محصول هدف

## ۲.۱ جایگاه محصول

SRIP باید به این محصول تبدیل شود:

> Relationship Operating System برای هلدینگ‌ها، شرکت‌های تابعه و تیم‌های Enterprise Relationship

و مزیت اصلی آن باید این زنجیره باشد:

```text
Relationship Graph
→ Institutional Memory
→ Meeting Intelligence
→ Follow-up Discipline
→ Enterprise Governance
```

## ۲.۲ سطوح تجربه

### سطح اول: Cockpit

سؤال کاربر: «الان چه کاری بیشترین اثر را دارد؟»

### سطح دوم: 360 Workspace

سؤال کاربر: «برای این سازمان، شخص یا رابطه چه می‌دانیم و قدم بعدی چیست؟»

### سطح سوم: Control Center

سؤال مدیر سیستم: «چه چیزی کنترل، تأیید، audit، نگهداری و محافظت می‌شود؟»

---

# ۳. Phase 0 — Product Contract و Release Baseline

**مدت هدف:** ۳ تا ۵ روز
**وابستگی:** ندارد
**خروجی:** matrix رسمی endpoint → screen → action → permission → test

## ۳.۱ Product mapping

- `[x]` استخراج تمام routeهای Web و Mobile در `docs/PRODUCT_CONTRACT_PHASE0.json`؛ ۸۲ Web page و ۵۷ Mobile source route/file
- `[x]` استخراج تمام controllerها و endpointهای API؛ ۴۵ controller و ۳۴۲ endpoint از source واقعی
- `[x]` اتصال هر endpoint به یکی از این وضعیت‌ها:
  - `User-facing workflow`
  - `Admin workflow`
  - `Background job`
  - `Integration-only`
  - `API-only`
- `[x]` مشخص‌کردن primary persona هر endpoint و registry نقش‌ها
- `[x]` مشخص‌کردن permission، scope و access؛ decoratorهای method/class و guardهای داخلی استخراج شده‌اند
- `[x]` مشخص‌کردن loading/empty/error/forbidden/offline/success/conflict state برای هر endpoint
- `[x]` تعیین owner فنی و owner محصول برای هر endpoint/domain

## ۳.۲ استانداردهای مشترک

- `[x]` تعریف status taxonomy مشترک برای lifecycle، work، relationship، opportunity، meeting، job، quality، approval، sync و severity
- `[x]` تعریف ۲۱ event taxonomy برای Timeline
- `[x]` تعریف severity taxonomy برای Data Quality و Risk
- `[x]` تعریف زبان و labelهای فارسی محصول با primary language `fa-IR` و direction `rtl`
- `[x]` تعریف واژگان ثابت برای Organization، Person، Relationship، Interaction، Meeting، Action، Commitment، Follow-up و Opportunity
- `[x]` تعریف naming convention برای endpoint، component، event و test
- `[x]` تعریف policy برای UUID، JSON خام و technical/admin labelها

## ۳.۳ Visual baseline

- `[x]` ثبت `network-preview.html` به‌عنوان Network visual reference محافظت‌شده و ثبت hash `25ab37bd85221cde540d47e9422af2bc59ce3de536be4cbc4a1f9a96aebeef78`
- `[x]` تعیین viewportهای مرجع: 1440، 1280، 1024، 768 و mobile
- `[x]` ثبت palette، spacing، radius، typography، layout و density مرجع در contract
- `[x]` قفل‌کردن `network-preview.html` در verifier و CI؛ فایل untracked است و stage/commit نمی‌شود
- `[x]` تعریف visual regression baseline برای Shell، Table، Picker، 360 و Network به‌عنوان policy اجرایی؛ مقایسه‌ی screenshot در route اپلیکیشن در phaseهای UI اجرا می‌شود

## ۳.۴ معیار قبولی Phase 0

- `[x]` هیچ endpoint اصلی بدون consumer یا تصمیم مستند باقی نماند؛ `webRouteGaps=[]` و consumer/decision برای هر ۳۴۲ endpoint ثبت شد.
- `[x]` هیچ feature P0 بدون permission و test plan باقی نماند؛ invariantهای permission/scope و test plan عبور کردند.
- `[x]` matrix در repository ثبت و review شود؛ خروجی رسمی `docs/PRODUCT_CONTRACT_PHASE0.json` و سند خوانای Phase 0 ثبت شد.
- `[x]` protected file در git status بدون تغییر باقی بماند؛ hash verifier عبور کرد و `network-preview.html` stage/commit نشده است.

**Evidence:** `node scripts/verify-product-phase0.mjs --check` با exit code صفر؛ آخرین نتیجه `controllers=45 endpoints=342 webPages=82 mobileFiles=57`, `missingFromCurrent=[]` و debt register برابر `32/16/50` است. جزئیات در [`PRODUCT_CONTRACT_PHASE0_2026.md`](./PRODUCT_CONTRACT_PHASE0_2026.md) و JSON machine-readable ثبت شده‌اند.

---

# ۴. Phase 1 — Design System V2 و App Shell

**مدت هدف:** ۱ تا ۲ هفته
**وابستگی:** Phase 0
**خروجی:** زبان بصری و interaction یکسان برای تمام صفحات

## ۴.۱ App Shell

- `[ ]` بازطراحی navigation بر اساس کاربر، نه تعداد route
- `[ ]` دسته‌بندی navigation به Today، Core، Execution، Intelligence، Data و Governance
- `[ ]` جداسازی واضح Admin از مسیرهای روزمره
- `[ ]` scope switcher با نمایش scope فعلی
- `[ ]` breadcrumb و back navigation استاندارد
- `[ ]` command palette برای search/create/navigate
- `[ ]` حفظ routeهای فعلی با redirect یا alias در صورت نیاز
- `[ ]` responsive sidebar برای tablet/mobile
- `[ ]` notification inbox در header
- `[ ]` user menu با role، scope و session

## ۴.۲ Shared primitives

- `[ ]` `ConfirmDialog`
- `[ ]` `Toast`
- `[ ]` `MutationFeedback`
- `[ ]` `LoadingSkeleton`
- `[ ]` `EmptyState`
- `[ ]` `ErrorState`
- `[ ]` `ForbiddenState`
- `[ ]` `OfflineBanner`
- `[ ]` `StaleDataBanner`
- `[ ]` `PermissionGate`
- `[ ]` `EntityPicker`
- `[ ]` `EntityMultiPicker`
- `[ ]` `DataTableV2`
- `[ ]` `TimelineFeed`
- `[ ]` `ScoreTrendCard`
- `[ ]` `Entity360Shell`
- `[ ]` `QuickCaptureDrawer`

## ۴.۳ Visual implementation

- `[ ]` حذف hex مستقل از page componentها
- `[ ]` تبدیل tokenهای تکراری به semantic token
- `[ ]` استانداردکردن light/dark/system theme
- `[ ]` استانداردکردن RTL با logical CSS properties
- `[ ]` تعیین Comfortable و Compact density
- `[ ]` استانداردکردن focus، hover، selected، disabled و pressed state
- `[ ]` بررسی contrast و keyboard navigation
- `[ ]` بررسی reduced motion
- `[ ]` یکسان‌سازی فارسی/انگلیسی در navigation و action labelها

## ۴.۴ معیار قبولی Phase 1

- `[ ]` پنج صفحه‌ی P0 با componentهای مشترک render شوند.
- `[ ]` هیچ مسیر P0 از browser `confirm()` استفاده نکند.
- `[ ]` همه‌ی mutationهای P0 feedback یکسان داشته باشند.
- `[ ]` Shell در light، dark، RTL و mobile بدون regression کار کند.
- `[ ]` visual snapshot baseline ثبت شود.

---

# ۵. Phase 2 — Today Cockpit

**مدت هدف:** ۱ تا ۲ هفته
**وابستگی:** Phase 1
**خروجی:** مرکز واقعی عملیات روزانه

## ۵.۱ داده و Backend

- `[ ]` endpoint یا aggregation service برای priority queue
- `[ ]` اتصال Actions overdue و due soon
- `[ ]` اتصال Commitments overdue و due soon
- `[ ]` اتصال Upcoming Meetings
- `[ ]` اتصال Stale Relationships
- `[ ]` اتصال Pending Approvals
- `[ ]` اتصال unresolved Data Quality issues مهم
- `[ ]` افزودن reason، source، owner، due date و priority به هر card
- `[ ]` اعمال permission و organization scope روی تمام aggregationها
- `[ ]` pagination یا bounded result برای queueهای بزرگ

## ۵.۲ UI

- `[ ]` greeting و scope فعلی
- `[ ]` KPI cardهای قابل کلیک
- `[ ]` Priority Queue
- `[ ]` Upcoming Meeting card
- `[ ]` Relationship Pulse
- `[ ]` Follow-up Queue
- `[ ]` My Work
- `[ ]` Quick Capture
- `[ ]` activity stream
- `[ ]` filter بر اساس owner، priority، scope و date
- `[ ]` ذخیره‌ی view و filter کاربر

## ۵.۳ mutationها

- `[ ]` complete action
- `[ ]` snooze action
- `[ ]` reassign action
- `[ ]` mark commitment complete
- `[ ]` create follow-up
- `[ ]` approve follow-up draft
- `[ ]` open meeting brief
- `[ ]` resolve یا assign quality issue

## ۵.۴ معیار قبولی Phase 2

سناریوی کامل:

```text
Login
→ Scope Selection
→ Today
→ Open Priority
→ Open Context
→ Create Interaction
→ Create Action
→ Complete Action
```

- `[ ]` بدون ورود UUID یا JSON خام
- `[ ]` با success/error/retry واقعی
- `[ ]` با permission denial قابل فهم
- `[ ]` با refresh محدود و حفظ context

---

# ۶. Phase 3 — Organization / Person / Relationship 360

**مدت هدف:** ۲ تا ۳ هفته
**وابستگی:** Phase 1 و Phase 2
**خروجی:** سه workspace اصلی relationship-centric

## ۶.۱ Entity360Shell

- `[ ]` header مشترک
- `[ ]` status و lifecycle state
- `[ ]` owner و scope
- `[ ]` health score
- `[ ]` last activity
- `[ ]` primary action bar
- `[ ]` tab navigation
- `[ ]` related records
- `[ ]` timeline
- `[ ]` right rail
- `[ ]` responsive layout

## ۶.۲ Organization 360

- `[ ]` Overview
- `[ ]` People
- `[ ]` Relationships
- `[ ]` Interactions
- `[ ]` Meetings
- `[ ]` Projects
- `[ ]` Opportunities
- `[ ]` Notes/Documents
- `[ ]` Timeline
- `[ ]` Data Quality
- `[ ]` key contacts
- `[ ]` open actions
- `[ ]` risk و opportunity
- `[ ]` create interaction/meeting/note/action/commitment

## ۶.۳ Person 360

- `[ ]` identity card
- `[ ]` نقش و department
- `[ ]` سازمان‌های مرتبط
- `[ ]` preferred channel
- `[ ]` last touch
- `[ ]` direct relationships
- `[ ]` meetings
- `[ ]` notes
- `[ ]` actions/commitments
- `[ ]` timeline filter
- `[ ]` quick capture context-aware

## ۶.۴ Relationship 360

- `[ ]` source/target context
- `[ ]` relationship type/status
- `[ ]` owner
- `[ ]` health/trust/recency/coverage score
- `[ ]` score history
- `[ ]` score factor explanation
- `[ ]` warm path
- `[ ]` connector
- `[ ]` relationship risk
- `[ ]` linked meeting/action/commitment/project/opportunity
- `[ ]` create introduction
- `[ ]` create follow-up
- `[ ]` recalculate score با feedback

## ۶.۵ معیار قبولی Phase 3

- `[ ]` سناریوی Organization → Relationship → Person کامل شود.
- `[ ]` Timeline در هر سه entity یکسان و قابل فیلتر باشد.
- `[ ]` recordهای مرتبط deep-link داشته باشند.
- `[ ]` هیچ association مهمی به input فنی وابسته نباشد.
- `[ ]` score همیشه دلیل، timestamp و confidence داشته باشد.

---

# ۷. Phase 4 — Meeting و Follow-up Loop

**مدت هدف:** ۲ هفته
**وابستگی:** Phase 3
**خروجی:** حلقه‌ی کامل Meeting → Decision → Action/Commitment → Follow-up

## ۷.۱ قبل جلسه

- `[ ]` meeting objective
- `[ ]` agenda builder
- `[ ]` participant picker
- `[ ]` relationship brief
- `[ ]` last interactions
- `[ ]` open actions
- `[ ]` open commitments
- `[ ]` risk signals
- `[ ]` suggested questions
- `[ ]` related organizations/people/projects

## ۷.۲ حین جلسه

- `[ ]` note capture سریع
- `[ ]` decision builder
- `[ ]` blocker builder
- `[ ]` action item builder
- `[ ]` commitment builder
- `[ ]` owner picker
- `[ ]` due-date picker
- `[ ]` link به entityهای مرتبط
- `[ ]` autosave یا draft state امن

## ۷.۳ بعد جلسه

- `[ ]` summary
- `[ ]` candidate actions
- `[ ]` candidate commitments
- `[ ]` edit/approve/reject هر candidate
- `[ ]` apply result per item
- `[ ]` follow-up draft
- `[ ]` send/approve state
- `[ ]` finalize meeting
- `[ ]` audit event
- `[ ]` retry failed item

## ۷.۴ Backend contract

- `[ ]` typed DTO برای decisions
- `[ ]` typed DTO برای action candidates
- `[ ]` typed DTO برای commitment candidates
- `[ ]` apply endpoint idempotent
- `[ ]` conflict result per item
- `[ ]` sourceMeetingId در خروجی‌های مرتبط
- `[ ]` statusهای draft، approved، applied، rejected، failed

## ۷.۵ معیار قبولی Phase 4

```text
Create Meeting
→ Prepare Brief
→ Add Notes
→ Add Decision
→ Add Action/Commitment
→ Approve
→ Apply
→ Create Follow-up
→ Finalize
```

- `[ ]` بدون JSON خام
- `[ ]` قابل تست در browser
- `[ ]` audit کامل
- `[ ]` failure/retry واقعی

---

# ۸. Phase 5 — Network به Intelligence و Action

**مدت هدف:** ۱ تا ۲ هفته
**وابستگی:** Phase 3 و visual baseline Phase 0
**خروجی:** graph قابل استفاده برای تصمیم و اقدام

## ۸.۱ حفظ مرجع بصری

- `[ ]` عدم تغییر `network-preview.html`
- `[ ]` مقایسه‌ی screenshot route با مرجع
- `[ ]` حفظ geometry، رنگ‌ها، spacing و hierarchy اصلی
- `[ ]` ثبت visual diff برای هر تغییر
- `[ ]` عدم اعمال redesign بدون review تصویری

## ۸.۲ قابلیت‌های graph

- `[ ]` scope filter
- `[ ]` entity type filter
- `[ ]` relationship type filter
- `[ ]` score threshold
- `[ ]` risk filter
- `[ ]` time range
- `[ ]` zoom/pan
- `[ ]` keyboard focus
- `[ ]` loading state
- `[ ]` empty state
- `[ ]` hidden/forbidden node explanation

## ۸.۳ Inspector و actions

- `[ ]` selected node inspector
- `[ ]` selected edge inspector
- `[ ]` relationship health
- `[ ]` warm path
- `[ ]` connector
- `[ ]` last interaction
- `[ ]` open Organization/Person/Relationship 360
- `[ ]` create relationship
- `[ ]` create introduction
- `[ ]` create interaction
- `[ ]` create follow-up
- `[ ]` create action

## ۸.۴ معیار قبولی Phase 5

- `[ ]` هر insight مهم graph حداقل یک CTA عملیاتی داشته باشد.
- `[ ]` انتخاب node حداکثر با دو کلیک به context یا action برسد.
- `[ ]` graph permission-aware و scope-aware باشد.
- `[ ]` visual diff خارج از baseline نباشد.

---

# ۹. Phase 6 — Execution Boards

**مدت هدف:** ۲ هفته
**وابستگی:** Phase 2 و Phase 3
**خروجی:** مدیریت عملیاتی Actions، Commitments، Projects و Opportunities

## ۹.۱ Viewهای مشترک

- `[ ]` table
- `[ ]` Kanban
- `[ ]` Calendar
- `[ ]` My Work
- `[ ]` Overdue
- `[ ]` Stalled
- `[ ]` Unassigned
- `[ ]` saved views
- `[ ]` filter chips
- `[ ]` server pagination
- `[ ]` sort
- `[ ]` column visibility
- `[ ]` bulk selection

## ۹.۲ Actions

- `[ ]` owner
- `[ ]` due date
- `[ ]` priority
- `[ ]` source context
- `[ ]` dependency picker
- `[ ]` cycle validation
- `[ ]` complete/snooze/reassign
- `[ ]` dependency graph

## ۹.۳ Commitments

- `[ ]` owner
- `[ ]` due date
- `[ ]` risk
- `[ ]` source meeting
- `[ ]` follow-up state
- `[ ]` mark overdue
- `[ ]` complete/close
- `[ ]` bulk operation

## ۹.۴ Projects

- `[ ]` project overview
- `[ ]` milestones
- `[ ]` requirements
- `[ ]` risks
- `[ ]` linked relationships
- `[ ]` linked organizations
- `[ ]` owner
- `[ ]` target date
- `[ ]` project health

## ۹.۵ Opportunities

- `[ ]` visual pipeline
- `[ ]` stage aging
- `[ ]` next step
- `[ ]` owner
- `[ ]` value
- `[ ]` linked organization/project/relationship
- `[ ]` win/loss reason
- `[ ]` forecast
- `[ ]` stalled alert

## ۹.۶ معیار قبولی Phase 6

- `[ ]` همه‌ی recordهای اجرایی owner و next step داشته باشند.
- `[ ]` drag/drop یا تغییر status permission-aware و idempotent باشد.
- `[ ]` bulk operation partial result و audit داشته باشد.
- `[ ]` هر pipeline حداقل table و Kanban داشته باشد.

---

# ۱۰. Phase 7 — Data Quality و Intelligence

**مدت هدف:** ۲ هفته
**وابستگی:** Phase 3 و Phase 6
**خروجی:** داده‌ی قابل اعتماد و intelligence قابل توضیح

## ۱۰.۱ Quality dashboard

- `[ ]` quality score کلی
- `[ ]` completeness
- `[ ]` duplicates
- `[ ]` stale records
- `[ ]` invalid values
- `[ ]` conflicts
- `[ ]` orphan records
- `[ ]` trend زمانی
- `[ ]` breakdown بر اساس organization/scope

## ۱۰.۲ Quality issue inbox

- `[ ]` issue list
- `[ ]` severity
- `[ ]` confidence
- `[ ]` source
- `[ ]` owner
- `[ ]` suggested fix
- `[ ]` evidence
- `[ ]` assign
- `[ ]` snooze
- `[ ]` resolve
- `[ ]` reject
- `[ ]` bulk triage

## ۱۰.۳ Duplicate merge

- `[ ]` duplicate preview
- `[ ]` two-column comparison
- `[ ]` field-level winner selection
- `[ ]` conflict explanation
- `[ ]` permission check
- `[ ]` apply merge
- `[ ]` rollback
- `[ ]` audit event
- `[ ]` idempotency

## ۱۰.۴ Import

- `[ ]` upload
- `[ ]` file validation
- `[ ]` column mapping
- `[ ]` field validation
- `[ ]` duplicate strategy
- `[ ]` preview
- `[ ]` commit
- `[ ]` progress
- `[ ]` partial failure
- `[ ]` retry failed rows
- `[ ]` downloadable report
- `[ ]` saved mapping template

## ۱۰.۵ Intelligence و AI

- `[ ]` explainable score
- `[ ]` factor detail
- `[ ]` evidence source
- `[ ]` confidence
- `[ ]` generated recommendation
- `[ ]` human approval
- `[ ]` apply/reject
- `[ ]` AI audit
- `[ ]` prompt-injection defense
- `[ ]` no direct database write by model

## ۱۰.۶ معیار قبولی Phase 7

- `[ ]` یک duplicate از preview تا rollback کامل تست شود.
- `[ ]` import با valid، invalid و duplicate row تست شود.
- `[ ]` هیچ AI write-back بدون approval ممکن نباشد.
- `[ ]` هر recommendation به record و evidence قابل ردیابی باشد.

---

# ۱۱. Phase 8 — Enterprise Control Center و Integration

**مدت هدف:** ۲ تا ۳ هفته
**وابستگی:** Phase 1، Phase 6 و Phase 7
**خروجی:** مدیریت امن، قابل مشاهده و قابل audit

## ۱۱.۱ Control Center

- `[ ]` security posture
- `[ ]` permission matrix
- `[ ]` active sessions
- `[ ]` integration health
- `[ ]` workflow health
- `[ ]` job/queue health
- `[ ]` data retention
- `[ ]` privacy cases
- `[ ]` audit stream
- `[ ]` backup/restore evidence
- `[ ]` feature flags
- `[ ]` incident/remediation CTA

## ۱۱.۲ Integrations

- `[ ]` connector catalog
- `[ ]` OAuth/connect flow
- `[ ]` scope consent
- `[ ]` sync status
- `[ ]` last successful sync
- `[ ]` next retry
- `[ ]` rate limit status
- `[ ]` conflict state
- `[ ]` dead-letter state
- `[ ]` disconnect/revoke
- `[ ]` audit event

## ۱۱.۳ Workflows و Jobs

- `[ ]` workflow list
- `[ ]` workflow builder یا template builder
- `[ ]` trigger definition
- `[ ]` condition definition
- `[ ]` action definition
- `[ ]` dry run
- `[ ]` execution trace
- `[ ]` per-step status
- `[ ]` retry
- `[ ]` pause/resume
- `[ ]` failure notification

## ۱۱.۴ Privacy / Security / Governance

- `[ ]` access request
- `[ ]` export request
- `[ ]` erase/anonymize request
- `[ ]` consent revoke
- `[ ]` retention policy
- `[ ]` policy evidence
- `[ ]` security event detail
- `[ ]` session revoke
- `[ ]` permission change audit
- `[ ]` export audit

## ۱۱.۵ معیار قبولی Phase 8

- `[ ]` Admin بتواند integration failure را تا resolution دنبال کند.
- `[ ]` Admin بتواند privacy request را از ایجاد تا completion دنبال کند.
- `[ ]` تمام writeهای حساس audit داشته باشند.
- `[ ]` access denial با دلیل و request ID نمایش داده شود.
- `[ ]` job failure با retry یا remediation CTA همراه باشد.

---

# ۱۲. Phase 9 — Release، QA و Adoption

**مدت هدف:** ۱ تا ۲ هفته
**وابستگی:** همه‌ی phaseهای قبلی
**خروجی:** release قابل اتکا و قابل ارائه

## ۱۲.۱ Browser E2E

- `[ ]` login
- `[ ]` refresh session
- `[ ]` scope switch
- `[ ]` Today priority
- `[ ]` Organization create
- `[ ]` Person create با picker
- `[ ]` Relationship create
- `[ ]` Interaction create
- `[ ]` Meeting pre/during/post
- `[ ]` Follow-up apply
- `[ ]` Action complete
- `[ ]` Commitment complete
- `[ ]` Opportunity stage change
- `[ ]` Project relationship link
- `[ ]` Network node → 360
- `[ ]` Data Quality merge preview
- `[ ]` Import preview/commit
- `[ ]` Permission denied
- `[ ]` API error/retry
- `[ ]` session expiration

## ۱۲.۲ Visual regression

- `[ ]` App Shell
- `[ ]` Today
- `[ ]` Organization 360
- `[ ]` Person 360
- `[ ]` Relationship 360
- `[ ]` Meeting Workspace
- `[ ]` Execution Board
- `[ ]` Data Quality
- `[ ]` Admin Control Center
- `[ ]` Network reference comparison
- `[ ]` light mode
- `[ ]` dark mode
- `[ ]` RTL
- `[ ]` mobile/tablet

## ۱۲.۳ Accessibility

- `[ ]` keyboard-only navigation
- `[ ]` visible focus
- `[ ]` screen-reader labels
- `[ ]` dialog focus trap
- `[ ]` form error association
- `[ ]` color contrast
- `[ ]` reduced motion
- `[ ]` no color-only status
- `[ ]` touch target size

## ۱۲.۴ Performance

- `[ ]` shell load budget
- `[ ]` Today load budget
- `[ ]` 360 load budget
- `[ ]` table pagination budget
- `[ ]` graph rendering budget
- `[ ]` bounded API payloads
- `[ ]` no unbounded offline queue
- `[ ]` slow query observation
- `[ ]` cache invalidation test

## ۱۲.۵ زیرساخت واقعی

- `[ ]` PostgreSQL واقعی
- `[ ]` Redis واقعی
- `[ ]` Prisma generate
- `[ ]` migration deploy
- `[ ]` seed/demo data
- `[ ]` API startup
- `[ ]` worker startup
- `[ ]` Web proxy
- `[ ]` health/readiness
- `[ ]` backup/restore
- `[ ]` production env validation

## ۱۲.۶ معیار قبولی Phase 9

- `[ ]` تمام browser workflowهای P0 سبز باشند.
- `[ ]` visual regression برای P0 بدون تغییر ناخواسته باشد.
- `[ ]` integration واقعی PostgreSQL و Redis سبز باشد.
- `[ ]` build/typecheck/lint/test سبز باشد.
- `[ ]` migration، seed و rollback verify شده باشد.
- `[ ]` release notes و onboarding آماده باشد.

---

# ۱۳. نقشه‌ی پوشش بدون حذف قابلیت‌ها

| Domain | تجربه‌ی نهایی | مسیرهای حفظ‌شده |
|---|---|---|
| Organizations | Organization 360 | `/organizations`, `/organizations/[id]` |
| People | Person 360 | `/people`, `/people/[id]` |
| Relationships | Relationship 360 و warm path | `/relationships`, `/relationships/[id]` |
| Interactions | timeline و quick capture | `/interactions`, `/interactions/[id]` |
| Meetings | pre/during/post workspace | `/meetings`, `/meetings/[id]`, `/calendar` |
| Actions | Today و Execution Board | `/today`, `/actions`, `/actions/[id]` |
| Commitments | Follow-up Cockpit | `/commitments`, `/commitments/[id]` |
| Projects | Project Control Room | `/projects`, `/projects/[id]` |
| Opportunities | pipeline و context رابطه | `/opportunities`, `/opportunities/[id]` |
| Network | graph → insight → action | `/network` |
| Requirements | matching contextual | `/requirements` |
| Recommendations/AI | explainable intelligence | `/recommendations`, `/intelligence`, `/ai`, `/ai-executive-brief` |
| Notes/Documents | knowledge layer | `/notes`, `/documents`, `/knowledge` |
| Data Management | import و quality | `/data-management`, `/data-management/import`, `/data-management/quality`, `/data-quality`, `/data-lifecycle` |
| Reports/Analytics | operational و executive reporting | `/reports`, `/reports/export`, `/analytics` |
| Workflows/Jobs | automation و execution trace | `/workflows`, `/approvals` |
| Integrations | connector health | `/integrations` |
| Enterprise/Governance | Control Center | `/enterprise`, `/governance`, `/authorization`, `/privacy`, `/security`, `/security-events`, `/sessions`, `/observability`, `/monitoring`, `/health` |
| Admin/Master Data | policy و configuration | `/admin/*`, `/settings` |

---

# ۱۴. قرارداد اجباری هر mutation

هر mutation باید این مراحل را داشته باشد:

1. `[ ]` client-side precondition
2. `[ ]` validation
3. `[ ]` permission gate
4. `[ ]` scope validation
5. `[ ]` semantic picker به‌جای technical ID
6. `[ ]` جلوگیری از submit تکراری
7. `[ ]` idempotency key
8. `[ ]` request/correlation ID
9. `[ ]` loading state
10. `[ ]` success feedback
11. `[ ]` field error
12. `[ ]` forbidden state
13. `[ ]` not-found state
14. `[ ]` conflict state
15. `[ ]` rate-limit state
16. `[ ]` retry
17. `[ ]` refresh محدود و حفظ context
18. `[ ]` audit در mutation حساس
19. `[ ]` unit test
20. `[ ]` API integration test
21. `[ ]` browser test
22. `[ ]` visual/RTL/mobile بررسی

---

# ۱۵. اولین Sprint اجرایی

**هدف:** ساخت یک vertical slice کامل، نه ده صفحه‌ی نصفه

- `[ ]` ConfirmDialog
- `[ ]` MutationFeedback
- `[ ]` EntityPicker V2
- `[ ]` AppShell navigation cleanup
- `[ ]` Today priority card
- `[ ]` Organization 360 shell
- `[ ]` unified TimelineFeed
- `[ ]` QuickCaptureDrawer
- `[ ]` MeetingBriefPanel
- `[ ]` browser test کامل از Login تا Complete Action

### خروجی نمایشی Sprint

```text
Login
→ Scope Selection
→ Today
→ Priority Card
→ Organization 360
→ Register Interaction
→ Create Action
→ Complete Action
```

### معیار قبولی Sprint

- `[ ]` یک user واقعی بتواند workflow را بدون آموزش فنی طی کند.
- `[ ]` هیچ UUID یا JSON خام در جریان وجود نداشته باشد.
- `[ ]` failure state قابل retry باشد.
- `[ ]` تغییرات با permission واقعی backend کنترل شود.
- `[ ]` screenshot قبل و بعد ثبت شود.

---

# ۱۶. KPIهای محصول

## سرعت و adoption

- `[ ]` ساخت اولین Organization در کمتر از ۶۰ ثانیه
- `[ ]` ثبت Interaction در کمتر از ۳۰ ثانیه
- `[ ]` ساخت Follow-up در کمتر از ۹۰ ثانیه
- `[ ]` ۱۰۰٪ mutationهای P0 بدون ورود technical ID
- `[ ]` ۱۰۰٪ mutationهای P0 با feedback کامل

## کیفیت relationship

- `[ ]` relationshipهای strategic دارای owner
- `[ ]` relationshipهای strategic دارای next step
- `[ ]` کاهش stale relationship
- `[ ]` کاهش overdue action/commitment
- `[ ]` افزایش warm path به action/introduction
- `[ ]` افزایش coverage افراد کلیدی

## کیفیت داده

- `[ ]` duplicate resolution rate
- `[ ]` completeness score
- `[ ]` unresolved issue aging
- `[ ]` import success rate
- `[ ]` AI suggestion evidence coverage

## کیفیت UX

- `[ ]` visual regression صفر در P0
- `[ ]` browser workflowهای P0 بدون flaky test
- `[ ]` accessibility pass
- `[ ]` performance budget pass
- `[ ]` mobile responsive pass

---

# ۱۷. Release Gate نهایی

Release فقط وقتی مجاز است که همه‌ی موارد زیر سبز باشند:

- `[ ]` Product contract matrix کامل
- `[ ]` Web typecheck
- `[ ]` Mobile typecheck
- `[ ]` API typecheck
- `[ ]` lint
- `[ ]` Web production build
- `[ ]` Mobile export
- `[ ]` API unit tests
- `[ ]` API contract tests
- `[ ]` PostgreSQL integration
- `[ ]` Redis/BullMQ integration
- `[ ]` browser E2E
- `[ ]` visual regression
- `[ ]` permission/security matrix
- `[ ]` migration deploy
- `[ ]` seed/demo workspace
- `[ ]` backup/restore
- `[ ]` health/readiness
- `[ ]` no protected file change
- `[ ]` docs و release notes

---

# ۱۸. تصمیم اجرایی نهایی

ترتیب رسمی اجرا:

```text
Phase 0 — Product Contract
→ Phase 1 — Design System و App Shell
→ Phase 2 — Today Cockpit
→ Phase 3 — Organization/Person/Relationship 360
→ Phase 4 — Meeting و Follow-up
→ Phase 5 — Network به Action
→ Phase 6 — Execution Boards
→ Phase 7 — Data Quality و Intelligence
→ Phase 8 — Enterprise Control Center
→ Phase 9 — Release و Adoption
```

هیچ phase با «وجود route» تمام‌شده محسوب نمی‌شود. معیار Done، workflow قابل استفاده، اتصال واقعی Frontend/Backend، permission، validation، feedback، تست و تجربه‌ی بصری است.

این فایل به‌عنوان **execution source of truth** برای ادامه‌ی کار SRIP نگهداری می‌شود و وضعیت checklist باید بعد از هر sprint به‌روزرسانی شود.
