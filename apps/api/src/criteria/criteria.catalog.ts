/**
 * SRIP — catalog of real, research-grounded relationship criteria.
 *
 * This file is the single source of truth for the criteria model used across the
 * platform (API, web, mobile, intake questionnaires, scoring, recommendations).
 *
 * Every criterion is anchored in published work rather than invented:
 *  - Dickson (1966) / Weber et al. (1996): 23 supplier-selection criteria →
 *    quality, delivery, capacity, technical capability, service, cost, financial position, contract terms.
 *  - Anderson & Narasimhan (1996); Choi & Lee (2007): root causes of buyer–supplier relationship failure →
 *    opportunism, dishonesty, non-adaptation, poor conflict handling, trust erosion.
 *  - Morgan & Hunt (1994): trust and commitment → relationship stability, cooperation, turnover reduction.
 *  - Jones et al. (1997); Li et al. (2026): commitment–trust → voice, loyalty, neglect, exit.
 *  - Mitchell/Agle/Wood (1997) + Mendelow (1991): stakeholder salience → power, legitimacy, urgency.
 *  - Gulati (1995, 1998); Das & Teng (1998): partner selection → resource complementarity, strategic fit, partner reputation.
 *  - فریمن (۱۹۷۷); Burt (1992, 2004); گرانووتر (۱۹۷۳): network position →
 *    betweenness/bridging, structural holes vs redundancy, weak-tie reach.
 *  - Altman (1968, 2000) Z''-score + Altman Hot'fi (2005) credit-risk rating + Basel IRB PD/LGD/EAD:
 *    financial health zones and credit exposure.
 *  - CFA Institute (2007): liquidity, leverage, coverage ratios for counterparties.
 *  - E&Y/Moody's (2002): customer lifetime value / profitability as relationship worth.
 *  - vendor-management suites (SmartVendor, Aravo): onboarding risk questions,
 *    risk tiering by data access, criticality, replaceability.
 *  - third-party due-diligence practice (neotas/Onesope 2025-2026): UBO transparency, sanctions/PEP screening,
 *    adverse media, ABAC policy, ISO 9001/14001/45001/27001/SA8000 evidence, refusal-to-answer as a red flag.
 *  - sales-execution research (Fortna et al. 2012 TSP; MEDDPICC; Gartner 2021; Gong 2025):
 *    multi-threading breadth, executive engagement, champion power + motivation, activity→pipeline conversion.
 *  - SaaS health scoring practice (Gainsight, ChurnZero, Vitally, Custify, Planhat):
 *    usage, feature adoption, support experience, sentiment, QBR, executive alignment, expansion signals,
 *    renewal-risk drivers (champion departure, declining product usage, low sentiment, no executive engagement).
 *  - predictive-modelling practice (Wilson et al. 2017): report uncertainty, do not extrapolate past observed data,
 *    be explicit about missing inputs → implemented here as confidence + uncertainty band + refusal to rank.
 */

export type CriterionSubject = 'ORGANIZATION' | 'PERSON' | 'RELATIONSHIP' | 'OPPORTUNITY';

export type CriterionFamily =
  | 'STRATEGIC'
  | 'VALUE'
  | 'CAPABILITY'
  | 'RELIABILITY'
  | 'ACCESS'
  | 'FINANCIAL'
  | 'RISK'
  | 'NETWORK';

export type EvidenceMethod =
  | 'SELF_REPORTED' // پاسخ خودِ مخاطب در پرسش‌نامه
  | 'OWNER_ASSESSED' // ارزیابی مدیر رابطه
  | 'DOCUMENT' // سند/مدرک بارگذاری‌شده
  | 'VERIFIED' // راستی‌آزمایی مستقل
  | 'INFERRED'; // استنتاج از داده‌های رفتار واقعی

export type ScaleId =
  | 'MATURITY'
  | 'FREQUENCY'
  | 'AGREEMENT'
  | 'QUALITY'
  | 'COVERAGE'
  | 'EXPOSURE'
  | 'FINANCIAL_ZONE'
  | 'DEPENDENCY';

export interface ScaleAnchor {
  level: number;
  label: string;
  score: number;
}

export interface Criterion {
  code: string;
  family: CriterionFamily;
  name: string;
  nameEn: string;
  why: string;
  appliesTo: CriterionSubject[];
  polarity: 'GOOD' | 'BAD';
  /** وزن معیار درون خانواده (۱ تا ۳). */
  weight: 1 | 2 | 3;
  /** داده از کجا می‌آید: پرسش‌نامه، رفتار مشاهده‌شده، یا هر دو. */
  evidence: 'ASSESSED' | 'OBSERVED' | 'BOTH';
  scaleId: ScaleId;
  /** گزینه‌های سفارشی به‌جای مقیاس پیش‌فرض family (برای سؤالات کمّی). */
  anchors?: ScaleAnchor[];
  /** نیمه‌عمر اعتبار پاسخ (روز) — بعد از آن اطمینان کاهش می‌یابد. */
  halfLifeDays: number;
  /** سؤالات اختیاری ورود اطلاعات (cold start). */
  intake?: {
    prompt: string;
    help: string;
    recommended?: boolean;
    /** اگر پاسخ «ندارد/ناشناخته» باشد چه هشدار ثبت شود. */
    warnBelow?: number;
    warning?: string;
  };
  /** مشاهدهٔ رفتار از کدام فیلد/منبع می‌آید (برای هم‌گام‌سازی با مدل امتیاز رفتار). */
  observedFrom?: string;
  /** معیار دروازه‌ای: یک پرچم سرخ که سقف امتیاز را تعیین می‌کند. */
  gate?: {
    /** اگر امتیاز معیار (در جهت خودش) از این آستانه بدتر شد، دروازه فعال می‌شود. */
    trigger: 'ABOVE' | 'BELOW';
    threshold: number;
    /** سقف امتیاز نهایی وقتی دروازه فعال است. */
    cap: number;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    message: string;
  };
  sources: string[];
}

export const SCALES: Record<ScaleId, { label: string; anchors: ScaleAnchor[] }> = {
  MATURITY: {
    label: 'بلوغ نظام‌مند',
    anchors: [
      { level: 0, label: 'اصلاً ندارد', score: 0 },
      { level: 1, label: 'غیررسمی و پراکنده', score: 25 },
      { level: 2, label: 'رویهٔ مکتوب دارد', score: 50 },
      { level: 3, label: 'اجرای پایدار و ممیزی‌شده', score: 75 },
      { level: 4, label: 'استاندارد بین‌المللی/گواهی معتبر', score: 100 },
    ],
  },
  FREQUENCY: {
    label: 'دوام و تکرار',
    anchors: [
      { level: 0, label: 'هرگز', score: 0 },
      { level: 1, label: 'به‌ندرت', score: 25 },
      { level: 2, label: 'گاهی', score: 50 },
      { level: 3, label: 'معمولاً', score: 75 },
      { level: 4, label: 'همیشه / بی‌استثنا', score: 100 },
    ],
  },
  AGREEMENT: {
    label: 'میزان هم‌راستایی',
    anchors: [
      { level: 0, label: 'تضاد کامل', score: 0 },
      { level: 1, label: 'هم‌راستایی کم', score: 25 },
      { level: 2, label: 'قسمتی مشترک', score: 50 },
      { level: 3, label: 'هم‌راستایی روشن', score: 75 },
      { level: 4, label: 'پیوستگی کامل استراتژیک', score: 100 },
    ],
  },
  QUALITY: {
    label: 'کیفیت مشاهده‌شده',
    anchors: [
      { level: 0, label: 'بسیار ضعیف', score: 0 },
      { level: 1, label: 'ضعیف', score: 25 },
      { level: 2, label: 'متوسط', score: 50 },
      { level: 3, label: 'خوب', score: 75 },
      { level: 4, label: 'عالی', score: 100 },
    ],
  },
  COVERAGE: {
    label: 'پوشش خطوط تماس',
    anchors: [
      { level: 0, label: 'بدون تماس', score: 0 },
      { level: 1, label: 'فقط یک نفر (رابطهٔ تک‌رشته‌ای)', score: 30 },
      { level: 2, label: 'دو خط تماس', score: 55 },
      { level: 3, label: 'سه تا چهار خط تماس', score: 80 },
      { level: 4, label: 'پنج خط تماس یا بیشتر، شامل مدیران ارشد', score: 100 },
    ],
  },
  EXPOSURE: {
    label: 'میزان مواجهه',
    anchors: [
      { level: 0, label: 'مواجههٔ تاییدشده / رد نشد', score: 100 },
      { level: 1, label: 'نشانهٔ قوی، در حال بررسی', score: 75 },
      { level: 2, label: 'پرسش باز / پاسخ داده نشد', score: 55 },
      { level: 3, label: 'ریسک جزئی، قابل مدیر', score: 25 },
      { level: 4, label: 'پاک — بررسی و مستند شده', score: 0 },
    ],
  },
  FINANCIAL_ZONE: {
    label: 'ناحیهٔ سلامت مالی',
    anchors: [
      { level: 0, label: 'ناحیهٔ خطر (امتیاز آلتمن زیر ۱٫۱ یا عدم شفافیت مالی)', score: 0 },
      { level: 1, label: 'منطقهٔ خاکستری (۱٫۱ تا ۲٫۶)', score: 40 },
      { level: 2, label: 'قابل قبول، حاشیهٔ کم', score: 60 },
      { level: 3, label: 'سالم (امتیاز آلتمن بالای ۲٫۶، نقدینگی کافی)', score: 85 },
      { level: 4, label: 'بسیار قوی (صورت مالی حسابرسی‌شده، پوشش > ۲)', score: 100 },
    ],
  },
  DEPENDENCY: {
    label: 'وابستگی متقابل',
    anchors: [
      { level: 0, label: 'وابستگی یک‌طرفه و غیرقابل جایگزینی', score: 100 },
      { level: 1, label: 'جایگزینی دشوار (بیش از ۶ ماه)', score: 75 },
      { level: 2, label: 'جایگزینی متوسط (۳ تا ۶ ماه)', score: 50 },
      { level: 3, label: 'جایگزینی آسان (کمتر از ۹۰ روز)', score: 25 },
      { level: 4, label: 'کالا/خدمت کاملاً جایگزین‌پذیر', score: 0 },
    ],
  },
};

export const FAMILY_META: Record<CriterionFamily, { name: string; nameEn: string; rationale: string }> = {
  STRATEGIC: {
    name: 'اهمیت و هم‌راستایی راهبردی',
    nameEn: 'Strategic salience & fit',
    rationale:
      'معیارهای انتخاب شریک (ریکاردز ۱۹۸۶؛ گولاتی ۱۹۹۵) و برجستگی ذی‌نفعان (میتچل ۱۹۹۷؛ مندلو ۱۹۹۱): قدرت، مشروعیت، فوریت و تناسب راهبردی.',
  },
  VALUE: {
    name: 'ارزش اقتصادی',
    nameEn: 'Economic value',
    rationale:
      'ارزش فعلی و چرخهٔ عمر رابطه (مودی ۲۰۰۲) و معیار هزینه/سود در ادبیات انتخاب تأمین‌کننده (دیکسون ۱۹۶۶).',
  },
  CAPABILITY: {
    name: 'توانمندی عملیاتی',
    nameEn: 'Operational capability',
    rationale:
      'معیارهای کلاسیک انتخاب تأمین‌کننده: کیفیت، تحویل به‌موقع، ظرفیت، توانمندی فنی، خدمات پس از فروش (دیکسون ۱۹۶۶؛ وبر ۱۹۹۶).',
  },
  RELIABILITY: {
    name: 'قابلیت اتکا و رفتار رابطه‌ای',
    nameEn: 'Reliability & relational behaviour',
    rationale:
      'اعتماد و تعهد (مورگان و هانت ۱۹۹۴) و ریشه‌های شکست رابطه: فرصت‌طلبی، بی‌وفایی در تعهد، ناتوانی در مدیریت اختلاف (اندرسون و ناراسیمهان ۱۹۹۶؛ چوی و لی ۲۰۰۷).',
  },
  ACCESS: {
    name: 'دسترسی و نفوذ در تصمیم',
    nameEn: 'Access & decision influence',
    rationale:
      'پوشش چندلایهٔ سازمان مشتری (فورتنا و همکاران ۲۰۱۲؛ گارتنر ۲۰۲۱) و قدرت/دسترسی/انگیزهٔ حامی (چارچوب فروش راهبردی).',
  },
  FINANCIAL: {
    name: 'سلامت مالی',
    nameEn: 'Financial health',
    rationale:
      'مدل آلتمن (۱۹۶۸، ۲۰۰۰)، نسبت‌های نقدینگی/اهرم/پوشش (انجمن تحلیلگران مالی ۲۰۰۷) و چارچوب ریسک اعتباری کمیتهٔ بازل (احتمال نکول، زیان در صورت نکول، میزان در معرض خطر).',
  },
  RISK: {
    name: 'ریسک، انطباق و حاکمیت',
    nameEn: 'Risk, compliance & governance',
    rationale:
      'ارزیابی ریسک طرف حساب: شفافیت مالکیت نهایی، غربالگری تحریم و مناصب، رسانهٔ منفی، امنیت داده، ملاحظات زیست‌محیطی/اجتماعی/حاکمیتی و تمرکز وابستگی (بررسی مقدماتی شخص ثالث).',
  },
  NETWORK: {
    name: 'جایگاه در شبکه',
    nameEn: 'Network position',
    rationale:
      'ذینفع/مرکزی فریمن (۱۹۷۷)، سوراخ‌های ساختاری برت (۱۹۹۲، ۲۰۰۴) و پیوندهای ضعیف گرانووتر (۱۹۷۳).',
  },
};

/** وزن خانواده‌ها در مدل هر نوع سوژه (نرمال‌سازی خودکار روی خانواده‌های دارای داده). */
export const FAMILY_WEIGHTS: Record<CriterionSubject, Record<CriterionFamily, number>> = {
  ORGANIZATION: {
    STRATEGIC: 0.18,
    VALUE: 0.16,
    CAPABILITY: 0.13,
    RELIABILITY: 0.13,
    ACCESS: 0.1,
    FINANCIAL: 0.16,
    RISK: 0.1,
    NETWORK: 0.04,
  },
  PERSON: {
    STRATEGIC: 0.1,
    VALUE: 0.06,
    CAPABILITY: 0.08,
    RELIABILITY: 0.24,
    ACCESS: 0.32,
    FINANCIAL: 0.0,
    RISK: 0.12,
    NETWORK: 0.08,
  },
  RELATIONSHIP: {
    STRATEGIC: 0.16,
    VALUE: 0.14,
    CAPABILITY: 0.1,
    RELIABILITY: 0.2,
    ACCESS: 0.12,
    FINANCIAL: 0.06,
    RISK: 0.12,
    NETWORK: 0.1,
  },
  OPPORTUNITY: {
    STRATEGIC: 0.12,
    VALUE: 0.26,
    CAPABILITY: 0.08,
    RELIABILITY: 0.12,
    ACCESS: 0.24,
    FINANCIAL: 0.04,
    RISK: 0.1,
    NETWORK: 0.04,
  },
};

export const CRITERIA: Criterion[] = [
  /* ------------------------------- STRATEGIC ------------------------------- */
  {
    code: 'STRAT_POWER',
    family: 'STRATEGIC',
    name: 'جایگاه در دستور کار تصمیم‌سازان',
    nameEn: 'Salience to decision makers',
    why: 'برجستگی ذی‌نفع بر پایهٔ قدرت، مشروعیت و فوریت خواسته — تعیین می‌کند حمایت یا مخالفت این طرف حساب واقعاً روی تصمیم اثر دارد یا نه.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'ASSESSED',
    scaleId: 'AGREEMENT',
    halfLifeDays: 365,
    intake: {
      prompt: 'این طرف حساب در دستور کار مدیران ارشد ما کجاست؟',
      help: 'مثلاً: پروژهٔ مصوب بودجه دارد، در کارت امتیازی مدیران است، یا صرفاً یک تماس معمولی.',
      recommended: true,
      warnBelow: 25,
      warning: 'بدون جایگاه تصمیم‌ساز، رابطه حتی اگر خوب باشد سرمایه‌گذاری چندانی نمی‌طلبد.',
    },
    sources: ['میتچل/اگل/وود ۱۹۹۷', 'مندلو ۱۹۹۱'],
  },
  {
    code: 'STRAT_FIT',
    family: 'STRATEGIC',
    name: 'تناسب راهبردی و تکمیل منابع',
    nameEn: 'تناسب راهبردی و مکملیت منابع',
    why: 'انتخاب شریک بر پایهٔ تناسب هدف و تکمیل‌بودن منابع (نه شباهت‌ها) — پیش‌بین اصلی ماندگاری همکاری.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'ASSESSED',
    scaleId: 'AGREEMENT',
    halfLifeDays: 365,
    intake: {
      prompt: 'همکاری با این سازمان چه خلأ راهبردی ما را پر می‌کند؟',
      help: 'تکنولوژی، دسترسی به بازار، منبع مالی، اعتبار برند یا ظرفیت تولید.',
      recommended: true,
    },
    sources: ['گولاتی ۱۹۹۵', 'دس و تنگ ۱۹۹۸'],
  },
  {
    code: 'STRAT_REPLACEMENT',
    family: 'STRATEGIC',
    name: 'دشواری جایگزینی و هزینهٔ خروج',
    nameEn: 'Replaceability / switching cost',
    why: 'هرچه جایگزینی سخت‌تر، رابطه راهبردی‌تر و در عین حال وابستگی پرریسک‌تر — مبنای طبقه‌بندی ریسک تأمین.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'DEPENDENCY',
    anchors: [
      { level: 0, label: 'کاملاً جایگزین‌پذیر (بازار آزاد)', score: 100 },
      { level: 1, label: 'جایگزینی تا ۹۰ روز ممکن است', score: 80 },
      { level: 2, label: 'جایگزینی ۳ تا ۶ ماه', score: 55 },
      { level: 3, label: 'جایگزینی بیش از ۶ ماه / دانش ضمنی بالا', score: 30 },
      { level: 4, label: 'غیرقابل جایگزینی در افق قابل‌تصور', score: 10 },
    ],
    halfLifeDays: 540,
    intake: {
      prompt: 'اگر این رابطه فردا قطع شود، چند ماه طول می‌کشد جایگزینش کنیم؟',
      help: 'معیار عملیاتی طبقه‌بندی تأمین‌کننده: «در ۳۰ روز قابل جایگزینی است؟»',
    },
    sources: ['دیکسون ۱۹۶۶', 'معیارهای ریسک‌تیئر ثالث (۲۰۲۶): قابلیت جایگزینی در ۳۰/۶۰ روز'],
  },
  {
    code: 'STRAT_EXEC_SPONSOR',
    family: 'STRATEGIC',
    name: 'حمایت مدیران ارشد دوطرفه',
    nameEn: 'Executive engagement on both sides',
    why: 'درگیری مدیران ارشد قوی‌ترین پیش‌بین رشد و نگهداشت مشتری است و نبود آن یکی از پرریسک‌ترین نشانه‌ها.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'BOTH',
    scaleId: 'FREQUENCY',
    halfLifeDays: 180,
    observedFrom: 'جلسات و تعاملات: ۹۰ روز اخیر (نقش: مدیر عامل/عضو هیئت‌مدیره)',
    intake: {
      prompt: 'در ۶ ماه گذشته چند نشست مشترک در سطح مدیران ارشد داشته‌ایم؟',
      help: 'منظور سطح مدیریت ارشد یا عضو هیئت‌مدیره در هر دو طرف.',
      recommended: true,
    },
    sources: ['گینسایت/پلنهت: محرک‌های ریسک تمدید', 'هم‌راستایی مدیریت ارشد (چرن‌زیرو)'],
  },
  /* --------------------------------- VALUE --------------------------------- */
  {
    code: 'VALUE_REALISED',
    family: 'VALUE',
    name: 'ارزش محقق‌شدهٔ سالانه',
    nameEn: 'Realised annual value',
    why: 'گردش/حاشیهٔ واقعی ۱۲ ماه گذشته — مبنای کمّی «ارزش رابطه» در ادبیات ارزش‌گذاری مشتری.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'BOTH',
    scaleId: 'QUALITY',
    anchors: [
      { level: 0, label: 'هیچ گردش ثبت‌شده‌ای', score: 0 },
      { level: 1, label: 'کمتر از ۱ میلیارد تومان', score: 30 },
      { level: 2, label: '۱ تا ۵ میلیارد', score: 55 },
      { level: 3, label: '۵ تا ۲۵ میلیارد', score: 80 },
      { level: 4, label: 'بیش از ۲۵ میلیارد', score: 100 },
    ],
    halfLifeDays: 270,
    observedFrom: 'فرصت‌ها: جمع ارزش فازهای برنده + فاکتورها',
    intake: {
      prompt: 'گردش یا ارزش مالی این رابطه در ۱۲ ماه گذشته چقدر بوده است؟',
      help: 'اختیاری — اگر عدد دقیق نیست، بازهٔ نزدیک را انتخاب کنید.',
      recommended: true,
    },
    sources: ['مودی ۲۰۰۲ (ارزش طول عمر مشتری)', 'ابزار مشتریان: سیگنال‌های توسعه و درآمد'],
  },
  {
    code: 'VALUE_PIPELINE',
    family: 'VALUE',
    name: 'ارزش فرصت‌های باز',
    nameEn: 'Open pipeline value',
    why: 'احتمال × ارزش پایپ‌لاین باز، شاخص پیشرو برای ارزش آینده و توجاه سرمایه‌گذاری روی رابطه.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP', 'OPPORTUNITY'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'OBSERVED',
    scaleId: 'QUALITY',
    halfLifeDays: 90,
    observedFrom: 'فرصت‌ها: جمع (مبلغ × احتمال مرحله)',
    sources: ['فورتنا و همکاران ۲۰۱۲ (فروش پرسرعت: کیفیت خط فروش)'],
  },
  {
    code: 'VALUE_MARGIN',
    family: 'VALUE',
    name: 'کیفیت حاشیه و شرایط قراردادی',
    nameEn: 'Margin quality & contract terms',
    why: '«هزینه» و «شرایط قرارداد» از معیارهای همیشگی انتخاب تأمین‌کننده؛ رابطهٔ پردردست ولی کم‌حاشیه ارزش راهبردی پایینی دارد.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'QUALITY',
    halfLifeDays: 365,
    intake: { prompt: 'حاشیهٔ سود این همکاری را چطور ارزیابی می‌کنید؟', help: 'نسبت به میانگین بخش خودتان قضاوت کنید.' },
    sources: ['دیکسون ۱۹۶۶ (هزینه، شرایط)', 'وبر ۱۹۹۶ (سودآوری)'],
  },
  {
    code: 'VALUE_GROWTH',
    family: 'VALUE',
    name: 'پتانسیل رشد (ارزش طول عمر مشتری)',
    nameEn: 'Growth / lifetime potential',
    why: 'ارزش چرخهٔ عمر، نه فقط گردش امروز؛ ملاک اولویت‌بندی سرمایه‌گذاری روی روابط.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP', 'OPPORTUNITY'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'QUALITY',
    halfLifeDays: 365,
    intake: {
      prompt: 'پتانسیل رشد این رابطه در دو سال آینده چقدر است؟',
      help: 'مثلاً امکان فروش مکمل، ورود به واحدهای دیگر گروه، یا قرارداد بلندمدت.',
    },
    sources: ['مودی ۲۰۰۲ (ارزش طول عمر مشتری)', 'ابزار مشتریان: فرصت‌های توسعه'],
  },
  {
    code: 'VALUE_PAYMENT',
    family: 'VALUE',
    name: 'خوش‌حسابی و رفتار تسویه',
    nameEn: 'Payment behaviour',
    why: 'سرعت تسویه و بدهی معوق، مستقیم‌ترین نشانهٔ ریسک نقدینگی و اعتماد اقتصادی.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'BOTH',
    scaleId: 'FREQUENCY',
    halfLifeDays: 180,
    observedFrom: 'فاکتورها/تعهدها: پرداخت به‌موقع ÷ کل تعهدات مالی',
    intake: { prompt: 'تعهدات مالی‌شان را معمولاً به‌موقع انجام می‌دهند؟', help: 'مبنای ۱۲ ماه اخیر.' },
    sources: ['آلتمن ۲۰۰۰ (سابقهٔ نکول)', 'انجمن تحلیلگران مالی ۲۰۰۷ (رفتار پرداخت طرف حساب)'],
  },
  /* ------------------------------- CAPABILITY ------------------------------ */
  {
    code: 'CAP_QUALITY_SYSTEM',
    family: 'CAPABILITY',
    name: 'نظام کیفیت و استانداردها',
    nameEn: 'Quality system & certification',
    why: '«کیفیت» و «ظرفیت تولید» مهم‌ترین معیارهای انتخاب تأمین‌کننده در ۶۰ سال پژوهش؛ گواهی معتبر مدرک قابل راستی‌آزمایی است.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'ASSESSED',
    scaleId: 'MATURITY',
    halfLifeDays: 540,
    gate: {
      trigger: 'BELOW',
      threshold: 25,
      cap: 55,
      severity: 'MEDIUM',
      message: 'عدم وجود نظام کیفیت قابل استناد: سقف امتیاز ۵۵ است تا یک ممیزی یا نمونه‌کار مستقل اضافه شود.',
    },
    intake: {
      prompt: 'برای کیفیت، استاندارد یا ممیزی مستقل دارند؟',
      help: 'استاندارد ۹۰۰۱، بازرسی شخص ثالث، گزارش نمونه‌آزمایی، یا هیچ‌کدام.',
      recommended: true,
    },
    sources: ['دیکسون ۱۹۶۶', 'وبر ۱۹۹۶ (نظام کیفیت، توانمندی فنی)'],
  },
  {
    code: 'CAP_DELIVERY',
    family: 'CAPABILITY',
    name: 'نظم تحویل و زمان‌بندی',
    nameEn: 'Delivery reliability',
    why: 'دقت در تحویل به‌موقع دومین معیار پرتکرار ادبیات تأمین و در عمل قابل اندازه‌گیری از تاریخ‌های تعهد.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'BOTH',
    scaleId: 'FREQUENCY',
    halfLifeDays: 270,
    observedFrom: 'تعهدها: تحویل به‌موقع ÷ تعهدات تحویل',
    intake: { prompt: 'در تحویل/اجرای به‌موقع تعهدات چقدر قابل اتکا هستند؟', help: 'از ۱۲ ماه اخیر فکر کنید.' },
    sources: ['دیکسون ۱۹۶۶ (تحویل)', 'ابزار مشتریان: مراحل ازدست‌رفته به‌عنوان ریسک ریزش'],
  },
  {
    code: 'CAP_CAPACITY',
    family: 'CAPABILITY',
    name: 'ظرفیت و انعطاف',
    nameEn: 'Capacity & flexibility',
    why: '«ظرفیت تولید بالا» و «انعطاف» از معیارهای ثابت انتخاب شریک؛ بدون آن، رشد پایپ‌لاین به شکست عملیاتی تبدیل می‌شود.',
    appliesTo: ['ORGANIZATION'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'MATURITY',
    halfLifeDays: 540,
    intake: { prompt: 'اگر حجم کار را ۳۰٪ افزایش دهیم، ظرفیت دارند؟', help: 'نیروی انسانی، تجهیزات، و زمان پاسخ به تغییر تقاضا.' },
    sources: ['وبر ۱۹۹۶ (ظرفیت، انعطاف)', 'گولاتی ۱۹۹۵ (منابع مکمل)'],
  },
  {
    code: 'CAP_TECH',
    family: 'CAPABILITY',
    name: 'توانمندی فنی و پژوهشی',
    nameEn: 'Technical capability & innovation',
    why: 'توانمندی فنی و بهره‌وری/نوآوری، پیش‌بین استمرار برتری شریک در افق میان‌مدت.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'MATURITY',
    halfLifeDays: 540,
    intake: { prompt: 'سطح توانمندی فنی‌شان نسبت به بازار چطور است؟', help: 'تیم، ابزار، دانش خاص، یا وابستگی به پیمانکاران.' },
    sources: ['دیکسون ۱۹۶۶ (توانمندی فنی)', 'گولاتی ۱۹۹۸ (اتحادهای مبتنی بر توانمندی)'],
  },
  {
    code: 'CAP_SERVICE',
    family: 'CAPABILITY',
    name: 'پشتیبانی و خدمات پس از تحویل',
    nameEn: 'Service & support',
    why: '«خدمات پس از فروش» از معیارهای کلاسیک؛ در عمل شدت و سرعت پشتیبانی، تجربهٔ کاربر نهایی را می‌سازد.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 1,
    evidence: 'BOTH',
    scaleId: 'QUALITY',
    halfLifeDays: 270,
    observedFrom: 'اقدام‌ها/تیکت‌های پشتیبانی: میانگین زمان پاسخ',
    intake: { prompt: 'پس از تحویل، پشتیبانی و رفع مشکل چطور است؟', help: 'سرعت پاسخ و کیفیت نتیجه.' },
    sources: ['دیکسون ۱۹۶۶ (گارانتی و خدمات)', 'ابزار مشتریان: تجربهٔ پشتیبانی (تیکت هر کاربر)'],
  },
  /* ------------------------------ RELIABILITY ------------------------------ */
  {
    code: 'REL_TRUST',
    family: 'RELIABILITY',
    name: 'اعتماد و صداقت در گفتار و کردار',
    nameEn: 'Trust (integrity + benevolence)',
    why: 'اعتماد هستهٔ مدل تعهد–اعتماد و قوی‌ترین پیش‌بین ادامهٔ رابطه؛ نداشتنش تقریباً همهٔ ارزش اقتصادی را بی‌اثر می‌کند.',
    appliesTo: ['ORGANIZATION', 'PERSON', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'BOTH',
    scaleId: 'FREQUENCY',
    halfLifeDays: 365,
    observedFrom: 'تعهدها: نرخ انجام به‌موقع + بازخورد جلسات',
    intake: {
      prompt: 'تا امروز گفته‌شان به عملشان نزدیک بوده؟',
      help: 'اختیاری — اگر تجربهٔ مستقیم ندارید، این را خالی بگذارید.',
      recommended: true,
    },
    sources: ['مورگان و هانت ۱۹۹۴ (اعتماد)', 'لی و همکاران ۲۰۲۶ (اعتماد به تعهد)'],
  },
  {
    code: 'REL_COMMITMENT',
    family: 'RELIABILITY',
    name: 'تعهد متقابل به ادامهٔ رابطه',
    nameEn: 'Mutual commitment',
    why: 'تعهد، سازۀ میانجی اعتماد تا ماندگاری و همکاری؛ نبودنش رابطه را شکننده و قابل‌خرید رقبا می‌کند.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'BOTH',
    scaleId: 'FREQUENCY',
    halfLifeDays: 270,
    observedFrom: 'تعهدهای سازهٔ رابطه (تعهد دوسویه در ۱۸۰ روز اخیر)',
    intake: { prompt: 'آیا آن‌ها هم سرمایه‌گذاری متقابل نشان داده‌اند؟', help: 'مثلاً قرارداد بلندمدت، اختصاص نفر، معرفی فرصت، پیش‌پرداخت.' },
    sources: ['مورگان و هانت ۱۹۹۴ (تعهد)', 'جونز و همکاران ۱۹۹۷ (نظریهٔ تعهد-اعتماد)'],
  },
  {
    code: 'REL_OPPORTUNISM',
    family: 'RELIABILITY',
    name: 'رفتار فرصت‌طلبانه (بدقولی، تغییر ناگهانی شرایط)',
    nameEn: 'Opportunism',
    why: 'شایع‌ترین ریشۀ شکست روابط تجاری: سوءاستفاده از وابستگی، تغییر قیمت در میانهٔ راه، پنهان‌کاری.',
    appliesTo: ['ORGANIZATION', 'PERSON', 'RELATIONSHIP'],
    polarity: 'BAD',
    weight: 3,
    evidence: 'ASSESSED',
    scaleId: 'FREQUENCY',
    halfLifeDays: 365,
    gate: {
      trigger: 'ABOVE',
      threshold: 70,
      cap: 45,
      severity: 'HIGH',
      message: 'سابقهٔ رفتار فرصت‌طلبانه: سقف امتیاز ۴۵ و نیازمند ضمانت قراردادی پیش از هر سرمایه‌گذاری.',
    },
    intake: {
      prompt: 'تا حالا در میانۀ همکاری شرایط را یک‌طرفه تغییر داده‌اند؟',
      help: 'افزایش قیمت، عقب کشیدن تعهد، استفاده از وابستگی ما.',
      warnBelow: 0,
      warning: 'پاسخ «بله» پرچم سرخ محسوب می‌شود و سقف امتیاز را پایین می‌آورد.',
    },
    sources: ['اندرسون و نارسیمهان ۱۹۹۶ (ریشه‌های شکست)', 'چوی و لی ۲۰۰۷ (فرصت‌طلبی)'],
  },
  {
    code: 'REL_INFORMATION_HONESTY',
    family: 'RELIABILITY',
    name: 'صداقت در انتقال اطلاعات',
    nameEn: 'Honest information sharing',
    why: 'پنهان‌کردن اطلاعات نامطلوب (تأخیر، نقص، مشکل مالی) از ریشه‌های اصلی فروپاشی رابطه است و قابل راستی‌آزمایی با اسناد.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'FREQUENCY',
    halfLifeDays: 365,
    intake: { prompt: 'اطلاعات نامطلوب را خودشان زودتر اعلام می‌کنند؟', help: 'مثلاً تأخیر، نقص کیفیت، مشکل نقدینگی.' },
    sources: ['اندرسون و نارسیمهان ۱۹۹۶', 'اصل بررسی مقدماتی: «پاسخ‌ها باید قابل راستی‌آزمایی باشند، نه روایت»'],
  },
  {
    code: 'REL_CONFLICT',
    family: 'RELIABILITY',
    name: 'کیفیت مدیریت اختلاف',
    nameEn: 'Conflict handling',
    why: 'نحوۀ برخورد با اختلاف، نه نبودِ اختلاف، تعیین‌کنندۀ بقای رابطه است (مسیرهای صدا/وفاداری در برابر غفلت/خروج).',
    appliesTo: ['RELATIONSHIP', 'PERSON'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'BOTH',
    scaleId: 'QUALITY',
    halfLifeDays: 365,
    observedFrom: 'اقدام‌های دارای برچسب اختلاف + یادداشت جلسات',
    intake: { prompt: 'آخرین اختلاف را چطور حل کردیم؟', help: 'سریع و سازنده / کش‌دار / بی‌نتیجه / با ضرر.' },
    sources: ['روسبالت و همکاران ۱۹۹۸ (خروج–صدا–وفاداری–غفلت)', 'چوی و لی ۲۰۰۷'],
  },
  {
    code: 'REL_ADAPTABILITY',
    family: 'RELIABILITY',
    name: 'انعطاف در شرایط غیرمنتظره',
    nameEn: 'Adaptability',
    why: '«عدم تطابق» سومین ریشۀ شکست رابطه؛ انعطاف در تغییر تقاضا و شرایط، ارزش واقعی شریک در بحران است.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 1,
    evidence: 'ASSESSED',
    scaleId: 'FREQUENCY',
    halfLifeDays: 365,
    intake: { prompt: 'در شرایط اضطراری (تأخیر، تحریم، نوسان بازار) چطور کنار آمدند؟', help: 'اگر تجربه‌ای نیست، خالی بگذارید.' },
    sources: ['اندرسون و ناراسیمهان ۱۹۹۶ (رفتار غیرتطبیقی)', 'وبر ۱۹۹۶ (انعطاف)'],
  },
  /* --------------------------------- ACCESS -------------------------------- */
  {
    code: 'ACC_MULTITHREADING',
    family: 'ACCESS',
    name: 'پوشش چندلایهٔ سازمان طرف حساب',
    nameEn: 'Multi-threading breadth',
    why: 'رابطهٔ تک‌رشته‌ای بزرگ‌ترین ریسک معاملات است؛ سازمان‌های چندلایه به‌طور معناداری بیشتر می‌برند و کمتر می‌بازند.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP', 'OPPORTUNITY'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'BOTH',
    scaleId: 'COVERAGE',
    halfLifeDays: 90,
    observedFrom: 'تعداد افراد منحصربه‌فرد دارای تعامل در ۹۰ روز اخیر + سطوح سازمانی پوشش‌داده‌شده',
    sources: [
      'فورتنا و همکاران ۲۰۱۲ (فروش تک‌مسیره: نرخ برد ۳٫۴ برابر با فروش چندلایه)',
      'گارتنر ۲۰۲۱ (۱۰ ذینفع، ۶ نقطهٔ تماس)',
      'گونگ ۲۰۲۵ (۲٫۸ برابر تماس معاملاتی بیشتر)',
    ],
  },
  {
    code: 'ACC_DECISION_ACCESS',
    family: 'ACCESS',
    name: 'دسترسی به سطح تصمیم‌گیری',
    nameEn: 'Access to the decision level',
    why: 'دسترسی واقعی به کسی که امضا می‌کند (نه فقط دروازه‌بان) — بدون آن، فرایند فروش روی شنیده‌ها پیش می‌رود.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP', 'OPPORTUNITY'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'BOTH',
    scaleId: 'FREQUENCY',
    halfLifeDays: 120,
    observedFrom: 'جلسات: ۱۸۰ روز اخیر با نقش مدیرعامل/عضو هیئت‌مدیره',
    intake: {
      prompt: 'آیا می‌توانیم مستقیماً با تصمیم‌گیر نهایی صحبت کنیم؟',
      help: 'بدون واسطه و بدون نیاز به مجوز.',
      recommended: true,
    },
    sources: ['چارچوب فروش راهبردی (دسترسی به تصمیم‌گیر اقتصادی)', 'ابزار مشتریان: نبود درگیری مدیریتی = ریسک تمدید'],
  },
  {
    code: 'ACC_CHAMPION_POWER',
    family: 'ACCESS',
    name: 'قدرت و انگیزهٔ چمپیون',
    nameEn: 'Champion power × access × motivation',
    why: 'چمپیون واقعی سه شرط دارد: قدرت، دسترسی به تصمیم‌گیر، و انگیزهٔ شخصی؛ فقدان هرکدام چمپیون را نمادین می‌کند.',
    appliesTo: ['PERSON', 'RELATIONSHIP', 'OPPORTUNITY'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'ASSESSED',
    scaleId: 'QUALITY',
    anchors: [
      { level: 0, label: 'نه قدرت، نه دسترسی، نه انگیزه', score: 0 },
      { level: 1, label: 'موافق اما بی‌اثر', score: 25 },
      { level: 2, label: 'دو شرط از سه شرط', score: 60 },
      { level: 3, label: 'هر سه شرط', score: 85 },
      { level: 4, label: 'تصمیم‌گیر مستقیم و حامی فعال', score: 100 },
    ],
    halfLifeDays: 150,
    intake: {
      prompt: 'این فرد قدرت، دسترسی و انگیزهٔ شخصی برای پیش بردن کار ما را دارد؟',
      help: 'هر سه لازم است؛ اگر فقط «خوب است» ولی اثری روی تصمیم ندارد، چمپیون نیست.',
      recommended: true,
    },
    sources: ['چارچوب فروش راهبردی (حامی)', 'فورتنا و همکاران ۲۰۱۲ (حامی با اثر قابل اندازه‌گیری)'],
  },
  {
    code: 'ACC_DECISION_ROLE',
    family: 'ACCESS',
    name: 'نقش در ساختار تصمیم خرید',
    nameEn: 'Role in the buying committee',
    why: 'طبقه‌بندی نقش‌ها (تصمیم‌گیر اقتصادی، تصمیم‌گیر فنی، کاربر نهایی، حامی) و وزن رأی هر نفر — «قدرت تصمیم» یکی از معیارهای همیشگی ارزیابی ذی‌نفع.',
    appliesTo: ['PERSON'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'ASSESSED',
    scaleId: 'QUALITY',
    anchors: [
      { level: 0, label: 'بی‌نقش / فقط کاربر', score: 25 },
      { level: 1, label: 'کاربر نهایی — اثر توصیه', score: 50 },
      { level: 2, label: 'تأییدکنندهٔ فنی/مالی', score: 70 },
      { level: 3, label: 'معرف و جهت‌دهنده (حامی)', score: 85 },
      { level: 4, label: 'تصمیم‌گیر نهایی با حق امضا', score: 100 },
    ],
    halfLifeDays: 365,
    intake: { prompt: 'نقش واقعی این فرد در تصمیم خرید/انتخاب چیست؟', help: 'اگر مطمئن نیستید، «کاربر نهایی» را انتخاب نکنید — خالی بگذارید.' },
    sources: ['میلرهایم هین — فروش راهبردی (تصمیم‌گیر اقتصادی، تصمیم‌گیر فنی، کاربر نهایی، حامی)', 'میتچل ۱۹۹۷ (بُعد قدرت)'],
  },
  {
    code: 'ACC_RESPONSIVENESS',
    family: 'ACCESS',
    name: 'سرعت و کیفیت پاسخ‌گویی',
    nameEn: 'Responsiveness',
    why: 'پاسخ‌دهی، شاخص عملی احترام متقابل و سلامت رابطه است و از داده‌های رفتار (نه قضاوت) قابل محاسبه.',
    appliesTo: ['PERSON', 'ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'OBSERVED',
    scaleId: 'QUALITY',
    halfLifeDays: 60,
    observedFrom: 'تعاملات: میانگین زمان پاسخ به پیام/اقدام + نرخ انجام اقدامات مشترک',
    sources: ['ابزار مشتریان: پاسخگویی و چرخهٔ ارتباط'],
  },
  {
    code: 'ACC_CONTACT_STABILITY',
    family: 'ACCESS',
    name: 'پایداری مخاطب (ریسک جابه‌جایی)',
    nameEn: 'Contact stability / departure risk',
    why: 'رفت رفت چمپیون یا مدیر رابطه، شایع‌ترین رویداد از دست رفتن مشتری؛ باید از ابتدا ثبت و پایش شود.',
    appliesTo: ['PERSON', 'ORGANIZATION'],
    polarity: 'BAD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'EXPOSURE',
    halfLifeDays: 120,
    intake: {
      prompt: 'احتمال جابه‌جایی/استعفای این فرد در ۱۲ ماه آینده چقدر است؟',
      help: 'نشانه‌ها: تغییر ساختار، نقش جدید، ۱۸ ماه بی‌تغییری در نقش، یا شنیده‌های رسمی.',
    },
    sources: ['گینسایت/چرن‌زیرو: خروج حامی از محرک‌های اصلی ریسک تمدید', 'ابزار مشتریان: تغییر نقاط تماس'],
  },
  /* -------------------------------- FINANCIAL ------------------------------ */
  {
    code: 'FIN_Z_SCORE',
    family: 'FINANCIAL',
    name: 'ناحیۀ سلامت مالی (معیار آلتمن)',
    nameEn: 'Financial health zone (Altman Z″)',
    why: 'طبقه‌بندی کلاسیک ورشکستگی: امتیاز آلتمن بالا = امن، بین ۱٫۱ تا ۲٫۶ = خاکستری، زیر ۱٫۱ = ناحیهٔ خطر.',
    appliesTo: ['ORGANIZATION'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'ASSESSED',
    scaleId: 'FINANCIAL_ZONE',
    halfLifeDays: 365,
    gate: {
      trigger: 'BELOW',
      threshold: 25,
      cap: 40,
      severity: 'HIGH',
      message: 'ناحیۀ خطر مالی (امتیاز آلتمن زیر ۱٫۱ یا صورت‌های مالی نامعتبر): سقف امتیاز ۴۰، نیازمند وثیقه/پیش‌پرداخت.',
    },
    intake: { prompt: 'وضعیت مالی‌شان را با کدام نشانه می‌شود توصیف کرد؟', help: 'صورت‌های مالی حسابرسی‌شده، نسبت جاری، یا صرفاً شنیده‌ها.' },
    sources: ['آلتمن ۱۹۶۸، ۲۰۰۰ (امتیاز اعتباری)', 'بازل (مدل داخلی رتبه‌بندی: احتمال نکول)'],
  },
  {
    code: 'FIN_LIQUIDITY',
    family: 'FINANCIAL',
    name: 'نقدینگی جاری',
    nameEn: 'Liquidity',
    why: 'نسبت جاری: توان پرداخت بدهی کوتاه‌مدت — معیار اصلی ارزیابی طرف حساب در استاندارد تحلیل مالی.',
    appliesTo: ['ORGANIZATION'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'QUALITY',
    anchors: [
      { level: 0, label: 'کمتر از ۰٫۸ یا نامشخص', score: 15 },
      { level: 1, label: '۰٫۸ تا ۱٫۰', score: 40 },
      { level: 2, label: '۱٫۰ تا ۱٫۵', score: 65 },
      { level: 3, label: '۱٫۵ تا ۲٫۵', score: 90 },
      { level: 4, label: 'بیش از ۲٫۵', score: 100 },
    ],
    halfLifeDays: 365,
    intake: { prompt: 'نسبت جاری (دارایی جاری ÷ بدهی جاری) حدوداً چقدر است؟', help: 'اگر صورت مالی ندارید، این سؤال را رد کنید.' },
    sources: ['تحلیل سرمایه‌گذاری و مدیریت سبد انجمن تحلیلگران مالی ۲۰۰۷ (فصل ۵)'],
  },
  {
    code: 'FIN_LEVERAGE',
    family: 'FINANCIAL',
    name: 'اهرم مالی و پوشش بدهی',
    nameEn: 'Leverage & coverage',
    why: 'بدهی بالا/سود و پوشش پایین بهره، ریسک نکول را در دورهٔ رکود تشدید می‌کند.',
    appliesTo: ['ORGANIZATION'],
    polarity: 'BAD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'QUALITY',
    anchors: [
      { level: 0, label: 'بدون بدهی / پوشش > ۴', score: 0 },
      { level: 1, label: 'بدهی ÷ سود < ۲، پوشش > ۲٫۵', score: 25 },
      { level: 2, label: 'بدهی ÷ سود ۲ تا ۴', score: 50 },
      { level: 3, label: 'بدهی ÷ سود ۴ تا ۶ یا پوشش ۱ تا ۲', score: 75 },
      { level: 4, label: 'بدهی ÷ سود > ۶ یا پوشش < ۱', score: 100 },
    ],
    halfLifeDays: 365,
    intake: { prompt: 'بار بدهی‌شان نسبت به سود چقدر است؟', help: 'تخمین «بدهی ÷ سود عملیاتی» هم کافی است.' },
    sources: ['انجمن تحلیلگران مالی ۲۰۰۷ (اهرم، پوشش، نقدینگی)', 'آلتمن ۲۰۰۰'],
  },
  {
    code: 'FIN_COUNTRY',
    family: 'FINANCIAL',
    name: 'ریسک کشور و تحریم/ارز',
    nameEn: 'Country & currency risk',
    why: 'ریسک کشور (امتیاز بازار اعتبار/رتبه) و محدودیت ارزی، ارزش واقعی تعهدات طرف حساب خارجی را تعیین می‌کند.',
    appliesTo: ['ORGANIZATION'],
    polarity: 'BAD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'EXPOSURE',
    halfLifeDays: 180,
    intake: { prompt: 'ریسک کشور/تحریم/انتقال ارز برای آن‌ها چقدر است؟', help: 'اگر داخل ایران کار می‌کنید، معمولاً «پاک» است مگرنه محدودیت ارزی داشته باشند.' },
    sources: ['داموداران: ریسک کشوری (بر پایهٔ فاصله‌های نکول اعتباری)', 'رتبه‌بندی ریسک کشوری آلتمن (۲۰۰۵)'],
  },
  /* ---------------------------------- RISK --------------------------------- */
  {
    code: 'RISK_SANCTIONS_PEP',
    family: 'RISK',
    name: 'غربالگری تحریم‌ها، مناصب و رسانهٔ منفی',
    nameEn: 'Sanctions / PEP / adverse-media screening',
    why: 'غربالگری، دروازۀ ورود هر طرف حساب است؛ تطابق با فهرست تحریم یا مناصب یعنی توقیف، جریمه و ریسک کیفری.',
    appliesTo: ['ORGANIZATION', 'PERSON'],
    polarity: 'BAD',
    weight: 3,
    evidence: 'ASSESSED',
    scaleId: 'EXPOSURE',
    halfLifeDays: 90,
    gate: {
      trigger: 'ABOVE',
      threshold: 50,
      cap: 20,
      severity: 'CRITICAL',
      message: 'مواجهۀ تحریم‌ها/مناصب/رسانهٔ منفی تأییدنشده: سقف امتیاز ۲۰ و توقف هر اقدام معاملاتی تا جمع‌بندی واحد انطباق.',
    },
    intake: {
      prompt: 'آیا در فهرست‌های تحریم، مناصب یا رسانهٔ منفی بررسی شده‌اند؟',
      help: 'پاسخ باید مستند باشد (تاریخ و منبع غربالگری). نبود غربالگری، خودش یک پرچم است.',
      recommended: true,
    },
    sources: ['فهرست‌های تحریم بین‌المللی (عملکرد ارزیابی شخص ثالث)', 'رویهٔ پذیرش مشتری مطابق مقررات مبارزه با پول‌شویی'],
  },
  {
    code: 'RISK_UBO',
    family: 'RISK',
    name: 'شفافیت مالکیت نهایی',
    nameEn: 'Beneficial-ownership transparency',
    why: 'ساختار مالکیت مبهم و ذی‌نفع واقعی پنهان، پرچم اصلی پولشویی و دور زدن تحریم است.',
    appliesTo: ['ORGANIZATION'],
    polarity: 'BAD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'MATURITY',
    anchors: [
      { level: 0, label: 'مالکیت نامشخص / لایه‌های بیگانه', score: 100 },
      { level: 1, label: 'اطلاعات ناقص، بدون راستی‌آزمایی', score: 75 },
      { level: 2, label: 'مشخص اما بدون سند رسمی', score: 45 },
      { level: 3, label: 'مطابق اسناد ثبتی تأیید شده', score: 15 },
      { level: 4, label: 'مالک نهایی تا شخص حقیقی، شفاف و مستند', score: 0 },
    ],
    halfLifeDays: 540,
    intake: { prompt: 'مالک نهایی و ساختار سهام‌داری‌شان شفاف و مستند است؟', help: 'افشای ذی‌نفع واقعی؛ «نمی‌دانم» هم اطلاعات می‌دهد.' },
    sources: ['قاعدهٔ احراز هویت مشتری و شفافیت مالکیت نهایی', 'عملکرد پرسشنامهٔ بررسی مقدماتی شخص ثالث (راستی‌آزمایی مالک نهایی)'],
  },
  {
    code: 'RISK_LEGAL',
    family: 'RISK',
    name: 'سابقۀ دعوای حقوقی و جریمۀ نظارتی',
    nameEn: 'Litigation & regulatory findings',
    why: 'دعوای مکرر یا جریمۀ رگولاتوری، الگوی رفتار و ریسک توقف عملیات را نشان می‌دهد.',
    appliesTo: ['ORGANIZATION', 'PERSON'],
    polarity: 'BAD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'EXPOSURE',
    halfLifeDays: 365,
    intake: { prompt: 'پروندۀ باز حقوقی، ورشکستگی یا جریمۀ سازمانی دارند؟', help: 'با ذکر منبع (دادگاه، نهاد ناظر، رسانه).' },
    sources: ['بررسی مقدماتی تأمین‌کننده: حوزهٔ انطباق حقوقی و نظارتی'],
  },
  {
    code: 'RISK_DATA_SECURITY',
    family: 'RISK',
    name: 'امنیت داده و حریم خصوصی',
    nameEn: 'Data security & privacy posture',
    why: 'هرچه طرف حساب به داده/سیستم ما بیشتر دسترسی دارد، ریسک نشتی بزرگ‌تر است؛ استاندارد ۲۷۰۰۱ و گزارش حسابرسی امنیتی مدرک اصلی است.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'BAD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'MATURITY',
    anchors: [
      { level: 0, label: 'بدون سیاست امنیتی', score: 100 },
      { level: 1, label: 'ادعا بدون مدرک', score: 70 },
      { level: 2, label: 'سیاست مکتوب، بدون ممیزی', score: 45 },
      { level: 3, label: 'گزارش حسابرسی امنیتی/استاندارد ۲۷۰۰۱ معتبر', score: 20 },
      { level: 4, label: 'گواهی + تست نفوذ اخیر + قرارداد پردازش داده', score: 0 },
    ],
    halfLifeDays: 365,
    intake: { prompt: 'برای داده و امنیت ما چه مدرکی دارند؟', help: 'استاندارد ۲۷۰۰۱، گزارش حسابرسی امنیتی، قرارداد محرمانگی، گزارش تست نفوذ.' },
    sources: ['وبر ۱۹۹۶ (حریم خصوصی/داده)', 'استاندارد ۲۷۰۰۱', 'عملکرد سطح‌بندی بر اساس داده‌ای که مخاطب لمس می‌کند'],
  },
  {
    code: 'RISK_ESG',
    family: 'RISK',
    name: 'حاکمیت، کار و محیط‌زیست',
    nameEn: 'ESG & governance',
    why: 'ارزیابی حاکمیت، کار و محیط‌زیست ریسک شهرت و تعطیلی را پیش می‌گیرد؛ ایدئولوژیک نیست: کار اجباری، ایمنی، و فساد مستقیم ارزِ رابطه را تهدید می‌کند.',
    appliesTo: ['ORGANIZATION'],
    polarity: 'BAD',
    weight: 1,
    evidence: 'ASSESSED',
    scaleId: 'MATURITY',
    halfLifeDays: 540,
    intake: { prompt: 'گزارش یا گواهی مسئولیت اجتماعی و محیط‌زیست دارند؟', help: 'استانداردهای ۱۴۰۰۱، ۴۵۰۰۱ و ۸۰۰۰، گزارش پایداری، یا خط‌مشی ضدفساد.' },
    sources: ['استانداردهای ۱۴۰۰۱/۴۵۰۰۱/۸۰۰۰', 'راهنمای بررسی مقدماتی سازمان ملل و سازمان همکاری اقتصادی'],
  },
  {
    code: 'RISK_CONCENTRATION',
    family: 'RISK',
    name: 'تمرکز وابستگی (یک‌نقطه‌ای بودن)',
    nameEn: 'Dependency concentration',
    why: 'اگر یک تأمین‌کننده/مشتری بخش بزرگی از درآمد یا عملیات ما را بگیرد، تمرکز خودش ریسک ساختاری است.',
    appliesTo: ['ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'BAD',
    weight: 2,
    evidence: 'BOTH',
    scaleId: 'DEPENDENCY',
    halfLifeDays: 270,
    observedFrom: 'سهم این رابطه از کل گردش/تعهدات سازمان (حداکثر وابستگی دوطرفه)',
    intake: { prompt: 'این همکاری چند درصد از درآمد/عملیات یک طرف را می‌گیرد؟', help: 'هرچه نزدیک‌تر به ۱۰۰٪، ریسک تمرکز بیشتر.' },
    sources: ['ریسک تمرکز بازل', 'پورتر ۱۹۸۰ (قدرت چانه‌زنی)'],
  },
  {
    code: 'RISK_CONFLICT_OF_INTEREST',
    family: 'RISK',
    name: 'تعارض منافع و وابستگی‌های پنهان',
    nameEn: 'Conflict of interest',
    why: 'خویشاوندی با تصمیم‌ساز، سهم در رقیب، یا نقش دولتی — اگر فاش نشود، هم ریسک انطباق و هم ریسک مذاکره است.',
    appliesTo: ['PERSON', 'ORGANIZATION'],
    polarity: 'BAD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'EXPOSURE',
    halfLifeDays: 365,
    intake: { prompt: 'تعارض منافع (نزدیکی به رقیب، سهم‌داری، نقش دولتی) وجود دارد؟', help: 'افشای این مورد، نه وجودش، نشانهٔ سلامت رابطه است.' },
    sources: ['غربالگری پول‌شویی، احراز هویت مشتری، مناصب و طرف‌های مرتبط'],
  },
  /* --------------------------------- NETWORK ------------------------------- */
  {
    code: 'NET_PATH_STRENGTH',
    family: 'NETWORK',
    name: 'قدرت مسیر تا هدف',
    nameEn: 'Path strength to target',
    why: 'اعتبار مسیر معرفی‌شده (محصول قدرت پیوندها) تعیین می‌کند یک تماس غیرمستقیم چقدر وزن دارد.',
    appliesTo: ['ORGANIZATION', 'PERSON', 'RELATIONSHIP', 'OPPORTUNITY'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'OBSERVED',
    scaleId: 'QUALITY',
    halfLifeDays: 120,
    observedFrom: 'مسیر شبکه: قدرت مسیر محاسبه‌شده (۰–۱۰۰)',
    sources: ['برت ۱۹۹۲ (دسترسی دوم/غیرمستقیم به سوراخ‌های ساختاری)'],
  },
  {
    code: 'NET_BRIDGE',
    family: 'NETWORK',
    name: 'نقش پل و واسطه‌گری',
    nameEn: 'Brokerage / betweenness',
    why: 'کسی که میان خوشه‌های جدا پل می‌زند، اطلاعات و منابع جدید می‌آورد؛ جایگاه واسطه با عملکرد بهتر همبسته است.',
    appliesTo: ['PERSON', 'ORGANIZATION'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'OBSERVED',
    scaleId: 'QUALITY',
    halfLifeDays: 180,
    observedFrom: 'سنجه‌های شبکه: واسطه‌گری و پل‌های بین‌سازمانی',
    sources: ['برت ۲۰۰۴ (سوراخ‌های ساختاری و ایده‌های خوب)', 'فریمن ۱۹۷۷ (بینایی مرکزی)', 'والنته و فوجیموتو ۲۰۱۰ / اورت و بورگاتی ۲۰۱۶ (واسطه‌گری)'],
  },
  {
    code: 'NET_NON_REDUNDANCY',
    family: 'NETWORK',
    name: 'تنوع و غیرحاشیه‌ای بودن پیوندها',
    nameEn: 'Non-redundant ties (low constraint)',
    why: 'پیوندهای همپوشان و تکراری (محدودیت بالا) دسترسی جدید نمی‌آورد؛ تنوع خوشه‌ها ارزش شبکه را می‌سازد.',
    appliesTo: ['ORGANIZATION', 'PERSON'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'OBSERVED',
    scaleId: 'QUALITY',
    halfLifeDays: 180,
    observedFrom: 'سنجه‌های شبکه: تعداد نوع رابطه + تعداد خوشه‌های متمایز (محدودیت)',
    sources: ['برت ۱۹۹۲ (محدودیت شبکه)', 'گرانووتر ۱۹۷۳'],
  },
  {
    code: 'NET_TIE_STRENGTH',
    family: 'NETWORK',
    name: 'قدرت پیوند (تازگی و بسامد تماس)',
    nameEn: 'Tie strength (frequency + recency)',
    why: 'قدرت پیوند در ادبیات شبکه با بسامد تماس، مدت رابطه و شدت متقابل سنجیده می‌شود؛ پیوند خفته دیگر منبع اطلاعات نیست.',
    appliesTo: ['RELATIONSHIP', 'PERSON'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'OBSERVED',
    scaleId: 'FREQUENCY',
    halfLifeDays: 90,
    observedFrom: 'تعامل‌های ۱۸۰ روزه + فاصله تا آخرین تعامل (افت تدریجی)',
    sources: ['گرانووتر ۱۹۷۳ (زمان صرف‌شده + شدت + متقابلیت)', 'نیومن ۲۰۰۳ (قوت پیوند)'],
  },
  {
    code: 'NET_SINGLE_POINT',
    family: 'NETWORK',
    name: 'آسیب‌پذیری نقطۀ تک‌روی (نقطۀ شکست)',
    nameEn: 'Single point of failure in network',
    why: 'اگر حذف یک فرد/سازمان شبکه را به اجزای جدا تقسیم کند، کل دسترسی به آن حوزه در معرض یک تصمیم است.',
    appliesTo: ['PERSON', 'ORGANIZATION', 'RELATIONSHIP'],
    polarity: 'BAD',
    weight: 2,
    evidence: 'OBSERVED',
    scaleId: 'QUALITY',
    halfLifeDays: 120,
    observedFrom: 'شبکه: حذف گره → تعداد اجزای جدید',
    sources: ['برت ۱۹۹۲ (دیپلماسی واسطه‌ای / وابستگی به شخص ثالث)', 'تحلیل گلوگاه و رأس برشی'],
  },
  /* ---------------------- OPPORTUNITY-specific (sales) --------------------- */
  {
    code: 'OPP_COMMITTEE_COVERAGE',
    family: 'ACCESS',
    name: 'پوشش کمیتهٔ خرید در این فرصت',
    nameEn: 'Buying-committee coverage',
    why: 'پوشش نداشتن افراد کلیدی (تأمین، امنیت، مالی، حقوقی) شایع‌ترین علت شکست ناگهانی معامله است.',
    appliesTo: ['OPPORTUNITY'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'BOTH',
    scaleId: 'COVERAGE',
    halfLifeDays: 60,
    observedFrom: 'شرکت‌کنندگان جلسه × نقش‌های لازم (تأمین، امنیت، حقوقی، مالی)',
    intake: { prompt: 'چه نقش‌های کلیدی در این معامله هنوز پوشش داده نشده‌اند؟', help: 'تأمین، امنیت، مالی، حقوقی، کاربر نهایی.' },
    sources: ['گارتنر ۲۰۲۱ (۶ تا ۱۰ ذینفع)', 'چارچوب فروش راهبردی (فرایند مکاتبات)'],
  },
  {
    code: 'OPP_PAPER_PROCESS',
    family: 'RISK',
    name: 'مسیر قرارداد و خرید شفاف است؟',
    nameEn: 'Paper process / procurement path',
    why: 'نبود فرایند خرید مشخص (درخواست پیشنهاد، ممیزی امنیتی، قرارداد) یعنی تاریخ بسته‌شدن معامله حدس است.',
    appliesTo: ['OPPORTUNITY'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'ASSESSED',
    scaleId: 'MATURITY',
    halfLifeDays: 90,
    intake: { prompt: 'مسیر رسمی تصمیم و قرارداد مشخص شده؟', help: 'کی تایید می‌کند، چه اسنادی لازم است، مهلت‌ها چیست.' },
    sources: ['چارچوب فروش راهبردی (فرایند کاغذی)', 'دیکسون ۱۹۶۶ (شرایط قرارداد)'],
  },
  {
    code: 'OPP_BUSINESS_CASE',
    family: 'VALUE',
    name: 'توجیه اقتصادی برای طرف حساب',
    nameEn: 'Business case / identified pain',
    why: 'مشکل روشن + ارزش قابل‌محاسبه، پایهٔ بودجه است؛ بدون آن «علاقه» به «بودجه» تبدیل نمی‌شود.',
    appliesTo: ['OPPORTUNITY', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 3,
    evidence: 'ASSESSED',
    scaleId: 'QUALITY',
    halfLifeDays: 90,
    intake: { prompt: 'آیا عدد مشخصی برای منفعتمان ثبت شده؟', help: 'مثلاً صرفه‌جویی سالانه، درآمد افزوده، کاهش ریسک قابل‌سنجش.' },
    sources: ['چارچوب فروش راهبردی (سنجه‌ها)', 'فورتنا و همکاران ۲۰۱۲ (درد شناسایی‌شده)'],
  },
  {
    code: 'OPP_ACTIVITY_MOMENTUM',
    family: 'ACCESS',
    name: 'شتاب فعالیت‌های مشترک',
    nameEn: 'Joint activity momentum',
    why: 'نرخ تبدیل فعالیت به پیشرفت فاز (فعالیت←فعالیت و فعالیت←خط فروش) پیش‌بین کوتاه‌مدت برد است.',
    appliesTo: ['OPPORTUNITY', 'RELATIONSHIP'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'OBSERVED',
    scaleId: 'FREQUENCY',
    halfLifeDays: 45,
    observedFrom: 'تعامل‌ها/جلسات ۳۰ روز اخیر + تغییر فاز فرصت',
    sources: ['گینسایت: تبدیل فعالیت←فعالیت و فعالیت←خط فروش'],
  },
  {
    code: 'OPP_ADVOCACY',
    family: 'RELIABILITY',
    name: 'مدافع فعال در داخل سازمان',
    nameEn: 'Internal advocacy / sentiment',
    why: 'نه رضایت مودبانه، بلکه آمادۀ دفاع در جلسهٔ داخلی بودن؛ شاخص احساسی و نه «شاخص رضایت».',
    appliesTo: ['OPPORTUNITY', 'PERSON'],
    polarity: 'GOOD',
    weight: 2,
    evidence: 'BOTH',
    scaleId: 'FREQUENCY',
    halfLifeDays: 90,
    observedFrom: 'لحن تعاملات + اقدامات معرفی/توصیه',
    intake: { prompt: 'آیا این فرد بدون حضور ما از کار ما دفاع می‌کند؟', help: 'اگر پاسخ «نیست/نیست» باشد، هنوز چمپیون نداریم.' },
    sources: ['گینسایت: احساسات مهم‌تر از شاخص رضایت', 'چارچوب فروش راهبردی (حامی)'],
  },
];

export const CRITERIA_BY_CODE = new Map(CRITERIA.map((c) => [c.code, c]));

export function criteriaFor(subject: CriterionSubject): Criterion[] {
  return CRITERIA.filter((c) => c.appliesTo.includes(subject));
}

export function scaleFor(criterion: Criterion): ScaleAnchor[] {
  return criterion.anchors ?? SCALES[criterion.scaleId].anchors;
}

/** پرسش‌نامۀ ورود اطلاعات: فقط سؤالات اختیاری که در لحظۀ ساخت قابل پاسخ‌دادن‌اند. */
export interface IntakeQuestion {
  code: string;
  family: CriterionFamily;
  criterionCode: string;
  subject: CriterionSubject;
  prompt: string;
  help: string;
  recommended: boolean;
  polarity: 'GOOD' | 'BAD';
  warning?: string;
  warnBelow?: number;
  anchors: ScaleAnchor[];
}

export function questionnaireFor(subject: CriterionSubject): IntakeQuestion[] {
  return criteriaFor(subject)
    .filter((c) => c.intake && (c.evidence === 'ASSESSED' || c.evidence === 'BOTH'))
    .map((c) => ({
      code: `Q_${c.code}`,
      family: c.family,
      criterionCode: c.code,
      subject,
      prompt: c.intake!.prompt,
      help: c.intake!.help,
      recommended: c.intake!.recommended === true,
      polarity: c.polarity,
      warning: c.intake!.warning,
      warnBelow: c.intake!.warnBelow,
      anchors: scaleFor(c),
    }));
}
