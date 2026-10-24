import {
  CRITERIA,
  CRITERIA_BY_CODE,
  FAMILY_META,
  FAMILY_WEIGHTS,
  criteriaFor,
  scaleFor,
  type Criterion,
  type CriterionFamily,
  type CriterionSubject,
  type EvidenceMethod,
  type ScaleAnchor,
} from './criteria.catalog';

/**
 * موتور ارزیابی مبتنی بر معیارها.
 *
 * سه اصل که از مدل‌سازی پیش‌بین گرفته شده (Wilson et al. 2017) و در این فایل پیاده شده است:
 *  ۱) برای معیار بی‌داده عدد ساختگی (مثلاً ۵۰) گذاشته نمی‌شود؛ معیار در «ناشناخته» گزارش می‌شود.
 *  ۲) هر امتیاز با «پوشش اطلاعات»، «اطمینان» و «باند عدم‌قطعیت» گزارش می‌شود.
 *  ۳) تا وقتی شواهد به حد نصاب نرسیده، سوژه در رتبه‌بندی رقابتی قرار نمی‌گیرد (rankable=false)
 *     و در عوض در صف «نیازمند ارزیابی» می‌نشیند.
 */

export interface AnswerInput {
  criterionCode: string;
  /** سطح انتخاب‌شده از مقیاس (۰ تا ۴). */
  level?: number | null;
  /** یا مقدار صریح ۰ تا ۱۰۰. */
  value?: number | null;
  note?: string | null;
  evidence?: string | null;
  method?: EvidenceMethod;
  answeredAt?: Date | string | null;
  answeredByName?: string | null;
}

export interface ObservedSignal {
  /** مقدار ۰ تا ۱۰۰ در جهت خودِ معیار. */
  value: number;
  /** حجم شواهد (تعداد رکورد/روز) که اطمینان را می‌سازد. */
  evidence: number;
  label: string;
}

export interface CriterionLine {
  code: string;
  family: CriterionFamily;
  familyName: string;
  name: string;
  nameEn: string;
  why: string;
  polarity: 'GOOD' | 'BAD';
  weight: number;
  weightPct: number;
  value: number | null;
  displayValue: number | null;
  confidence: number;
  status: 'OBSERVED' | 'ASSESSED' | 'BLENDED' | 'UNKNOWN';
  needsReview: boolean;
  answerAgeDays: number | null;
  reliabilityDecay: number;
  note?: string | null;
  evidence?: string | null;
  answeredByName?: string | null;
  observed?: { value: number; evidence: number; label: string } | null;
  assessed?: { value: number; level: number; anchor: ScaleAnchor | null; method: EvidenceMethod; confidence: number } | null;
  gate?: { severity: string; message: string; cap: number; active: boolean } | null;
  warning?: string | null;
  sources: string[];
  actionHint: string;
}

export interface FamilyLine {
  family: CriterionFamily;
  name: string;
  nameEn: string;
  rationale: string;
  modelWeight: number;
  weightPct: number;
  score: number | null;
  confidence: number;
  coveragePct: number;
  known: number;
  total: number;
  lines: CriterionLine[];
}

export interface CriteriaAssessment {
  subjectType: CriterionSubject;
  subjectId: string | null;
  /** امتیاز نهایی ۰ تا ۱۰۰ (پس از سقف دروازه‌ها). */
  score: number;
  /** امتیاز پیش از اعمال سقف دروازه. */
  rawScore: number;
  /** نصف عرض باند عدم‌قطعیت. */
  uncertainty: number;
  rangeLow: number;
  rangeHigh: number;
  /** درصد وزن مدل که با داده پوشش داده شده. */
  coverage: number;
  /** اطمینان ترکیبی (کیفیت پاسخ × تازگی × چندمنبعی × پوشش). */
  confidence: number;
  /** امتیاز تنبیه‌شده با اطمینان — مبنای رتبه‌بندی. */
  rankingScore: number;
  rankable: boolean;
  /** سقف اعمال‌شده توسط پرچم‌های دروازه‌ای (null یعنی بدون سقف). */
  gateCap: number | null;
  verdict: 'INSUFFICIENT_DATA' | 'PRELIMINARY' | 'EMERGING' | 'SOLID' | 'STRONG' | 'AT_RISK' | 'CRITICAL';
  verdictLabel: string;
  verdictHint: string;
  families: FamilyLine[];
  criteria: CriterionLine[];
  knownCriteria: number;
  totalCriteria: number;
  unknown: { code: string; name: string; family: CriterionFamily; weightPct: number; prompt?: string; help?: string }[];
  flags: { code: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'; message: string; criterionCode: string }[];
  reviewDue: { code: string; name: string; reason: string }[];
  answeredCount: number;
  methodMix: Partial<Record<EvidenceMethod, number>>;
  computedAt: string;
  hints: string[];
}

const clamp01_100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const METHOD_QUALITY: Record<EvidenceMethod, number> = {
  DOCUMENT: 100,
  VERIFIED: 90,
  OWNER_ASSESSED: 70,
  SELF_REPORTED: 55,
  INFERRED: 40,
};

export function methodLabel(method: EvidenceMethod): string {
  return (
    {
      DOCUMENT: 'مدرک/سند',
      VERIFIED: 'راستی‌آزمایی مستقل',
      OWNER_ASSESSED: 'ارزیابی مدیر رابطه',
      SELF_REPORTED: 'خوداظهادی مخاطب',
      INFERRED: 'استنتاج از رفتار',
    } as Record<EvidenceMethod, string>
  )[method];
}

function ageDays(answeredAt?: Date | string | null): number | null {
  if (!answeredAt) return null;
  const t = typeof answeredAt === 'string' ? Date.parse(answeredAt) : answeredAt.getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

/** افت اعتبار با گذشت زمان: پس از یک نیمه‌عمر، اطمینان ۷۰٪ و پس از دوبرابر، ۴۵٪ می‌شود. */
export function reliabilityDecay(age: number | null, halfLifeDays: number): number {
  if (age == null) return 0.85;
  const ratio = age / Math.max(30, halfLifeDays);
  return Math.max(0.35, Math.min(1, 1 - 0.3 * Math.min(1, ratio) - 0.25 * Math.max(0, Math.min(1, ratio / 2))));
}

function confidenceForAssessed(input: AnswerInput, criterion: Criterion): number {
  const method = input.method ?? 'OWNER_ASSESSED';
  const quality = METHOD_QUALITY[method] ?? 60;
  const evidenceBonus = input.evidence && input.evidence.trim().length > 8 ? 10 : 0;
  const noteBonus = input.note && input.note.trim().length > 12 ? 4 : 0;
  const decay = reliabilityDecay(ageDays(input.answeredAt), criterion.halfLifeDays);
  return clamp01_100((quality + evidenceBonus + noteBonus) * decay);
}

/** اطمینان سیگنال مشاهده‌شده از حجم شواهد: ۱ رکورد ≈ ۳۰، ۱۲+ رکورد ≈ ۹۰. */
export function confidenceForObserved(evidence: number): number {
  if (!Number.isFinite(evidence) || evidence <= 0) return 15;
  return clamp01_100(28 + 62 * (1 - Math.exp(-evidence / 6)));
}

function anchorFor(criterion: Criterion, level?: number | null): ScaleAnchor | null {
  const anchors = scaleFor(criterion);
  if (level == null) return null;
  return anchors.find((a) => a.level === Math.round(level)) ?? null;
}

/** مقدار پاسخ پرسش‌نامه به ۰ تا ۱۰۰ (در جهت خودِ معیار). */
export function assessedValue(criterion: Criterion, input: AnswerInput): number | null {
  if (input.value != null && Number.isFinite(Number(input.value))) return clamp01_100(Number(input.value));
  const anchor = anchorFor(criterion, input.level);
  return anchor ? anchor.score : null;
}

export function criterionByCode(code: string): Criterion | undefined {
  return CRITERIA_BY_CODE.get(code);
}

function verdictFor(a: { score: number; coverage: number; confidence: number; criticalFlag: boolean }): {
  verdict: CriteriaAssessment['verdict'];
  label: string;
  hint: string;
} {
  if (a.criticalFlag) return { verdict: 'CRITICAL', label: 'پرچم بحرانی', hint: 'یک دروازۀ ریسک فعال است؛ تا جمع‌شدن این مورد، امتیاز اعتبار عملیاتی ندارد.' };
  if (a.coverage < 25) return { verdict: 'INSUFFICIENT_DATA', label: 'داده کافی نیست', hint: 'تصویر هنوز ساخته نشده؛ این عدد را برای تصمیم استفاده نکنید.' };
  if (a.confidence < 40) return { verdict: 'PRELIMINARY', label: 'پیش‌نویس ارزیابی', hint: 'شواهد کم یا کهنه است؛ با چند پاسخ مستند، امتیاز جابه‌جا می‌شود.' };
  if (a.score < 40) return { verdict: 'AT_RISK', label: 'ضعیف', hint: 'شواهد کافی، وضعیت نامطلوب — این رابطه نیازمند اقدام است.' };
  if (a.score >= 75 && a.confidence >= 65) return { verdict: 'STRONG', label: 'قوی', hint: 'شواهد کافی و باکیفیت.' };
  return { verdict: 'SOLID', label: 'قابل اتکا', hint: 'امتیاز بر پایهٔ شواهد کافی محاسبه شده است.' };
}

function actionHintFor(line: CriterionLine, criterion: Criterion): string {
  if (line.status === 'UNKNOWN') {
    return criterion.evidence === 'OBSERVED'
      ? 'با ثبت تعامل/جلسه/تعهد واقعی، این معیار خودکار پر می‌شود.'
      : criterion.intake ? `پاسخ به این پرسش کافی است: «${criterion.intake.prompt}»` : 'یک ارزیابی مستند برای این معیار ثبت کنید.';
  }
  const weak = line.polarity === 'GOOD' ? line.value != null && line.value < 45 : line.value != null && line.value > 55;
  if (weak) return 'شواهد فعلی این معیار را ضعیف می‌کند؛ یک اقدام اصلاحی با مهلت مشخص تعریف کنید.';
  if (line.answerAgeDays != null && line.answerAgeDays > criterion.halfLifeDays * 2) return 'اعتبار این پاسخ رو به پایان است؛ بازبینی دوره‌ای انجام شود.';
  return 'وضعیت این معیار مطلوب است؛ در بازبینی بعدی تمدید شود.';
}

export interface ComputeOptions {
  subjectType: CriterionSubject;
  subjectId?: string | null;
  answers?: AnswerInput[];
  observed?: Record<string, ObservedSignal>;
  /** فقط این معیارها در مدل لحاظ شوند (مثلاً مدل سازمانی). */
  only?: string[];
  /** آستانهٔ پوشش برای رتبه‌بندی. */
  minCoverageForRanking?: number;
}

/**
 * محاسبۀ امتیاز معیارمحور.
 *
 * @returns ساختار کامل شامل خانوادۀ معیارها، پوشش، اطمینان، باند عدم‌قطعیت، پرچم‌ها و صف بازبینی
 */
export function computeCriteriaAssessment(options: ComputeOptions): CriteriaAssessment {
  const subject = options.subjectType;
  const answersByCode = new Map<string, AnswerInput>();
  for (const a of options.answers ?? []) {
    if (!a || !a.criterionCode) continue;
    if (a.level == null && a.value == null) continue; // «پاسخ ندادم» یعنی ناشناخته، نه صفر
    answersByCode.set(a.criterionCode, a);
  }
  const observed = options.observed ?? {};
  const allowed = options.only?.length ? new Set(options.only) : null;
  const universe = criteriaFor(subject).filter((c) => (allowed ? allowed.has(c.code) : true));
  const modelWeights = FAMILY_WEIGHTS[subject];
  const totalModelWeight = Object.values(modelWeights).reduce((s, v) => s + v, 0) || 1;

  const lines: CriterionLine[] = [];
  const families: FamilyLine[] = [];
  const flags: CriteriaAssessment['flags'] = [];
  const reviewDue: CriteriaAssessment['reviewDue'] = [];
  const unknown: CriteriaAssessment['unknown'] = [];
  const methodMix: Partial<Record<EvidenceMethod, number>> = {};
  let answeredCount = 0;

  for (const family of Object.keys(FAMILY_META) as CriterionFamily[]) {
    const familyCriteria = universe.filter((c) => c.family === family);
    if (!familyCriteria.length) continue;
    const familyLines: CriterionLine[] = [];
    let famWeightSum = 0;
    let famScoreSum = 0;
    let famConfSum = 0;
    let famKnownWeight = 0;
    const famTotalWeight = familyCriteria.reduce((s, c) => s + c.weight, 0) || 1;

    for (const criterion of familyCriteria) {
      const answer = answersByCode.get(criterion.code);
      const signal = observed[criterion.code];
      const aVal = answer ? assessedValue(criterion, answer) : null;
      const aConf = answer && aVal != null ? confidenceForAssessed(answer, criterion) : 0;
      const oVal = signal && Number.isFinite(signal.value) ? clamp01_100(signal.value) : null;
      const oConf = oVal != null ? confidenceForObserved(signal.evidence) : 0;

      let value: number | null = null;
      let confidence = 0;
      let status: CriterionLine['status'] = 'UNKNOWN';
      if (aVal != null && oVal != null) {
        value = Math.round((aVal * aConf + oVal * oConf) / Math.max(1, aConf + oConf));
        confidence = clamp01_100(100 - ((100 - aConf) * (100 - oConf)) / 100);
        status = 'BLENDED';
      } else if (aVal != null) {
        value = aVal;
        confidence = aConf;
        status = 'ASSESSED';
      } else if (oVal != null) {
        value = oVal;
        confidence = oConf;
        status = 'OBSERVED';
      }
      if (answer) {
        answeredCount += 1;
        const m = answer.method ?? 'OWNER_ASSESSED';
        methodMix[m] = (methodMix[m] ?? 0) + 1;
      }

      const age = ageDays(answer?.answeredAt);
      const decay = reliabilityDecay(age, criterion.halfLifeDays);
      const weightPct = Math.round((criterion.weight / famTotalWeight) * (modelWeights[family] / totalModelWeight) * 10000) / 100;
      const line: CriterionLine = {
        code: criterion.code,
        family,
        familyName: FAMILY_META[family].name,
        name: criterion.name,
        nameEn: criterion.nameEn,
        why: criterion.why,
        polarity: criterion.polarity,
        weight: criterion.weight,
        weightPct,
        value,
        displayValue: value == null ? null : value,
        confidence: status === 'UNKNOWN' ? 0 : confidence,
        status,
        needsReview: status !== 'UNKNOWN' && (confidence < 40 || (age != null && age > criterion.halfLifeDays * 2)),
        answerAgeDays: age,
        reliabilityDecay: Math.round(decay * 100) / 100,
        note: answer?.note ?? null,
        evidence: answer?.evidence ?? null,
        answeredByName: answer?.answeredByName ?? null,
        observed: signal ? { value: oVal ?? 0, evidence: signal.evidence, label: signal.label } : null,
        assessed:
          answer && aVal != null
            ? {
                value: aVal,
                level: answer.level ?? 0,
                anchor: anchorFor(criterion, answer.level),
                method: answer.method ?? 'OWNER_ASSESSED',
                confidence: aConf,
              }
            : null,
        gate: criterion.gate
          ? {
              severity: criterion.gate.severity,
              message: criterion.gate.message,
              cap: criterion.gate.cap,
              active:
                value != null &&
                (criterion.gate.trigger === 'ABOVE' ? value >= criterion.gate.threshold : value <= criterion.gate.threshold),
            }
          : null,
        warning:
          value != null && criterion.intake?.warnBelow != null && criterion.intake.warning && value <= criterion.intake.warnBelow
            ? criterion.intake.warning
            : null,
        sources: criterion.sources,
        actionHint: '',
      };
      line.actionHint = actionHintFor(line, criterion);
      familyLines.push(line);

      if (value == null) {
        unknown.push({
          code: criterion.code,
          name: criterion.name,
          family,
          weightPct,
          prompt: criterion.intake?.prompt,
          help: criterion.intake?.help,
        });
        continue;
      }
      famScoreSum += value * criterion.weight;
      famWeightSum += criterion.weight;
      famKnownWeight += criterion.weight;
      famConfSum += line.confidence * criterion.weight;
      if (line.gate?.active) {
        flags.push({ code: `GATE_${criterion.code}`, severity: criterion.gate!.severity, message: criterion.gate!.message, criterionCode: criterion.code });
      }
      if (line.warning) flags.push({ code: `WARN_${criterion.code}`, severity: 'MEDIUM', message: line.warning, criterionCode: criterion.code });
      if (line.needsReview) reviewDue.push({ code: criterion.code, name: criterion.name, reason: line.confidence < 40 ? 'اطمینان کمتر از ۴۰' : 'پاسخ کهنه (بیش از دو نیمه‌عمر)' });
    }

    const familyScore = famWeightSum > 0 ? Math.round(famScoreSum / famWeightSum) : null;
    families.push({
      family,
      name: FAMILY_META[family].name,
      nameEn: FAMILY_META[family].nameEn,
      rationale: FAMILY_META[family].rationale,
      modelWeight: modelWeights[family],
      weightPct: Math.round((modelWeights[family] / totalModelWeight) * 1000) / 10,
      score: familyScore,
      confidence: famKnownWeight > 0 ? Math.round(famConfSum / famKnownWeight) : 0,
      coveragePct: famKnownWeight > 0 ? Math.round((famKnownWeight / famTotalWeight) * 100) : 0,
      known: familyLines.filter((l) => l.value != null).length,
      total: familyLines.length,
      lines: familyLines,
    });
    lines.push(...familyLines);
  }

  let num = 0;
  let den = 0;
  let confNum = 0;
  let familyCredit = 0;
  for (const f of families) {
    if (f.score == null || f.modelWeight <= 0) continue;
    num += f.score * f.modelWeight;
    den += f.modelWeight;
    confNum += f.confidence * f.modelWeight;
  }
  // پوشش = سهم وزن مدل که واقعاً با داده پر شده است (اعتبار نسبی، نه «یک پاسخ = خانوادۀ پر»).
  for (const f of families) {
    if (f.modelWeight <= 0) continue;
    familyCredit += f.modelWeight * (f.coveragePct / 100);
  }
  const rawScore = den > 0 ? Math.round(num / den) : 0;
  const knownWeight = Math.min(1, familyCredit / totalModelWeight);
  const coverage = Math.round(knownWeight * 100);
  const baseConfidence = den > 0 ? Math.round(confNum / den) : 0;
  const confidence = Math.round(baseConfidence * (0.55 + 0.45 * knownWeight));
  const uncertainty = Math.round((1 - knownWeight) * 28 + (100 - baseConfidence) / 12);
  const activeCap = flags
    .filter((f) => f.code.startsWith('GATE_'))
    .reduce<number | null>((min, f) => {
      const code = f.code.replace('GATE_', '');
      const c = criterionByCode(code);
      const cap = c?.gate?.cap ?? null;
      if (cap == null) return min;
      return min == null ? cap : Math.min(min, cap);
    }, null);
  const score = activeCap == null ? rawScore : Math.min(rawScore, activeCap);
  const criticalFlag = flags.some((f) => f.severity === 'CRITICAL');
  const rankable = coverage >= (options.minCoverageForRanking ?? 40) && confidence >= 35 && !criticalFlag;
  const rankingScore = rankable ? Math.round(score * (0.7 + 0.3 * (confidence / 100))) : score;
  const v = verdictFor({ score, coverage, confidence, criticalFlag });

  const hints: string[] = [];
  if (coverage < 40) {
    const heavyUnknowns = unknown
      .filter((u) => u.weightPct >= 1.5)
      .sort((a, b) => b.weightPct - a.weightPct)
      .slice(0, 4);
    if (heavyUnknowns.length)
      hints.push(`برای عبور از آستانۀ رتبه‌بندی (${options.minCoverageForRanking ?? 40}٪ پوشش)، این ${heavyUnknowns.length} معیار پرتأثیر را پاسخ دهید: ${heavyUnknowns.map((u) => u.name).join('، ')}.`);
  }
  const weakest = lines
    .filter((l) => l.value != null && (l.polarity === 'GOOD' ? l.value < 45 : l.value > 55))
    .sort((a, b) => b.weightPct - a.weightPct)
    .slice(0, 3)
    .map((l) => l.name);
  if (weakest.length) hints.push(`ضعیف‌ترین نقاط: ${weakest.join('، ')}.`);
  if (flags.length) hints.push(`${flags.length} پرچم ثبت شده است — ابتدا موارد بحرانی/بالا.`);
  if (!answeredCount && Object.keys(observed).length) hints.push('فعلاً فقط رفتار ثبت‌شده محاسبه شده؛ افزودن ارزیابی انسانی تصویر را کامل می‌کند.');

  return {
    subjectType: subject,
    subjectId: options.subjectId ?? null,
    score,
    rawScore,
    uncertainty,
    rangeLow: Math.max(0, score - uncertainty),
    rangeHigh: Math.min(100, score + uncertainty),
    coverage,
    confidence,
    rankingScore,
    rankable,
    gateCap: activeCap,
    verdict: v.verdict,
    verdictLabel: v.label,
    verdictHint: v.hint,
    families: families.filter((f) => f.modelWeight > 0),
    criteria: lines,
    knownCriteria: lines.filter((l) => l.value != null).length,
    totalCriteria: lines.length,
    unknown,
    flags,
    reviewDue,
    answeredCount,
    methodMix,
    computedAt: new Date().toISOString(),
    hints,
  };
}

/** خلاصه‌ساز کم‌حجم برای جاسازی در متادیتای Score و کارت‌های لیست. */
export function summarizeAssessment(a: CriteriaAssessment) {
  return {
    score: a.score,
    rawScore: a.rawScore,
    coverage: a.coverage,
    confidence: a.confidence,
    uncertainty: a.uncertainty,
    rangeLow: a.rangeLow,
    rangeHigh: a.rangeHigh,
    rankable: a.rankable,
    rankingScore: a.rankingScore,
    gateCap: a.gateCap,
    verdict: a.verdict,
    verdictLabel: a.verdictLabel,
    known: a.knownCriteria,
    total: a.totalCriteria,
    flags: a.flags.map((f) => ({ code: f.code, severity: f.severity, criterionCode: f.criterionCode })),
    families: a.families.map((f) => ({ family: f.family, name: f.name, score: f.score, weightPct: f.weightPct, coveragePct: f.coveragePct })),
    computedAt: a.computedAt,
  };
}

/** نگاشت فاکتورهای مدل رفتاری موجود به معیارهای کاتالوگ (پل دو مدل). */
export const FACTOR_CRITERIA_MAP: Record<string, { good: string[]; bad: string[] }> = {
  strategicValue: { good: ['STRAT_POWER', 'STRAT_FIT', 'NET_BRIDGE'], bad: [] },
  economicValue: { good: ['VALUE_REALISED', 'VALUE_MARGIN'], bad: [] },
  influence: { good: ['ACC_DECISION_ACCESS', 'ACC_CHAMPION_POWER', 'ACC_DECISION_ROLE'], bad: [] },
  trust: { good: ['REL_TRUST', 'REL_COMMITMENT', 'REL_INFORMATION_HONESTY'], bad: ['REL_OPPORTUNISM'] },
  access: { good: ['ACC_MULTITHREADING', 'ACC_RESPONSIVENESS', 'OPP_COMMITTEE_COVERAGE'], bad: [] },
  engagement: { good: ['NET_TIE_STRENGTH', 'OPP_ACTIVITY_MOMENTUM', 'STRAT_EXEC_SPONSOR'], bad: [] },
  recency: { good: [], bad: [] },
  diversity: { good: ['NET_NON_REDUNDANCY'], bad: [] },
  responsiveness: { good: ['ACC_RESPONSIVENESS', 'CAP_SERVICE'], bad: [] },
  commitmentReliability: { good: ['CAP_DELIVERY', 'VALUE_PAYMENT', 'REL_COMMITMENT'], bad: [] },
  opportunityPotential: { good: ['VALUE_GROWTH', 'VALUE_PIPELINE', 'OPP_BUSINESS_CASE', 'OPP_PAPER_PROCESS'], bad: [] },
  risk: { good: ['FIN_Z_SCORE', 'FIN_LIQUIDITY'], bad: ['REL_OPPORTUNISM', 'RISK_SANCTIONS_PEP', 'RISK_UBO', 'RISK_LEGAL', 'RISK_DATA_SECURITY', 'RISK_CONCENTRATION', 'FIN_LEVERAGE', 'FIN_COUNTRY', 'ACC_CONTACT_STABILITY'] },
};

export interface FactorAssessment {
  /** مقدار ۰ تا ۱۰۰ در جهت خودِ فاکتور؛ null یعنی هنوز هیچ معیاری برای این فاکتور داده ندارد. */
  value: number | null;
  confidence: number;
  criteria: string[];
  gateCap: number | null;
}

/** ارزش هر فاکتور رفتاری از دید معیارها — بدون ساختن عدد برای معیار بی‌داده. */
export function factorAssessment(a: CriteriaAssessment): Record<string, FactorAssessment> {
  const byCode = new Map(a.criteria.map((c) => [c.code, c]));
  const out: Record<string, FactorAssessment> = {};
  for (const [factor, map] of Object.entries(FACTOR_CRITERIA_MAP)) {
    let num = 0;
    let den = 0;
    let confNum = 0;
    const used: string[] = [];
    let gateCap: number | null = null;
    for (const code of map.good) {
      const line = byCode.get(code);
      if (!line || line.value == null) continue;
      const weight = line.weight;
      num += line.value * weight;
      den += weight;
      confNum += line.confidence * weight;
      used.push(code);
      if (line.gate?.active && line.gate.cap < (gateCap ?? 101)) gateCap = line.gate.cap;
    }
    for (const code of map.bad) {
      const line = byCode.get(code);
      if (!line || line.value == null) continue;
      const weight = line.weight;
      num += (100 - line.value) * weight;
      den += weight;
      confNum += line.confidence * weight;
      used.push(code);
      if (line.gate?.active && line.gate.cap < (gateCap ?? 101)) gateCap = line.gate.cap;
    }
    out[factor] = {
      value: den > 0 ? clamp01_100(num / den) : null,
      confidence: den > 0 ? Math.round(confNum / den) : 0,
      criteria: used,
      gateCap,
    };
  }
  return out;
}

/** خلاصۀ عددی برای مصرف‌کننده‌هایی که فقط عدد می‌خواهند (معیارهای ناشناخته = حذف، نه صفر). */
export function criteriaFactorBridge(a: CriteriaAssessment): Record<string, number> {
  const factors = factorAssessment(a);
  const out: Record<string, number> = {};
  for (const [factor, item] of Object.entries(factors)) out[factor] = item.value ?? 50;
  return out;
}

export const CRITERIA_VERSION = 'criteria-v1';
export const ALL_CRITERIA = CRITERIA;
