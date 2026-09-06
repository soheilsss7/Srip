# مدل معیارهای ارزیابی (Criteria Assessment Model)

سند فنی فاز «امتیازدهی بر پایهٔ معیارهای واقعی». منبع حقیقت یک فایل است:
`apps/api/src/criteria/criteria.catalog.ts` — هر چیز دیگر (دمو، وب، موبایل) از همان تغذیه می‌شود.

---

## ۱. مسئله و تصمیم مدل

قبلاً نمره‌ها فقط از **رفتار ثبت‌شده** ساخته می‌شدند (جلسه، تعامل، قول، فرصت). دو ایراد داشت:

1. «معیار واقعی» پشت عدد نبود — یعنی هیچ‌کس نمی‌توانست بپرسد این ۶۸ بر پایهٔ چه تعریفی است.
2. **دقیقاً در لحظهٔ شروع**، که هیچ رفتاری ثبت نشده، سامانه سکوت می‌کرد یا عدد بی‌اساس می‌داد.

تصمیم مدل (ترکیبی، همان که کاربر انتخاب کرد):

- دو نوع **عامل** داریم: `OBSERVED` (رفتار مشاهده‌شده، ۱۲ عامل قبلی) و `ASSESSED` (معیارهای ارزیابی‌شده).
- در **لحظهٔ ساخت رکورد** یک پرسش‌نامای **کاملاً اختیاری** نشان داده می‌شود که پاسخ‌هایش **همان معیارها** را پر می‌کند — یعنی دادهٔ صفر، بهای «بی‌نمره‌ماندن» نمی‌دهد.
- سهم هر لایه **پویا** است: هرچه رفتار واقعی بیشتر، سهم مشاهده بیشتر؛ در شروع سرد، ارزیابی انسانی حاکم است.
- معیار بدون داده **صفر حساب نمی‌شود**؛ در فهرست «بدون داده» می‌ماند و **پوشش اطلاعات** را پایین می‌آورد. هیچ‌وقت عدد ساختگی (مثل ۵۰) جای خالی را پر نمی‌کند.

استناد به بیرون (چون «باید دقیق و پژوهش‌محور باشد»):

| حوزه | مبنای تحقیقی |
|---|---|
| انتخاب/ارزیابی تأمین‌کننده و شریک | Dickson (1966) — رتبه‌بندی ۲۳ معیار خرید؛ Weber, Desphande & Olson (1996) — افزودن انعطاف، ریسک، موقعیت مالی، شهرت صنعتی؛ Ghodsypour & Wighton (1996) — مدل چندمعیارهٔ کیفیت/قیمت/تحویل |
| اعتماد و تعهد در رابطه | Morgan & Hunt (1994) — اعتماد = صداقت + قابلیت اتکا، تعهد به‌عنوان متغیر میانی؛ «partner-likeness» و رفتار فرصت‌طلبانه در اتحادیاهای استراتژیک |
| جست‌وجوی مسئله‌محور | Behavioral theory of the firm — یک قول/ادعای حل‌نشده تا بسته شدن، قابلیت اتکا را پایین نگه می‌دارد |
| موقعیت شبکه | Burt (2004) و ScienceDirect (bridging/brokerage) — فرم قید `Cᵢ = Σⱼ (pᵢⱼ + Σ_q pᵢq p_qⱼ)²`، پل = یال بدون مخاطب مشترک؛ Granovetter (1973) — پیوندهای ضعیف و دسترسی به اطلاعات نو؛ Valente & Fujimoto — VF-brokerage |
| تکمیل due diligence (لایه‌های عملی) | چک‌لیست‌های رایج vendor due diligence / supply-chain risk assessment: طبقه‌بندی ریسک → عمق و دورۀ ارزیابی، احراز هویت سازمانی و UBO، مالی حسابرسی‌شده، امنیت سایبری (SOC 2 / ISO 27001)، حقوقی/تنظیمی، شهرت و تحریم/PEP، تاب‌آوری عملیاتی و ESG؛ پرچم‌های قرمز = مدارک غایب/تأخیرداره، پاسخ‌های مبهم به امنیت، «انکار کامل همه‌چیز» |
| انضباط عدم‌قطعیت | ادبیات مدل‌سازی اکوسیستم (PLOS ONE) و شبکه‌های بیولوژیک (PLOS BBNet) — مدل باید baseline ساده را بشکند، ابهام پارامتر/ساختار باید گزارش شود، برون‌یابی بیرون از دامنهٔ داده «پرامتیاز ولی غلط» تولید می‌کند، ادعای کیفی باید شاهد مستند داشته باشد |

---

## ۲. ساختار کاتالوگ

`CRITERIA: CriterionDef[]` — **۴۷ معیار** در **۸ خانواده** با **۸ مقیاس** پاسخ:

| کلید خانواده | نام فارسی | معیار | وزن REL | وزن ORG | وزن PERSON | وزن OPP |
|---|---|---|---|---|---|---|
| `STRATEGIC` | اهمیت و هم‌راستایی راهبردی | ۴ | .16 | .18 | .10 | .12 |
| `VALUE` | ارزش اقتصادی | ۶ | .14 | .16 | .06 | .26 |
| `CAPABILITY` | توانمندی عملیاتی | ۵ | .10 | .13 | .08 | .08 |
| `RELIABILITY` | قابلیت اتکا و رفتار رابطه‌ای | ۷ | .20 | .13 | .24 | .12 |
| `ACCESS` | دسترسی و نفوذ در تصمیم | ۸ | .12 | .10 | .32 | .24 |
| `FINANCIAL` | سلامت مالی | ۴ | .06 | .16 | 0 | .04 |
| `RISK` | ریسک، انطباق و حاکمیت | ۸ | .12 | .10 | .12 | .10 |
| `NETWORK` | جایگاه در شبکه | ۵ | .10 | .04 | .08 | .04 |

وزن‌ها به ازای هر سوژه **مجموعاً ۱** هستند و اعتبارسنجی زمان بارگذاری این را چک می‌کند.
توزیع سوژه‌ها: ORGANIZATION ۳۸، RELATIONSHIP ۳۰، PERSON ۱۶، OPPORTUNITY ۱۱ معیار.

هر `CriterionDef` این‌ها را دارد:

```
code, family, name (fa), nameEn, why (چرا این عدد اهمیت دارد),
appliesTo[], polarity: 'GOOD' | 'BAD', weight: 1|2|3,
evidence: 'ASSESSED' | 'OBSERVED' | 'BOTH',
scaleId | anchors[], halfLifeDays (عمر اعتبار پاسخ),
sources[]  ← ارجاع تحقیقی همان معیار،
intake?    ← { prompt, help, recommended }  (پرسش لحظۀ ساخت رکورد)
observedFrom? ← نام سیگنال رفتاری (برای BOTH/OBSERVED)
gate?      ← { trigger, threshold, cap, severity, message }
```

مقیاس‌ها (`SCALES`): `MATURITY`، `FREQUENCY`، `AGREEMENT`، `QUALITY`، `COVERAGE`، `EXPOSURE`، `FINANCIAL_ZONE`، `DEPENDENCY` — هر کدام ۵ لنگر (level 0…4) با برچسب فارسی و نمرهٔ ۰…۱۰۰. ورودی آزاد ۰…۱۰۰ هم مجاز است (`value`).

### معیارهای مشاهده‌پذیر

۲۱ معیار از ۴۷ مورد `evidence !== 'ASSESSED'` هستند و از رفتار واقعی محاسبه می‌شوند
(`criteriaObserved` در دمو / `computeObserved` در سرویس): `REL_TRUST`، `REL_COMMITMENT`،
`REL_CONFLICT`، `CAP_DELIVERY`، `CAP_SERVICE`، `VALUE_PAYMENT`، `VALUE_REALISED`،
`VALUE_PIPELINE`، `ACC_DECISION_ACCESS`، `ACC_MULTITHREADING`، `ACC_RESPONSIVENESS`،
`STRAT_EXEC_SPONSOR`، `RISK_CONCENTRATION`، پنج معیار `NET_*` و سه معیار `OPP_*`.
بقیه فقط با ارزیابی انسانی/مستند پر می‌شوند.

### پرچم‌های دروازه (نه میانگین‌گیری)

| معیار | شرط | سقف نمره | شدت |
|---|---|---|---|
| `RISK_SANCTIONS_PEP` | ریسک بالای آستانه | 20 | CRITICAL |
| `FIN_Z_SCORE` | زیر آستانه (منطقۀ خطر مالی) | 40 | HIGH |
| `REL_OPPORTUNISM` | رفتار فرصت‌طلبانه | 45 | HIGH |
| `CAP_QUALITY_SYSTEM` | نبود سیستم کیفیت | 55 | MEDIUM |

نمرهٔ نهایی `min(weightedScore, gateCap)` است؛ پرچم بحرانی علاوه بر سقف،
`rankable = false` می‌کند و یک توصیهٔ `RISK_MITIGATION` می‌سازد.

---

## ۳. موتور محاسبه

`apps/api/src/criteria/criteria.engine.ts` (و همتای دقیقش در دمو، `computeCriteria`):

1. **سطح → نمره:** لنگر مقیاس، یا `value` خام ۰…۱۰۰. برای `BAD` معکوس می‌شود.
2. **اطمینان هر پاسخ:** `(METHOD_QUALITY + evidenceBonus) × decay`
   - `DOCUMENT 100، VERIFIED 90، OWNER_ASSESSED 70، SELF_REPORTED 55، INFERRED 40`
   - `+10` اگر شرح مدرک (>8 کاراکتر)، `+4` اگر یادداشت (>12 کاراکتر)
   - فرسودگی با سن پاسخ: `decay = max(0.35, 1 − 0.3·min(1,r) − 0.25·min(1,r/2))`، `r = age / max(30, halfLifeDays)`
3. **ترکیب لایه‌ها در معیارهای `BOTH`:** وزن معکوس اطمینان → اگر هر دو شاهد باشند `BLENDED`، وگرنه `OBSERVED`/`ASSESSED`.
4. **نمرۀ خانواده:** میانگین وزن‌دار معیارهای **دارای داده** (خانوادۀ بدون داده در تقسیم حساب نمی‌شود).
5. **نمرۀ سوژه:** میانگین وزن‌دار خانواده‌ها با `FAMILY_WEIGHTS[subjectType]`.
6. **پوشش اطلاعات (weight-aware):** `familyCredit = Σ modelWeight_f × coveragePct_f`؛
   `knownWeight = min(1, familyCredit / totalModelWeight)`. یعنی «یک پاسخ = کل خانوادۀ پوشیده» دیگر
   ۱۰۰٪ نمی‌شود؛ پوشش، سهم واقعی معیارهای پاسخ‌داده‌شده است.
7. **جریمۀ اطمینان:** `confidence ×= 0.55 + 0.45 × knownWeight` — کم‌داتی، اطمینان را هم می‌خورد.
8. **باند عدم‌قطعیت:** `uncertainty = (1−coverage)·28 + (100−conf)/12`؛ بازۀ گزارش‌شده `[score−u, score+u]`.
9. **رتبه‌بندی:** `rankable = coverage ≥ minCoverageForRanking (پیش‌فرض 40) && confidence ≥ 35 && بدون پرچم CRITICAL`؛
   `rankingScore = score × (0.7 + 0.3 × conf/100)` تا در فهرست‌های مقایسه‌ای، رکورد کم‌اطمینان جلو نیفتد.
10. **حکم (verdict):** `CRITICAL` → `INSUFFICIENT_DATA` (پوشش <۲۵) → `PRELIMINARY` (اطمینان <۴۰) →
    `AT_RISK` (نمره <۴۰) → `STRONG` (≥۷۵ و اطمینان ≥۶۵) → `SOLID`. با `verdictLabel` و `verdictHint` فارسی.
11. **بازبینی:** `needsReview` اگر اطمینان <۴۰ یا سن پاسخ > ۲× نصف عمر → در `review-queue`.

### پیوند با امتیاز رابطه

در `relationship-score.service.ts` لایه‌ها این‌طور ترکیب می‌شوند:

```
b            = interactions + meetings×2 + commitments + opportunities
evidenceShare= b / (b + 6)                      // رفتار واقعی هرچه بیشتر، سهم بیشتر
assessedShare= (1 − evidenceShare) × (0.35 + 0.65 × confidence/100)
score        = min(weightedSum, gateCap)
scoreBasis   = 'COLD_START_ASSESSED' وقتی b = 0
```

همچنین `FACTOR_CRITERIA_MAP` + `factorAssessment()` / `criteriaFactorBridge()` مشخص می‌کند کدام معیار
هر یک از ۱۲ عامل رفتاری را تغذیه/تعدیل می‌کند (مثلاً `ACC_MULTITHREADING` روی عامل تنوع،
`REL_COMMITMENT` روی وفای به قول). `criteriaService` در `ScoringModule` جایگزین شد با `CriteriaModule`
(بدون چرخهٔ import).

---

## ۴. داده و API

Prisma (`apps/api/prisma/schema.prisma`):

- `enum CriteriaSubjectType { ORGANIZATION PERSON RELATIONSHIP OPPORTUNITY }`
- `enum CriteriaAnswerMethod { DOCUMENT VERIFIED OWNER_ASSESSED SELF_REPORTED INFERRED }`
- `enum CriteriaReviewStatus { OPEN REFRESHED DISPUTED ACCEPTED }`
- `CriteriaAnswer` — `@@unique([subjectType, subjectId, criterionCode])`، `level?`، `value?`، `note?`، `evidence?`،
  `method`، `answeredAt`، `answeredById`
- `CriteriaSnapshot` — خروجی هر محاسبه (نمره، پوشش، اطمینان، باند، پرچم‌ها، `familyScores Json`، `criteriaVersion`)
- `CriteriaOverride` — `familyWeights Json?`، `minCoverageForRanking` (پیش‌فرض ۴۰) — وزن‌ها بدون تغییر کد عوض می‌شوند
- `CriteriaReviewTask` — صف بازبینی/اختلاف

مسیرها (`/api/v1`، همان permission‌های موجود: `entity.read` / `entity.write` / `analytics.read` / `admin.catalog`):

| متد | مسیر | کار |
|---|---|---|
| `GET` | `/criteria` | کاتالوگ کامل + خانواده‌ها + وزن‌ها + مقیاس‌ها |
| `GET` | `/criteria/questionnaire/:subjectType` | پرسش‌نامای اختیاری (`?recommended=true` برای ۸–۹ پرسش پیشنهادی) |
| `GET` | `/criteria/assessment/:subjectType/:subjectId` | ارزیابی کامل: نمره، باند، خانواده‌ها، خطوط معیار، بدون‌داده‌ها، hints |
| `POST` | `/criteria/assessment/:subjectType/:subjectId` | ثبت پاسخ‌ها (`{ answers[], source }`) + بازمحاسبه |
| `GET` | `/criteria/review-queue` | بازبینی‌های لازم + پاسخ‌های کهنه |
| `GET/PATCH` | `/criteria/overrides/:organizationId` | وزن خانوادگی و آستانۀ رتبه‌بندی |
| `GET` | `/criteria/coverage/:organizationId` | چند رکورد ارزیابی‌شده/قابل‌مقایسه است |

**ورودی باز:** `POST /organizations`، `POST /people`، `POST /relationships` یک فیلد اختیاری
`criteriaAnswers[]` می‌گیرند و همان لحظه ارزیابی را می‌سازند (cold start بدون مسدود کردن ثبت رکورد).

**پیوست پاسخ‌ها:** `criteria` (خلاصه) روی فهرست و جزئیات سازمان/شخص/رابطه attach می‌شود تا
فهرست‌ها بتوانند نشان بدهند کدام رکورد ارزیابی نشده است.

**توصیه‌ها:** دو قاعدهٔ جدید — `RISK_MITIGATION` هنگام پرچم `CRITICAL`/`HIGH` معیارها، و
`FOLLOW_UP` «تکمیل ارزیابی معیارها» وقتی پوشش < ۴۰.

---

## ۵. جریان در رابط کاربری

مؤلفهٔ مشترک: `apps/{web-ux,web}/app/_components/criteria.tsx`

| جزء | کجا | کار |
|---|---|---|
| `CriteriaIntake` | فرم‌های ساخت سازمان/شخص/رابطه، و حالت ویرایش کارت | پرسش‌های پیشنهادی/همه، چیپ لنگرها، «نمی‌دانم»، یادداشت/مدرک |
| `CriteriaBadge` | ستون «ارزیابی معیارها» در فهرست سازمان‌ها، زیر نام در فهرست افراد، در فهرست روابط | نمره + پوشش + رنگ حکم |
| `CriteriaScoreCard` | جزئیات سازمان/شخص/رابطه | نمره، بازۀ قابل‌انتظار، پوشش و اطمینان، پرچم‌ها، بازشوندهٔ خانواده→معیار، بلوک «بدون داده»، hints، ویرایش و ذخیره |
| `CriteriaRailChip` | پنل گره‌های صفحهٔ شبکه | خلاصهٔ یک‌خطی + تعداد معیار بدون داده |
| `/admin/criteria` | مدیریت | کاتالوگ، وزن خانوادگی + آستانۀ رتبه‌بندی (PATCH overrides)، پرچم‌های دروازه، تقویم بازبینی |

مرتب‌سازی‌های جدید: `coverage` (ناقص‌ترین ارزیابی اول) در فهرست سازمان‌ها و افراد و روابط؛
`criteria` در سازمان‌ها.

**موبایل** (`apps/mobile/src/features/criteria.tsx`): `CriteriaIntake` در `create-organization`،
`create-person`، `create-relationship`؛ `CriteriaScore` در `organization/[id]`، `person/[id]`،
`relationship/[id]`؛ `CriteriaChip` در فهرست‌های `organizations.tsx` و `people.tsx`.
استایل با `StyleSheet` خودِ فایل (بدون Tailwind) و همان منطق وب — یعنی یک کاتالوگ، سه کلاینت.

اگر محیطی مسیرهای `/criteria` را نداشته باشد (کلاینت قدیمی با Mock مستقل)، مؤلفه‌ها با تشخیص ۴۰۴
**بی‌صدا پنهان** می‌شوند؛ هیچ خطای سرخ روی فرم ثبت رکورد نمی‌آید.

---

## ۶. دمو و هم‌رسانی کاتالوگ

- `apps/web-ux/scripts/sync-criteria-catalog.mjs` → `scripts/criteria-data.json`
  (کاتالوگ از روی فایل TS موتور API با parse ساختار-آگاه تولید می‌شود؛ اعتبارسنجی‌های همان موتور هم اجرا می‌شود:
  یکتابی کدها، وزن خانوادگی مجموعاً ۱، مقیاس موجود).
  - `pnpm sync:criteria` برای تولید دوباره
  - `pnpm lint:criteria-drift` (و `scripts/release-ux.sh`) در صورت اختلاف، انتشار را متوقف/هم‌رسانی می‌کند
- `scripts/mock-api.mjs` همتای کامل موتور را دارد (`computeCriteria`) و `criteria-data.json` را می‌خواند؛
  در بیلد استاتیک، `make-demo-sw.mjs` همان JSON را به‌صورت `globalThis.__SRIP_CRITERIA_DATA__` به `sw.js` تزریق می‌کند
  (موک دمو بدون باندلر، با چسباندن خطی ساخته می‌شود — پس هیچ `import` یا `fs` قابل‌اجرای دیگری مجاز نیست).
- ارزیابی‌های نمونه (`seedCriteriaAssessments`) روی `ORGANIZATION:org-3`، `ORGANIZATION:org-6`،
  `RELATIONSHIP:r-1`، `RELATIONSHIP:r-4`، `PERSON:p-2` با سن ۱۲ روز ذخیره می‌شوند تا پوشش و فرسودگی در دمو معنادار باشد.

### اعداد تأییدشده در دمو (موک روی :۴۰۰۰، کاربر `client`)

| حالت | نمره | پوشش | اطمینان | باند | حکم |
|---|---|---|---|---|---|
| سازمان تازه با ۵ پاسخ (۶ معیار از ۳۸) | 74 | ۲۳٪ | ۵۲ | ۵۱–۹۷ | داده کافی نیست (۳۲ معیار بدون داده) |
| همان سازمان با ۷ پاسخ بیشتر | 40 | ۱۰۰٪ | ۷۱ | ۳۸–۴۲ | SOLID با سقف دو پرچم |
| `ORGANIZATION/org-2` (۴ پاسخ کهنه) | 39 | ۴٪ | ۳۶ | ۹–۶۹ | داده کافی نیست، غیرقابل‌مقایسه |
| `RELATIONSHIP/r-1` | 66 | ۹۴٪ | — | — | rankable |
| `RELATIONSHIP/r-4` | 45 | ۸۰٪ | — | — | یک پرچم + سقف |

---

## ۷. راه‌های توسعه (بدون شکستن بقیه)

- **معیار تازه:** فقط افزودن یک شیء به `CRITERIA` (+ در صورت نیاز `intake`) → `pnpm sync:criteria` →
  پرسش‌نامه، کارت، فهرست و دمو خودکار به‌روز می‌شوند. عدد `weight` ۱…۳ و `halfLifeDays` را جدی بگیرید.
- **وزن تازه برای یک مشتری:** بدون کد، از `/admin/criteria` (PATCH `/criteria/overrides/:orgId`).
- **معیار مشاهده‌پذیر تازه:** `evidence: 'OBSERVED'|'BOTH'` + `observedFrom` و محاسبه‌اش در
  `computeObserved` (API) و `criteriaObserved` (موک) — این دو باید مثل هم بمانند.
- **پرسش‌نامۀ کوتاه‌تر:** `intake.recommended: true` روی ۸ تا ۱۰ معیار؛ بقیه زیر «نمایش همه».

### محدودیت‌های شناخته‌شده

- اعتبارسنجی «پاسخ‌های متناقض» (مثلاً «سیستم کیفیت داریم» + «بدون ISO») هنوز به شکل صریح پیاده نشده —
  فقط یادداشت بازبینی ثبت می‌شود.
- موتور دمو برای دمو است؛ منطق امتیاز واقعی در `apps/api` زنده است. هر تغییر موتور باید با
  `sync:criteria` و بازبینی دستی `computeCriteria` هم‌گام شود.
- `prisma migrate` در این سند اجرا نشده (محیط sandbox بدون `node_modules` اپ API و بدون دیتابیس)؛
  فایل مهاجرت `20260905120000_criteria_assessment_model` آمادهٔ اجراست.
