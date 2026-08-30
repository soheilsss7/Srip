# ممیزی محصول و طرح ارتقای SRIP

**تاریخ ممیزی:** ۳۰ اوت ۲۰۲۶
**شاخه:** `arena/01a04fd2-srip`
**دامنه:** Backend، Web، Mobile، مدل داده، قرارداد API، پوشش UI و جریان‌های عملیاتی
**تصمیم ثابت:** `network-preview.html` در این مرحله بررسی یا تغییر داده نشده است و باید دست‌نخورده بماند.

---

## ۱. خلاصه مدیریتی

SRIP از نظر دامنه‌ی Backend یک هسته‌ی وسیع و ارزشمند دارد: سازمان، شخص، نقش سازمانی، رابطه، تعامل، جلسه، اقدام، تعهد، پروژه، فرصت، مسیر ارتباطی، امتیاز، پیشنهاد، سند، کیفیت داده، Workflow، اعلان، Audit، Privacy و Integration در مدل‌ها و Controllerها دیده می‌شوند.

اما محصول هنوز از یک **سیستم روزانه‌ی مدیریت تعاملات** فاصله دارد. مشکل اصلی کمبود route نیست؛ مشکل، فاصله‌ی بین API غنی و تجربه‌ی عملیاتی کاربر است:

- کاربر در چند نقطه هنوز باید UUID یا JSON خام وارد کند.
- پرونده‌ی یکپارچه‌ی Relationship/Organization/Person هنوز Workspace واقعی ۳۶۰ درجه نیست.
- بسیاری از صفحات فهرست/فرم روی abstractionهای generic (`CrudWorkspace`، `ResourceConsole`، `EntityWorkspace`) سوارند و context، validation، انتخابگر موجودیت، pagination و feedback کامل ندارند.
- Note در Schema و چند سرویس مصرف‌کننده وجود دارد، اما مسیر CRUD مستقل و UI مستقل برای آن وجود ندارد.
- مسیر جلسه شروع خوبی دارد، ولی قبل/بعد جلسه هنوز به فرم‌های خام و JSON تصمیم‌ها متکی است.
- Dashboard/Workspace فعلی بیشتر directory است؛ برای کارهای امروز، overdue، relationship review و follow-up یک Cockpit واقعی لازم است.
- ممیزی‌های موجود عمدتاً static/contract-level هستند و هنوز جای تست UI واقعی، mutation با دیتابیس واقعی و سناریوی end-to-end خالی است.

**نتیجه:** معماری و Backend ظرفیت ساخت محصول هدف را دارند، اما قبل از افزودن AI و Integrationهای بیشتر باید لایه‌ی Product Operations و 360 Workspace ساخته و به API متصل شود.

---

## ۲. شواهد و وضعیت قابل تکرار

| بخش | نتیجه‌ی مشاهده‌شده | تفسیر |
|---|---|---|
| Web TypeScript | PASS با `corepack pnpm --filter @srip/web typecheck` | کد Web از نظر TypeScript کامپایل می‌شود. |
| Web Production Build | PASS؛ ۷۱ صفحه‌ی build شد | وجود route و build سالم است، اما تکمیل Product را ثابت نمی‌کند. |
| Web frontend audit | PASS؛ ۱۰۵ فایل TS/TSX | secret-like material، direct fetch خارج از API layer و token storage قدیمی در scan فعلی پیدا نشد. |
| Web contract audit | PASS؛ ۴۳ Controller غیر-AI و ۷۹ route | فقط پوشش ساختاری و وجود route را تأیید می‌کند، نه قابل‌استفاده‌بودن UI. |
| Mobile TypeScript | PASS با `corepack pnpm --filter @srip/mobile typecheck` | اپ Mobile از نظر TypeScript سالم است. |
| API TypeScript / Build | FAIL؛ به‌دلیل Generated Prisma Client موجود/همگام نیست، حدود ۱۰۶۰ خطای زنجیره‌ای | این یک release blocker محیط/فرآیند است؛ ابتدا باید `prisma generate` در نصب/CI تضمین شود. |
| Prisma generate در این محیط | FAIL به‌دلیل قطع TLS هنگام دریافت engine از `binaries.prisma.sh` | علت محیطی است، اما فرآیند نصب باید خطای واضح و قابل‌رفع داشته باشد. |
| Backend verification script | قبل از اجرا در مرحله‌ی `pnpm install` متوقف شد چون فقط binary به نام `pnpm` را می‌پذیرد، درحالی‌که این محیط با Corepack قابل اجراست | اسکریپت verification باید Corepack یا `npm exec pnpm` را نیز پشتیبانی کند. |
| UI E2E واقعی | در `apps/web` تست Playwright/Cypress قابل مشاهده نیست | برای معیار پذیرش محصول کافی نیست و باید اضافه شود. |

> خطاهای API مانند نبودن `ActionStatus`، `Prisma` و delegateهای `relationship`/`meeting`/`action`/… نشانه‌ی نبودن client تولیدشده‌ی متناسب با Schema هستند. این خطاها را نباید به‌عنوان ۱۰۶۰ نقص مستقل در منطق دامنه شمرد؛ بااین‌حال تا رفع آن، API قابل build/release نیست.

### دستورات ممیزی

```bash
corepack pnpm --filter @srip/web typecheck
corepack pnpm --filter @srip/web build
corepack pnpm --filter @srip/web run audit
corepack pnpm --filter @srip/web run audit:contract
corepack pnpm --filter @srip/mobile typecheck
corepack pnpm --filter @srip/api typecheck
```

---

## ۳. نقشه‌ی کامل Backend به UI

قرارداد استخراج‌شده شامل **۳۱۳ endpoint** است که **۶ endpoint مربوط به AI** کنار گذاشته شده و در نتیجه **۳۰۷ endpoint غیر-AI** در ۴۳ Controller غیر-AI وجود دارد:

- `GET`: ۱۳۷
- `POST`: ۱۱۵
- `PATCH`: ۳۰
- `DELETE`: ۲۳
- `PUT`: ۲

جدول زیر endpoint family، صفحه‌ی فعلی، component/form غالب، permission و وضعیت کاربردی را ثبت می‌کند. این جدول مبنای backlog اجرایی است؛ PASS در ستون UI فقط به معنی وجود صفحه و اتصال اولیه است، نه قبولی معیار محصول.

### ۳.۱ دامنه‌ی اصلی و عملیات روزانه

| Controller / endpoint family | صفحه و component فعلی | Permission اصلی | وضعیت فعلی / شکاف | اولویت |
|---|---|---|---|---|
| `organizations`: `GET /`, `GET /:id`, `GET /:id/timeline`, `POST /`, `PATCH /:id`, `PATCH /:id/archive`, `POST /:id/restore` | `/organizations` و `/organizations/[id]`؛ صفحه‌ی فهرست اختصاصی و detail اختصاصی | `org.read`, `org.write`, `data.restore` | فهرست خوب‌تر از generic است؛ detail هنوز key/value فنی و فاقد Organization 360 کامل، افراد کلیدی، جلسات، فرصت‌ها، اسناد، ریسک و action cockpit است. | P0 |
| `core-domain` سازمان: relationship types، units، organization contacts | `/organizations/[id]`؛ فرم Unit و Contact | `relationship.read/write`, `org.read/write` | Unit picker واقعی دارد؛ contact فقط create دارد و edit/delete مستقل ندارد. | P1 |
| `people`: فهرست، detail، timeline، سازمان‌های فرد، archive/restore | `/people` و `/people/[id]` | `person.read`, `person.write`, `data.restore` | فهرست و scoreها مناسب‌تر است؛ افزودن سازمان در detail هنوز `Organization ID` خام دارد. Person 360، نقش‌ها و ارتباطات مستقیم کامل نیست. | P0 |
| `relationships`: list/detail/timeline/create/update/lifecycle/archive/restore | `/relationships` و `/relationships/[id]` | `relationship.read`, `relationship.write`, `data.restore` | لیست score/filter و picker سازمان دارد؛ detail فقط چند score فعلی و Timeline ساده دارد؛ history، contacts، interactions، meetings، risk/opportunity و next action یکپارچه نیست. | P0 |
| `relationship score`: `POST /relationships/:id/recalculate-score` | `/relationships/[id]` | `relationship.write` | mutation متصل است، ولی trend، دلیل تغییر، actor و snapshot history در UI نمایش داده نمی‌شود. | P1 |
| `interactions`: list، `timeline/:relationshipId`، detail، create/update/delete | `/interactions` و `/interactions/[id]`؛ Timeline اختصاصی | `interaction.read`, `interaction.write` | Timeline خوب شروع شده؛ create/edit نیازمند entity picker، channel taxonomy، validation، optimistic/success feedback و اتصال کامل به Relationship 360 است. | P0 |
| `meetings`: list/detail/create/update/outcome/participants/delete | `/meetings` و `/meetings/[id]` | `meeting.read`, `meeting.write` | مسیر کامل‌تر است، اما participant و context باید picker باشند؛ outcome شامل `Decisions (JSON)` است؛ brief و post-meeting تبدیل خروجی به Action/Commitment باید Workspace مرحله‌ای شود. | P0 |
| `meetings/:id/minutes`, `finalize`, `action-items/extract`, `action-items/apply`, `follow-ups/list` | `/meetings/[id]` | `meeting.read/write`, سپس `action.write`/`commitment.write` | extraction قطعی و قابل تأیید وجود دارد؛ UI باید candidate builder، تصمیم builder، owner picker، موعد، نوع Action/Commitment و نتیجه‌ی هر mutation را ارائه کند. | P0 |
| `actions`: list/detail/create/update/delete، overdue/due-soon، dependencies | `/actions` و `/actions/[id]` با `CrudWorkspace` | `action.read`, `action.write` | endpointها وجود دارند؛ فرم generic است، IDهای خام و نبود filter cockpit/board/bulk action دارد. | P0 |
| `commitments`: list/detail/create/update/delete، overdue/due-soon، sweep، mark-overdue | `/commitments` و `/commitments/[id]` با `CrudWorkspace` | `commitment.read`, `commitment.write` | از نظر API پوشش خوب؛ UI برای Follow-up Cockpit، owner، risk، source meeting و وضعیت جمعی کافی نیست. | P0 |
| `core-domain` referrals | `/referrals` با `EntityWorkspace` | `relationship.read/write` | source/target person/org و relationship به UUID خام متکی است؛ create/update محدود و detail/Timeline ندارد. | P1 |
| `core-domain` action dependencies | در detail Action | `action.write` | فقط endpoint-level action است؛ dependency picker، cycle error و dependency graph در UI لازم است. | P2 |

### ۳.۲ Execution، شبکه و Intelligence

| Controller / endpoint family | صفحه و component فعلی | Permission اصلی | وضعیت فعلی / شکاف | اولویت |
|---|---|---|---|---|
| `projects`: CRUD، requirements، relationships، risks، milestones | `/projects` با `CrudWorkspace` و `/projects/[id]` اختصاصی | `project.read`, `project.write` | detail نسبتاً پرقابلیت است؛ list generic و associationها باید picker و قابل‌فیلتر شوند؛ project باید context عملیاتی سازمان/رابطه را نشان دهد. | P1 |
| `opportunities`: CRUD | `/opportunities` با `CrudWorkspace` و detail | `opportunity.read`, `opportunity.write` | IDهای organization/project/relationship خام؛ pipeline، next step، owner، value history و relation context لازم است. | P1 |
| `requirements`: `GET /requirements/:id/matches` | `/requirements` | `project.read` | کاملاً به Requirement ID خام و محاسبه‌ی یک‌باره متکی است؛ باید از Project/Requirement detail و Network/Connector قابل دسترسی باشد. | P1 |
| `network`: graph/path/centrality/bridges/bottlenecks/single-points/connectors/person-relationships CRUD | `/network`؛ graph component اختصاصی و style مرجع | `network.read`, `relationship.write` | live graph به Backend متصل است و ظاهر مرجع باید حفظ شود؛ operational actions مثل انتخاب Connector، ساخت رابطه، drill-down به Person/Org 360 و permission state باید کامل‌تر شود. `network-preview.html` خارج از scope این مرحله است. | P1 |
| `analytics`: status/summary/network/workflows/recommendations funnel، outcomes/events | `/analytics` و بخشی در `/dashboard` | `analytics.read/write` | گزارش‌های پایه وجود دارد؛ Dashboard باید operational KPI و action queue بدهد، نه فقط metrics. | P1 |
| `intelligence`: explain/recalculate/history/risk signals/score versions/calibration/opportunity/coverage/network | `/intelligence` | `relationship.read/write`, `network.read` | مسیرهای تخصصی وجود دارند؛ UI هنوز بیشتر admin/technical است و explainability باید در context هر Relationship/Meeting دیده شود. | P1 |
| `scoring`: recalculateهای relationship/opportunity/risk/connector/network و version/calibration CRUD | `/admin/scoring` و `/intelligence` | `scoring.admin` و domain read/write | version/calibration در UI عمومی عملیات روزانه نیست؛ باید public read-only score explanation و admin calibration تفکیک شود. | P2 |
| `recommendations`: list/detail/explain/generate/view/accept/approve/reject/snooze/assign/execute | `/recommendations` و detail | `recommendation.read`, `recommendation.write` | پوشش endpoint خوب؛ اجرای پیشنهاد باید در context رابطه/جلسه انجام شود و stateهای generated/approved/executed/failed واضح باشند. | P1 |
| `search`: search، saved CRUD و run | `/search` | `search.read`, `search.write` | search مرکزی وجود دارد؛ نتیجه‌ی Note عملاً بدون Note CRUD ناقص است؛ باید global command palette و deep-link 360 اضافه شود. | P1 |

### ۳.۳ اسناد، داده و Governance

| Controller / endpoint family | صفحه و component فعلی | Permission اصلی | وضعیت فعلی / شکاف | اولویت |
|---|---|---|---|---|
| `documents`: list/status/detail/signed-url/upload/index | `/documents`؛ upload و indexing متصل | `document.read`, `document.write` | اتصال API واقعی است؛ organization در UI قبلی UUID خام بوده؛ classification، scan/index status، relation attach و error/retry باید بهتر شود. | P1 |
| `Note` model و مصرف‌کننده‌های search/privacy/tags/custom-fields | `/knowledge` فقط به `/documents` redirect می‌کند | مدل مجوز مشخص برای CRUD مستقل ندارد | **شکاف قطعی:** controller/service مستقل برای Note دیده نشد؛ کاربر نمی‌تواند Note را به‌صورت first-class ثبت/ویرایش/حذف و در 360 Timeline مشاهده کند. | P0 |
| `data-management`: import preview/report/approve، quality، scan، duplicates/detect | `/data-management`, `/data-management/import`, `/data-management/quality`, `/data-quality` | `data.import`, `data.import.approve`, `data.quality.read/execute` | دامنه قوی است؛ resolution workflow برای duplicate، ownership و remediation هنوز باید عملیاتی شود. | P1 |
| `custom-fields`: definition/value CRUD | `/admin/custom-fields` | `admin.custom_fields`, `entity.read/write` | UI admin generic است؛ custom field renderer در فرم‌های Organization/Person/Relationship وجود ندارد. | P1 |
| `tags`: tag CRUD و entity assignment | `/admin/tags` | `tag.read`, `tag.write` | مدیریت tag وجود دارد؛ tag picker و filter در 360/listهای اصلی یکپارچه نیست. | P1 |
| `admin`: overview/users/orgs/roles/permissions/tags/master data/workflows/integrations/audit/custom fields/scoring/notification rules/AI settings | `/admin/*` و `/authorization` | عمدتاً `enterprise.admin` | چند صفحه فقط read-only console هستند و mutation/permission-aware feedback ندارند؛ admin باید از عملیات روزانه جدا ولی کامل باشد. | P1 |
| `authorization`: roles/memberships/permission evaluate | `/authorization`, `/admin/roles`, `/admin/permissions` | `role.manage`, `access.manage` | permission catalog نمایش داده می‌شود؛ membership assignment و effective-access simulator باید UI کامل داشته باشد. | P1 |
| `approvals`: list/request/approve/reject | `/approvals` | `approval.read/request/decide` | flow وجود دارد ولی `entityId` خام است؛ entity picker و نمایش diff/دلیل تصمیم لازم است. | P1 |
| `reporting`: `GET /reports/:kind`, export | `/reports`, `/reports/export` | `report.read`, `report.export` | export approval/audit خوب طراحی شده؛ report builder/filter و وضعیت async export نیازمند تکمیل است. | P1 |
| `privacy`: policy/consents/requests/export/access/erase/retention/audit | `/privacy`, `/admin/retention` | `privacy.*` | پوشش governance خوب؛ UX برای request lifecycle، evidence و approval باید خواناتر شود. | P2 |
| `enterprise`: overview/policies/exports/security-events/feature-flags | `/enterprise`, `/admin/exports`, `/admin/feature-flags` | `enterprise.*`, `feature_flag.*` | بیشتر console/technical؛ برای admin سازمانی قابل قبول، برای مدیر تعاملات اولویت پایین‌تر دارد. | P2 |
| `security`: events/governance preflight/exports | `/security`, `/security-events`, `/governance` | `security.read`, `enterprise.security`, `audit.read` | read مسیر دارد؛ export/incident workflow و filterهای عملیاتی لازم است. | P2 |
| `audit`: list | `/admin/audit` | `audit.read` | read-only table؛ فیلتر entity/actor/date، before/after diff و deep-link لازم است. | P1 |
| `sessions`: list/revoke/revoke-all/admin revoke | `/sessions`, `/admin/sessions` | `session.admin.revoke` | مسیرهای امنیتی وجود دارد؛ UI admin هنوز برای session/user به شناسه‌ی خام نیاز دارد. | P2 |
| `notifications`: status/list/unread/read-all/preferences/digest/delivery/push | `/notifications` | notification-specific | اعلان‌ها وجود دارند؛ notification center باید به Action/Commitment/Review و deep-link context متصل شود. | P1 |
| `integrations`: list/authorize/callback/sync/runs/delete و webhook | `/integrations` | `integration.read/write` | OAuth/sync endpoint وجود دارد؛ provider health، mapping conflict و retry باید UI عملیاتی داشته باشد. | P2 |
| `workflows`: list/create/execute/trigger/resume/approval/decision | `/workflows` | `workflow.read/write/execute` | صفحه بیشتر execution console است؛ builder و execution trace لازم است. | P2 |
| `data-lifecycle`: status/restore/permanent-delete | `/data-lifecycle` و detailهای archive/restore | `data.lifecycle_status`, `data.restore`, `data.permanent_delete` | موجود است؛ برای عملیات روزانه نباید در مسیر اصلی دیده شود، ولی audit/approval و bulk scope باید روشن باشد. | P2 |
| `health`, `metrics`, `observability`, `users` | `/health`, `/metrics`, `/monitoring`, `/observability` | system/admin permissions | برای Ops مناسب؛ بخشی از این صفحات نباید در navigation مدیر تعاملات عادی نمایش داده شوند. | P2 |

### ۳.۴ Auth و AI

| حوزه | endpoint / UI | نتیجه |
|---|---|---|
| Auth | `/auth/register`, `/login`, `/refresh`, `/logout`, password reset، verify، OIDC، MFA؛ صفحات `/login`, `/register`, `/password-reset`, `/mfa` | مسیر اصلی وجود دارد. در `apps/api/src/main.ts` فهرست `publicPrefixes` با نام واقعی password-reset و email-verify هم‌نام نیست؛ این موضوع metadata Swagger/امنیت مستندشده را نادرست می‌کند و باید اصلاح شود. |
| AI | `/ai/status`, `/provider-health`, `/usage`, `/executive-brief`, `/query`, `/retrieve`؛ صفحات `/ai`, `/ai-executive-brief` | باید پس از تثبیت data quality، 360 و workflow استفاده شود؛ AI نباید جایگزین ثبت قطعی Interaction/Meeting/Action/Commitment شود. |

---

## ۴. یافته‌های مهم UI و UX

### P0 — شکاف‌هایی که مانع محصول هدف هستند

1. **نبود Note به‌عنوان موجودیت first-class**
   - `Note` در Schema با `title`, `body`, `organizationId`, `personId`, `createdById` وجود دارد.
   - Search، Privacy، Tags و Custom Fields آن را مصرف می‌کنند.
   - اما controller/service مستقل و مسیر `/notes` دیده نشد.
   - `/knowledge` صرفاً به `/documents` redirect می‌کند.
   - نتیجه: بخش مهمی از حافظه‌ی ارتباطی قابل ثبت و مشاهده‌ی استاندارد نیست.

2. **Relationship 360 هنوز ناقص است**
   - detail فعلی در `apps/web/app/relationships/[id]/page.tsx` عمدتاً score فعلی، مالک، مرحله و Timeline ساده را نشان می‌دهد.
   - باید یک Workspace واحد برای score trend، افراد کلیدی، تعاملات، جلسات، Noteها، Actionها، Commitmentها، فرصت‌ها، ریسک، مسیر ارتباط و audit بسازد.

3. **Organization و Person detail هنوز key/value فنی هستند**
   - در detailها objectها با `JSON.stringify` و field key فنی نمایش داده می‌شوند.
   - برای استفاده‌ی روزانه باید labels محلی، sectionهای معنایی، edit inline، contact card، role card و deep-linkهای context وجود داشته باشد.

4. **فرم‌های generic برای موجودیت‌های اصلی کافی نیستند**
   - `CrudWorkspace` در `apps/web/app/_components/crud-workspace.tsx` فیلدها را از config خام تولید می‌کند.
   - این component به‌طور عمومی validation معنایی، entity picker، pagination، bulk action، success toast، conflict/version handling و permission-aware field hiding ندارد.
   - `permission` در type config وجود دارد، اما خود component آن را enforce/render نمی‌کند؛ enforcement واقعی فقط به Backend واگذار شده و UX مربوط به مجوز ناقص است.

5. **UUID و شناسه‌ی فنی در مسیرهای معمول**
   - `QuickCreate` در `apps/web/app/_components/quick-create.tsx` برای Person، Relationship و سایر موجودیت‌ها ID خام می‌خواهد.
   - People detail برای افزودن سازمان `Organization ID` می‌خواهد.
   - Meetings برای Organization/Relationship ID فرم خام دارد.
   - Approvals و Requirements نیز entityId/Requirement ID خام می‌خواهند.
   - راه‌حل: `EntityPicker` مشترک با جست‌وجو، scope، recently used، create inline و نمایش نام/نوع/وضعیت.

6. **Meeting Workspace به فرم خام و JSON تصمیم‌ها متکی است**
   - `apps/web/app/meetings/[id]/page.tsx` فیلد `Decisions (JSON)` دارد.
   - باید `DecisionBuilder` با ردیف‌های تصمیم، owner، deadline، rationale و تبدیل مستقیم به Action/Commitment ساخته شود.

7. **Follow-up Cockpit وجود ندارد**
   - endpointهای overdue/due-soon در Actions و Commitments موجودند.
   - اما صفحه‌ی روزانه‌ی یکپارچه برای امروز، overdue، تعهدات باز، relationshipهای stale، reviewهای نزدیک و موارد بدون owner وجود ندارد.

### P1 — ارتقاهای لازم برای بلوغ محصول

- pagination/cursor و server-side filtering در فهرست‌های اصلی؛ generic list فعلی غالباً فقط یک پاسخ اولیه می‌گیرد.
- state استاندارد برای loading، initial empty، filtered empty، error با retry، forbidden، saving، saved و stale conflict.
- toast/inline confirmation استاندارد به‌جای اتکا به `alert/confirm` مرورگر.
- تاریخچه‌ی score/status و دلیل/actor، نه فقط مقدار فعلی.
- renderer استاندارد برای custom fields و tags در همه‌ی 360 Workspaceها.
- فیلتر Timeline بر اساس نوع رویداد، channel، owner، date، status و source.
- دسترسی به Create/Update/Delete در UI بر اساس permission واقعی و scope؛ نه فقط شکست بعد از submit.
- قابلیت keyboard، responsive desktop/tablet و RTL واقعی در componentهای shared.

### P2 — تکمیل Enterprise و Scale

- Workflow builder و execution trace کامل.
- Integration mapping/conflict/retry و calendar/email sync.
- Privacy request case management، retention evidence و export governance پیشرفته.
- گزارش‌ساز مدیریتی و snapshotهای trend.
- observability dashboard برای تیم Platform، جدا از navigation مدیر تعاملات.

---

## ۵. معماری محصول پیشنهادی

### ۵.۱ Navigation اصلی

به‌جای نمایش ۷۹ route به‌صورت لینک‌های هم‌سطح، navigation باید حول کار روزانه باشد:

1. **Today / Cockpit**
   - کارهای امروز، overdue، تعهدات نزدیک، جلسه‌ی بعدی، relationshipهای stale، هشدارهای ریسک و approvalهای منتظر.
2. **Organizations**
   - directory، hierarchy، Organization 360.
3. **People**
   - directory، نقش/نفوذ/دسترسی، Person 360.
4. **Relationships**
   - health/risk/strategic، Relationship 360 و Network.
5. **Interactions & Meetings**
   - Timeline، Quick Capture، Meeting Workspace.
6. **Execution**
   - Actions، Commitments، Projects، Opportunities.
7. **Insights**
   - Search، Network، Reports، Recommendations، Intelligence.
8. **Admin / Governance**
   - Data Quality، Import، Documents/Notes، Permissions، Audit، Integrations، Privacy.

`/workspace` باید از فهرست لینک‌ها به launchpad عملیاتی با KPI، saved views و quick actions تبدیل شود.

### ۵.۲ Componentهای مشترک لازم

- `EntityPicker<T>`: جست‌وجو، debounce، scope، keyboard، empty/error، create inline.
- `EntityMultiPicker<T>`: برای participant، افراد کلیدی، tags و رابطه‌های مرتبط.
- `RelationshipContext`: سازمان مبدأ/مقصد، health، owner، last/next interaction.
- `TimelineFeed`: رویدادهای استاندارد با filter، pagination و deep-link.
- `ScoreTrendCard`: current، trend، snapshot، reason، actor.
- `QuickCaptureDrawer`: Interaction، Meeting، Note، Action، Commitment در context فعلی.
- `MeetingBriefPanel`: خلاصه رابطه، آخرین تعامل، ریسک، افراد مهم، objective و agenda.
- `DecisionBuilder` و `FollowUpBuilder`.
- `MutationFeedback`: saving/success/error/retry/requestId/conflict.
- `PermissionGate`: hide/disable با توضیح، نه فقط ارسال request و نمایش 403.
- `DataTable`: server pagination، sorting، filter chips، column visibility، bulk selection.
- `Entity360Shell`: header، status/score، tabs، timeline، related records و activity composer.

### ۵.۳ قرارداد frontend برای هر mutation

هر mutation باید این چرخه را داشته باشد:

1. precondition و client validation؛
2. permission/scope check در UI؛
3. picker و payload معنایی، بدون UUID دستی؛
4. `saving` و جلوگیری از submit تکراری؛
5. idempotency key از API client؛
6. success feedback با نام موجودیت و امکان Undo/بازگشت در صورت امکان؛
7. refresh دقیق query و حفظ context؛
8. نمایش `ApiError.code`, `requestId` و field errors؛
9. state مخصوص `403`, `404`, `409`, `429` و offline؛
10. تست happy path، validation، forbidden، error و retry.

---

## ۶. برنامه‌ی اجرای مرحله‌ای

### فاز صفر — Release Gate و تثبیت قرارداد

**هدف:** API واقعاً build/test شود.

- تولید Prisma Client متناسب با `schema.prisma` در install/CI/Docker.
- اصلاح verification script برای Corepack و fail واضح در نبود Postgres/Redis.
- اجرای `prisma generate`, `migrate deploy`, seed، API typecheck/build و unit/integration test در CI.
- اصلاح public route metadata در `main.ts` برای password reset، email verify و OIDC.
- تولید OpenAPI معتبر از runtime و contract test برای تمام ۳۰۷ endpoint غیر-AI.
- `network-preview.html` بدون تغییر باقی بماند.

**خروجی قبولی:** `api typecheck`, `api build`, migration، seed و smoke test با دیتابیس واقعی PASS.

### فاز یک — هسته‌ی روزانه و 360

ترتیب پیشنهادی:

1. `Today / Follow-up Cockpit`
2. `Organization 360`
3. `Person 360`
4. `Relationship 360`
5. `Quick Capture`
6. `EntityPicker` و حذف UUID از مسیرهای اصلی
7. Note CRUD و Timeline یکپارچه

**خروجی قبولی:** مدیر بتواند بدون ترک context یک سازمان/شخص/رابطه، Interaction، Note، Meeting، Action و Commitment ثبت کند و نتیجه را در Timeline ببیند.

### فاز دو — Meeting Intelligence عملیاتی و Execution

- Pre-meeting Brief با داده‌ی واقعی Relationship 360.
- Meeting notes/outcome/decisions با builder.
- participant picker و role/attendance.
- تبدیل decision به Action/Commitment با owner و deadline.
- Follow-up state machine، reminder و overdue cockpit.
- Project/Opportunity association با picker و context.

**خروجی قبولی:** جلسه از آماده‌سازی تا follow-up بدون JSON خام و بدون UUID دستی مدیریت شود.

### فاز سه — Data Quality، Search و Reports

- duplicate resolution با merge preview و audit.
- completeness score برای Organization/Person/Relationship.
- stale relationship review queue.
- Search با deep-link و Noteهای واقعی.
- report filters، saved views، export async و approval state.

### فاز چهار — Network و Intelligence در context

- حفظ ظاهر مرجع Network و عدم دست‌کاری Preview فعلی.
- drill-down graph به Person/Organization/Relationship 360.
- Connector recommendation با اقدام مستقیم.
- score explanation/trend در پرونده‌ی رابطه.
- AI brief/query فقط روی داده‌ی سالم و با citation به recordهای داخلی.

### فاز پنج — Integration و Enterprise scale

- تقویم و Email پس از تثبیت Interaction/Meeting.
- webhook/sync retry و mapping UI.
- Workflow builder.
- Privacy/retention/export governance پیشرفته.
- auditability و observability عملیاتی.

---

## ۷. ماتریس تست UI و Acceptance Test

برای هر دامنه‌ی مهم، تست باید با API واقعی یا contract-faithful test server اجرا شود؛ mock صرفاً برای unit component مجاز است.

| سناریو | مسیر | الزام‌های تست |
|---|---|---|
| Auth و session | Login → refresh → logout | loading، خطای اعتبارسنجی، refresh همزمان، redirect پس از 401، پاک‌شدن session |
| Organization 360 | create → picker → detail → archive/restore | duplicate، scope، 403، contacts/units، Timeline، success/error feedback |
| Person 360 | create → assign organization → contact → detail | entity picker، role، primary org، contact validation، deep-link |
| Relationship 360 | create → score → interaction → timeline | organization picker، status/lifecycle، score trend، owner، risk، stale state |
| Quick Capture | note/interaction/action/commitment/meeting | submit سریع، حفظ context، entity picker، keyboard، cancel، duplicate submit |
| Meeting | brief → participants → outcome → decisions → finalize | بدون JSON خام، تصمیم builder، تبدیل به Action/Commitment، idempotency، finalize state |
| Follow-up Cockpit | today/overdue/due-soon | filter، owner، bulk status، empty state، retry، deep-link به record |
| Documents/Notes | upload/index/note CRUD | progress، scan/index status، file error، classification، Timeline و search |
| Data Quality | scan → duplicate → resolve | preview، permission، merge conflict، audit، remediation state |
| Search/Network | search → result → graph → 360 | result type، no-result، permission filtering، graph selection، path/connector action |
| Approval/Export | request → approve/reject → download | entity picker، diff، two-person permission، pending/error/expired state |
| Admin/RBAC | role/membership/evaluate | effective permission، 403، scope، audit، جلوگیری از privilege escalation |
| Mobile/offline | create offline → queue → reconnect | stable idempotency key، queue state، permanent vs transient failure، sync feedback |

**Definition of Done هر صفحه:**

- route و API واقعی؛
- DTO/schema و client validation؛
- entity picker برای تمام foreign keyها؛
- loading/error/empty/forbidden/success؛
- permission-aware rendering؛
- pagination/filter واقعی؛
- mutation feedback و idempotency؛
- تست UI happy/negative/permission؛
- RTL و responsive؛
- deep-link و حفظ context؛
- عدم نیاز به UUID یا JSON خام برای عملیات عادی.

---

## ۸. تصمیم‌های اجرایی نهایی

1. **در این مرحله هیچ تغییری در `network-preview.html` داده نمی‌شود.**
2. اولویت فوری، رفع release blocker مربوط به Prisma generation و سپس ساخت `Today + 360 + Quick Capture` است.
3. Route count و contract audit به‌تنهایی معیار تکمیل نیستند؛ معیار، انجام موفق workflow توسط کاربر واقعی است.
4. AI و Integration بعد از ثبت دقیق داده و پایدارشدن workflow اصلی اجرا می‌شوند.
5. abstractionهای generic برای admin/read-only قابل استفاده‌اند، اما Organization/Person/Relationship/Meeting/Action/Commitment باید componentهای domain-specific داشته باشند.
6. هر endpoint مهم باید owner UI، permission، mutation، state و تست مشخص داشته باشد؛ endpoint بدون UI عملیاتی یا UI بدون endpoint واقعی «feature کامل» محسوب نمی‌شود.
