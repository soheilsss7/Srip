# SRIP — قرارداد محصول و Baseline رسمی Phase 0

**نسخه:** `2026.08.30`
**وضعیت:** تکمیل و verify شده
**منبع roadmap:** [`PRODUCT_UPGRADE_PLAN_2026.md`](./PRODUCT_UPGRADE_PLAN_2026.md)
**checklist اجرایی:** [`PRODUCT_UPGRADE_EXECUTION_CHECKLIST_2026.md`](./PRODUCT_UPGRADE_EXECUTION_CHECKLIST_2026.md)
**شاخه:** `arena/01a04fd2-srip`

## ۱. خروجی رسمی و source of truth

قرارداد machine-readable در [`PRODUCT_CONTRACT_PHASE0.json`](./PRODUCT_CONTRACT_PHASE0.json) ثبت شده است. این فایل source of truth ماتریس رسمی زیر است:

```text
endpoint → screen/consumer surface → action → permission + scope → test plan
```

برای هر endpoint این فیلدها ثبت شده‌اند:

- method، route، API route با prefix واقعی `/api/v1`، controller، handler، source file و source line؛
- domain، classification و consumer surface؛
- screenهای مصرف‌کننده یا تصمیم صریح `API-only`، `Integration-only` یا `Background job`؛
- action فنی handler و `productAction` قابل فهم برای workflow؛
- permission، منبع permission (decorator، guard یا policy)، access و scope؛
- personaهای اصلی، `productOwner` و `technicalOwner`؛
- state matrix کامل `loading`، `empty`، `error`، `forbidden`، `offline`، `success` و `conflict`؛
- test plan و test IDهای deterministic برای contract، unit، integration و browser.

### نمونه‌ی matrix

| Endpoint | Consumer / screen | Action | Permission / scope | Test plan |
|---|---|---|---|---|
| `POST /actions` | `/actions`، `/today` | `post create` / `create-assign-complete` | `action.write` / organization + role/ownership | `phase0.endpoint.post-actions.contract/unit/integration/browser` |
| `POST /commitments/follow-up/sweep-overdue` | Scheduler/worker و Today follow-up queue | `post sweep` / `sweep-overdue-follow-ups` | `commitment.write` / organization + role/ownership | contract، unit، integration، browser |
| `POST /integrations/webhooks/:provider` | External provider webhook adapter | `post webhook` / `verify-ingest-deduplicate` | webhook signature، replay window و event-id policy | contract، unit، integration، browser |
| `GET /metrics` | Prometheus و internal monitoring | `get prometheus` / `scrape-runtime-metrics` | InternalMetricsGuard و internal CIDR policy | contract، unit، integration |
| `GET /admin/overview` | Admin Control Center | `get overview` / `configure-and-govern` | class-level `enterprise.admin` | contract، unit، integration، browser |

جدول کامل ۳۴۲ endpoint در JSON است و عمداً در این سند تکرار نشده تا یک source of truth باقی بماند.

## ۲. inventory واقعی repository

Verifier در source واقعی repository اجرا می‌شود و inventory را از decoratorهای controller، فایل‌های route و source tree استخراج می‌کند؛ فهرست مسیرها در JSON موجود است.

| سطح | تعداد | روش استخراج |
|---|---:|---|
| API controller file | ۴۵ | تمام `apps/api/src/**/*.controller.ts` |
| API endpoint | ۳۴۲ | `@Get`، `@Post`، `@Put`، `@Patch`، `@Delete` و `@All` |
| Web page source | ۸۲ | تمام `apps/web/app/**/page.tsx` |
| Mobile route/source file | ۵۷ | تمام `apps/mobile/src/app/**/*.{ts,tsx}` |
| Prisma model | ۸۹ | modelهای `apps/api/prisma/schema.prisma` |

طبقه‌بندی endpointها در baseline:

| Classification | تعداد |
|---|---:|
| `User-facing workflow` | ۲۴۲ |
| `Admin workflow` | ۹۱ |
| `Background job` | ۱ |
| `Integration-only` | ۱ |
| `API-only` | ۷ |

بنابراین endpointی بدون consumer یا تصمیم صریح باقی نمانده است. `API-only` به‌معنای حذف capability نیست؛ consumer آن runtime، telemetry، Prometheus، health probe یا API integration ثبت شده است.

## ۳. ownership، persona، permission و scope

Persona registry مشترک شامل این نقش‌هاست:

- `Executive / مدیر ارشد`
- `Relationship Manager / مدیر روابط`
- `Project Manager / مدیر پروژه`
- `Analyst / تحلیل‌گر`
- `Standard User / کاربر عادی`
- `Holding Admin / مدیر هلدینگ`
- `Subsidiary Admin / مدیر شرکت تابعه`
- `Platform Admin / مدیر پلتفرم`

هر endpoint حداقل یک persona، یک owner محصول و یک owner فنی دارد. owner محصول در `productOwner` و تیم پاسخ‌گوی فنی در `technicalOwner` ثبت شده‌اند؛ `owner` برای سازگاری با consumerهای قبلی همان owner محصول است. در جاهایی که source code owner دقیق‌تری اعلام نمی‌کند، `API Platform` به‌عنوان تیم accountable فنی ثبت شده است، نه به‌عنوان ادعای نام یک فرد.

Permission از `@RequirePermission` در سطح method یا class استخراج می‌شود. برای health، Prometheus و webhook که مدل دسترسی آن‌ها bearer permission معمولی نیست، policy واقعی guard نیز به‌صورت explicit ثبت شده است:

- health: deployment/runtime probe policy؛
- metrics: `InternalMetricsGuard` و internal metrics CIDR؛
- webhook: `WebhookSignatureGuard`، provider، signature، replay window و event ID.

Scope baseline برای مسیرهای authenticated، organization scope به‌همراه role/ownership policy است و باید در service/authorization layer حفظ شود. برای integration و runtime scope اختصاصی همان‌طور که در matrix آمده است.

## ۴. status، event، severity و واژگان محصول

### Status taxonomy

Taxonomy مشترک در JSON برای این حوزه‌ها ثبت شده است:

- lifecycle: `DRAFT`، `ACTIVE`، `ON_HOLD`، `COMPLETED`، `CANCELLED`، `ARCHIVED`
- work: `OPEN`، `IN_PROGRESS`، `BLOCKED`، `DONE`، `CANCELLED`
- relationship: `PROSPECTIVE`، `ACTIVE`، `AT_RISK`، `DORMANT`، `CLOSED`
- opportunity: `IDENTIFIED`، `QUALIFIED`، `PROPOSAL`، `NEGOTIATION`، `WON`، `LOST`، `ON_HOLD`
- meeting: `PLANNED`، `IN_PROGRESS`، `COMPLETED`، `CANCELLED`
- job: `QUEUED`، `PROCESSING`، `COMPLETED`، `PARTIAL`، `FAILED`، `CANCELLED`
- quality issue: `OPEN`، `ASSIGNED`، `SNOOZED`، `RESOLVED`، `REJECTED`
- approval: `PENDING`، `APPROVED`، `REJECTED`، `EXPIRED`
- sync: `CONNECTED`، `SYNCING`، `HEALTHY`، `DEGRADED`، `FAILED`، `DISCONNECTED`
- severity: `INFO`، `LOW`، `MEDIUM`، `HIGH`، `CRITICAL`

### Event taxonomy

۲۱ event مشترک برای Timeline در JSON ثبت شده‌اند؛ از جمله `interaction.created`، `meeting.finalized`، `action.completed`، `commitment.overdue`، `relationship.score_changed`، `relationship.risk_detected`، `opportunity.stage_changed`، `data_quality.issue_resolved`، `workflow.failed`، `integration.sync_failed`، `approval.completed` و `security.event`.

### واژگان و policy زبان

زبان اصلی UI `fa-IR` و direction آن `rtl` است. واژگان ثابت شامل موارد زیر هستند:

| English | فارسی |
|---|---|
| Organization | سازمان |
| Person | شخص |
| Relationship | رابطه |
| Interaction | تعامل |
| Meeting | جلسه |
| Action | اقدام |
| Commitment | تعهد |
| Follow-up | پیگیری |
| Opportunity | فرصت |
| Network | شبکه |
| Data Quality | کیفیت داده |
| Approval | تأیید |

UUID، Prisma ID، raw database key، raw JSON mutation payload و internal permission key از کاربر عادی درخواست یا در workflow عادی نمایش داده نمی‌شوند. جایگزین آن‌ها EntityPicker، EntityMultiPicker، search، semantic builder، label و deep link است. label فنی فقط در admin، debug، audit و API integration context مجاز است.

## ۵. state contract مشترک

برای تمام ۳۴۲ endpoint، state matrix هفت‌گانه در JSON ثبت شده است:

| State | قرارداد UX |
|---|---|
| `loading` | skeleton/progress و جلوگیری از mutation تکراری |
| `empty` | empty state معنادار با CTA یا توضیح نبود داده |
| `error` | خطای قابل فهم، حفظ context و retry |
| `forbidden` | Permission/Scope state بدون افشای داده‌ی محافظت‌شده |
| `offline` | offline banner، حفظ draft/queue و retry پس از اتصال |
| `success` | feedback یکنواخت و به‌روزرسانی context/timeline |
| `conflict` | جلوگیری از overwrite خاموش و تصمیم merge/reload |

این جدول contract Phase 0 است و ادعای پیاده‌سازی کامل تمام stateها در UI را ندارد؛ پیاده‌سازی مشترک آن‌ها در Phase 1 و workflowهای بعدی verify خواهد شد.

## ۶. Visual baseline شبکه

مرجع visual بدون تغییر در `network-preview.html` باقی مانده و hash محافظتی آن:

```text
sha256 25ab37bd85221cde540d47e9422af2bc59ce3de536be4cbc4a1f9a96aebeef78
```

Verifier hash را در صورت وجود فایل کنترل می‌کند؛ چون فایل protected و untracked است، نبودن آن در clone معمولی مجاز است. hash مورد انتظار در contract ثابت است تا اجرای CI بدون فایل untracked نیز deterministic بماند.

viewportهای baseline:

```text
1440 · 1280 · 1024 · 768 · mobile
```

توکن‌های ثبت‌شده از reference:

- canvas: body `#050914`، card `#080f20`، graph `#020713`؛ body padding برابر `24px` و mobile برابر `10px`؛
- palette: text `#f5f7ff`، muted `#8993aa`، border `#18233c`، active `#416de8`، strong `#4b7cff`، very strong `#20d1c3`، moderate `#9a6bff`، weak `#f0ae38` و risk `#f04455`؛
- layout: card حداکثر `890px` و ارتفاع `658px`، header برابر `78px`، graph برابر `518px`، footer برابر `61px` و SVG viewBox برابر `880x510`؛
- typography: Inter/system stack، عنوان `19px/1.1`، label برابر `12px/500`، sublabel برابر `10px` و body برابر `11px`؛
- radius: card برابر `10px`، control برابر `8px` و overlay برابر `9px`؛
- density: canvas متراکم با labelهای ۱۰ تا ۱۲ پیکسلی و controlهای ۳۴ تا ۴۰ پیکسلی.

تغییرات بعدی Network باید در route واقعی اپلیکیشن و با screenshot comparison در تمام viewportهای بالا انجام شوند؛ فایل reference قابل تغییر، rename، stage یا commit نیست.

## ۷. debt register — شفاف‌سازی، نه ادعای حل

Phase 0 debtها را حذف نکرده است؛ فقط inventory و evidence آن‌ها را ثبت کرده است:

| Debt | تعداد فایل متاثر | وضعیت |
|---|---:|---|
| browser `confirm()` / `alert()` | ۳۲ | باقی‌مانده؛ جایگزینی با ConfirmDialog در Phase 1 |
| generic workspace / ResourceConsole / CrudWorkspace | ۱۶ | باقی‌مانده؛ تفکیک workflowها در Phase 1 تا 6 |
| technical identifier references | ۵۰ | باقی‌مانده؛ جایگزینی تدریجی با picker، label و deep link |

فهرست کامل pathها در `debtRegister` فایل JSON است. هیچ‌یک از این سه debt در Phase 0 به‌عنوان حل‌شده علامت نخورده‌اند.

## ۸. عدم حذف و مقایسه با baseline قبلی

برای کنترل قید «هیچ endpoint موجود حذف نشود»، verifier کلیدهای موجود در `apps/API_CONTRACT.json` را با source inventory مقایسه می‌کند. نتیجه‌ی اجرای فعلی:

```text
baseline API_CONTRACT: 312 endpoint
current source inventory: 342 endpoint
missingFromCurrent: []
addedSinceBaseline: 30 endpoint
```

این مقایسه فقط evidence عدم حذف است؛ endpointهای جدید نیز در matrix فعلی ثبت شده‌اند. route، capability، model یا workflow موجود در این Phase حذف نشده است.

## ۹. verifier قطعی و CI

منبع verifier:

```text
scripts/verify-product-phase0.mjs
```

اجرا در local برای تولید contract:

```bash
node scripts/verify-product-phase0.mjs
```

اجرای check بدون بازتولید فایل:

```bash
node scripts/verify-product-phase0.mjs --check
```

shortcut پروژه:

```bash
pnpm verify:phase0
```

`--check` در صورت stale بودن JSON، نبودن domain catalog، gap در Web family، endpoint بدون consumer/decision، action، owner، permission/scope، classification، state matrix، test plan یا حذف endpoint baseline با exit code غیرصفر fail می‌شود. همین check در job اصلی CI قبل از سایر quality gateها ثبت شده است.

آخرین اجرای قطعی در این workspace:

```text
PHASE0_PRODUCT_CONTRACT_CHECK=PASS
controllers=45 endpoints=342 webPages=82 mobileFiles=57
PHASE0_PROTECTED_REFERENCE=PRESENT_AND_HASHED
confirmOrAlert=32 genericWorkspace=16 technicalIdentifierFiles=50
```

## ۱۰. Definition of Done Phase 0

- [x] inventory واقعی API، Web، Mobile و Prisma تولید شد؛
- [x] matrix رسمی endpoint → screen/consumer → action → permission/scope → test در repository ثبت شد؛
- [x] پنج classification موردنیاز در contract تعریف و endpointها به یکی از آن‌ها متصل شدند؛
- [x] persona، owner فنی/محصول، surface و state matrix برای تمام endpointها ثبت شد؛
- [x] status، event، severity و واژگان ثابت ثبت شد؛
- [x] policy UUID، JSON خام و technical/admin label ثبت شد؛
- [x] Network reference، viewportها، tokenهای visual و hash محافظتی ثبت شد؛
- [x] debt register سه‌گانه بدون ادعای حل‌شدن ثبت شد؛
- [x] verifier reproducible با exit code معتبر و CI integration اضافه شد؛
- [x] مقایسه‌ی عدم حذف با API baseline بدون missing endpoint عبور کرد.

Phase 1 فقط پس از این baseline شروع می‌شود و `[x]` شدن این سند به‌معنای حل debtهای UI یا تکمیل visual regression نیست.
