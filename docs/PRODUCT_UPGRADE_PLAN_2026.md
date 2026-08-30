# SRIP — برنامه‌ی ارتقای محصول، رابط کاربری و تجربه‌ی عملیاتی

**تاریخ بازبینی:** ۳۰ اوت ۲۰۲۶
**شاخه:** `arena/01a04fd2-srip`
**هدف:** تبدیل SRIP از یک محصول با پوشش وسیع API و route به یک **Relationship Operating System** سریع، قابل‌اعتماد و روزانه برای هلدینگ، شرکت‌های تابعه و تیم‌های Relationship/Executive.

> **قید مهم:** `network-preview.html` در این برنامه فقط به‌عنوان مرجع بصری محفوظ می‌ماند و نباید تغییر کند. هرگونه ارتقای Network باید در route و stylesheet مربوط به اپلیکیشن، با مقایسه‌ی تصویری با مرجع، انجام شود.

---

## ۱. نتیجه‌ی بازبینی کامل

### آنچه همین حالا ارزشمند است

- مدل دامنه‌ی گسترده: Organization، Person، Relationship، Interaction، Meeting، Action، Commitment، Project، Opportunity، Network، Recommendation، Document، Note، Data Quality، Workflow، Integration، Privacy و Enterprise.
- درخت route کامل در Web و Mobile و اتصال اولیه‌ی آن‌ها به API مشترک.
- API client مشترک با مدیریت session، refresh، timeout، error code، request ID و idempotency.
- `EntityPicker` و `QuickCreate` برای کاهش ورود شناسه‌های فنی.
- design tokenهای light/dark، RTL، focus state و responsive foundation.
- Network، Meeting، Detail pageها، Data Quality و Governance هرکدام foundation قابل توسعه دارند.
- backend از نظر typecheck/build و تست‌های unit/contract فعلی قابل‌تکرار است.

### شکاف‌های اصلی که باید برطرف شوند

بازبینی source inventory نشان می‌دهد محصول از نظر تعداد قابلیت کمبود ندارد؛ مسئله، **اتصال قابلیت‌ها به یک جریان کاری پیوسته** است:

1. **محور اصلی هنوز صفحه است، نه کار کاربر.** کاربر باید از چند صفحه عبور کند تا از یک Relationship به Meeting، Note، Action، Commitment و Follow-up برسد.
2. **generic abstraction بیش از حد در مسیرهای مهم استفاده شده است.** بعضی routeها هنوز با `CrudWorkspace`، `ResourceConsole` یا `EntityWorkspace` نمایش داده می‌شوند؛ این برای admin مناسب است، اما برای Action، Commitment، Opportunity، Project و Referral تجربه‌ی متمایز و context-aware لازم است.
3. **فرم‌ها هنوز یکدست نیستند.** picker در بعضی مسیرها وجود دارد، اما در برخی associationها هنوز ID یا payload فنی در لایه‌ی ذهنی کاربر باقی می‌ماند. Decisions، outcome و بعضی ساختارهای meeting نیز باید از JSON خام به builder تبدیل شوند.
4. **feedback mutation استاندارد نشده است.** در چند نقطه هنوز `confirm()` مرورگر، پیام‌های غیرهم‌شکل و refresh کامل صفحه وجود دارد. هر mutation باید loading، success، error، retry، forbidden، conflict و request ID داشته باشد.
5. **Today/Cockpit باید مرکز محصول شود.** داشبورد نباید فقط KPI یا launchpad باشد؛ باید بگوید «الان دقیقاً چه کاری انجام دهم؟».
6. **360 Workspace هنوز کامل نشده است.** Organization، Person و Relationship باید timeline، health، score trend، افراد کلیدی، فرصت‌ها، جلسات، action/commitment، اسناد/یادداشت و next best action را در یک صفحه‌ی واحد جمع کنند.
7. **Network هنوز از insight به action پل کامل ندارد.** انتخاب node باید به profile، رابطه، معرفی، interaction یا task منتهی شود؛ نه فقط نمایش graph.
8. **زبان بصری و محتوایی در همه‌جا یکسان نیست.** بخشی از navigation و detailها فارسی و بخشی انگلیسی‌اند. tokenهای CSS مفیدند، اما aliasهای تکراری و page-specific style باعث drift می‌شوند.
9. **E2E واقعی UI هنوز gate محصول نیست.** build و contract برای release لازم‌اند، اما کافی نیستند؛ باید workflow واقعی با browser، API و دیتابیس واقعی تست شود.

### inventory فعلی

- Web: حدود **۸۲ page source** و routeهای متعدد برای core، intelligence، governance و admin.
- Mobile: حدود **۵۷ route/file عملیاتی**.
- Backend: **۸۹ مدل Prisma** و حدود **۴۳ controller**؛ قرارداد API غیر-AI در ممیزی‌های قبلی حدود **۳۰۷ endpoint** را پوشش می‌دهد.
- generic workspaceها هنوز در چند مسیر اصلی استفاده می‌شوند.
- در source فعلی چندین browser `confirm()` وجود دارد و باید با ConfirmDialog استاندارد جایگزین شود.

**تشخیص نهایی:** SRIP نباید یک کپی از Salesforce یا یک CRUD admin panel باشد. فرصت اصلی آن ترکیب این چهار مزیت است:

> **Relationship graph + institutional memory + operational follow-up + enterprise governance**

---

## ۲. نتیجه‌ی مقایسه با پلتفرم‌های مشابه

### Affinity — معیار Relationship Intelligence

Affinity روی capture خودکار email/calendar، امتیاز رابطه، warm introduction path و دید firm-wide تمرکز دارد؛ یعنی سؤال محصول از «این contact کیست؟» به «چه کسی بهترین مسیر برای بازکردن این در را دارد؟» تبدیل می‌شود. [Affinity](https://www.affinity.co/) و [Relationship Intelligence](https://www.affinity.co/blog/relationship-intelligence)

**چیزی که از Affinity می‌گیریم:**

- Relationship strength با دلیل، تازگی تعامل و مسیر پیشنهادی.
- نمایش مستقیم «چه کسی معرفی کند؟».
- هشدار relationshipهای در حال سردشدن.
- activity capture بدون ثبت دستی مداوم.

**چیزی که کپی نمی‌کنیم:**

- مدل private-capital-only؛ SRIP باید هلدینگ، subsidiary، partner، customer، project و enterprise governance را هم پوشش دهد.

### Attio — معیار flexible data model و context

Attio روی Objects، custom attributes، list/view، timeline، workflow، AI attributes، call intelligence و API/SDK بنا شده است. [Attio Objects](https://attio.com/blog/introducing-attio-objects)، [Attio Workflows](https://attio.com/blog)، [Attio sales-led guide](https://attio.com/help/reference/industry-guides/sales-led)

**چیزی که از Attio می‌گیریم:**

- هر record یک صفحه‌ی context-rich و قابل سفارشی‌سازی داشته باشد.
- table، kanban، calendar و timeline فقط viewهای مختلف یک داده‌ی واحد باشند.
- saved views و custom fields واقعاً usable باشند.
- Workflow از تغییر record تا اجرای action، با run history و failure state، قابل مشاهده باشد.

**چیزی که کپی نمی‌کنیم:**

- آزادی نامحدود بدون opinion؛ برای کاربر عادی باید مسیر پیشنهادی و template آماده وجود داشته باشد.

### folk — معیار frictionless execution

folk روی capture سریع contact، enrichment، pipeline، task، unified timeline و follow-up assistant تمرکز دارد و هدف آن کاهش کار اداری است. [folk](https://www.folk.app/)، [folk Sales CRM](https://www.folk.app/crm-for-x/sales)

**چیزی که از folk می‌گیریم:**

- یک کلیک برای capture و ساخت record.
- follow-up پیشنهادی با متن و context آماده.
- timeline چندکاناله.
- pipeline ساده و action-oriented.

### Clay — معیار Data Intelligence و Signal

Clay خود را بیشتر به‌عنوان لایه‌ی enrichment، signal، research و orchestration نشان می‌دهد، نه جایگزین CRM. Signals، enrichment چندمنبعه، workflow و MCP آن برای ساختن داده‌ی قابل‌اقدام طراحی شده‌اند. [Clay](https://www.clay.com/)، [Custom Signals](https://www.clay.com/signals)، [Clay MCP](https://www.clay.com/mcp)

**چیزی که از Clay می‌گیریم:**

- هر data quality issue فقط خطا نباشد؛ صف قابل‌اقدام با owner، confidence، source و approval داشته باشد.
- signal به enrichment و سپس به action یا alert متصل شود.
- AI قبل از write-back نیازمند preview، confidence و تأیید انسانی باشد.

### Salesforce — معیار Enterprise AI و Governance

Salesforce در Sales Cloud، activity capture، relationship graph، research، scoring، forecasting و next-best-action را به‌صورت یک لایه‌ی enterprise عرضه می‌کند. [Sales Cloud Einstein](https://salesforce.com/products/sales-cloud/tools/einstein-relationship-insights)

**چیزی که از آن می‌گیریم:**

- explainability برای score و recommendation.
- approval، audit، role، scope و evidence در کنار هر automation.
- forecast و risk که به pipeline واقعی متصل است.

### Pipedrive و HubSpot — معیار سادگی روزانه

Pipedrive با pipeline بصری، activity، reminder، calendar و next activity تجربه‌ی task-first می‌سازد. [Pipedrive](https://www.pipedrive.com/)، [Activities & Goals](https://www.pipedrive.com/en/features/activities-goals)

HubSpot نیز contact، deal pipeline، activity timeline، automation و reporting را به‌عنوان مبانی CRM معرفی می‌کند. [HubSpot CRM fundamentals](https://www.hubspot.com/products/crm/what-is)

**چیزی که از هر دو می‌گیریم:**

- کاربر باید در هر صفحه یک next step مشخص ببیند.
- pipeline باید با drag/drop، filter، aging و stalled state قابل فهم باشد.
- dashboard باید overdue، stalled، upcoming و conversion را نشان دهد؛ نه فقط تعداد objectها.

### جایگاه پیشنهادی SRIP

| محور | انتخاب SRIP |
|---|---|
| Core | Relationship Operating System برای هلدینگ و enterprise relationship teams |
| Differentiator | warm paths + cross-entity context + follow-up discipline |
| UX | سرعت و سادگی folk/Pipedrive، با عمق 360 و graph سطح Affinity |
| Data model | opinionated core objectها + custom fields/views کنترل‌شده، نه آزادی بی‌حد |
| AI | پیشنهاد و draft با evidence و تأیید انسانی، نه black-box mutation |
| Enterprise | scope، policy، audit، privacy، retention، approvals و observability از روز اول |

---

## ۳. معماری تجربه‌ی کاربر

### Navigation نهایی

1. **امروز** — Today / Cockpit
2. **سازمان‌ها** — Organization directory و Organization 360
3. **اشخاص** — People directory و Person 360
4. **روابط** — Relationship health و Relationship 360
5. **تعاملات و جلسات** — timeline، quick capture و meeting workspace
6. **اجرا** — Actions، Commitments، Projects، Opportunities
7. **هوشمندی** — Network، Search، Recommendations، Intelligence، Reports، AI
8. **داده و مدیریت** — Notes، Documents، Data Quality، Import، Lifecycle
9. **حاکمیت** — Permissions، Approvals، Workflows، Integrations، Privacy، Security، Audit، Observability

کاربر عادی نباید همه‌ی admin routeها را در navigation اصلی ببیند. permission gate باید navigation، action و content را هم‌زمان کنترل کند.

### سه سطح اصلی محصول

#### سطح ۱: Cockpit
پاسخ به این سؤال: **الان چه کاری بیشترین اثر را دارد؟**

#### سطح ۲: 360 Workspace
پاسخ به این سؤال: **برای این سازمان/شخص/رابطه چه می‌دانیم و قدم بعد چیست؟**

#### سطح ۳: System of Record / Governance
پاسخ به این سؤال: **چه چیزی ثبت، کنترل، تأیید، audit و حفظ می‌شود؟**

---

## ۴. مشخصات UI پیشنهادی

### A. Today / Relationship Cockpit

چیدمان پیشنهادی:

- Header: سلام، scope فعلی، جستجوی سراسری، Quick Capture و اعلان‌ها.
- چهار KPI قابل کلیک: `Overdue`، `Due today`، `Stale relationships`، `Pending approvals`.
- ستون اصلی: **اولویت‌های امروز** با کارت هر task شامل دلیل، entity، deadline، owner و CTA.
- ستون دوم: **جلسه‌ی بعدی** با brief، افراد، هدف و آخرین تعامل.
- بخش سوم: **Relationship pulse** با رابطه‌هایی که سرد شده‌اند یا score آن‌ها افت کرده است.
- بخش چهارم: **Follow-up queue** با draft آماده و گزینه‌ی approve/edit/snooze.
- پایین صفحه: activity stream و quick add.

حالت‌های اجباری: loading skeleton، empty با CTA، error با retry، forbidden، offline، stale data و success بعد از complete.

### B. Organization 360

- Header: نام، نوع، وضعیت، scope، owner، health و آخرین فعالیت.
- نوار action: ثبت تعامل، جلسه، یادداشت، action، commitment، opportunity و archive.
- Tabs: Overview، People، Relationships، Interactions، Meetings، Projects، Opportunities، Documents/Notes، Timeline، Data quality.
- Right rail: key contacts، open actions، risk، next best action و network path.
- نمودار health: score فعلی، trend، دلیل تغییر، confidence و snapshot history.

### C. Person 360

- identity card با نقش، سازمان‌های مرتبط، preferred channel و last touch.
- relationship map با organizationها و شخص‌های مرتبط.
- timeline فیلترشونده بر اساس email/meeting/call/note/action.
- «what to say next» فقط در صورت وجود evidence و با تأیید انسانی.
- create interaction/meeting/note از context شخص، بدون ID دستی.

### D. Relationship 360

- دو طرف رابطه در header با direction، type، owner و status.
- scoreهای health، trust، recency، coverage و risk.
- warm path: مسیرهای ممکن، connector، hop count، strength، last interaction و CTA برای draft introduction.
- timeline و activity composer در همان صفحه.
- linked meetings، actions، commitments، projects و opportunities.
- action واضح: `Recalculate`، `Plan follow-up`، `Create introduction`، `Add note`.

### E. Meeting Workspace

سه مرحله‌ی روشن:

1. **قبل جلسه:** objective، agenda، participants با picker، brief رابطه، آخرین تعامل، open commitments، risks و suggested questions.
2. **حین جلسه:** note capture سریع، decision، blocker، commitment و action item builder.
3. **بعد جلسه:** summary، candidate actionها، owner/date picker، approve/apply، follow-up draft، finalize و audit result.

هر candidate باید قبل از apply قابل ویرایش باشد. `Decisions (JSON)` و payload مشابه نباید در UI نمایش داده شود.

### F. Network Workspace

- ظاهر و geometry مرجع حفظ شود؛ redesign آزاد انجام نشود.
- toolbar چپ: scope، entity type، score threshold، relationship type، risk و time range.
- مرکز: graph با zoom، pan، keyboard focus و selected state.
- پنل راست: node/edge detail، health، warm path، related records و action CTA.
- پایین پنل: `Open 360`، `Create relationship`، `Create introduction`، `Create follow-up`.
- graph loading با data واقعی، empty state برای نبود رابطه و توضیح permission برای nodeهای پنهان.

### G. Execution Board

Actions، Commitments، Opportunities و Projects باید علاوه بر table، viewهای زیر را داشته باشند:

- Kanban بر اساس status/stage
- Calendar بر اساس due/target date
- My work بر اساس owner
- Stalled / overdue
- Saved views
- bulk complete، reassign، snooze و export با permission

### H. Data Quality Console

- score کیفیت کلی و تفکیک completeness، duplicates، stale، invalid، conflict و orphan.
- صف issueها با severity، source، confidence، owner، suggested fix و evidence.
- duplicate merge به‌صورت preview دو ستونه، field-level selection، conflict explanation و rollback/audit.
- import wizard پنج مرحله‌ای: upload، mapping، validation، duplicate strategy، preview/commit.
- هر job progress، retry، partial failure و downloadable report داشته باشد.

### I. Enterprise / Admin

Admin باید یک **Control Center** باشد، نه مجموعه‌ای از جدول‌های جدا:

- Security posture
- Permission matrix
- Active sessions
- Integrations health
- Job/queue health
- Data retention
- Privacy cases
- Audit stream
- Backup/restore evidence
- Feature flags

این بخش می‌تواند dense و technical باشد، ولی باید با filter، status chip، incident detail و remediation CTA قابل استفاده بماند.

---

## ۵. Component و design system backlog

### P0 shared components

- `AppShellV2`: sidebar collapse، command palette، scope switcher، breadcrumbs و responsive behavior.
- `TodayCockpit` و `PriorityCard`.
- `Entity360Shell` و `EntityHeader`.
- `EntityPicker` / `EntityMultiPicker` با debounce، keyboard، recent، create-inline و selected label.
- `TimelineFeed` با event taxonomy، filter، pagination و deep link.
- `ScoreTrendCard` و `ExplainabilityPanel`.
- `QuickCaptureDrawer`.
- `MeetingBriefPanel`، `DecisionBuilder` و `FollowUpBuilder`.
- `DataTableV2` با server pagination، sorting، column visibility، bulk selection و saved views.
- `ConfirmDialog` به‌جای `alert/confirm` مرورگر.
- `MutationFeedback` برای saving/success/error/retry/conflict.
- `PermissionGate` برای hide/disable + دلیل قابل فهم.
- `OfflineBanner` و `StaleDataBanner`.

### قوانین visual

- یک palette semantic؛ component نباید hex مستقل تعریف کند.
- light/dark با token یکسان، نه دو implementation جدا.
- RTL واقعی با `margin-inline`، `padding-inline` و logical properties.
- فارسی به‌عنوان زبان اصلی محصول؛ English فقط برای technical/admin label در صورت نیاز.
- 8px spacing grid، radius و shadow ثابت.
- data density قابل تنظیم: Comfortable / Compact.
- focus state، keyboard navigation، contrast و reduced motion اجباری.
- وضعیت‌ها فقط با رنگ منتقل نشوند؛ icon + label + text explanation داشته باشند.
- skeleton باید فرم نهایی component را تقلید کند.

### Visual QA

1. برای هر P0 screen fixture ثابت بسازیم.
2. از route در viewportهای 1440، 1280، 1024، 768 و mobile screenshot بگیریم.
3. Network با مرجع موجود مقایسه‌ی pixel-level شود؛ `network-preview.html` دست‌نخورده بماند.
4. visual regression برای shell، table، dialog، picker، 360 header و graph ثبت شود.

---

## ۶. تغییرات Backend و قرارداد لازم

UI قوی بدون قرارداد مناسب دوباره به mock یا payload فنی برمی‌گردد. این API additions باید با همان authorization، pagination، idempotency و audit موجود ساخته شوند:

### Core experience API

- unified activity feed برای Organization، Person، Relationship، Meeting، Project و Opportunity.
- `next actions` و `priority queue` با reason، score، due date و source.
- saved views، filters و preferences per user/scope.
- search suggestions و global command search با entity type و permission filtering.
- bulk mutation با job status، partial result و idempotency.
- notification inbox با read/unread، snooze، action و deep-link.

### Relationship intelligence

- score snapshot history و factor explanation.
- warm path result با confidence، data source، last interaction و privacy mask.
- relationship health alert و stale threshold configuration.
- introduction draft/candidate با human approval و audit.

### Meeting/follow-up

- typed decisions، agenda items، minutes، action candidates و commitment candidates.
- apply endpoint با result per item، conflict و idempotency.
- follow-up draft و send/approve state.
- link source meeting به همه‌ی خروجی‌ها.

### Data quality

- issue queue با lifecycle: open، assigned، snoozed، resolved، rejected.
- merge preview/apply/rollback.
- import validation report، mapping template و retry failed rows.
- field provenance، confidence و last verified.

### Enterprise

- integration sync status، last success، next retry، rate-limit و dead-letter detail.
- workflow execution trace و per-step failure.
- privacy/export job state و download permission.
- audit evidence برای AI suggestion، data change، export، merge و permission change.

---

## ۷. برنامه‌ی اجرایی مرحله‌ای

### Phase 0 — Product contract و baseline

**مدت:** ۳ تا ۵ روز
**خروجی:** یک matrix واحد از endpoint → screen → action → permission → test.

- inventory کامل routeها و controllerها.
- تعیین primary user برای هر route: Executive، Relationship Manager، Project Manager، Analyst، Admin.
- freeze کردن visual baseline شبکه.
- تعریف event taxonomy و status taxonomy.
- تعریف naming و زبان UI.

**Acceptance:** هیچ endpoint اصلی بدون consumer یا تصمیم «admin/API-only» باقی نماند.

### Phase 1 — Shell و Design System V2

**مدت:** ۱ تا ۲ هفته

- AppShellV2، navigation گروه‌بندی‌شده، scope switcher، command palette.
- token cleanup و حذف page-specific drift.
- Dialog، Toast، Table، Picker، Timeline و PermissionGate مشترک.
- حذف `confirm()` از مسیرهای P0.

**Acceptance:** ۵ route اصلی در light/dark/RTL/mobile با component مشترک و بدون regression کار کنند.

### Phase 2 — Today Cockpit

**مدت:** ۱ تا ۲ هفته

- priority queue، overdue، due soon، stale relationships، upcoming meetings، approvals.
- quick capture از context.
- complete/snooze/reassign با mutation feedback.
- saved views و filter persistence.

**Acceptance:** کاربر با login بتواند از Today یک action واقعی، یک follow-up و یک meeting را بدون خروج از cockpit انجام دهد.

### Phase 3 — Organization / Person / Relationship 360

**مدت:** ۲ تا ۳ هفته

- Entity360Shell برای سه object اصلی.
- unified timeline و related records.
- score trend، health، owner، key contacts و next best action.
- create interaction/note/meeting/action از context.
- deep link دوطرفه بین graph و 360.

**Acceptance:** سناریوی «سازمان → رابطه → شخص → تعامل → action» بدون ورود UUID یا JSON خام کامل شود.

### Phase 4 — Meeting و Follow-up loop

**مدت:** ۲ هفته

- pre-meeting brief.
- typed notes/decisions/action/commitment builder.
- apply candidates با preview و نتیجه‌ی per item.
- follow-up draft و approval.
- calendar view و meeting reminders.

**Acceptance:** از ساخت meeting تا ثبت minutes، ایجاد action/commitment و follow-up قابل پیگیری، یک workflow browser-tested وجود داشته باشد.

### Phase 5 — Network → Intelligence → Action

**مدت:** ۱ تا ۲ هفته

- حفظ ظاهر مرجع graph.
- node/edge inspector.
- warm path و relationship explanation.
- CTA برای معرفی، interaction و task.
- risk، bridge، bottleneck و connector با drill-down.

**Acceptance:** انتخاب یک node در graph حداکثر با دو کلیک به 360 یا action منتهی شود؛ هیچ graph insight بن‌بست نباشد.

### Phase 6 — Execution و pipeline views

**مدت:** ۲ هفته

- Action/Commitment board، My work، overdue و calendar.
- Opportunity pipeline با stage aging و next step.
- Project overview با milestones، requirements، risks و linked relationships.
- bulk operation و saved views.

**Acceptance:** هر record اجرایی owner، due date، next step، source context و state قابل‌فهم داشته باشد.

### Phase 7 — Data Quality و Intelligence

**مدت:** ۲ هفته

- quality score و issue inbox.
- duplicate preview/merge/rollback.
- import wizard و validation report.
- signal → enrichment → recommendation → action.
- AI explainability و human approval.

**Acceptance:** هیچ AI/data mutation بدون preview، confidence، permission و audit اجرا نشود.

### Phase 8 — Enterprise Control Center و Integration

**مدت:** ۲ تا ۳ هفته

- integration catalog و health.
- workflow builder و execution trace.
- permissions، approvals، audit، privacy، retention و sessions.
- observability، queue، backup/restore و incident states.
- export control با policy و evidence.

**Acceptance:** Admin بتواند یک integration failure، یک access denial، یک privacy request و یک failed job را از ابتدا تا resolution دنبال کند.

### Phase 9 — Release و adoption

**مدت:** ۱ تا ۲ هفته

- Playwright/Cypress browser workflows.
- visual regression.
- API + PostgreSQL + Redis واقعی در CI.
- seed/demo workspace برای presentation.
- onboarding و empty-state content.
- performance budget و accessibility audit.

**Acceptance:** release gate بدون bypass:

- build/typecheck/lint
- unit/contract/integration
- browser workflows
- visual snapshots
- security/permission matrix
- mobile export
- migration/seed/rollback

---

## ۸. پوشش بدون حذف قابلیت‌ها

| حوزه‌ی موجود | سطح جدید تجربه | routeهای موجود که باید حفظ و ارتقا یابند |
|---|---|---|
| Organization | Organization 360 | `/organizations`, `/organizations/[id]` |
| People | Person 360 | `/people`, `/people/[id]` |
| Relationships | Relationship 360 + warm path | `/relationships`, `/relationships/[id]` |
| Interaction | Quick capture + timeline | `/interactions`, `/interactions/[id]` |
| Meeting | pre/during/post workspace | `/meetings`, `/meetings/[id]`, `/calendar` |
| Actions | Today + board + detail | `/today`, `/actions`, `/actions/[id]` |
| Commitments | follow-up cockpit | `/commitments`, `/commitments/[id]` |
| Projects | project control room | `/projects`, `/projects/[id]` |
| Opportunities | pipeline + relationship context | `/opportunities`, `/opportunities/[id]` |
| Network | graph → insight → action | `/network` |
| Requirements | project/relationship matching | `/requirements` |
| Recommendations/AI | explainable suggestions | `/recommendations`, `/recommendations/[id]`, `/intelligence`, `/ai`, `/ai-executive-brief` |
| Notes/Documents | contextual knowledge layer | `/notes`, `/documents`, `/knowledge` |
| Data Management | import, quality, duplicate resolution | `/data-management`, `/data-management/import`, `/data-management/quality`, `/data-quality`, `/data-lifecycle` |
| Reporting/Analytics | operational and executive dashboards | `/reports`, `/reports/export`, `/analytics` |
| Workflows/Jobs | automation with trace | `/workflows`, `/approvals` |
| Integrations | connector health and retry | `/integrations` |
| Enterprise/Governance | control center | `/enterprise`, `/governance`, `/authorization`, `/privacy`, `/security`, `/security-events`, `/sessions`, `/observability`, `/monitoring`, `/health` |
| Admin/master data | policy and configuration | `/admin/*`, `/settings` |

هیچ domain حذف نمی‌شود؛ فقط routeهای user-facing از حالت generic به workspace تخصصی تبدیل می‌شوند و routeهای technical/admin پشت Control Center منظم می‌شوند.

---

## ۹. معیارهای سنجش محصول

### Adoption

- زمان ثبت اولین Organization/Person: کمتر از ۶۰ ثانیه.
- زمان ثبت Interaction از یک 360 page: کمتر از ۳۰ ثانیه.
- زمان ساخت follow-up بعد از meeting: کمتر از ۹۰ ثانیه.
- درصد mutationهای P0 که بدون ورود ID خام انجام می‌شوند: **۱۰۰٪**.
- درصد mutationهای P0 با success/error/permission state: **۱۰۰٪**.

### Relationship operations

- درصد Relationshipهای strategic دارای owner و next step.
- درصد actionهای overdue و stale.
- median time از meeting finalize تا apply شدن follow-up.
- درصد warm pathهایی که به action یا introduction منجر می‌شوند.
- coverage افراد کلیدی سازمان‌ها.

### Data quality

- duplicate resolution rate.
- completeness score per organization/person.
- unresolved issue aging.
- import failure rate و retry success rate.
- درصد AI/data suggestions که با confidence و evidence نمایش داده می‌شوند.

### UX quality

- Web Vitals و response budget برای shell و detail.
- accessibility: keyboard، focus، contrast، screen-reader labels.
- visual regression صفر در صفحات P0.
- ۵ workflow browser-critical بدون flaky test.

---

## ۱۰. Definition of Done برای هر feature

هر feature فقط وقتی Done است که:

1. UI واقعی و route قابل استفاده داشته باشد؛ صرف endpoint یا table کافی نیست.
2. payload معنایی باشد؛ UUID، JSON خام و technical ID از کاربر معمولی خواسته نشود.
3. client validation و server validation هر دو فعال باشند.
4. permission قبل از action در UI و دوباره در backend اعمال شود.
5. loading، empty، error، forbidden، conflict، retry و success طراحی شده باشد.
6. mutation idempotent و request/correlation ID قابل رهگیری باشد.
7. listها pagination، sorting، filter و scope صحیح داشته باشند.
8. deep-link به entity context و timeline وجود داشته باشد.
9. audit برای تغییر حساس، export، merge، AI apply و permission change ثبت شود.
10. unit/contract، API integration و browser workflow تست داشته باشد.
11. RTL، mobile، dark mode و reduced motion بررسی شده باشد.
12. screenshot baseline در P0 ثبت شده باشد.

---

## ۱۱. اولین sprint پیشنهادی — خروجی کاملاً ملموس

برای شروع بدون پخش‌شدن scope، این ۱۰ ticket باید اول انجام شوند:

1. ساخت `ConfirmDialog` و جایگزینی تمام `confirm()`های P0.
2. نهایی‌کردن `EntityPicker` با recent، selected label، keyboard و create-inline.
3. ساخت `MutationFeedback` و اتصال به API error code/request ID.
4. ساخت `AppShellV2` با navigation فارسی و admin separation.
5. تبدیل `/today` به cockpit واقعی با داده‌ی action/commitment/meeting/relationship.
6. ساخت `Entity360Shell` و انتقال Organization/Person/Relationship به آن.
7. ساخت unified `TimelineFeed` برای سه 360 page.
8. ساخت `QuickCaptureDrawer` با context organization/person/relationship.
9. ساخت `MeetingBriefPanel` و `FollowUpBuilder` بدون JSON خام.
10. اضافه‌کردن اولین browser test: login → scope → organization → interaction → action → complete.

**خروجی قابل نمایش sprint:** کاربر وارد می‌شود، scope را انتخاب می‌کند، از Today یک priority را باز می‌کند، Organization 360 را می‌بیند، Interaction ثبت می‌کند، action می‌سازد و از همان صفحه آن را complete می‌کند.

---

## تصمیم نهایی

بهترین مسیر این نیست که همه‌ی routeها دوباره از صفر طراحی شوند یا قابلیت جدید بدون نظم اضافه شود. مسیر درست:

1. **Shell و primitives را یکدست کنیم.**
2. **Today را مرکز کار قرار دهیم.**
3. **سه 360 Workspace اصلی را بسازیم.**
4. **Meeting → Follow-up → Action/Commitment را به حلقه‌ی کامل تبدیل کنیم.**
5. **Network را به action متصل کنیم، بدون تغییر مرجع بصری.**
6. **Data Quality و AI را explainable و approval-aware کنیم.**
7. **Enterprise را در یک Control Center منسجم کنیم.**
8. **با browser، visual و زیرساخت واقعی release کنیم.**

این ترتیب بیشترین اثر را با کمترین حذف دارد: قابلیت‌های موجود حفظ می‌شوند، اما از حالت پراکنده و technical به تجربه‌ای سریع، جذاب و قابل اتکا برای کار روزانه تبدیل می‌شوند.
