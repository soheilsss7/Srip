import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { ScoringBaseService, clampScore } from './scoring-base.service';
import { AuditService } from '../audit/audit.service';
import { Prisma } from '@prisma/client';

export const RELATIONSHIP_SCORE_FACTORS = [
  'strategicValue',
  'economicValue',
  'influence',
  'trust',
  'access',
  'engagement',
  'recency',
  'diversity',
  'responsiveness',
  'commitmentReliability',
  'opportunityPotential',
  'risk',
] as const;

type RelationshipFactor = typeof RELATIONSHIP_SCORE_FACTORS[number];
type WeightMap = Record<RelationshipFactor, number>;

const DEFAULT_RELATIONSHIP_WEIGHTS: WeightMap = Object.fromEntries(
  RELATIONSHIP_SCORE_FACTORS.map((factor) => [factor, 1]),
) as WeightMap;

const asNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clampWeight = (value: unknown) => Math.max(0, asNumber(value, 0));

function normalizeWeights(input: Record<string, unknown> | undefined): WeightMap {
  const source = input ?? {};
  const merged = { ...DEFAULT_RELATIONSHIP_WEIGHTS } as WeightMap;
  for (const factor of RELATIONSHIP_SCORE_FACTORS) {
    if (Object.prototype.hasOwnProperty.call(source, factor)) merged[factor] = clampWeight(source[factor]);
  }
  const total = RELATIONSHIP_SCORE_FACTORS.reduce((sum, factor) => sum + merged[factor], 0);
  if (total <= 0) return { ...DEFAULT_RELATIONSHIP_WEIGHTS };
  return Object.fromEntries(RELATIONSHIP_SCORE_FACTORS.map((factor) => [factor, merged[factor] / total])) as WeightMap;
}

function extractWeights(weights: unknown): Record<string, unknown> {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) return {};
  const raw = weights as Record<string, unknown>;
  // ScoreVersion may contain either direct weights or industry-specific weights.
  if (raw.default && typeof raw.default === 'object' && !Array.isArray(raw.default)) return raw.default as Record<string, unknown>;
  return raw;
}

function industryWeights(weights: unknown, industries: string[]): Record<string, unknown> | undefined {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) return undefined;
  const raw = weights as Record<string, unknown>;
  const byIndustry = raw.industries;
  if (!byIndustry || typeof byIndustry !== 'object' || Array.isArray(byIndustry)) return undefined;
  const map = byIndustry as Record<string, unknown>;
  for (const industry of industries.filter(Boolean)) {
    const exact = map[industry];
    if (exact && typeof exact === 'object' && !Array.isArray(exact)) return exact as Record<string, unknown>;
    const key = Object.keys(map).find((k) => k.toLowerCase() === industry.toLowerCase());
    if (key && map[key] && typeof map[key] === 'object' && !Array.isArray(map[key])) return map[key] as Record<string, unknown>;
  }
  return undefined;
}

@Injectable()
export class CanonicalRelationshipScoreService extends ScoringBaseService {
  constructor(
    prisma: PrismaService,
    eventBus: EventBusService,
    private readonly authorization: AuthorizationService,
    audit: AuditService,
  ) { super(prisma, eventBus, audit); }

  private async resolveWeights(versionWeights: unknown, organizationId: string, sourceIndustry?: string | null, targetIndustry?: string | null): Promise<WeightMap> {
    const industries = [targetIndustry, sourceIndustry].filter((x): x is string => Boolean(x));
    const base = extractWeights(versionWeights);
    let selected: Record<string, unknown> = base;

    const scopedIndustry = industryWeights(versionWeights, industries);
    if (scopedIndustry) {
      selected = { ...base, ...scopedIndustry };
      const otherWeight = typeof scopedIndustry.otherWeight === 'number' ? scopedIndustry.otherWeight : undefined;
      if (otherWeight !== undefined) {
        const explicitlyConfigured = new Set(Object.keys(scopedIndustry).filter(k => k !== 'otherWeight'));
        const remaining = RELATIONSHIP_SCORE_FACTORS.filter(f => !explicitlyConfigured.has(f));
        if (remaining.length) {
          const perFactor = otherWeight / remaining.length;
          for (const factor of remaining) selected[factor] = perFactor;
        }
        delete selected.otherWeight;
      }
    }

    // ScoringRule is the admin-configurable override layer. It is intentionally
    // data-driven so changing weights never requires a code deployment.
    const rules = await this.prisma.scoringRule.findMany({
      where: {
        entityType: 'Relationship',
        scoreType: 'RELATIONSHIP',
        active: true,
        OR: [{ organizationId }, { organizationId: null }],
      },
      orderBy: [{ organizationId: 'desc' }, { updatedAt: 'desc' }],
      select: { definition: true, weight: true, organizationId: true },
    });

    for (const rule of rules) {
      const definition = (rule.definition && typeof rule.definition === 'object' && !Array.isArray(rule.definition))
        ? rule.definition as Record<string, unknown>
        : {};
      const scopeIndustry = typeof definition.industry === 'string' ? definition.industry : undefined;
      if (scopeIndustry && !industries.some((x) => x.toLowerCase() === scopeIndustry.toLowerCase())) continue;
      const ruleWeights = definition.weights;
      if (ruleWeights && typeof ruleWeights === 'object' && !Array.isArray(ruleWeights)) {
        selected = { ...selected, ...(ruleWeights as Record<string, unknown>) };
      } else if (typeof definition.factor === 'string' && RELATIONSHIP_SCORE_FACTORS.includes(definition.factor as RelationshipFactor)) {
        selected = { ...selected, [definition.factor]: rule.weight };
      }
    }

    return normalizeWeights(selected);
  }

  async calculate(userId: string, relationshipId: string, persist = true) {
    const relationship = await this.prisma.relationship.findUnique({
      where: { id: relationshipId },
      include: { sourceOrganization: { select: { id: true, industry: true } }, targetOrganization: { select: { id: true, industry: true } } },
    });
    if (!relationship || relationship.deletedAt) throw new NotFoundException('Relationship not found');
    await this.authorization.assertAnyOrganizationAccess(userId, [relationship.sourceOrganizationId, relationship.targetOrganizationId]);

    const since = new Date(Date.now() - 180 * 86400000);
    const interactionTypeRows = await this.prisma.interaction.groupBy({ by: ['type'], where: { relationshipId, deletedAt: null, occurredAt: { gte: since } } });
    const interactionPeopleRows = await this.prisma.interaction.groupBy({ by: ['personId'], where: { relationshipId, deletedAt: null, occurredAt: { gte: since }, personId: { not: null } } });
    const [interactionCount, meetings, latest, active, opportunityAgg, commitmentAgg, interactionTypeCount, peopleCount, outcomeInteractions] = await Promise.all([
      this.prisma.interaction.count({ where: { relationshipId, deletedAt: null, occurredAt: { gte: since } } }),
      this.prisma.meeting.count({ where: { relationshipId, deletedAt: null, startAt: { gte: since } } }),
      this.prisma.interaction.findFirst({ where: { relationshipId, deletedAt: null }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
      this.activeVersion('RELATIONSHIP'),
      this.prisma.opportunity.aggregate({ where: { relationshipId, deletedAt: null }, _count: { _all: true }, _sum: { value: true }, _avg: { probability: true } }),
      this.prisma.$queryRaw<Array<{ total: bigint; completed: bigint; nonCancelled: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS total, COUNT(*) FILTER (WHERE status = 'FULFILLED' AND ("dueAt" IS NULL OR "completionAt" IS NULL OR "completionAt" <= "dueAt"))::bigint AS completed, COUNT(*) FILTER (WHERE status <> 'CANCELLED')::bigint AS "nonCancelled" FROM "Commitment" WHERE "relationshipId" = ${relationshipId} AND "deletedAt" IS NULL`),
      interactionTypeRows.length,
      interactionPeopleRows.length,
      this.prisma.interaction.count({ where: { relationshipId, deletedAt: null, occurredAt: { gte: since }, outcome: { not: null } } }),
    ]);

    const daysSince = latest ? Math.max(0, (Date.now() - latest.occurredAt.getTime()) / 86400000) : 365;
    const engagement = clampScore(interactionCount * 4 + meetings * 8);
    const recency = clampScore(100 - daysSince * 1.1);
    const strategicValue = clampScore(relationship.strategicScore);
    const influence = clampScore(relationship.influenceScore);
    const trust = clampScore(relationship.trustScore);
    const access = clampScore(relationship.accessScore);

    const opportunityCount = opportunityAgg._count._all;
    const economicValue = clampScore(Math.log10(Math.max(1, Number(opportunityAgg._sum.value ?? 0))) * 20);
    const opportunityPotential = opportunityCount === 0 ? clampScore(relationship.opportunityScore) : clampScore(Number(opportunityAgg._avg.probability ?? 0));
    const diversity = clampScore(((interactionTypeCount / 5) * 70) + ((peopleCount / 5) * 30));
    const responsiveness = interactionCount === 0 ? 0 : clampScore((outcomeInteractions / interactionCount) * 100);

    const commitmentStats = commitmentAgg[0] ?? { completed: 0n, nonCancelled: 0n, total: 0n };
    const completedCommitments = Number(commitmentStats.completed);
    const reliabilityDenominator = Number(commitmentStats.nonCancelled);
    const commitmentReliability = reliabilityDenominator === 0 ? 50 : clampScore((completedCommitments / reliabilityDenominator) * 100);
    const risk = clampScore(100 - relationship.riskScore);

    const weights = await this.resolveWeights(active.version?.weights, relationship.sourceOrganizationId, relationship.sourceOrganization.industry, relationship.targetOrganization.industry);
    const factors: Record<RelationshipFactor, number> = {
      strategicValue, economicValue, influence, trust, access, engagement, recency, diversity,
      responsiveness, commitmentReliability, opportunityPotential, risk,
    };
    const score = clampScore(RELATIONSHIP_SCORE_FACTORS.reduce((sum, factor) => sum + factors[factor] * weights[factor], 0));

    const result = {
      score,
      version: active.version?.version ?? 1,
      versionId: active.version?.id,
      type: 'RELATIONSHIP' as const,
      subjectType: 'Relationship',
      subjectId: relationshipId,
      explanation: 'Relationship score combines all canonical relationship factors using normalized, configurable weights from the active score version and applicable admin scoring rules.',
      factors: {
        ...factors,
        weights,
        interactions180d: interactionCount,
        meetings180d: meetings,
        daysSinceLastInteraction: Math.round(daysSince),
        interactionTypeCount,
        connectedPeople180d: peopleCount,
        opportunityCount,
        commitmentCount: reliabilityDenominator,
      },
    };
    return persist ? this.persist(userId, result, relationship.sourceOrganizationId) : result;
  }
}
