# SRIP — گزارش کامل پلتفرم (معماری، ماژول‌ها، امتیازدهی، هوشمندی، رابط کاربری)

> این سند بر پایهٔ کد واقعی مخزن (`arena/01a07178-srip`) نوشته شده است، نه بر پایهٔ فرض.
> هر بخش، مسیر فایل مرجع را ذکر می‌کند تا بتوانید مستقیم به منبع بروید.

**فهرست مطالب**

1. [پلتفرم چیست](#۱-پلتفرم-چیست)
2. [اصول محصول](#۲-اصول-محصول)
3. [نقشهٔ مخزن و معماری کلان](#۳-نقشهٔ-مخزن-و-معماری-کلان)
4. [مدل داده و دامنه](#۴-مدل-داده-و-دامنه)
5. [هویت، دسترسی و امنیت (RBAC/ABAC)](#۵-هویت-دسترسی-و-امنیت)
6. [موتور امتیازدهی (Scoring)](#۶-موتور-امتیازدهی)
7. [نسخه‌بندی، کالیبراسیون و حاکمیت امتیاز](#۷-نسخه‌بندی-کالیبراسیون-و-حاکمیت-امتیاز)
8. [تحلیل شبکه و گراف](#۸-تحلیل-شبکه-و-گراف)
9. [تطبیق نیازمندی با شبکه (Requirement Matching)](#۹-تطبیق-نیازمندی-با-شبکه)
10. [لایهٔ هوشمندی (AI)](#۱۰-لایهٔ-هوشمندی-ai)
11. [موتور توصیه‌ها](#۱۱-موتور-توصیه‌ها)
12. [اعلان‌ها، گردش کار و تأییدها](#۱۲-اعلان‌ها-گردش-کار-و-تأییدها)
13. [داده: ورود، کیفیت، حریم خصوصی و چرخهٔ حیات](#۱۳-داده-ورود-کیفیت-حریم-خصوصی-و-چرخهٔ-حیات)
14. [جستجو، تحلیل (Analytics) و گزارش‌گیری](#۱۴-جستجو-تحلیل-و-گزارش‌گیری)
15. [رابط وب (apps/web و apps/web-ux / srip2)](#۱۵-رابط-وب)
16. [اپلیکیشن موبایل (apps/mobile)](#۱۶-اپلیکیشن-موبایل)
17. [زیرساخت، پایش و DR](#۱۷-زیرساخت-پایش-و-dr)
18. [تست، درگاه‌های انتشار و ممیزی قرارداد](#۱۸-تست-درگاه‌های-انتشار-و-ممیزی-قرارداد)
19. [اجرای محلی و حالت دمو](#۱۹-اجرای-محلی-و-حالت-دمو)
20. [وضعیت فعلی، شکاف‌ها و کارهای ناتمام](#۲۰-وضعیت-فعلی-شکاف‌ها-و-کارهای-ناتمام)

---

## ۱. پلتفرم چیست

**SRIP = Strategic Relationship Intelligence Platform** — «سامانهٔ عامل هوش روابط راهبردی».

یک پلتفرم سازمانی (enterprise) برای **هلدینگ‌ها و گروه‌های شرکتی** است که سرمایهٔ اصلی‌اش
«روابط راهبردی» است: رابطه با مشتریان، شرکا، بانک‌ها، نهادهای دولتی، سرمایه‌گذاران و تأمین‌کنندگان.
پلتفرم این روابط را از حالت «دفترچهٔ تلفن و خاطرات افراد» بیرون می‌آورد و به یک **دارایی قابل‌اندازه‌گیری،
قابل‌امتیازدهی و قابل‌تحلیل شبکه** تبدیل می‌کند.

سه کار اصلی را انجام می‌دهد:

| کار | یعنی چه در عمل |
|---|---|
| **ثبت و حافظهٔ نهادی** | هر تعامل، جلسه، قول (commitment)، اقدام (action)، سند و یادداشت روی یک «رابطه» به نام دو طرفِ آن ثبت می‌شود؛ با حذف نرم، ممیزی (audit) و طبقه‌بندی محرمانگی. |
| **امتیازدهی و تحلیل** | سلامت رابطه، ریسک، نفوذ/دسترسی/اعتماد، ارزش اقتصادی، امتیاز شبکهٔ هر سازمان، امتیاز «ساز‌و‌حلقهٔ اتصال» (Connector) هر شخص، و امتیاز فرصت‌ها — همگی با فرمول‌های شفاف، وزن‌پذیر و نسخه‌بندی‌شده. |
| **اقدام‌سازی** | از دل امتیازها و تحلیل شبکه، «توصیه» (Recommendation) تولید می‌شود که انسان تأیید/رد/ویرایش می‌کند و در صورت تأیید، به Action واقعی و اعلان تبدیل می‌شود. |

مقیاس فعلی کد: **۴۲ ماژول API** (۴۴ کنترلر / ۷۳ سرویس / ۲۴۲ فایل TS)، **~۳۳۲ اندپوینت**،
**۸۹ مدل و ۴۱ انام در Prisma**، **۵۳ مسیر route در وب** (۵۶ صفحه در خروجی استاتیک)، **۵۵ صفحه در موبایل**، به‌علاوهٔ زیرساخت IaaC، DR، WAF، و درگاه‌های تست/ممیزی.

---

## ۲. اصول محصول

این اصول در `README.md` و `CHANGELOG.md` به‌عنوان «قواعد حفظ‌شده محصول» ذکر شده‌اند و در کد قابل ردیابی‌اند:

- **Relationship First** — موجودیت مرکزی «رابطه» است، نه «مخاطب» (CRM کلاسیک). همه‌چیز (جلسه، اقدام، سند، فرصت) به رابطه وصل است.
- **Network First** — شبکه/گراف، هم‌عرض جدول‌هاست؛ مسیر‌یابی، پل‌ها، گلوگاه‌ها و نقاط تک‌شکست تحلیل می‌شوند.
- **Actionable Intelligence** — هیچ تحلیلی بدون «قدم بعدی» رها نمی‌شود (توصیه ← اقدام).
- **Explainable AI** — هر امتیاز/توصیه همراه `explanation`، `factors`، `evidence` و `confidence` است.
- **Institutional Memory** — حافظهٔ سازمان حتی پس از رفتن افراد (سناپشات، ممیزی، نسخه‌بندی).
- **Cross-Company Intelligence** — داده بین شرکت‌های هلدینگ با رعایت محدودهٔ مجاز (tenant scope) قابل تحلیل است.
- **Executive Simplicity** — لایهٔ «پیشخوان مدیریتی» و «بریف هفتگی» بالای همان پیچیدگی.

---

## ۳. نقشهٔ مخزن و معماری کلان

```
Srip/
├── apps/
│   ├── api/          ← NestJS + Prisma + PostgreSQL  (منبع حقیقت، همهٔ منطق)
│   │   ├── src/<42 module>/                          controller + service + spec
│   │   ├── prisma/schema.prisma                      89 models + 41 enums
│   │   └── scripts/verify-phase-*.sh                 درگاه‌های راستی‌آزمایی
│   ├── web/          ← Next.js App Router (نسخهٔ اصلی رابط)
│   ├── web-ux/       ← کلون بازطراحی‌شدهٔ رابط = «srip2 / UI 3.0»  → خروجی استاتیک در docs/srip2
│   └── mobile/       ← Expo SDK 57 + React Native 0.86 (expo-router)
├── packages/         ← api-client, auth, config, design-system, types, ui, validation, tsconfig, eslint-config
├── docs/             ← (امروزه) خروجی استاتیک گیت‌هاب‌پیج  ⚠ ببینید §۲۱
├── infra/, infrastructure/  ← docker, nginx, terraform (VPC/WAF/RDS/EKS/…), scripts backup/PITR/restore
├── tests/            ← e2e, load, security, dr, storage (اسکریپت‌های Node)
└── scripts/          ← ۸۰+ اسکریپت verify-*/، backup، benchmark، preview-server
```

**سبک معماری:** Modular Monolith یک API مشترک + سه کلاینت (وب، وب‌یو‌اکس، موبایل) + پکیج‌های مشترک.
منطق امتیاز/دسترسی/AI **در فرانت‌اند تکرار نمی‌شود**؛ کلاینت‌ها فقط نمایش می‌دهند (هرچند گراف و کارت‌ها
روی کلاینت هم محاسبهٔ سبک بصری دارند).

**جریان داده:**

```
کلاینت ──/api/v1──▶ Guard (JWT + RateLimit + Idempotency)
                 ──▶ AuthorizationService (RBAC + ABAC + محدودهٔ سازمانی + طبقه‌بندی داده)
                 ──▶ ماژول دامنه ──▶ Prisma (Postgres)
                 ──▶ EventBus (Outbox در همان ترنزکشن)
                 ──▶ Worker (queue) ──▶ نتیفیکیشن/وب‌هوک/اسکور بازمحاسبه/آنالیتیکس
```

- **Outbox الگو:** `apps/api/src/event-bus/event-bus.service.ts` رویداد دامنه را درون همان `TransactionClient`
  می‌نویسد (`publishInTransaction`)؛ اگر فرایند بمیرد، رکورد `PENDING` می‌ماند و `flushPending()` دوباره تلاش می‌کند.
- **Worker:** `apps/api/src/worker.ts` همان `AppModule` را با `QUEUE_WORKER_ENABLED=true` بالا می‌آورد (process جدا از API).
- **Redis:** کش عملکرد + صف. کامیت `f6ea058` کلاینت‌های Redis را با `offline-queue` و تایم‌اوت اتصال harden کرد
  (تا قطعی Redis، API را نکشد).
- **پراکسی هم‌ریشه در وب:** اگر `NEXT_PUBLIC_API_URL` تنظیم نشده/نسبی باشد، Next خودش `/api/v1/*` را به
  `API_PROXY_TARGET` (پیش‌فرض `http://localhost:4000`) پروکسی می‌کند — `apps/web-ux/next.config.ts`.

---

## ۴. مدل داده و دامنه

منبع: `apps/api/prisma/schema.prisma` — ۸۹ مدل و ۴۱ انام.

### هستهٔ دامنه

| مدل | نقش | نکات کلیدی |
|---|---|---|
| `Organization` | شرکت/سازمان | `parentOrganizationId` (سلسله‌مراتب هلدینگ)، `type` (HOLDING/SUBSIDIARY/CUSTOMER/PARTNER/BANK/GOVERNMENT/INVESTOR/SUPPLIER/OTHER)، `industry`، حذف نرم |
| `OrganizationUnit` / `ContactInformation` | واحدها و راه‌های ارتباطی | پایهٔ ABAC روی دپارتمان |
| `Person` | مخاطب انسانی | سه امتیاز ذاتی: `influenceScore`، `decisionPower`، `accessibilityScore` + `sensitivity`/شغل |
| `Relationship` | **پیوند رسمی بین دو سازمان** | ۸ امتیاز: `healthScore` `strategicScore` `riskScore` `trustScore` `accessScore` `influenceScore` `opportunityScore` `resilienceScore` + `engagementScore`؛ `status` (PROSPECTIVE/ACTIVE/AT_RISK/DORMANT/ARCHIVED)، `lifecycleStage` (۹ فاز IDENTIFIED→LOST)، `ownerId`/`backupOwnerId`، `reviewCadenceDays=90`، `lastInteractionAt`، `nextActionAt`؛ `@@unique([source,target,relationshipType])` |
| `PersonRelationship` | پیوند بین دو شخص | همان مجموعهٔ امتیازات؛ پایهٔ گراف اشخاص و Connector |
| `Interaction` / `Meeting` / `Note` | تعامل/جلسه/یادداشت | `type`، `occurredAt`، `outcome`، جلسه → `MeetingParticipant`، `transcript` |
| `Action` / `Commitment` / `ActionDependency` | اقدام/قول/وابستگی | وضعیت و سررسید → مبنای «reliability» و بریف مدیریتی |
| `Project` / `ProjectRequirement` / `ProjectMilestone` / `ProjectRisk` | پروژه و نیازمندی‌ها | ورودی موتور تطبیق نیازمندی |
| `Opportunity` / `Referral` | فرصت و معرفی | `probability`، `value`؛ Referral با وضعیت → موفقیت معرفی |
| `Document` / `Tag` / `TagAssignment` / `RelationshipTag` / `CustomField(+Value)` | مدارک، برچسب، فیلد سفارشی | انعطاف بدون migration |
| `RelationshipType` / `InteractionType` | کاتالوگ نوع‌ها | اعتبارسنجی در سرویس (نوع نامعتبر/غیرفعال → 403) |

### امتیاز و سوابق

`Score` (کلید canonical = `type:subjectType:subjectId`)، `ScoreSnapshot` (تاریخچهٔ هر محاسبه)،
`ScoreVersion` (وزن‌ها/وضعیت DRAFT-ACTIVE-ARCHIVED)، `ScoreCalibration` (خروجی مشاهد vs امتیاز)،
`RelationshipScoreSnapshot` (سناپشات پهن روی رابطه با `reason` شامل شمارهٔ نسخه).

### امنیت و عملیات

`User`, `Account`, `IdentityProvider`, `Role`, `Permission`, `RolePermission`, `Membership`, `Session`,
`LoginHistory`, `MfaDevice`, `RecoveryCode`, `PasswordResetToken`, `EmailVerificationToken`,
`AuditLog`, `SecurityEvent`, `IdempotencyRecord`, `FileSecurityScan`.

### حاکمیت داده

`PrivacyRequest`, `ConsentRecord`, `DataProcessingPolicy`, `DataLifecycleRecord`, `DataDeletionApproval`,
`DataExportLog`, `DataImport`, `DataImportRow`, `DataImportDuplicate`, `DataQualitySnapshot`.

### اتوماسیون و یکپارچه‌سازی

`Workflow`, `WorkflowExecution`, `WorkflowEventDelivery`, `ApprovalRequest`, `WorkflowApproval`,
`NotificationRule`, `Notification`, `IntegrationConnection`, `IntegrationWebhookEvent`,
`IntegrationSyncCursor`, `IntegrationExternalRecord`, `IntegrationSyncRun`, `ConnectionPath`.

### AI

`AiPromptVersion`, `AiDocumentChunk`, `AiUsageEvent`, `AiSetting`.

**قاعدهٔ سراسری:** هیچ حذف فیزیکی در مسیر عادی وجود ندارد؛ همه `deletedAt` + `deletedById` (حذف نرم با ممیزی)
و حذف دائمی فقط از مسیر `privacy.erase` / `data.permanent_delete` با تأییدیه.

---

## ۵. هویت، دسترسی و امنیت

منابع: `apps/api/src/auth/auth.service.ts`، `apps/api/src/common/authorization/*`، `apps/api/src/sessions/*`.

### هویت

- رمز با **bcrypt cost 12**؛ قفل شدن اکانت پس از `MAX_FAILED_LOGINS` به مدت `LOCKOUT_MS` (شمارش
  `failedLoginCount`، آزادسازی هنگام ورود موفق).
- **JWT access token** کوتاه‌مدت + **refresh token چرخشی** (rotation) که خودِ «نشست» است:
  `Session` با `ip/userAgent`، `rotate` و `revoke`؛ خروج → ابطال refresh.
- **MFA**: `MfaDevice` + `RecoveryCode`؛ مسیر `/mfa`.
- **OIDC**: `apps/api/src/auth/oidc.service.ts` (provider بیرونی، `IdentityProvider`).
- **Register/Reset flow** با `EmailVerificationToken` و `PasswordResetToken` (توکن یک‌بارمصرف).
- Hardening سطح HTTP: `helmet`، `RateLimit` module، `IdempotencyRecord` برای تکرارناپذیری نوشتن‌ها.

### مدل دسترسی: RBAC + ABAC + چندمستأجری

- **۱۰ نقش** (`access.constants.ts`): `SUPER_ADMIN`, `HOLDING_ADMIN`, `HOLDING_EXECUTIVE`,
  `SUBSIDIARY_ADMIN`, `SUBSIDIARY_EXECUTIVE`, `RELATIONSHIP_MANAGER`, `PROJECT_MANAGER`, `ANALYST`,
  `STANDARD_USER`, `READ_ONLY`.
- **~۱۱۰ کلید مجوز**: از `org.read` تا `data.permanent_delete`، `privacy.manage`، `ai.executive_brief`،
  `scoring.admin`، `report.export`، `session.admin.revoke`. نقش‌ها از دیتابیس نگاشت می‌شوند (`RolePermission`)،
  پس تغییر مجوزها داده‌محور است نه کد.
- **Membership** = (کاربر × سازمان × نقش) + `department`/`departmentUnitId` + `dataScope` (طبقهٔ محرمانگی مجاز)
  + `accessScope` (ORG/SUBSIDIARIES/…) + `scope` (JSON سفارشی) + `isPrimary`.
- **محدودهٔ سازمانی:** `accessibleOrganizationIds()` برای `SUPER_ADMIN` مقدار `null` می‌دهد (= بدون سقف)؛
  برای نقش‌های هلدینگ یا `accessScope=SUBSIDIARIES`، درخت سازمان را باز می‌کند (`descendants()` با walk روی
  `parentOrganizationId`). همین لیست در **هر** کوئری به‌عنوان `WHERE ... IN (...)` تزریق می‌شود.
- **طبقه‌بندی داده (ABAC):** `PUBLIC 0 · INTERNAL 1 · CONFIDENTIAL 2 · RESTRICTED 3 · PRIVATE 4 · HIGHLY_CONFIDENTIAL 5`
  — `classificationAllows()` بررسی می‌کند سقف کاربر ≥ طبقهٔ رکورد باشد.
- `access-policy.ts` شرط‌های ساختاریافته را ارزیابی می‌کند (`evaluateConditions`, `attributesAllow`,
  `canGrantRole`, `roleCanManageAccess`) — یعنی نقش‌دهیِ نقشِ بالاتر توسط نقش پایین‌تر مسدود است.
- **Field-level security:** `field-security.service.ts` + `relationship-presenter.ts` (فیلدهای حساس مثل
  شمارهٔ تماس شخصی/یادداشت‌های داخلی فقط با `person.sensitive_contacts.read`، `relationship.internal.read` …
  ارائه می‌شوند).
- **هر عمل نوشتن** → `AuditService.logMutation({before,after,reason,organizationId})`.

### قرارداد پاسخ

`EntityResponseDto` خروجی را یکدست می‌کند (`{data, meta}`) و `total` را **bounded** نگه می‌دارد؛
همهٔ لیست‌ها `take` سقف‌دار + `cursor` دارند (الگوی pagination کلاینت‌محور).

---

## ۶. موتور امتیازدهی

مسیر: `apps/api/src/scoring/`. همهٔ امتیازها در بازهٔ **۰..۱۰۰** (`clampScore`) و **تعیین‌پذیر** (deterministic)‌اند:
هیچ رندوم، هیچ LLM، هیچ حالت مخفی.

### ۶.۱ امتیاز رابطه — `CanonicalRelationshipScoreService`

۱۲ عامل (`RELATIONSHIP_SCORE_FACTORS`) و فرمول هرکدام (پنجرهٔ زمانی **۱۸۰ روز**):

| عامل | فرمول دقیق در کد |
|---|---|
| `strategicValue` | `relationship.strategicScore` (ورودی انسانی) |
| `economicValue` | `clamp(log10(max(1, Σ opportunity.value)) × 20)` |
| `influence` | `relationship.influenceScore` |
| `trust` | `relationship.trustScore` |
| `access` | `relationship.accessScore` |
| `engagement` | `clamp(interactions₁₈₀ × 4 + meetings₁₈₀ × 8)` |
| `recency` | `clamp(100 − daysSince × 1.1)` — اگر تعاملی نباشد `daysSince = 365` |
| `diversity` | `clamp((تعداد نوع تعامل ÷ 5) × 70 + (تعداد اشخاص درگیر ÷ 5) × 30)` |
| `responsiveness` | اگر تعامل صفر است ۰؛ در غیر این صورت `تعاملاتِ دارای outcome ÷ کل تعاملات × 100` |
| `commitmentReliability` | `FULFILLED به‌موقع ÷ غیرلغوشده × 100`؛ اگر هیچ قولی نیست = **۵۰** (نه صفر — تا بی‌سابقگی تنبیه نشود) |
| `opportunityPotential` | اگر فرصتی ثبت نشده: `relationship.opportunityScore`؛ در غیر صورت: میانگین `probability` فرصت‌ها |
| `risk` | `100 − relationship.riskScore` (ورودی ریسک به‌عنوان عامل معکوس) |

**ترکیب نهایی:** `score = Σ factorᵢ × wᵢ` که `w` از `normalizeWeights()` می‌آید: وزن‌ها روی جمع ۱ نرمال می‌شوند؛
اگر جمع وزن‌ها صفر شد، به وزن پیش‌فرض (همه ۱ = مساوی) برمی‌گردد. سپس `explanation` + تمام `factors` (به‌همراه
`weights` و شمارش‌های خام مثل `interactions180d`) ذخیره می‌شود.

منابع داده هر محاسبه (۹ کوئری موازی): شمارش تعاملات و جلسات ۱۸۰ روزه، آخرین تعامل، `groupBy` نوع تعامل و شخص،
`aggregate` فرصت‌ها، و `$queryRaw` روی `Commitment` با `COUNT(*) FILTER (WHERE …)`.

### ۶.۲ امتیاز ریسک — `RiskScoreService`

```
configuredRisk = relationship.riskScore
resilienceRisk = 100 − relationship.resilienceScore
recencyRisk    = clamp(daysSinceLastInteraction × 1.1)
score          = 0.6·configuredRisk + 0.2·resilienceRisk + 0.2·recencyRisk   (+ وزن نسخهٔ فعال)
```

### ۶.۳ امتیاز شبکه (سازمان) — `NetworkScoreService`

```
strength            = avg(health + trust + access) / 3      وزن 0.45
resilience          = avg(resilienceScore)                   وزن 0.25
opportunityCoverage = clamp(opportunityCount × 10)           وزن 0.15
peopleCoverage      = clamp(personCount × 5)                 وزن 0.15
```

### ۶.۴ امتیاز اتصال‌دهنده (شخص) — `ConnectorScoreService`

```
connectionBreadth   = clamp(personRelationshipCount × 8)     وزن 0.20
relationshipQuality = avg(health+trust+access)/3 روی پیوندهای شخص  وزن 0.25
organizationLevel   = clamp(influence×.45 + decisionPower×.35 + accessibility×.20)  وزن 0.20
relationshipInfluence = avg(influenceScore)                  وزن 0.15
referralSuccess     = (ACCEPTED+COMPLETED) ÷ کل معرفی‌ها × 100  وزن 0.20
```
پاسخ «چه کسی گرهٔ اتصال ماست؟» از همین‌جا می‌آید (`/network/connectors`).

### ۶.۵ امتیاز فرصت — `OpportunityScoreService`

```
valueScore = clamp(log10(max(1,value)) × 18)
score      = 0.5·probability + 0.3·valueScore + 0.2·relationship.opportunityScore
```

### ۶.۶ ذخیرهٔ امتیاز (الگوی یکسان در همهٔ امتیازها)

`ScoringBaseService.persist()` در **یک ترنزکشن**:
۱) upsert روی `Score` با کلید canonical ۲) درج `ScoreSnapshot` ۳) `audit.logMutation` ۴) انتشار رویداد `SCORE_UPDATED`
(شنوندگانی مثل `analytics-recommendation.listener` روی این رویداد سوارند).
نتیجه `{...score, scoreId, persistedAt}` برمی‌گردد.

### ۶.۷ اندپوینت‌ها

`@Controller('scores')` — `POST /scores/relationship/:id/recalculate`,
`POST /scores/risk/relationship/:id/recalculate`, `POST /scores/opportunity/:id/recalculate`,
`POST /scores/connector/person/:id/recalculate`, `POST /scores/network/organization/:id/recalculate`,
`GET /scores/:type/:subjectType/:subjectId/history`، و مسیرهای مدیریت نسخه/کالیبراسیون (با مجوز `scoring.admin`).

> نکتهٔ سازگاری: `apps/api/src/relationships/relationship-score.service.ts` فقط یک **facade** است که به
> `CanonicalRelationshipScoreService` delegate می‌کند — عمداً «فرمول دوم» نگه داشته نشده است.

---

## ۷. نسخه‌بندی، کالیبراسیون و حاکمیت امتیاز

مسیر: `apps/api/src/scoring/score-versioning.service.ts` + مدل‌های `ScoreVersion/ScoreCalibration/ScoringRule`.

- هر نوع امتیاز یک زنجیرهٔ نسخه با نام `<type>-default` دارد؛ وضعیت‌ها `DRAFT → ACTIVE → ARCHIVED`.
  فعال‌سازی در **ترنزکشن**: بقیهٔ همان نام ARCHIVE و هدف ACTIVE می‌شود.
- **وزن‌ها JSON‌اند** و سه لایه دارند:
  1. `weights.default` — وزن پایهٔ نسخه
  2. `weights.industries[<industry>]` — override صنعتی؛ با `otherWeight` می‌توان سهم باقی‌مانده را بین عوامل
     تنظیم‌نشده تقسیم کرد (مثلاً بانک‌ها به `trust` وزن بیشتری می‌دهند).
  3. `ScoringRule` (میزبان ادمین) — override سازمانی/سراسری با `definition.weights` یا `{factor, weight}`؛
     `orderBy [{organizationId desc},{updatedAt desc}]` یعنی قانون سازمانی بر سراسری می‌چربد.
- **وزن‌دهی بدون دیپلوی**: چون همه‌چیز داده است، تغییر مدل امتیاز یک عملیات اداری است، نه تغییر کد.
- **کالیبراسیون:** `ScoreCalibration(expectedScore, observedScore, observedOutcome)` و خلاصهٔ
  `meanAbsoluteError` روی حداکثر ۱۰٬۰۰۰ نمونه (bounded) — ابزار «آیا مدل ما واقعیت را پیش‌بینی می‌کند؟».
- **تاریخچه:** هر رابطه `RelationshipScoreSnapshot` با `reason` شامل `relationshipVersion=…;riskVersion=…`
  نگه می‌دارد؛ پس می‌توان گفت «امتیاز ۵ روز پیش ۷۱ بود چون نسخهٔ وزن عوض شد».
- `configureIndustry` و `updateDraft` فقط پیش‌نویس را تغییر می‌دهند — نسخهٔ فعالِ در حال استفاده قابل خراب‌کردن نیست.

---

## ۸. تحلیل شبکه و گراف

مسیر: `apps/api/src/network/network.service.ts` (+ رابط کاربری در §۱۵).

### گراف‌سازی

`graph(userId, organizationId, type, status, query, focus, limit, cursor)`:

- دامنهٔ دسترسی از `accessibleOrganizationIds` تزریق می‌شود؛ اگر `organizationId` بیرون از دامنه باشد → 403.
- سه جستجوی موازی (organizations / people / projects) با سقف `pageSize+1`؛ `pageSize` بین ۲۵ و ۵۰۰.
- گره‌ها: `org:<id>`، `person:<id>`، `project:<id>`. یال‌ها: `relationship` (سازمان↔سازمان)،
  `person_relationship`، `membership`، `project`.
- **وزن یال** = `max(1, round((health+trust+access+influence)/4))`، همراه `risk` و `strategicImportance`.
- `focus=<nodeId>` فقط همسایه‌های مستقیم را نگه می‌دارد (Ego view).
- خروجی `page:{limit, nextCursor, bounded:true}` — هیچ پاسخ بی‌سقفی وجود ندارد.

### مسیر‌یابی (Path)

`path(userId, from, to, organizationId, mode)`:

- **BFS لایه‌به‌لای روی دیتابیس** (نه بارگذاری کل گراف در حافظه)؛ سقف‌ها از محیط:
  `NETWORK_MAX_PATH_HOPS` (پیش‌فرض ۸، سقف ۱۲) و `NETWORK_PATH_FRONTIER` (پیش‌فرض ۲۵۰، سقف ۵۰۰).
- `mode='shortest'` → هزینهٔ هر هاپ = ۱.
  `mode='best'` → هزینه = `max(1, 101 − min(100, weight)) + risk×0.5` (یعنی یال‌های سالم‌تر و کم‌ریسک‌تر ارجح).
- اگر دو سر بیرون از دامنهٔ کاربر باشند → 404 (نه افشای وجود).
- پاسخ: `found, nodes, edges, hops, totalCost, bounded, maxHops`.

### تحلیل‌های ساختاری

| تحلیل | تعریف در کد |
|---|---|
| `centrality` | درجهٔ گره (degree) روی کل گراف، مرتب‌شده |
| `connectors` | برای هر شخص، `ConnectorScoreService.calculate(..., persist=false)` → رتبه‌بندی |
| `bridgePeople` | «پل‌ساز»: از یال عضویت، سازمانِ شخص ← اندازهٔ همسایگی آن سازمان (reach) |
| `bottlenecks` | `neighbors + 2 × (یال‌های پرریسک: risk ≥ 60)` |
| `singlePointsOfFailure` | شمارش مؤلفه‌های همبندی (`componentCount`) قبل/بعد از حذف گره؛ `fragmentationIncrease > 0` = نقطهٔ شکست |

هر پنج تحلیل در `reporting` → `networkReport` جمع می‌شوند و یک «گزارش شبکه» می‌سازند.

---

## ۹. تطبیق نیازمندی با شبکه

مسیر: `apps/api/src/requirements/requirement-matching.service.ts` (۲۴۲ خط).
سوالی که پاسخ می‌دهد: **«پروژه/نیازمندی X را چه کسی — مستقیم یا با واسطه — می‌تواند تأمین کند؟»**

**مراحل (pipeline):** `Requirement → Keywords → Target Orgs → Direct → 1-Hop → 2-Hop → Connector Person → Path Strength → Health/Trust/Engagement → Success Probability → Rank`

1. **واژگان نیازمندی**: توکن‌سازی `title + category + description`، حذف توکن‌های زیر ۳ حرف، حداکثر ۱۲ اصطلاح.
2. **تنگ‌سازی کاندیدا در دیتابیس** (نه در حافظه): `contains` روی `name/displayName/industry` با سقف `max(300, min(1000, limit×20))`.
3. **تطبیق هدف**: `overlap = 2|A∩B| / (|A|+|B|) × 100` بین واژگان نیازمندی و `name + industry + type + typeKeywords(type)`
   (نقشهٔ کلیدواژه‌ای برای BANK/INVESTOR/GOVERNMENT/… که نام سازمان را با معنا گسترش می‌دهد).
4. **گراف محلی کران‌دار**: یال‌های اولیه (≤ ۵۰۰۰) + یک لایهٔ بازگشایی ۲-هاپ؛ fanout هر گره ≤ ۱۰۰.
5. **قدرت یال**: `0.30·health + 0.30·trust + 0.20·engagement + 0.15·strategic + 0.05·(100−risk)`
   به‌علاوهٔ بونوس وضعیت: `ACTIVE +5`, `AT_RISK −10`, `DORMANT −15`.
6. **قدرت مسیر**: برای مسیر چندهوردی `Π strengths / 100^(n−1)` — یعنی هر هاپ اضافه، مسیر را بی‌رحمانه تنبیه می‌کند.
7. **احتمال موفقیت** (امتیاز رتبه‌بندی):
   `0.30·targetFit + 0.35·pathStrength + 0.12·health + 0.12·trust + 0.06·engagement + proximityBonus`
   که `proximityBonus = 20` برای اتصال مستقیم و `12` برای ۲-هاپ.
8. **طبقه‌بندی**: `DIRECT` / `INDIRECT` / `GAP`؛ و `INTERNAL`/`EXTERNAL` بر اساس «ریشهٔ هلدینگ یکسان»
   — محاسبهٔ ریشه با **CTE بازگشتی** روی `parentOrganizationId` (یک کوئری برای ≤ ۱۰۰۰ سازمان).
9. **آدمِ واسط**: بالاترین `influenceScore` ← `decisionPower` ← `accessibilityScore` در سازمان واسط.
10. خروجی: `bestConnection`, `directConnections`, `indirectConnections`, `internal/externalConnections`,
    `relationshipGaps`, `recommendations` (۵ رتبهٔ برتر با `successProbability` و `rationale`) — هر مورد با
    `evidence` کامل (توکن‌ها، relation IDها، مسیر).

این همان جایی است که «شبکه» به پول تبدیل می‌شود: شکاف‌ها (= Gaps) لیست کاری رشد رابطه‌اند، نه فقط هشدار.

---

## ۱۰. لایهٔ هوشمندی (AI)

مسیر: `apps/api/src/ai/` — `ai-pipeline.service.ts`، `ai.gateway.service.ts`، `providers/*`.

> **اصل طراحی:** هوشمندی پیش‌فرض **قاعده‌محور و داخلی** است؛ هیچ فراخوانی بیرونی انجام نمی‌شود مگر
> `AI_PROVIDER=external`. نتیجهٔ هر درخواست با `status:'completed_without_external_model'` برمی‌گردد تا
> هیچ ابهامی در «این را مدل نوشت یا منطق سیستم؟» نماند.

### ۱۰.۱ لایهٔ ایمنی/حریم خصوصی روی ورودی

```
redact():  email → [REDACTED_EMAIL] ،  شمارهٔ تلفن → [REDACTED_PHONE]
defend():  "ignore all/any/previous instructions" → [BLOCKED_PROMPT_INJECTION]
           "system prompt" → [BLOCKED_SYSTEM_PROMPT_REFERENCE]
```
هر دو پیش از ایندکس‌کردن اسناد اعمال می‌شوند (`indexDocument` → قطعه‌ها با `metadata.redacted:true`).

### ۱۰.۲ RAG سبک (بدون بردارِ واقعی)

- `chunk(text, size=1200, overlap=150)` → قطعه‌ها در `AiDocumentChunk` با `contentHash` (sha256) و
  `embedding` **۳۲بعدی معین‌نگر** (هش کاراکتری نرمال‌شده) — قابل‌تکرار، بدون وابستگی به مدل.
- بازیابی: حداکثر ۲۰۰ قطعهٔ در دامنهٔ دسترسی کاربر ← امتیاز **اشتراک توکنی** (`score()`) ← فیلتر `score>0`
  ← مرتب‌سازی ← **۸ قطعهٔ برتر**.
- یعنی retrieval دوگانه است: **دادهٔ ساختاریافته از DB** + **قطعه‌های سند**.

### ۱۰.۳ اینتنت‌ها (9)

`SMART_SEARCH · MEETING_BRIEF · MEETING_SUMMARY · ACTION_EXTRACTION · COMMITMENT_EXTRACTION ·
RISK_DETECTION · OPPORTUNITY_DETECTION · NEXT_BEST_ACTION · EXECUTIVE_BRIEF`

منطق `retrieve()` عمداً برای اینتنت‌های «حالت‌دار» (ریسک/فرصت/قدم بعدی) متن پرسش را فیلتر سخت نمی‌کند —
چون زبان طبیعی با `contains` جور درنمی‌آید؛ به‌جایش **شواهد واقعیِ در دامنه** می‌گیرد: ۱۵ تعامل اخیر، ۱۵ جلسهٔ
پیش‌رو، روابط stale (اقدام موعدگذشته یا >۶۰ روز بی‌تعاملی)، روابط پرریسک (`risk ≥ 60` یا `health ≤ 40`)،
روابط فرصت‌محور (`opportunity ≥ 60` و `health ≥ 45`).

### ۱۰.۴ `draft()` — پاسخ‌سازی

- `ACTION_EXTRACTION/COMMITMENT_EXTRACTION`: جمله‌هایی که شامل `will|must|need to|should|todo|follow up|deliver|send|prepare|schedule`
  هستند استخراج می‌شوند (حداکثر ۲۰) با `requires_confirmation: true`.
- `RISK_DETECTION`: سیگنال‌های متنی (regex) + سیگنال‌های داده‌ای فارسی مثل
  «ریسک بالا (۷۲) و سلامت پایین (۳۵) — «شرکت آریا»».
- `NEXT_BEST_ACTION`: پیشنهاد فارسیِ اقدام‌پذیر — «پیگیری «X» — اقدام بعدی موعدش رسیده»،
  «ثبت نتیجهٔ جلسهٔ …»، «ادامهٔ گفتگو با … (بر اساس تعامل ۱۴۰۵/…)» — سقف ۱۰، بدون تکرار.
- `MEETING_BRIEF/SUMMARY` از `meetingId`، با شرکت‌کننده‌ها، اقدام‌ها و تعهدات.

### ۱۰.۵ بریف اجرایی (`executiveBrief`)

پنجرهٔ ۷ روزه (قابل `weekStart`) در دامنهٔ کاربر: جلسات، تعهدات باز، اقدامات معوق، روابط پرریسک/کم‌سلامت،
فرصت‌های جدید + `recommendations` سه‌موردیِ متنی + `evidence` با شناسه‌ها. هر اجرا: `AuditLog` + `AiUsageEvent`
(توکن، تأخیر، provider، model) + متریک `observeAi`.

### ۱۰.۶ Providerها

| Provider | رفتار |
|---|---|
| `DeterministicAiProvider` (پیش‌فرض) | پاسخ قاعده‌محور، بدون شبکه، `model:'rule-based-v1'` |
| `ExternalAiProvider` | OpenAI-compatible (`AI_BASE_URL`, `AI_MODEL` پیش‌فرض `gpt-4o-mini`)، `temperature:0.1`، AbortController با `timeoutMs` (پیش‌فرض ۳۰ ثانیه)، trace span و متریک، خطا → 503 `ServiceUnavailableException`؛ بدون `AI_API_KEY` همان اول `health()` قرمز است |

`humanConfirmationRequired` برای `ACTION_EXTRACTION`, `COMMITMENT_EXTRACTION`, `RISK_DETECTION`,
`OPPORTUNITY_DETECTION`, `NEXT_BEST_ACTION` `true` است — AI هرگز خودش را «تصمیم نهایی» جا نمی‌زند.

---

## ۱۱. موتور توصیه‌ها

مسیر: `apps/api/src/recommendations/recommendations.service.ts`.

**۹ نوع**: `FOLLOW_UP · MEETING · INTRODUCTION · RELATIONSHIP_REPAIR · DIVERSIFICATION · OPPORTUNITY ·
RISK_MITIGATION · PROJECT_CONNECTION · EXECUTIVE_ESCALATION`.

**۷ وضعیت**: `PROPOSED → APPROVED/REJECTED/SNOOZED/ASSIGNED → EXECUTED → ARCHIVED`.

قواعد تولید در `generate()` (روی حداکثر ۵۰۰ رابطهٔ دامنهٔ کاربر؛ `daysSince` از `lastInteractionAt`):

| نوع | شرط | `confidence` |
|---|---|---|
| `FOLLOW_UP` | `nextActionAt ≤ امروز` یا `daysSince ≥ 90` | `55 + min(35, days/4) + (10 اگر موعد رسیده)` |
| `MEETING` | `strategic ≥ 70` و `daysSince ≥ 60` | `65 + strategic×0.2` |
| `RISK_MITIGATION` | `risk ≥ 65` یا `health ≤ 40` | `60 + risk×0.3 + (10 اگر health≤40)` |
| `DIVERSIFICATION` | `resilience ≤ 40` و `influence ≥ 50` | `60 + (50 − resilience)×0.4` |
| `OPPORTUNITY` | `opportunity ≥ 60` و `health ≥ 45` | میانگین سه امتیاز |
| `EXECUTIVE_ESCALATION` | `strategic ≥ 85` و `daysSince ≥ 120` | `75 + (strategic − 85)` |

- **ضدتکرار**: اگر رکورد فعال (PROPOSED/ASSIGNED/SNOOZED/APPROVED) با همان `(type, relationshipId, targetId)`
  باشد، مورد جدید ساخته نمی‌شود.
- **انسانی‌محور**: `approve / reject / edit / snooze(until) / assign / accept / view` — هرکدام در ترنزکشن با
  `audit.logMutation` و رویداد `RECOMMENDATION_*`.
- **Execute** فقط پس از `APPROVED`: یک `Action` می‌سازد با اولویت
  `RISK_MITIGATION → HIGH`، `EXECUTIVE_ESCALATION → CRITICAL`، بقیه `MEDIUM`، سررسید **۷ روز بعد**، لینک
  `recommendationId`، رویداد `ACTION_CREATED` + `RECOMMENDATION_ACTION_CREATED` و یک اعلان درون‌برنامه‌ای.
- **Explain**: `GET .../explain` `{reason, evidence, factors, humanApprovalRequired:true}` را برمی‌گرداند.
- **قیاس اثر**: `analytics.recommendationFunnel()` همان قیف را از `AnalyticsEvent`
  (viewed → accepted → actionCreated → actionCompleted → outcome) با درصد تبدیل می‌خواند.

---

## ۱۲. اعلان‌ها، گردش کار و تأییدها

### اعلان (`apps/api/src/notifications/`)

- **موتور قاعده** (`notification-rule-engine.service.ts`): روی رویدادهای دامنه اجرا می‌شود و شرط‌های JSON را
  با عملگرهای `exists · equals · notEquals · in · contains · gt · gte · lt · lte` ارزیابی می‌کند
  (مسیریابی با `path`). `NotificationRule` هر سازمان می‌تواند قواعد خودش را داشته باشد.
- **کاتالوگ هشدارهای کسب‌وکار** (`canonical-business-alerts.ts`) — ۹ کلید پایدار:
  `RELATIONSHIP_DECAY`(HIGH), `COMMITMENT_OVERDUE`(HIGH), `MEETING_WITHOUT_OUTCOME`(MEDIUM),
  `LONG_INACTIVITY`(MEDIUM), `PERSON_POSITION_CHANGE`(MEDIUM), `SCORE_DECREASE`(HIGH),
  `SINGLE_POINT_OF_CONTACT_RISK`(HIGH), `NEW_OPPORTUNITY`(HIGH),
  `PROJECT_WITHOUT_SUFFICIENT_RELATIONSHIP`(MEDIUM) — گیرنده پیش‌فرض: `owner`.
- **بلادرنگ**: `notifications.gateway.ts` (WebSocket) + `notification-realtime.service.ts`.

### گردش کار (`apps/api/src/workflows/`)

```ts
type WorkflowDefinition = {
  trigger?: { type: string; entityType?: string };
  conditions?: Array<{ path: string; equals?; notEquals?; exists? }>;
  actions?: WorkflowAction[];
}
```

- `workflow-event.listener.ts` رویداد دامنه ← اجرایWorkflowهای منطبق؛ `conditionsPass()` همهٔ شرط‌ها را AND می‌کند.
- `WorkflowExecution` سابقهٔ اجرا، `WorkflowEventDelivery` تلاش تحویل وب‌هوک (retry/idempotency).
- **تأیید چندمرحله‌ای**: `workflow-approval.service.ts` — اجرای معلق می‌ماند (`PHASE_M_APPROVAL_WORKFLOW_RESUME`)
  و با `APPROVE/REJECT` از `ApprovalRequest` ادامه می‌یابد؛ تصمیم انسانی در `WorkflowApproval` ثبت می‌شود.

---

## ۱۳. داده: ورود، کیفیت، حریم خصوصی و چرخهٔ حیات

مسیر: `apps/api/src/data-management/`، `apps/api/src/privacy/`، `apps/api/src/common/data-lifecycle/`.

- **Import خط تولید** (`data-import.service.ts` + `data-import.worker.ts`): صف‌شدن، پردازش **batched** برای
  تأییدها، گزارش‌های صفحه‌بندی‌شده، `DataImportRow` (خطای هر سطر) و `DataImportDuplicate`.
- **تشخیص تکرار** (`duplicate-detection.service.ts`): تنگ‌سازی کاندیدا **پیش از** امتیاز شباهت (تا
  O(n²) تبدیل به کار نشود) — همان الگوی کل مخزن: «اول کران، بعد هوش».
- **کیفیت داده** (`data-quality.service.ts`) با ۸ بازرسی:
  `Duplicate Organizations · Missing Owners · Missing Contacts · Stale Relationships · Invalid Emails ·
  Missing Organizations · Missing Dates · Incomplete Profiles` + بخش `coverage` برای هر موجودیت؛
  نتایج در `DataQualitySnapshot` ذخیره و idها سقف‌دار (`maxReturnedIds`) می‌شوند.
  مجوزها: `data.quality.read` / `data.quality.execute`.
- **حریم خصوصی**: `PrivacyRequest` (access/erase) با جریان تأیید، `DataExportLog` برای هر خروجی،
  `ConsentRecord`، `DataProcessingPolicy`؛ حذف نرم → `DataDeletionApproval` → حذف دائمی (`data.permanent_delete`).
- **چرخهٔ حیات**: `common/data-lifecycle/data-lifecycle.service.ts` نقطهٔ واحد `softDelete/archive/restore`
  (هر آرشیو = ممیزی + رویداد).

---

## ۱۴. جستجو، تحلیل و گزارش‌گیری

### جستجو (`search/search.service.ts`)

- ۹ جدول: Organization, Person, Relationship, Meeting, Interaction, Project, Opportunity, Document, Note.
- مسیر سریع: `to_tsvector('simple', …) @@ plainto_tsquery('simple', q)` با `LIMIT 100` در دامنهٔ سازمانی.
- **مسیر جایگزین `ILIKE`**: چون در کلاسترهای با locale/encoding خاص (SQL_ASCII) توکن‌ساز Postgres حروف
  فارسی را «حرف» نمی‌شمارد، جستجوی زیررشته‌ای فعال می‌شود — یک اصلاح بومی‌سازی واقعی، نه رگرسیون.
- امتیازدهی: `100` تطبیق کامل · `90` پیشوند · `70` زیررشته · در غیر این صورت **فازی distance** (≤ ۶۰) روی
  متن فشرده‌شده · `+10` به ازای هر توکن موجود · سقف ۱۰۰.

### Analytics (`analytics/analytics.service.ts`)

- `summary`: ۱۶ شمارش موازی (سازمان/شخص/رابطه/جلسه/اقدام/تعهد/پروژه/فرصت/اعلان/اجرای workflow…) +
  `activeUsers30d` (query raw DISTINCT روی `AnalyticsEvent`) + `featureUsage` (top 20) + شمارش‌های قیف.
  کش ۳۰ ثانیه‌ای با `PerformanceCacheService` (کلید `perf:dashboard:summary:<userId>`) — و در دامنهٔ مستأجر.
- `recommendationFunnel(from,to)`: تبدیل هر مرحله و نرخ‌های کلی.
- `analytics-recommendation.listener.ts`: رویدادهای دامنه ← `AnalyticsEvent` (بدون نوشتن همزمان در ریکوئست کاربر).

### Reporting (`reporting/reporting.service.ts`)

- **۱۷ گزارش**: `relationship-health, relationship-risk, network, meeting, commitment, action, opportunity,
  project, company, contact, risk, influence, referral, subsidiary-comparison, executive, holding,
  executive-summary`. هرکدام صفحه‌بندی ۲۰۰تایی با `scope`.
- **۴ فرمت**: `csv` (با BOM برای Excel فارسی)، `xlsx` (ExcelJS، فریز سرستون + autofilter)، `pdf` (pdfkit)، `json`.
- **دروازهٔ خروجی**: `export()` علاوه بر `report.read` به `report.export` (با `classification:'INTERNAL'`) نیاز دارد،
  می‌تواند `approvalId` بخواهد و `DataExportLog` + ممیزی ثبت می‌کند. `validateFormat` فرمت نامعتبر را 400 می‌کند.
- گزارش `network` واقعاً ترکیبی است: `graph + centrality + connectors + bridgePeople + bottlenecks + singlePointsOfFailure`.

---

## ۱۵. رابط وب

دو کلاینت Next.js (App Router، React 19، **کاملاً RTL و فارسی**، فونت **Vazirmatn** لوکال):

| | `apps/web` | `apps/web-ux` («srip2» / UI 3.0) |
|---|---|---|
| نقش | نسخهٔ مرجع/اصلی | کلون بازطراحی‌شده برای مقایسه و انتشار روی `GitHub Pages /Srip/srip2` |
| ساختار `app/` | یکسان (۵۷ مسیر) | یکسان + `ui-v3.css` |
| خروجی استاتیک | `docs/` | `docs/srip2/` (با `basePath=/Srip/srip2`) |

**۵۳ مسیر** (`app/*/page.tsx`): `dashboard, network, relationships, people, organizations, interactions, meetings, calendar, actions,
commitments, projects, opportunities, intelligence, ai, ai-executive-brief, recommendations, reports, analytics,
documents (مرکز دانش), knowledge, requirements, approvals, referrals, search, notifications, settings, sessions,
privacy, security, security-events, governance, enterprise, authorization, admin (+feature-flags, exports, sessions,
retention, master-data), data-management, data-quality, data-exchange, data-lifecycle, integrations, workflows,
monitoring, observability, metrics, health, api-coverage, backend-coverage, help, workspace, login/register/mfa/
forgot-password/password-reset, actions`.

### ویژگی‌های کلیدی رابط

- **AppShell واحد** (`_components/workspace.tsx`): `WorkspaceProvider` با `GET /auth/me` (نقش/مجوز/محدوده)،
  فیلتر منو بر اساس `can(permission)`، انتخاب محدودهٔ سازمانی (فیلتر UI؛ مرجع، سرور است)،
  دو نمای ناوبری **«ساده/کامل»** با ذخیره در `localStorage`، «واژه‌نامهٔ یک‌خطی» برای هر بخش (GLOSS).
- **پردهٔ احراز هویت (auth-gate veil)**: CSS بحرانی inline در `layout.tsx` تا بازدیدکنندهٔ ناشناس حتی برای یک
  فریم پلتفرم را نبیند؛ سپس `router.replace('/login')`.
- **تقویم جلالی**: `_components/jalali-date-field.tsx` با پاپ‌اور سلطه‌یابِ واکنش‌گرا — برای گزارش‌دهی بومی.
- **گراف شبکه** (`app/network/page.tsx` + `_graph.tsx`، ۸۴۲ خط SVG خالص، بدون کتابخانه):
  چیدمان خوشه‌ای معین‌نگر (هر سازمان در «حباب» پاستلی، اشخاص/پروژه‌ها در مدار)، رنگ/خط‌چین یال بر اساس وضعیت،
  پهنای یال بر اساس وزن، حالت مسیر مبدأ/مقصد، `focus/fit/reset/zoom`، کارت شناور گره، دابل‌کلیک = بازکردن صفحه.
  در کامیت آخر **drag گره حذف شد** (کلیک = انتخاب؛ کشیدن فقط برای pan پس‌زمینه؛ `9px slop` برای لغو pan تصادفی) —
  چون جابه‌جایی پیکسلی روی مختصات world گره‌ها را پرتاب می‌کرد.
- **کارت‌های کیفیت/داده**: `quality-dashboard.tsx` (۳۹۶ خط)، `operational-table.tsx`، `crud-workspace.tsx`،
  `entity-detail.tsx`، `ego-graph.tsx`، `command-palette.tsx` (⌘K)، `notifications-drawer.tsx`، `quick-create.tsx`.
- **تم روشن/تیره** با `data-theme` و `prefers-color-scheme`؛ احترام به `prefers-reduced-motion`.
- **PWA/آفلاین دمو**: `scripts/make-demo-sw.mjs` همان `mock-api.mjs` (سرور Node) را به `public/sw.js` تبدیل می‌کند؛
  یعنی **خروجی استاتیک GitHub Pages کل محصول را با صفر بک‌اند اجرا می‌کند** (ورود دمو: `demo / 123456`).
- **استایل**: دو فایل `globals.css` (۲۲۵۷ خط: توکن‌ها، پوسته، جدول‌ها، ۴۲ بلوک `@media`) و `ui-v3.css` (لایهٔ UI 4).

---

## ۱۶. اپلیکیشن موبایل

مسیر: `apps/mobile` — **Expo SDK 57 / React Native 0.86 / expo-router** (با `react-native-web`)،
`orientation: portrait`، `userInterfaceStyle: automatic`، typed routes.

- **Tabها**: `index` (پیشخوان)، `relationships`، `interactions`، `meetings`، `actions`، `more`.
- **۵۵ صفحه**: موجودیت‌ها (`organization/[id]`, `person/[id]`, `meeting/[id]`, `action/[id]`,
  `commitment/[id]`, `interaction/[id]`, `project/[id]`, `opportunity/[id]`, `recommendation/[id]`) +
  فرم‌های ایجاد (`create-relationship/person/organization/meeting/action/commitment/project/opportunity`) +
  `intelligence`, `network`, `dashboard`, `data-quality`, `integrations`, `documents`, `offline-queue`,
  `ai`, `ai-executive-brief`, `meeting-brief`, `profile`, `notifications`, `login/mfa/register/forgot-password`.
- **توکن‌ها در `expo-secure-store`** (`services/auth-store.ts`) — نه AsyncStorage.
- **صف آفلاین** (`services/offline-queue.ts`): صف `POST/PATCH/DELETE` در SecureStore با
  **`idempotencyKey` پایدار در هر تلاش مجدد** ← سرور replay می‌کند و دادهٔ تکراری ساخته نمی‌شود؛
  `flushMutations` خطاهای 4xx را drop و 5xx را با `attempts+1` نگه می‌دارد. همین را بک‌اند با
  `IdempotencyRecord` پشتیبانی می‌کند (کامیت `f6ea058` هم Redis را برای همین مسیر harden کرد).
- **Push** با `expo-notifications` (`services/push.ts`)؛ **گراف شبکه** به RN پورت شده
  (`features/graph-model.ts` + `network-graph.tsx`).
- وضعیت: «کامپانیون موبایل» برای کار روزمرهٔ میدانی (ثبت تعامل/اقدام/جلسه بیرون از دفتر) است، نه کلید کامل
  ماژول‌های ادمین.

---

## ۱۷. زیرساخت، پایش و DR

- **compose توسعه** (`docker-compose.yml`): `postgres:17-alpine`، `redis:8-alpine`، `clamav` (اسکن فایل)،
  `api:4000`، `worker`، `web:3000`. تصویر per-env + healthcheck؛ `docker-compose.production.yml` جدا.
- **IaaC**: `infrastructure/terraform/modules/` → `network`, `waf`, `database`, `redis`, `storage`,
  `secrets`, `monitoring`, `load-balancer` (+ `infrastructure/waf/README.md`).
- **پایگاه داده/کوئری**: migrationهای commit‌شده در `apps/api/prisma/migrations`، seed (`prisma:seed`,
  `seed-demo`, `seed-mock-compat`)، اسلات `data.restore`.
- **پایش**: `observability.controller.ts` → `/observability/summary`، `/observability/queue`،
  `/observability/metrics` (قالب **Prometheus** text/0.0.4)؛ `metrics.service.ts` تاخیر/توکن AI/خطاها را می‌شمارد؛
  `trace.service.ts` با span در مسیرهای بیرونی (مثل AI).
- **DR/بکاپ** (`scripts/`): `backup-postgres.sh`, `backup-base-pitr.sh`, `create-backup-manifest.sh`,
  `apply-backup-retention.sh`, `backup-scheduler.sh` (با lock + اعتبارسنجی پس از بکاپ)، `restore-pitr.sh`,
  `restore-drill.sh`, `disaster-drill.sh`, `measure-rpo.sh`, `tests/dr/backup-restore-smoke.sh`.
- **مهاجرت امن**: `migration-preflight.sh` وجود بکاپ **رمزنگاری‌شده با checksum** را شرط می‌گذارد.
- **مقیاس**: `performance-gate.sh`, `explain-benchmark.sh`, `tests/load/*` (بنچمارک همزمانی با P50/P95/P99)،
  `load-gate-network-search-reporting.sh`.
- **امنیت runtime**: `apps/api/src/production-hardening.ts`، rate-limit، امنی‌تی‌ایونت (`SecurityEvent`)،
  رمزنگاری توکن یکپارچه‌سازی‌ها (`security:encrypt-integration-tokens`).

---

## ۱۸. تست، درگاه‌های انتشار و ممیزی قرارداد

- **CI** (`.github/workflows/ci.yml`): `pnpm install --frozen-lockfile` → `db:generate` → `check:phase0-6` →
  `lint` → `typecheck` → `build` → `pnpm audit --audit-level high` → `pretest:hardening` → `test:integration`؛
  jobهای جدا برای تست API، `test:security`، `test:e2e` و اسکریپت‌های `verify-package8*`.
- **~۸۰ اسکریپت verify** در `scripts/` (per-phase/per-package) و `apps/api/scripts/verify-phase-*.sh|ts` —
  هر فاز پروژه درگاه راستی‌آزمایی خودش را دارد (قرارداد API، کش، صف، IDOR، ایدمپوتنسی،پوشش تست…).
- **قرارداد**: `apps/API_CONTRACT.json`, `apps/MASTER_CONFORMANCE_AUDIT.json`,
  `apps/REPOSITORY_WEB_CONTRACT_AUDIT.json` + `apps/web*/scripts/{frontend-audit,repository-contract-audit,
  api-tests,link-crawl}.mjs` — یعنی «وب دقیقاً همان چیزی را صدا می‌زند که بک‌اند وعده داده» به‌صورت مکانیکی سنجیده می‌شود.
- **e2e/امنیت**: `tests/e2e/{e2e-smoke,package8-e2e,contract-suite}.mjs`،
  `tests/security/{idor-matrix,owasp-asvs-runtime,package8-security-regression}.mjs`.
- **استراتژی شفافیت**: اسناد تأکید دارند که «اثبات ایستا» با «اثبات runtime» قاطی نشود؛ جایی که DB/شبکه در دسترس
  نباشد، PASS جعلی گزارش نمی‌شود.

---

## ۱۹. اجرای محلی و حالت دمو

```bash
# ۱) زیرساخت
docker compose up -d postgres redis clamav
# ۲) نصب و دیتابیس
pnpm install                      # pnpm 10.12.4
pnpm db:generate && pnpm db:migrate
pnpm --filter @srip api prisma:seed:demo     # دادهٔ نمایشی
# ۳) اجرا
pnpm dev                          # api :4000 · web :3000 · worker
# ۴) خروجی استاتیکِ بدون بک‌اند (برای مرور/دمو)
bash scripts/release-ux.sh        # می‌سازد: apps/web-ux/out → docs/srip2
node serve-preview.mjs            # :4173 — لندینگ + /Srip (اصلی) + /Srip/srip2 (UI 3.0)
```

ورود دمو در نسخهٔ استاتیک: `demo / 123456` (مالک) و `client@arya-tech.ir` (مستأجر آریا فناوری) —
دو پرسونای نقش/محدوده متفاوت برای سنجش رفتار چندمستأجری.

---

## ۲۰. مدل معیارهای ارزیابی (Criteria Assessment Model)

سند کامل و قابل‌ارجاع: `docs/CRITERIA-MODEL.md`. اینجا خلاصۀ فنی و محل کدها.

### چرا و چه چیزی

نمره‌ها پیش‌تر فقط از رفتار ثبت‌شده ساخته می‌شدند؛ دو نقص داشت: (الف) تعریف «معیار» پشت عدد نبود،
(ب) در `cold start` (داده = صفر) عملاً نمره‌ای نبود. فاز جدید یک **مدل واحد** می‌سازد که عوامل را
دو-نوعی می‌کند و وزنشان را با شواهد تنظیم می‌کند:

- `OBSERVED` — همان ۱۲ عامل رفتاری فعلی (تعامل/جلسه/قول/فرصت/تازگی/…).
- `ASSESSED` — کاتالوگ **۴۷ معیار در ۸ خانواده** که از تحقیق بیرون آمده (Dickson 1966 و Weber et al. 1996
  برای انتخاب شریک/تأمین‌کننده، Morgan & Hunt 1994 برای اعتماد/تعهد، Burt 2004 + Granovetter 1973 برای
  شبکه، چک‌لیست‌های due diligence برای لایۀ ریسک/انطباق، و ادبیات انضباط عدم‌قطعیت PLOS برای
  coverage/confidence و «بدون داده ≠ صفر»).

### فایل‌ها

| مسیر | نقش |
|---|---|
| `apps/api/src/criteria/criteria.catalog.ts` | **منبع حقیقت**: خانواده‌ها، مقیاس‌ها، ۴۷ معیار، `FAMILY_WEIGHTS`، `questionnaireFor()` — و `CRITERIA_VERSION = 'criteria-v1'` + `METHOD_QUALITY` در `criteria.engine.ts` |
| `apps/api/src/criteria/criteria.engine.ts` | `computeAssessment`، `summarizeAssessment`، `FACTOR_CRITERIA_MAP`، `factorAssessment`، `criteriaFactorBridge`، `gateCap` |
| `apps/api/src/criteria/criteria.service.ts` | Prisma (answers/snapshots/overrides/review-tasks) + کش ۶۰ ثانیه‌ای + `recordAnswers` |
| `apps/api/src/criteria/criteria.controller.ts` | ۹ مسیر `/criteria/*` (کاتالوگ، پرسش‌نامه، ارزیابی GET/POST/PATCH، review-queue، overrides GET/PATCH، coverage) |
| `apps/api/prisma/schema.prisma` | `CriteriaAnswer` / `CriteriaSnapshot` / `CriteriaOverride` / `CriteriaReviewTask` + سه enum |
| `apps/api/prisma/migrations/20260905120000_criteria_assessment_model/` | مهاجرت (هنوز در این sandbox اجرا نشده) |
| `apps/web-ux/scripts/sync-criteria-catalog.mjs` | کاتالوگ → `criteria-data.json` برای دمو (`--check` = drift gate) |
| `apps/web-ux/scripts/mock-api.mjs` | همتای کامل موتور در دمو (`computeCriteria`، مسیرهای `/criteria/*`، intake در `POST /organizations` `/people` `/relationships`) |
| `apps/{web-ux,web}/app/_components/criteria.tsx` | `CriteriaIntake` / `CriteriaBadge` / `CriteriaScoreCard` / `CriteriaRailChip` |
| `apps/web-ux/app/admin/criteria/page.tsx` | کاتالوگ‌براوزر + وزن خانوادگی + آستانۀ رتبه‌بندی + صف بازبینی |
| `apps/mobile/src/features/criteria.tsx` | همان منطق در RN با `StyleSheet` (intake در سه فرم ساخت، کارت در سه صفحهٔ جزئیات، چیپ در دو فهرست) |

### قواعد مهم موتور (هر دو پیاده‌سازی یکسان)

1. `answerMethod` → کیفیت روش: `DOCUMENT 100 / VERIFIED 90 / OWNER_ASSESSED 70 / SELF_REPORTED 55 / INFERRED 40`؛
   `+10` مدرک (>8 کاراکتر)، `+4` یادداشت (>12)؛ فرسودگی: `decay = max(.35, 1 − .3·min(1,r) − .25·min(1,r/2))`، `r = age/max(30,halfLife)`
2. `confidence = methodQuality·decay (+bonuses)`، و پس از آن `confidence ×= 0.55 + 0.45·knownWeight`
3. پوشش **وزن‌محور**: `familyCredit = Σ modelWeight_f · coveragePct_f`، `knownWeight = min(1, familyCredit/totalModelWeight)`
   — پاسخ‌دادن به یک معیار، خانوادۀ ۸ عضوی را ۱۰۰٪ نمی‌کند
4. `uncertainty = (1−coverage)·28 + (100−conf)/12` → بازۀ `[score±u]` در همه‌جا نمایش داده می‌شود
5. خانواده = میانگین وزن‌دار معیارهای **دارای داده**؛ سوژه = میانگین وزن‌دار خانواده‌ها با `FAMILY_WEIGHTS[subjectType]`
6. `GATES`: `RISK_SANCTIONS_PEP`→cap 20 (CRITICAL)، `FIN_Z_SCORE`→40، `REL_OPPORTUNISM`→45، `CAP_QUALITY_SYSTEM`→55؛
   `score = min(weighted, gateCap)`، پرچم CRITICAL ⇒ `rankable=false`
7. `rankable = coverage ≥ minCoverageForRanking (40) && conf ≥ 35 && بدون CRITICAL`؛
   `rankingScore = score·(0.7 + 0.3·conf/100)`
8. verdict ladder: `CRITICAL → INSUFFICIENT_DATA (<25 cov) → PRELIMINARY (<40 conf) → AT_RISK (<40 score) → STRONG (≥75 & conf≥65) → SOLID`
9. `needsReview = conf < 40 || age > 2×halfLife` → `CriteriaReviewTask` و `/criteria/review-queue`
10. `OBSERVED` هیچ‌وقت از نبود داده صفر نمی‌گیرد: نبودِ کلید ⇒ `null`، صفر واقعی فقط وقتی است که رفتار واقعاً صفر باشد

### نقطۀ اتصال به امتیاز رابطه (`relationship-score.service.ts`)

```ts
b             = interactions + meetings*2 + commitments + opportunities
evidenceShare = b / (b + 6)
assessedShare = (1 − evidenceShare) * (0.35 + 0.65 * confidence/100)
score         = min(Σ wᵢfᵢ با تعدیل پل معیارها, gateCap)
scoreBasis    = b === 0 ? 'COLD_START_ASSESSED' : 'BLEND'
```

و `FACTOR_CRITERIA_MAP` برای هر یک از ۱۲ عامل مشخص می‌کند کدام معیارها آن را به‌عنوان «شاهد تحلیلی»
تقویت/تعدیل کنند (مثلاً `ACC_MULTITHREADING` → تنوع مخاطب، `REL_COMMITMENT` → وفای به قول،
`NET_*` → عوامل موقعیت شبکه).

### API

`GET /criteria` · `GET /criteria/questionnaire/:subjectType[?recommended=true]` ·
`GET|POST /criteria/assessment/:subjectType/:subjectId` · `GET /criteria/review-queue` ·
`GET|PATCH /criteria/overrides/:organizationId` · `GET /criteria/coverage/:organizationId`.
مجوزها تازه اضافه نشدند: `entity.read` / `entity.write` / `analytics.read` / `admin.catalog`.
`POST` روی سه سوژۀ اول، `criteriaAnswers[]` اختیاری می‌پذیرد (cold-start intake همان لحظۀ ساخت).

### ریسک‌های نگهداری

- موک دمو با بیلد **بدون باندلر** (چسباندن خطی در `make-demo-sw.mjs`) ساخته می‌شود؛ منطق تازهٔ دمو باید داخل
  `mock-api.mjs` بماند، بی `import` تازه، بی `server.listen` دوم، و API‌های node-only داخل `try{}`
  (در مرورگر `globalThis.__SRIP_CRITERIA_DATA__` تنها منبع کاتالوگ است).
- تغییر کاتالوگ بدون `pnpm sync:criteria` دمو را از API جدا می‌کند → `release-ux.sh` و
  `pnpm lint:criteria-drift` همین را می‌گیرند.
- `apps/web` (کلاینت قدیمی) موک مستقل دارد که `/criteria/*` را ندارد؛ مؤلفه‌ها با تشخیص ۴۰۴ خودشان را
  پنهان می‌کنند تا فرم ثبت رکورد نشکند.

---

## ۲۱. وضعیت فعلی، شکاف‌ها و کارهای ناتمام

### آنچه پخته است
دامنهٔ کامل + دسترسی لایه‌ای + امتیازدهی نسخه‌بندی‌شده/قابل‌توضیح + **مدل معیارهای ارزیابی با پوشش و اطمینان
و cold-start** (§۲۰، `docs/CRITERIA-MODEL.md`) + تحلیل شبکهٔ واقعی + موتور توصیه با حلقهٔ
انسان + گزارش‌گیری چندفرمتی با درگاه تأیید + آفلاین/ایدپوتنسی در موبایل + درگاه‌های CI و ممیزی قرارداد.

### شکاف‌ها و بدهی فنی (به ترتیب اولویت)

1. **⚠ سند راهنما زیر پای خروجی استاتیک له شده — نیمی از این راه باز شد.** ۱۵۱ فایل `docs/*.md` از
   `main` بازگردانده شدند (بدون دست‌زدن به `docs/srip2/` و خروجی استاتیک): به همین دلیل
   `scripts/verify-phase0-6.sh` و `scripts/verify-package8-final.sh` و سوئیت
   `test/unit/package8-final-audit.spec.ts` دوباره سبزند. باقی‌ماندۀ این شکاف دو چیز است:
   (الف) `scripts/verify.sh` برای شمارش چک‌باکس‌ها به `python` + `python-docx` نیاز دارد که در
   رانر CI نیست، پس شغل `quality` همان‌جا هم قرمز است (روی `main` هم قرمز بود — ربطی به این کار ندارد)؛
   (ب) جای درست خروجی استاتیک از `docs/` به `site/` یا `public/` منتقل شود تا سند و خروجی هم‌نام نمانند.
   متن اصلی این بند: `README.md` به `docs/IMPLEMENTATION_CHECKLIST.md` و
   `docs/MASTER_TECHNICAL_SPEC.md` ارجاع می‌دهد، اما در این برنچ محتوای `docs/` با **خروجی استاتیک
   GitHub Pages** جایگزین شده (`docs/srip2/...`)؛ ۱۴۶ فایل `docs/*.md` فقط در `main` موجودند
   (`git ls-tree main` = 146، در HEAD = 0). راه‌حل: خروجی استاتیک به `public/` یا `site/` منتقل و `docs/*.md`
   بازگردانی شود (یا مسیر خروجی GH Pages به `docs/` محدود و اسناد به `docs/manual/` برود).
2. **موبایل — انجام شد (بازبینی این برنچ).** دو بلوک کهنه که سایدبار را در موبایل به ردیفی از نقطه
   تبدیل می‌کردند (`@media(max-width:900px)` «ریل آیکونی» با `font-size:0` و `content:'•'` و بلوک `760px`
   با `flex-direction:row`) حذف شدند؛ ناوبری موبایل حالا همان دراور عمودی v4.2 است: برچسب کامل،
   لیست ستونی، ارتفاع ضربهٔ `min-height:44px`، عرض `min(320px,88vw)` و `padding` امن. در همان فایل
   یک بلوک «پاس موبایل v4.4» اضافه شد که `100dvh` (با `100vh` به‌عنوان fallback) برای `.app-shell`/
   `.sidebar`/صفحهٔ ورود، و `env(safe-area-inset-*)` برای هدر ثابت، دراور اعلان‌ها و محتوای صفحه ست می‌کند.
3. **`viewport-fit` و safe-area — انجام شد.** `layout.tsx` (هر دو کلاینت) حالا `export const viewport` با
   `viewportFit:'cover'` و `maximumScale:5` دارد و `themeColor` روشن/تاریک می‌دهد؛ ارتفاع بوم گرافِ
   تمام‌صفحه در `ui-v3.css` هم از `calc(100vh - 130px)` به `100dvh` رفت.
4. **PWA — انجام شد.** `manifest.webmanifest` (با `display:standalone`، `theme_color`، `safe_area_inset_overrides`
   و آیکون maskable)، `icon.svg`، PNGهای ۱۹۲/۵۱۲/maskable/`apple-touch-icon` و فاوآیکون‌ها ساخته شدند
   (`scripts/gen-icons.mjs`، خروجی‌ها commit‌اند) و از طریق `metadata` وصل‌اند؛ `appleWebApp` استاتوس‌بار را
   مشکی می‌کند و `formatDetection.telephone:false` شماره‌های فارسی را به لینک تماس تبدیل نمی‌کند. چون
   `basePath` روی URLهای متادیتا اعمال نمی‌شود، مسیرها صراحتاً با `PAGES_BASE` پیشوند می‌گیرند (الگوی
   `sw-register`)؛ در خروجی استاتیک همه با `curl` ۲۰۰ شدند.
5. **زوم اجباری iOS — انجام شد.** در breakpoint موبایل `input,select,textarea{font-size:16px}` و
   `min-height:44px` برای `.btn/.net-btn/.toolbar-select` ست می‌شود، و `user-scalable` بسته می‌ماند.
6. **تعامل لمسی گراف — انجام شد (web-ux).** روی بوم `touch-action:none` است، زوم دوانگشتی با محور ثابت روی
   نقطۀ میانیِ دو انگشت پیاده شد، دوتپ روی گره بزرگ‌نمایی می‌کند و دوتپ روی زمینۀ خالی بازنشانی؛
   کلیک با «سlop» جابه‌جایی (۶px) و دابل‌کلیک ماوس حفظ شده و راهنمای «دو انگشت = زوم» به نوار ابزار اضافه شد.
   کلاینت قدیمی `apps/web` گراف جدا و ساده‌تری دارد و فقط `touch-action` گرفت؛ پینچ به آن منتقل نشد.
   **هنوز روی دستگاه واقعی تأیید نشده** (مرورگر سری‌هد در این محیط کار نمی‌کند).

7. **AI فقط قاعده‌محور است.** Provider بیرونی هست ولی خروجی آن هیچ validation/schema‌ای ندارد، `AiPromptVersion`
   در مسیر `execute()` خوانده نمی‌شود، و بردارها واقعی نیستند (هش ۳۲بعدی). برای «هوشمندی» جدی: RAG با
   embedding واقعی + rerank + guardrail روی خروجی + ارزیابی.
8. **`recommendationAcceptanceRate` در `analytics.summary` هنوز `0` ثابت است** (فقط قیف واقعی در
   `recommendationFunnel` محاسبه می‌شود) → کارت داشبورد گمراه‌کننده.
9. **بازمحاسبهٔ امتیازها manual/رویدادمحور است؛** زمان‌بند (cron/queue) برای «decay همهٔ روابط شب‌ها» وجود ندارد،
   پس `healthScore` روی رابطه می‌تواند کهنه بماند (سیگنال `relationship-decay` در `riskSignals` همان نقص را
   پوشش می‌دهد). پاسخ‌های معیارها هم همان زمان‌بند را لازم دارند: «decay + refresh» سنجهٔ کهنه را هر شب
   به `CriteriaReviewTask` اضافه کند (امروز فقط هنگام محاسبه علامت می‌خورد).
10. **موبایل در CI تست نمی‌شود** (نه typecheck اجباری در gate، نه e2e RN)؛ `apps/mobile` فقط `tsc --noEmit` دارد.

### وضعیت کار باز (پس از پاس موبایل)
آیتم‌های **۲ تا ۶** انجام شدند و در خروجی استاتیک بازسازی‌شده با `scripts/release-ux.sh` دیده می‌شوند؛
باقی‌ماندۀ این محور فقط **تأیید چشمی روی گوشی واقعی** (نصب PWA، نچ‌دارینگ، ژست‌های گراف) است و آیتم **۱**
(له‌شدن اسناد زیر خروجی استاتیک). typecheck سخت `apps/mobile` صفر خطا است.
