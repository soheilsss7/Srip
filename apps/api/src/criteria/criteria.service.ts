import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';
import { AuditService } from '../audit/audit.service';
import {
  CRITERIA,
  CRITERIA_BY_CODE,
  FAMILY_META,
  FAMILY_WEIGHTS,
  SCALES,
  criteriaFor,
  questionnaireFor,
  scaleFor,
  type Criterion,
  type CriterionSubject,
} from './criteria.catalog';
import {
  computeCriteriaAssessment,
  criteriaFactorBridge,
  methodLabel,
  summarizeAssessment,
  type AnswerInput,
  type CriteriaAssessment,
  type ObservedSignal,
} from './criteria.engine';
import { CRITERIA_VERSION } from './criteria.engine';

const SUBJECTS = new Set<CriterionSubject>(['ORGANIZATION', 'PERSON', 'RELATIONSHIP', 'OPPORTUNITY']);
const SENIOR_TITLE = /(مدیر\s*عامل|مدیرعامل|ceo|chief|عضو\s*هیئت\s*مدیره|مدیر\s*ارشد|رئیس|director|president|vp|نائب\s*رئیس)/i;

const clamp01_100 = (v: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(v) ? v : 0)));
const coverageValue = (contacts: number, senior = false) =>
  contacts <= 0 ? 0 : contacts === 1 ? (senior ? 45 : 30) : contacts === 2 ? 55 : contacts <= 4 ? 80 : 100;
const logScale = (amount: number) => clamp01_100(Math.log10(Math.max(1, amount)) * 20);

export interface SaveAnswersInput {
  subjectType: CriterionSubject;
  subjectId: string;
  answers: Array<{
    criterionCode: string;
    level?: number | null;
    value?: number | null;
    note?: string | null;
    evidence?: string | null;
    method?: AnswerInput['method'];
    answeredAt?: string | null;
  }>;
  /** 'INTAKE' وقتی پرسش‌نامۀ ساخت رکورد است. */
  source?: string;
  /** حذف پاسخ معیارهای ناموجود در این مجموعه. */
  replace?: boolean;
  /** پس از ذخیره، فیلدهای استنتاجی موجودیت به‌روز شود. */
  syncScores?: boolean;
}

/**
 * ارزیابی مبتنی بر معیارهای واقعی.
 *
 * این سرویس تنها منبع محاسبۀ «امتیاز معیارمحور» است: کاتالوگ معیارها، پرسش‌نامۀ اختیاری
 * ورود اطلاعات، سیگنال‌های رفتاری مشاهده‌شده، اطمینان/پوشش، پرچم‌های قرمز و تقویم بازبینی.
 */
@Injectable()
export class CriteriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly eventBus: EventBusService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- کاتالوگ

  catalog(subject?: string) {
    const list = subject && SUBJECTS.has(subject as CriterionSubject) ? criteriaFor(subject as CriterionSubject) : CRITERIA;
    return {
      version: CRITERIA_VERSION,
      families: (Object.keys(FAMILY_META) as (keyof typeof FAMILY_META)[]).map((key) => ({
        key,
        ...FAMILY_META[key],
        criteria: list.filter((c) => c.family === key).map((c) => c.code),
      })),
      scales: Object.fromEntries((Object.keys(SCALES) as (keyof typeof SCALES)[]).map((k) => [k, { label: SCALES[k].label, anchors: SCALES[k].anchors }])),
      criteria: list.map((c) => this.publicCriterion(c)),
      methodLabels: Object.fromEntries(
        (['DOCUMENT', 'VERIFIED', 'OWNER_ASSESSED', 'SELF_REPORTED', 'INFERRED'] as const).map((m) => [m, methodLabel(m)]),
      ),
    };
  }

  private publicCriterion(c: Criterion) {
    return {
      code: c.code,
      family: c.family,
      familyName: FAMILY_META[c.family].name,
      name: c.name,
      nameEn: c.nameEn,
      why: c.why,
      appliesTo: c.appliesTo,
      polarity: c.polarity,
      weight: c.weight,
      evidence: c.evidence,
      halfLifeDays: c.halfLifeDays,
      sources: c.sources,
      observedFrom: c.observedFrom ?? null,
      gate: c.gate ? { trigger: c.gate.trigger, threshold: c.gate.threshold, cap: c.gate.cap, severity: c.gate.severity, message: c.gate.message } : null,
      intake: c.intake ? { prompt: c.intake.prompt, help: c.intake.help, recommended: c.intake.recommended === true, warning: c.intake.warning ?? null } : null,
      anchors: scaleFor(c),
    };
  }

  questionnaire(subjectType: string) {
    const subject = this.subject(subjectType);
    const questions = questionnaireFor(subject);
    return {
      subjectType: subject,
      version: CRITERIA_VERSION,
      optional: true,
      totalCriteria: criteriaFor(subject).length,
      questions: questions.map((q) => ({
        ...q,
        criterion: this.publicCriterion(CRITERIA_BY_CODE.get(q.criterionCode)!),
      })),
      recommendedIds: questions.filter((q) => q.recommended).map((q) => q.code),
      note: 'همۀ پرسش‌ها اختیاری‌اند. پاسخ‌ندادنه با صفر یکسان نیست: معیار در «ناشناخته» می‌ماند و اطمینان امتیاز پایین می‌آید.',
    };
  }

  private subject(value: string): CriterionSubject {
    const key = String(value ?? '').toUpperCase() as CriterionSubject;
    if (!SUBJECTS.has(key)) throw new BadRequestException('subjectType باید یکی از ORGANIZATION، PERSON، RELATIONSHIP یا OPPORTUNITY باشد.');
    return key;
  }

  // ------------------------------------------------------------ دسترسی‌ها

  /** شناسۀ سازمانِ مالکِ سوژه، برای دامنهٔ دسترسی و جداسازی داده. */
  private async orgIdFor(subjectType: CriterionSubject, subjectId: string): Promise<string | null> {
    if (subjectType === 'ORGANIZATION') return subjectId;
    if (subjectType === 'PERSON') {
      const row = await this.prisma.person.findUnique({ where: { id: subjectId }, select: { organizationId: true, deletedAt: true } });
      if (!row || row.deletedAt) throw new NotFoundException('Person not found');
      return row.organizationId ?? null;
    }
    if (subjectType === 'RELATIONSHIP') {
      const row = await this.prisma.relationship.findUnique({ where: { id: subjectId }, select: { sourceOrganizationId: true, deletedAt: true } });
      if (!row || row.deletedAt) throw new NotFoundException('Relationship not found');
      return row.sourceOrganizationId ?? null;
    }
    const row = await this.prisma.opportunity.findUnique({ where: { id: subjectId }, select: { organizationId: true, deletedAt: true } });
    if (!row || row.deletedAt) throw new NotFoundException('Opportunity not found');
    return row.organizationId ?? null;
  }

  // ------------------------------------------------- سیگنال‌های مشاهده‌شده

  /** نشست‌هایی که در بازۀ زمانی مشخص، مدیر ارشد طرف حساب در آن‌ها شرکت کرده است. */
  private async seniorMeetings(filter: Record<string, unknown>, since: Date): Promise<number> {
    const rows = await this.prisma.meetingParticipant.findMany({
      where: { meeting: { deletedAt: null, startAt: { gte: since }, ...filter }, person: { deletedAt: null } },
      select: { meetingId: true, person: { select: { title: true } } },
      take: 800,
    });
    const ids = new Set(rows.filter((r: any) => SENIOR_TITLE.test(String(r.person?.title ?? ''))).map((r: any) => r.meetingId));
    return ids.size;
  }

  /**
   * بخش «مشاهده‌شده» مدل ترکیبی: معیارهایی که لازم نیست کسی دربارهٔ آن‌ها قضاوت کند،
   * از رفتار ثبت‌شده (تعامل، جلسه، تعهد، فرصت، پوشش مخاطب) محاسبه می‌شوند.
   * بدون شواهد، معیار عمداً ناشناخته می‌ماند (نه صفر، نه ۵۰).
   */
  async observedSignals(subjectType: CriterionSubject, subjectId: string, organizationId: string | null): Promise<Record<string, ObservedSignal>> {
    const out: Record<string, ObservedSignal> = {};
    const since90 = new Date(Date.now() - 90 * 86400000);
    const since180 = new Date(Date.now() - 180 * 86400000);
    const put = (code: string, value: number, evidence: number, label: string) => {
      if (evidence <= 0) return;
      out[code] = { value: clamp01_100(value), evidence, label };
    };

    if (subjectType === 'RELATIONSHIP') {
      const rel = await this.prisma.relationship.findUnique({
        where: { id: subjectId },
        select: { sourceOrganizationId: true, targetOrganizationId: true, riskScore: true, trustScore: true },
      });
      if (!rel) throw new NotFoundException('Relationship not found');
      const [inter, inter90, people90, meetings, latest, opps, commitments, types, outcomeInter, parallelRels, targetPeople, seniorCount] = await Promise.all([
        this.prisma.interaction.count({ where: { relationshipId: subjectId, deletedAt: null, occurredAt: { gte: since180 } } }),
        this.prisma.interaction.count({ where: { relationshipId: subjectId, deletedAt: null, occurredAt: { gte: since90 } } }),
        this.prisma.interaction.groupBy({ by: ['personId'], where: { relationshipId: subjectId, deletedAt: null, occurredAt: { gte: since90 }, personId: { not: null } } }),
        this.prisma.meeting.count({ where: { relationshipId: subjectId, deletedAt: null, startAt: { gte: since180 } } }),
        this.prisma.interaction.findFirst({ where: { relationshipId: subjectId, deletedAt: null }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
        this.prisma.opportunity.aggregate({ where: { relationshipId: subjectId, deletedAt: null }, _sum: { value: true }, _count: { _all: true }, _avg: { probability: true } }),
        this.prisma.commitment.groupBy({ by: ['status'], where: { relationshipId: subjectId, deletedAt: null }, _count: { _all: true } }),
        this.prisma.interaction.groupBy({ by: ['type'], where: { relationshipId: subjectId, deletedAt: null, occurredAt: { gte: since180 } } }),
        this.prisma.interaction.count({ where: { relationshipId: subjectId, deletedAt: null, occurredAt: { gte: since180 }, outcome: { not: null } } }),
        this.prisma.relationship.count({
          where: {
            deletedAt: null,
            id: { not: subjectId },
            OR: [
              { sourceOrganizationId: rel.sourceOrganizationId, targetOrganizationId: rel.targetOrganizationId },
              { sourceOrganizationId: rel.targetOrganizationId, targetOrganizationId: rel.sourceOrganizationId },
            ],
          },
        }),
        this.prisma.person.count({ where: { deletedAt: null, organizationId: rel.targetOrganizationId } }),
        this.seniorMeetings({ relationshipId: subjectId }, since180),
      ]);

      const contacts = people90.length;
      put('ACC_MULTITHREADING', coverageValue(contacts, seniorCount > 0), Math.max(contacts, inter90), `${contacts} خط تماس فعال در ۹۰ روز`);
      const daysSince = latest ? (Date.now() - latest.occurredAt.getTime()) / 86400000 : 365;
      put(
        'NET_TIE_STRENGTH',
        clamp01_100(inter * 4 + meetings * 8) * 0.6 + clamp01_100(100 - daysSince * 1.1) * 0.4,
        inter + meetings,
        `آخرین تعامل ${Math.round(daysSince)} روز پیش`,
      );
      const done = commitments.find((c) => c.status === 'FULFILLED')?._count._all ?? 0;
      const commitmentTotal = commitments.reduce((sum, c) => sum + (c.status === 'CANCELLED' ? 0 : c._count._all), 0);
      if (commitmentTotal > 0) put('CAP_DELIVERY', (done / commitmentTotal) * 100, commitmentTotal, `${done} از ${commitmentTotal} تعهد انجام شده`);
      if (inter > 0) put('ACC_RESPONSIVENESS', (outcomeInter / inter) * 100, inter, `${outcomeInter} از ${inter} تعامل با نتیجه`);
      const totalValue = Number(opps._sum.value ?? 0);
      if (totalValue > 0) put('VALUE_REALISED', logScale(totalValue), opps._count._all, `گردش ثبت‌شده ${totalValue.toLocaleString('fa-IR')}`);
      put('VALUE_PIPELINE', logScale(totalValue * (Number(opps._avg.probability ?? 0) / 100)), opps._count._all, 'ارزش وزنی پایپ‌لاین باز');
      put(
        'ACC_DECISION_ACCESS',
        seniorCount > 0 ? Math.min(100, 60 + seniorCount * 10) : meetings > 0 ? 35 : 20,
        seniorCount + meetings,
        seniorCount > 0 ? `${seniorCount} نشست با مدیران ارشد` : 'بدون نشست با سطح تصمیم',
      );
      put('STRAT_EXEC_SPONSOR', seniorCount > 0 ? Math.min(100, 55 + seniorCount * 12) : 15, seniorCount + meetings, 'درگیری مدیران ارشد در ۱۸۰ روز');
      put('NET_NON_REDUNDANCY', clamp01_100((types.length / 5) * 60 + (Math.min(contacts, 5) / 5) * 40), types.length + contacts, `${types.length} نوع تعامل با ${contacts} نفر`);
      put('NET_BRIDGE', clamp01_100(targetPeople > 0 ? Math.min(100, 20 + contacts * 12 + (seniorCount ? 20 : 0)) : 10), contacts, 'پل میان واحدهای طرف حساب');
      put(
        'NET_SINGLE_POINT',
        parallelRels === 0 && contacts <= 1 ? 100 : parallelRels === 0 ? 70 : Math.max(0, 35 - parallelRels * 8),
        parallelRels + 1,
        parallelRels === 0 ? 'این رابطه تنها مسیر دسترسی به این سازمان است' : `${parallelRels} رابطهٔ موازی با همین سازمان`,
      );
      const orgValue = Number(
        (await this.prisma.opportunity.aggregate({ where: { deletedAt: null, organizationId: rel.sourceOrganizationId }, _sum: { value: true } }))._sum.value ?? 0,
      );
      const share = orgValue > 0 ? totalValue / orgValue : parallelRels === 0 ? 0.85 : 0.2;
      put('RISK_CONCENTRATION', clamp01_100(share * 100), Math.max(1, parallelRels + 1), `سهم ${Math.round(share * 100)}٪ از گردش ثبت‌شدهٔ سازمان`);
      return out;
    }

    if (subjectType === 'ORGANIZATION') {
      const [rels, people, inter, inter90, contacts, meetings, opps, commitments, seniorCount] = await Promise.all([
        this.prisma.relationship.count({ where: { deletedAt: null, OR: [{ sourceOrganizationId: subjectId }, { targetOrganizationId: subjectId }] } }),
        this.prisma.person.count({ where: { deletedAt: null, organizationId: subjectId } }),
        this.prisma.interaction.count({ where: { deletedAt: null, organizationId: subjectId, occurredAt: { gte: since180 } } }),
        this.prisma.interaction.count({ where: { deletedAt: null, organizationId: subjectId, occurredAt: { gte: since90 } } }),
        this.prisma.interaction.groupBy({ by: ['personId'], where: { deletedAt: null, organizationId: subjectId, occurredAt: { gte: since90 }, personId: { not: null } } }),
        this.prisma.meeting.count({ where: { deletedAt: null, organizationId: subjectId, startAt: { gte: since180 } } }),
        this.prisma.opportunity.aggregate({ where: { deletedAt: null, organizationId: subjectId }, _sum: { value: true }, _avg: { probability: true }, _count: { _all: true } }),
        this.prisma.commitment.groupBy({ by: ['status'], where: { deletedAt: null, organizationId: subjectId }, _count: { _all: true } }),
        this.seniorMeetings({ organizationId: subjectId }, since180),
      ]);
      const avgRow = await this.prisma.relationship.aggregate({
        where: { deletedAt: null, OR: [{ sourceOrganizationId: subjectId }, { targetOrganizationId: subjectId }] },
        _avg: { trustScore: true, riskScore: true, healthScore: true },
      });
      const contactsCount = contacts.length;
      put('ACC_MULTITHREADING', coverageValue(contactsCount, seniorCount > 0), Math.max(contactsCount, inter90), `${contactsCount} مخاطب فعال در ۹۰ روز`);
      const totalValue = Number(opps._sum.value ?? 0);
      if (totalValue > 0) put('VALUE_REALISED', logScale(totalValue), opps._count._all, `گردش ثبت‌شده ${totalValue.toLocaleString('fa-IR')}`);
      put('VALUE_PIPELINE', logScale(totalValue * (Number(opps._avg.probability ?? 0) / 100)), opps._count._all, 'ارزش وزنی فرصت‌ها');
      const done = commitments.find((c) => c.status === 'FULFILLED')?._count._all ?? 0;
      const commitmentTotal = commitments.reduce((sum, c) => sum + (c.status === 'CANCELLED' ? 0 : c._count._all), 0);
      if (commitmentTotal > 0) put('CAP_DELIVERY', (done / commitmentTotal) * 100, commitmentTotal, `${done} از ${commitmentTotal} تعهد انجام شده`);
      put('STRAT_EXEC_SPONSOR', seniorCount > 0 ? Math.min(100, 55 + seniorCount * 10) : 15, seniorCount + meetings, `${seniorCount} نشست با مدیران ارشد`);
      put('NET_BRIDGE', clamp01_100(Math.min(100, rels * 12 + contactsCount * 4)), rels, `${rels} رابطهٔ ثبت‌شده`);
      put('NET_TIE_STRENGTH', clamp01_100(inter * 2 + meetings * 3), inter + meetings, `${inter} تعامل در ۱۸۰ روز`);
      put('NET_NON_REDUNDANCY', clamp01_100(Math.min(100, rels * 10 + people * 2)), rels + people, `${rels} رابطه با ${people} نفر`);
      put('NET_SINGLE_POINT', clamp01_100(rels <= 1 ? 85 : Math.max(0, 60 - rels * 8)), Math.max(1, rels), rels <= 1 ? 'تنها یک رابطهٔ ثبت‌شده' : `${rels} رابطه`);
      if (avgRow._avg.trustScore != null) put('REL_TRUST', Number(avgRow._avg.trustScore), Math.max(1, rels), 'میانگین اعتماد روابط این سازمان');
      if (avgRow._avg.riskScore != null) put('RISK_CONCENTRATION', clamp01_100(Number(avgRow._avg.riskScore)), Math.max(1, rels), 'میانگین ریسک روابط');
      void organizationId;
      return out;
    }

    if (subjectType === 'PERSON') {
      const person = await this.prisma.person.findUnique({
        where: { id: subjectId },
        select: { organizationId: true, title: true, influenceScore: true, decisionPower: true, accessibilityScore: true },
      });
      if (!person) throw new NotFoundException('Person not found');
      const [inter, inter90, outcome, meetings, colleagues, attendedSenior] = await Promise.all([
        this.prisma.interaction.count({ where: { personId: subjectId, deletedAt: null, occurredAt: { gte: since180 } } }),
        this.prisma.interaction.count({ where: { personId: subjectId, deletedAt: null, occurredAt: { gte: since90 } } }),
        this.prisma.interaction.count({ where: { personId: subjectId, deletedAt: null, occurredAt: { gte: since180 }, outcome: { not: null } } }),
        this.prisma.meetingParticipant.count({ where: { personId: subjectId, meeting: { deletedAt: null, startAt: { gte: since180 } } } }),
        this.prisma.interaction.groupBy({
          by: ['personId'],
          where: { deletedAt: null, organizationId: person.organizationId, occurredAt: { gte: since90 }, personId: { not: null } },
        }),
        this.seniorMeetings({ organizationId: person.organizationId }, since180),
      ]);
      const relCount = await this.prisma.personRelationship
        .count({ where: { deletedAt: null, OR: [{ sourcePersonId: subjectId }, { targetPersonId: subjectId }] } })
        .catch(() => 0);
      const latest = await this.prisma.interaction.findFirst({ where: { personId: subjectId, deletedAt: null }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } });
      const daysSince = latest ? (Date.now() - latest.occurredAt.getTime()) / 86400000 : 365;
      const senior = SENIOR_TITLE.test(String(person.title ?? ''));
      put('ACC_RESPONSIVENESS', inter > 0 ? (outcome / inter) * 100 : 0, inter, `${outcome} از ${inter} تعامل با نتیجه`);
      put(
        'NET_TIE_STRENGTH',
        clamp01_100(inter * 4 + meetings * 6) * 0.6 + clamp01_100(100 - daysSince * 1.1) * 0.4,
        inter + meetings,
        `آخرین تماس ${Math.round(daysSince)} روز پیش`,
      );
      put('ACC_MULTITHREADING', coverageValue(colleagues.length, senior), colleagues.length, `${colleagues.length} خط تماس در سازمان او`);
      put(
        'ACC_DECISION_ACCESS',
        senior ? 85 : attendedSenior > 0 ? 60 : Number(person.accessibilityScore ?? 0) > 60 ? 50 : 25,
        Math.max(1, inter90 + meetings),
        senior ? 'سمت ارشد' : attendedSenior > 0 ? 'حضور در نشست‌های سطح تصمیم' : 'بدون نشانهٔ دسترسی به تصمیم',
      );
      put('NET_SINGLE_POINT', relCount === 0 && inter90 === 0 ? 90 : inter90 === 0 ? 60 : 20, Math.max(1, relCount + inter90), 'جایگاه تنها در مسیر دسترسی');
      // فیلد صفر یعنی «ارزیابی نشده»، نه «نفوذ صفر» — پس سیگنالی تولید نمی‌شود.
      if (Number(person.influenceScore ?? 0) > 0) put('STRAT_POWER', Number(person.influenceScore), Math.max(1, inter), 'شاخص نفوذ ثبت‌شده');
      if (Number(person.decisionPower ?? 0) > 0) put('ACC_CHAMPION_POWER', Number(person.decisionPower), Math.max(1, inter), 'قدرت تصمیم ثبت‌شده');
      return out;
    }

    // OPPORTUNITY
    const opp = await this.prisma.opportunity.findUnique({
      where: { id: subjectId },
      select: { value: true, probability: true, status: true, relationshipId: true, organizationId: true },
    });
    if (!opp) throw new NotFoundException('Opportunity not found');
    const orgFilter = opp.organizationId ?? organizationId ?? undefined;
    const [inter, meetings, contacts, seniorCount] = await Promise.all([
      orgFilter ? this.prisma.interaction.count({ where: { deletedAt: null, organizationId: orgFilter, occurredAt: { gte: since90 } } }) : Promise.resolve(0),
      orgFilter ? this.prisma.meeting.count({ where: { deletedAt: null, organizationId: orgFilter, startAt: { gte: since90 } } }) : Promise.resolve(0),
      orgFilter
        ? this.prisma.interaction.groupBy({ by: ['personId'], where: { deletedAt: null, organizationId: orgFilter, occurredAt: { gte: since90 }, personId: { not: null } } })
        : Promise.resolve([] as Array<{ personId: string | null; _count: any }>),
      orgFilter ? this.seniorMeetings({ organizationId: orgFilter }, since90) : Promise.resolve(0),
    ]);
    put('OPP_ACTIVITY_MOMENTUM', clamp01_100(inter * 3 + meetings * 8), inter + meetings, `${inter} تعامل و ${meetings} جلسه در ۹۰ روز`);
    put('ACC_MULTITHREADING', coverageValue(contacts.length, seniorCount > 0), contacts.length, `${contacts.length} مخاطب درگیر`);
    put('ACC_DECISION_ACCESS', seniorCount > 0 ? Math.min(100, 60 + seniorCount * 10) : 20, seniorCount || meetings, seniorCount ? 'نشست با سطح تصمیم' : 'بدون نشست با سطح تصمیم');
    const value = Number(opp.value ?? 0);
    const stageBoost = opp.status === 'ACTIVE' ? 12 : opp.status === 'QUALIFYING' ? 4 : 0;
    put('VALUE_PIPELINE', logScale(value * (clamp01_100(Number(opp.probability ?? 0) + stageBoost) / 100)), 1, 'ارزش وزنی فرصت');
    return out;
  }

  // ------------------------------------------------------------- محاسبه

  private async answers(subjectType: CriterionSubject, subjectId: string): Promise<AnswerInput[]> {
    const rows = await this.prisma.criteriaAnswer.findMany({
      where: { subjectType, subjectId, deletedAt: null },
      orderBy: { answeredAt: 'desc' },
    });
    return rows.map((r) => ({
      criterionCode: r.criterionCode,
      level: r.level,
      value: r.value,
      note: r.note,
      evidence: r.evidence,
      method: r.method as AnswerInput['method'],
      answeredAt: r.answeredAt,
    }));
  }

  private async weightsFor(subjectType: CriterionSubject, organizationId: string | null) {
    if (!organizationId) return null;
    const override = await this.prisma.criteriaOverride.findFirst({
      where: { subjectType, enabled: true, OR: [{ organizationId }, { organizationId: null }] },
      orderBy: [{ organizationId: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!override) return null;
    const base = { ...FAMILY_WEIGHTS[subjectType] };
    const custom = override.familyWeights as Record<string, number> | null;
    if (custom && typeof custom === 'object') {
      for (const key of Object.keys(base)) {
        if (typeof custom[key] === 'number' && custom[key] >= 0) base[key as keyof typeof base] = custom[key] as number;
      }
    }
    return { weights: base, minCoverage: override.minCoverageForRanking ?? 40, overrideId: override.id };
  }

  /** محاسبۀ وضعیت ارزیابی یک سوژه (بدون نوشتن در پایگاه داده). */
  async assess(subjectType: string, subjectId: string, userId?: string): Promise<CriteriaAssessment & { organizationId: string | null; bridge: Record<string, number> }> {
    const subject = this.subject(subjectType);
    const organizationId = await this.orgIdFor(subject, subjectId);
    if (userId) await this.assertAccess(userId, subject, organizationId);
    const [answerRows, observed, override] = await Promise.all([
      this.answers(subject, subjectId),
      this.observedSignals(subject, subjectId, organizationId),
      this.weightsFor(subject, organizationId),
    ]);
    const assessment = computeCriteriaAssessment({
      subjectType: subject,
      subjectId,
      answers: answerRows,
      observed,
      minCoverageForRanking: override?.minCoverage,
    });
    return { ...assessment, organizationId, bridge: criteriaFactorBridge(assessment) };
  }

  /** ارزیابی با ورودی‌های آماده — برای فراخوانی از سرویس امتیازدهی (بدون کوئری تکراری). */
  async assessWithContext(input: {
    subjectType: CriterionSubject;
    subjectId: string;
    organizationId: string | null;
    answersOverride?: AnswerInput[];
    observedOverride?: Record<string, ObservedSignal>;
    includeObserved?: boolean;
  }): Promise<CriteriaAssessment> {
    const [answers, observed, override] = await Promise.all([
      input.answersOverride ?? this.answers(input.subjectType, input.subjectId),
      input.includeObserved === false ? Promise.resolve({} as Record<string, ObservedSignal>) : this.observedSignals(input.subjectType, input.subjectId, input.organizationId),
      this.weightsFor(input.subjectType, input.organizationId),
    ]);
    return computeCriteriaAssessment({
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      answers,
      observed: { ...observed, ...(input.observedOverride ?? {}) },
      minCoverageForRanking: override?.minCoverage,
    });
  }

  private async assertAccess(userId: string, subjectType: CriterionSubject, organizationId: string | null) {
    if (await this.authorization.isSuperAdmin(userId)) return;
    if (!organizationId) throw new NotFoundException('سازمان مالک این رکورد پیدا نشد');
    await this.authorization.assertAnyOrganizationAccess(userId, [organizationId]);
  }

  // ------------------------------------------------------------- ذخیرۀ پاسخ

  /**
   * اعتبارسنجی پاسخ‌های پرسش‌ناما *پیش از* ساخت رکورد.
   * هدف: اگر کد معیار نامعتبر یا نامرتبط است، درخواست همان‌جا 400 شود و رکورد یتیم ساخته نشود.
   * «نمی‌دانم» (بدون level و value) بی‌صدا حذف می‌شود — هرگز صفر ثبت نمی‌شود.
   */
  normalizeIntake(subjectType: CriterionSubject, answers: unknown): SaveAnswersInput['answers'] {
    if (!Array.isArray(answers) || !answers.length) return [];
    const out: SaveAnswersInput['answers'] = [];
    for (const raw of answers as Array<Record<string, unknown>>) {
      const a = (raw ?? {}) as Record<string, unknown>;
      const code = String(a.criterionCode ?? '').toUpperCase();
      const criterion = CRITERIA_BY_CODE.get(code);
      if (!criterion) throw new BadRequestException(`معیار «${String(a.criterionCode ?? '')}» در کاتالوگ وجود ندارد.`);
      if (!criterion.appliesTo.includes(subjectType)) throw new BadRequestException(`معیار «${criterion.name}» برای ${subjectType} تعریف نشده است.`);
      const hasLevel = a.level != null && Number.isFinite(Number(a.level));
      const hasValue = a.value != null && Number.isFinite(Number(a.value));
      if (!hasLevel && !hasValue) continue;
      out.push({
        criterionCode: criterion.code,
        level: hasLevel ? Math.max(0, Math.min(5, Math.round(Number(a.level)))) : null,
        value: hasValue ? Number(a.value) : null,
        note: a.note ? String(a.note) : null,
        evidence: a.evidence ? String(a.evidence) : null,
        method: (a.method as SaveAnswersInput['answers'][number]['method']) ?? 'OWNER_ASSESSED',
        answeredAt: a.answeredAt ? String(a.answeredAt) : null,
      });
    }
    return out;
  }

  async saveAnswers(userId: string, input: SaveAnswersInput) {
    const subjectType = this.subject(input.subjectType);
    if (!input.subjectId) throw new BadRequestException('subjectId لازم است');
    const organizationId = await this.orgIdFor(subjectType, input.subjectId);
    await this.assertAccess(userId, subjectType, organizationId);
    await this.authorization.assertPermission(userId, subjectType === 'RELATIONSHIP' ? 'relationship.write' : 'entity.write', {
      organizationId: organizationId ?? undefined,
    });
    const answers = Array.isArray(input.answers) ? input.answers : [];
    if (!answers.length) throw new BadRequestException('دست‌کم یک پاسخ لازم است. اگر نمی‌دانید، این بخش را رد کنید.');
    const normalized: AnswerInput[] = [];
    for (const a of answers) {
      const criterion = CRITERIA_BY_CODE.get(String(a.criterionCode ?? '').toUpperCase());
      if (!criterion) throw new BadRequestException(`معیار «${a.criterionCode}» در کاتالوگ وجود ندارد.`);
      if (!criterion.appliesTo.includes(subjectType))
        throw new BadRequestException(`معیار «${criterion.name}» برای ${subjectType} تعریف نشده است.`);
      const anchors = scaleFor(criterion);
      const hasLevel = a.level != null && Number.isFinite(Number(a.level));
      const hasValue = a.value != null && Number.isFinite(Number(a.value));
      if (!hasLevel && !hasValue) {
        // «نمی‌دانم» = حذف پاسخ، نه صفر گذاشتن
        await this.prisma.criteriaAnswer.deleteMany({ where: { subjectType, subjectId: input.subjectId, criterionCode: criterion.code } });
        continue;
      }
      const level = hasLevel ? Math.max(0, Math.min(anchors.length - 1, Math.round(Number(a.level)))) : null;
      const value = hasValue ? clamp01_100(Number(a.value)) : null;
      if (value != null && (value < 0 || value > 100)) throw new BadRequestException('مقدار باید بین ۰ تا ۱۰۰ باشد.');
      normalized.push({
        criterionCode: criterion.code,
        level,
        value,
        note: a.note ? String(a.note).slice(0, 2000) : null,
        evidence: a.evidence ? String(a.evidence).slice(0, 1000) : null,
        method: (a.method ?? 'OWNER_ASSESSED') as AnswerInput['method'],
        answeredAt: a.answeredAt ? new Date(a.answeredAt) : new Date(),
      });
    }

    const saved = await this.eventBus.transaction(async (tx: any) => {
      const rows = [];
      for (const a of normalized) {
        const criterion = CRITERIA_BY_CODE.get(a.criterionCode)!;
        const row = await tx.criteriaAnswer.upsert({
          where: { subjectType_subjectId_criterionCode: { subjectType, subjectId: input.subjectId, criterionCode: a.criterionCode } },
          update: {
            level: a.level,
            value: a.value,
            note: a.note,
            evidence: a.evidence,
            evidenceRefs: (a as any).evidenceRefs ?? undefined,
            method: a.method,
            answeredAt: a.answeredAt,
            family: criterion.family,
            organizationId,
            source: input.source ?? 'MANUAL',
            reviewStatus: 'UNREVIEWED',
            answeredById: userId,
            deletedAt: null,
          },
          create: {
            subjectType,
            subjectId: input.subjectId,
            organizationId,
            criterionCode: a.criterionCode,
            family: criterion.family,
            level: a.level,
            value: a.value,
            note: a.note,
            evidence: a.evidence,
            method: a.method,
            answeredAt: a.answeredAt,
            source: input.source ?? 'MANUAL',
            answeredById: userId,
          },
        });
        rows.push(row);
      }
      if (input.replace) {
        const keep = new Set(normalized.map((n) => n.criterionCode));
        const existing = await tx.criteriaAnswer.findMany({ where: { subjectType, subjectId: input.subjectId, deletedAt: null }, select: { criterionCode: true } });
        const toRemove = existing.map((e: any) => e.criterionCode).filter((c: string) => !keep.has(c));
        if (toRemove.length) await tx.criteriaAnswer.deleteMany({ where: { subjectType, subjectId: input.subjectId, criterionCode: { in: toRemove } } });
      }
      await this.audit.logMutation(
        {
          userId,
          action: 'UPDATE',
          entityType: 'CriteriaAnswer',
          entityId: `${subjectType}:${input.subjectId}`,
          organizationId: organizationId ?? undefined,
          before: {},
          after: { answers: normalized.map((n) => ({ criterionCode: n.criterionCode, level: n.level, value: n.value })) },
          reason: input.source === 'INTAKE' ? 'criteria_intake' : 'criteria_assessment',
        },
        tx,
      );
      return rows;
    });

    const assessment = await this.assess(subjectType, input.subjectId, userId);
    await this.persistAssessment(userId, subjectType, input.subjectId, organizationId, assessment, input.source ?? 'MANUAL');
    if (input.syncScores !== false) await this.applyToSubject(userId, subjectType, input.subjectId, assessment);
    return { savedCount: saved.length, assessment: { ...assessment, summary: summarizeAssessment(assessment) } };
  }

  /** ذخیرۀ تصویر ارزیابی + صف بازبینی + پرچم‌ها. */
  private async persistAssessment(
    userId: string,
    subjectType: CriterionSubject,
    subjectId: string,
    organizationId: string | null,
    assessment: CriteriaAssessment,
    source: string,
  ) {
    const canonicalId = `criteria:${subjectType.toLowerCase()}:${subjectId}`;
    await this.eventBus.transaction(async (tx: any) => {
      await tx.criteriaSnapshot.create({
        data: {
          subjectType,
          subjectId,
          organizationId,
          modelVersion: `${CRITERIA_VERSION}+${source}`,
          score: assessment.score,
          rawScore: assessment.rawScore,
          coverage: assessment.coverage,
          confidence: assessment.confidence,
          uncertainty: assessment.uncertainty,
          rankable: assessment.rankable,
          flags: assessment.flags as any,
          payload: summarizeAssessment(assessment) as any,
          createdById: userId || undefined,
        },
      });
      await tx.score.upsert({
        where: { id: canonicalId },
        update: {
          type: 'CRITERIA',
          subjectType,
          subjectId,
          value: assessment.score,
          version: 1,
          explanation: `امتیاز معیارمحور (${assessment.knownCriteria}/${assessment.totalCriteria} معیار، پوشش ${assessment.coverage}٪، اطمینان ${assessment.confidence}٪)${
            assessment.flags.length ? `، ${assessment.flags.length} پرچم` : ''
          }. بازهٔ قابل‌انتظار ${assessment.rangeLow} تا ${assessment.rangeHigh}.`,
          metadata: { criteria: summarizeAssessment(assessment), breakdown: assessment.families } as any,
        },
        create: {
          id: canonicalId,
          type: 'CRITERIA',
          subjectType,
          subjectId,
          value: assessment.score,
          version: 1,
          explanation: `امتیاز معیارمحور (${assessment.knownCriteria}/${assessment.totalCriteria} معیار، پوشش ${assessment.coverage}٪، اطمینان ${assessment.confidence}٪)`,
          metadata: { criteria: summarizeAssessment(assessment), breakdown: assessment.families } as any,
        },
      });
      for (const item of assessment.reviewDue) {
        await tx.criteriaReviewTask.upsert({
          where: { subjectType_subjectId_criterionCode: { subjectType, subjectId, criterionCode: item.code } },
          update: { reason: item.reason, status: 'OPEN', dueAt: new Date(Date.now() + 14 * 86400000) },
          create: {
            subjectType,
            subjectId,
            organizationId,
            criterionCode: item.code,
            reason: item.reason,
            severity: 'MEDIUM',
            dueAt: new Date(Date.now() + 14 * 86400000),
          },
        });
      }
      const critical = assessment.flags.find((f) => f.severity === 'CRITICAL');
      if (critical && userId) {
        await tx.notification.create({
          data: {
            userId,
            type: 'ALERT',
            title: 'پرچم بحرانی در ارزیابی معیارها',
            body: critical.message,
            channel: 'IN_APP',
            priority: 'HIGH',
            deepLink: subjectType === 'RELATIONSHIP' ? `/relationships/${subjectId}` : `/${subjectType.toLowerCase()}s/${subjectId}`,
            data: { criterionCode: critical.criterionCode, subjectType, subjectId } as any,
          },
        }).catch(() => undefined);
      }
      await this.eventBus.publishInTransaction(tx, {
        eventType: DOMAIN_EVENT_TYPES.SCORE_UPDATED,
        aggregateType: subjectType,
        aggregateId: subjectId,
        organizationId: organizationId ?? undefined,
        actorId: userId,
        payload: { criteria: summarizeAssessment(assessment) } as any,
      });
      return undefined;
    });
  }

  /**
   * جاری‌سازی معیارها در کل پلتفرم: نتیجهٔ ارزیابی روی فیلدهای استنتاجی موجودیت
   * می‌نشیند تا فهرست‌ها، کارت‌ها، پیشنهادها و گزارش‌ها همان را ببینند.
   */
  private async applyToSubject(userId: string, subjectType: CriterionSubject, subjectId: string, assessment: CriteriaAssessment) {
    const known = new Map(assessment.criteria.filter((c) => c.value != null).map((c) => [c.code, c]));
    const num = (code: string) => known.get(code)?.value ?? null;
    const good = (code: string) => {
      const l = known.get(code);
      if (!l || l.value == null) return null;
      return clamp01_100(l.polarity === 'GOOD' ? l.value : 100 - l.value);
    };
    const bad = (...codes: string[]) => {
      const values = codes.map((code) => {
        const l = known.get(code);
        if (!l || l.value == null) return 0;
        return clamp01_100(l.polarity === 'BAD' ? l.value : 100 - l.value);
      });
      const max = Math.max(0, ...values);
      return values.some((v) => v > 0) ? max : null;
    };
    const avg = (...values: Array<number | null>) => {
      const list = values.filter((v): v is number => v != null);
      return list.length ? Math.round(list.reduce((sum, v) => sum + v, 0) / list.length) : null;
    };

    if (subjectType === 'RELATIONSHIP') {
      const data: Record<string, number> = {};
      const trust = good('REL_TRUST');
      if (trust != null) data.trustScore = trust;
      const strategic = avg(good('STRAT_POWER'), good('STRAT_FIT'));
      if (strategic != null) data.strategicScore = strategic;
      const access = avg(good('ACC_MULTITHREADING'), good('ACC_DECISION_ACCESS'));
      if (access != null) data.accessScore = access;
      const influence = avg(good('ACC_DECISION_ACCESS'), good('ACC_CHAMPION_POWER'));
      if (influence != null) data.influenceScore = influence;
      const opportunity = avg(good('VALUE_GROWTH'), good('VALUE_PIPELINE'), good('OPP_BUSINESS_CASE'));
      if (opportunity != null) data.opportunityScore = opportunity;
      const health = avg(good('CAP_DELIVERY'), good('REL_COMMITMENT'), good('ACC_RESPONSIVENESS'), trust ?? null);
      if (health != null) data.healthScore = health;
      const risk = bad('RISK_SANCTIONS_PEP', 'REL_OPPORTUNISM', 'RISK_CONCENTRATION', 'RISK_LEGAL', 'RISK_UBO');
      if (risk != null) data.riskScore = risk;
      if (Object.keys(data).length) {
        const current = await this.prisma.relationship
          .findUnique({ where: { id: subjectId }, select: { reviewCadenceDays: true, nextReviewAt: true } })
          .catch(() => null);
        const cadence = Math.max(7, Number(current?.reviewCadenceDays ?? 90));
        const days = assessment.reviewDue.length ? Math.min(14, cadence) : assessment.coverage < 40 ? Math.min(30, cadence) : cadence;
        (data as Record<string, unknown>).nextReviewAt = new Date(Date.now() + days * 86400000);
        await this.prisma.relationship
          .update({ where: { id: subjectId }, data: data as any })
          .catch(() => undefined);
      }
    } else if (subjectType === 'PERSON') {
      const data: Record<string, number> = {};
      const influence = avg(good('ACC_DECISION_ACCESS'), good('STRAT_POWER'));
      if (influence != null) data.influenceScore = influence;
      const decision = avg(good('ACC_CHAMPION_POWER'), good('ACC_DECISION_ROLE'));
      if (decision != null) data.decisionPower = decision;
      const accessibility = avg(good('ACC_RESPONSIVENESS'), good('ACC_MULTITHREADING'));
      if (accessibility != null) data.accessibilityScore = accessibility;
      if (Object.keys(data).length) await this.prisma.person.update({ where: { id: subjectId }, data }).catch(() => undefined);
    } else if (subjectType === 'OPPORTUNITY') {
      const coverage = num('ACC_MULTITHREADING');
      const committee = num('OPP_COMMITTEE_COVERAGE');
      const caseScore = num('OPP_BUSINESS_CASE');
      const access = num('ACC_DECISION_ACCESS');
      if (coverage != null || committee != null || caseScore != null) {
        const signals = [coverage, committee, caseScore, access].filter((v): v is number => v != null);
        const probability = signals.length ? clamp01_100(12 + (signals.reduce((sum, v) => sum + v, 0) / signals.length) * 0.68) : null;
        if (probability != null) await this.prisma.opportunity.update({ where: { id: subjectId }, data: { probability } }).catch(() => undefined);
      }
    }
    // ORGANIZATION: تصویر ارزیابی در Score و کارت‌ها خوانده می‌شود (سازمان ستون امتیاز ندارد).
    void userId;
  }

  // ------------------------------------------------------ بازبینی و کیفیت

  /** صف بازبینی: پاسخ‌های کهنه یا کم‌اطمینان، به‌همراه تقویم نیمه‌عمر. */
  async reviewQueue(userId: string, organizationId?: string) {
    const accessible = organizationId ? [organizationId] : ((await this.authorization.accessibleOrganizationIds(userId)) ?? undefined);
    const where: any = { status: 'OPEN', ...(accessible && accessible.length ? { organizationId: { in: accessible } } : {}) };
    const [tasks, stale] = await Promise.all([
      this.prisma.criteriaReviewTask.findMany({ where, orderBy: { dueAt: 'asc' }, take: 200 }),
      this.prisma.criteriaAnswer.findMany({
        where: { deletedAt: null, ...(accessible && accessible.length ? { organizationId: { in: accessible } } : {}) },
        orderBy: { answeredAt: 'asc' },
        take: 400,
      }),
    ]);
    const overdueAnswers = stale
      .map((row) => {
        const criterion = CRITERIA_BY_CODE.get(row.criterionCode);
        if (!criterion) return null;
        const age = Math.floor((Date.now() - row.answeredAt.getTime()) / 86400000);
        if (age < criterion.halfLifeDays) return null;
        return {
          subjectType: row.subjectType,
          subjectId: row.subjectId,
          criterionCode: row.criterionCode,
          name: criterion.name,
          age,
          dueInDays: criterion.halfLifeDays - age,
          reason: age > criterion.halfLifeDays * 2 ? 'اعتبار پاسخ گذشته (بیش از دو نیمه‌عمر)' : 'نزدیک به پایان اعتبار پاسخ',
        };
      })
      .filter(Boolean)
      .slice(0, 100);
    return { tasks, staleAnswers: overdueAnswers, total: tasks.length + overdueAnswers.length };
  }

  /** کیفیت کاوراژ معیارها برای یک سازمان (چند سوژه آمادهٔ رتبه‌بندی است). */
  async coverageReport(userId: string, organizationId: string, subjectType: string) {
    const subject = this.subject(subjectType);
    await this.authorization.assertAnyOrganizationAccess(userId, [organizationId]);
    const ids =
      subject === 'ORGANIZATION'
        ? (await this.prisma.organization.findMany({ where: { id: organizationId }, select: { id: true } })).map((r) => r.id)
        : subject === 'PERSON'
          ? (await this.prisma.person.findMany({ where: { organizationId, deletedAt: null }, select: { id: true }, take: 200 })).map((r) => r.id)
          : (
              await this.prisma.relationship.findMany({
                where: { deletedAt: null, sourceOrganizationId: organizationId },
                select: { id: true },
                take: 200,
              })
            ).map((r) => r.id);
    const answers = ids.length
      ? await this.prisma.criteriaAnswer.groupBy({ by: ['subjectId'], where: { subjectType: subject, subjectId: { in: ids }, deletedAt: null }, _count: { _all: true } })
      : [];
    const bySubject = new Map<string, number>(answers.map((a) => [a.subjectId, Number(a._count._all)]));
    const minForRanking = Math.ceil(criteriaFor(subject).length * 0.35);
    const rows = ids.map((id) => ({
      subjectId: id,
      answered: bySubject.get(id) ?? 0,
      ready: (bySubject.get(id) ?? 0) >= minForRanking,
    }));
    return {
      subjectType: subject,
      assessed: rows.filter((r) => r.answered > 0).length,
      rankable: rows.filter((r) => r.ready).length,
      total: rows.length,
      minAnswersForRanking: minForRanking,
      rows: rows.sort((a, b) => a.answered - b.answered).slice(0, 50),
    };
  }

  /** جمع‌بندی آمادهٔ نمایش برای فهرست‌ها (بدون محاسبهٔ مجدد — از Score ذخیره‌شده خوانده می‌شود). */
  async summaries(subjectType: CriterionSubject, subjectIds: string[]) {
    const ids = [...new Set(subjectIds.filter(Boolean))];
    if (!ids.length) return new Map<string, any>();
    const rows = await this.prisma.score
      .findMany({ where: { type: 'CRITERIA', subjectType, subjectId: { in: ids } }, select: { subjectId: true, value: true, metadata: true, updatedAt: true } })
      .catch(() => [] as any[]);
    return new Map(
      rows.map((row: any) => {
        const summary = (row.metadata as any)?.criteria ?? {};
        return [
          row.subjectId,
          {
            ...summary,
            score: row.value ?? summary.score ?? null,
            updatedAt: row.updatedAt,
            version: CRITERIA_VERSION,
          },
        ];
      }),
    );
  }

  // --------------------------------------------------- تنظیم مدل (مدیریتی)

  /** وزن‌های فعال یک سازمان به‌همراه کاتالوگ، تا رابط مدیریتی داده‌محور بماند. */
  async listOverrides(userId: string, organizationId: string) {
    await this.authorization.assertAnyOrganizationAccess(userId, [organizationId]);
    const rows = await this.prisma.criteriaOverride.findMany({ where: { OR: [{ organizationId }, { organizationId: null }] }, orderBy: { updatedAt: 'desc' } });
    return {
      version: CRITERIA_VERSION,
      defaults: FAMILY_WEIGHTS,
      organizationId,
      overrides: rows.map((r) => ({
        id: r.id,
        subjectType: r.subjectType,
        scope: r.scope,
        familyWeights: r.familyWeights,
        criterionWeights: r.criterionWeights,
        minCoverageForRanking: r.minCoverageForRanking,
        enabled: r.enabled,
        isLocal: r.organizationId === organizationId,
        updatedAt: r.updatedAt,
      })),
      families: (Object.keys(FAMILY_META) as (keyof typeof FAMILY_META)[]).map((key) => ({ key, ...FAMILY_META[key] })),
    };
  }

  async saveOverride(userId: string, organizationId: string, body: { subjectType?: string; scope?: string; familyWeights?: Record<string, number>; minCoverageForRanking?: number; enabled?: boolean }) {
    await this.authorization.assertPermission(userId, 'admin.catalog', { organizationId });
    const subjectType = this.subject(String(body.subjectType ?? 'RELATIONSHIP'));
    const scope = String(body.scope ?? 'DEFAULT').slice(0, 40);
    const incoming = (body.familyWeights ?? {}) as Record<string, unknown>;
    const merged = { ...FAMILY_WEIGHTS[subjectType] };
    for (const key of Object.keys(merged) as (keyof typeof merged)[]) {
      const value = Number(incoming[key]);
      if (Number.isFinite(value) && value >= 0 && value <= 1) merged[key] = value;
    }
    const total = Object.values(merged).reduce((sum, v) => sum + v, 0);
    if (total <= 0) throw new BadRequestException('مجموع وزن خانواده‌ها باید بزرگ‌تر از صفر باشد.');
    const normalized = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, Math.round((v / total) * 10000) / 10000])) as Record<string, number>;
    const minCoverage = Math.max(0, Math.min(100, Math.round(Number(body.minCoverageForRanking ?? 40) || 40)));
    const row = await this.prisma.criteriaOverride.upsert({
      where: { organizationId_subjectType_scope: { organizationId, subjectType, scope } },
      update: { familyWeights: normalized as any, minCoverageForRanking: minCoverage, enabled: body.enabled !== false, updatedById: userId },
      create: { organizationId, subjectType, scope, familyWeights: normalized as any, minCoverageForRanking: minCoverage, enabled: body.enabled !== false, updatedById: userId },
    });
    await this.audit.logMutation({
      userId,
      action: 'UPDATE',
      entityType: 'CriteriaOverride',
      entityId: row.id,
      organizationId,
      before: {},
      after: { subjectType, scope, familyWeights: normalized, minCoverageForRanking: minCoverage },
      reason: 'criteria_weights_updated',
    });
    return { id: row.id, subjectType, scope, familyWeights: normalized, minCoverageForRanking: minCoverage, enabled: row.enabled };
  }
}
