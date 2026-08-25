import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { NetworkService } from '../network/network.service';
import { CanonicalRelationshipScoreService } from '../scoring/relationship-score.service';
import { RiskScoreService } from '../scoring/risk-score.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const DEFAULT_WEIGHTS = { trust: 0.2, access: 0.2, influence: 0.2, engagement: 0.2, recency: 0.2 };

@Injectable()
export class IntelligenceService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly network: NetworkService, private readonly relationshipScore: CanonicalRelationshipScoreService, private readonly riskScore: RiskScoreService) {}

  private async getRelationship(userId: string, id: string) {
    const r = await this.prisma.relationship.findUnique({ where: { id } });
    if (!r || r.deletedAt) throw new NotFoundException('Relationship not found');
    await this.authorization.assertAnyOrganizationAccess(userId, [r.sourceOrganizationId, r.targetOrganizationId]);
    return EntityResponseDto.fromUnknown(r);
  }

  async explain(userId: string, id: string) {
    const r = await this.getRelationship(userId, id);
    const [relationshipScore, riskScore] = await Promise.all([
      this.relationshipScore.calculate(userId, id, false),
      this.riskScore.calculate(userId, id, false),
    ]);
    const strategic = clamp((r.opportunityScore + r.resilienceScore + r.influenceScore + r.accessScore) / 4);
    const factors = relationshipScore.factors;
    return {
      relationshipId: id,
      scoreVersion: relationshipScore.version,
      scores: {
        health: relationshipScore.score,
        strategic,
        risk: riskScore.score,
        trust: r.trustScore,
        access: r.accessScore,
        influence: r.influenceScore,
        opportunity: r.opportunityScore,
        resilience: r.resilienceScore,
        engagement: Number(factors.engagement ?? 0),
      },
      factors: {
        interactions180d: Number(factors.interactions180d ?? 0),
        meetings180d: Number(factors.meetings180d ?? 0),
        daysSinceLastInteraction: Number(factors.daysSinceLastInteraction ?? 365),
        recency: Number(factors.recency ?? 0),
        risk: riskScore.score,
      },
      versionIds: { relationship: relationshipScore.versionId ?? null, risk: riskScore.versionId ?? null },
      explanation: [
        'Relationship health is calculated by the canonical RelationshipScoreService.',
        'Risk is calculated by the canonical RiskScoreService.',
        'Strategic score remains a relationship intelligence breakdown derived from opportunity, resilience, influence and access.',
      ],
    };
  }

  async recalculate(userId: string, id: string, reason = 'intelligence-recalculation') {
    const [relationshipScore, riskScore, explanation] = await Promise.all([
      this.relationshipScore.calculate(userId, id, true),
      this.riskScore.calculate(userId, id, true),
      this.explain(userId, id),
    ]);
    const updated = await this.prisma.relationship.update({ where: { id }, data: {
      healthScore: relationshipScore.score,
      riskScore: riskScore.score,
      engagementScore: Number(relationshipScore.factors.engagement ?? 0),
      strategicScore: explanation.scores.strategic,
      lastInteractionAt: Number(relationshipScore.factors.daysSinceLastInteraction ?? 365) < 365 ? new Date(Date.now() - Number(relationshipScore.factors.daysSinceLastInteraction) * 86400000) : undefined,
    }});
    await this.prisma.relationshipScoreSnapshot.create({ data: { relationshipId: id, healthScore: updated.healthScore, strategicScore: updated.strategicScore, riskScore: updated.riskScore, trustScore: updated.trustScore, accessScore: updated.accessScore, influenceScore: updated.influenceScore, opportunityScore: updated.opportunityScore, resilienceScore: updated.resilienceScore, engagementScore: updated.engagementScore, reason: `${reason};relationshipVersion=${relationshipScore.version};riskVersion=${riskScore.version}` } });
    return { relationship: updated, explanation, canonicalScores: { relationship: relationshipScore, risk: riskScore } };
  }

  async history(userId: string, id: string, limit = 30) { await this.getRelationship(userId, id); return EntityResponseDto.manyUnknown(await this.prisma.relationshipScoreSnapshot.findMany({ where: { relationshipId: id }, orderBy: { createdAt: 'desc' }, take: Math.max(1, Math.min(100, limit)) })); }

  async riskSignals(userId: string, organizationId?: string) {
    const ids = await this.authorization.accessibleOrganizationIds(userId); const scope = organizationId ? (ids ? (ids.includes(organizationId) ? [organizationId] : []) : [organizationId]) : ids;
    const relationships = await this.prisma.relationship.findMany({ where: { deletedAt: null, OR: [{ sourceOrganizationId: { in: scope } }, { targetOrganizationId: { in: scope } }] }, orderBy: [{ riskScore: 'desc' }, { healthScore: 'asc' }], take: 100 });
    return relationships.map(r => ({ relationshipId: r.id, riskScore: r.riskScore, healthScore: r.healthScore, resilienceScore: r.resilienceScore, lastInteractionAt: r.lastInteractionAt, signals: [...(r.riskScore >= 70 ? ['high-risk-score'] : []), ...(r.healthScore <= 40 ? ['low-health'] : []), ...(r.resilienceScore <= 40 ? ['low-resilience'] : []), ...(!r.lastInteractionAt || Date.now() - r.lastInteractionAt.getTime() > 90 * 86400000 ? ['relationship-decay'] : [])] }));
  }

  async scoreVersions(userId: string) {
    await this.authorization.assertPermission(userId, 'relationship.read', {});
    return EntityResponseDto.manyUnknown(await this.prisma.scoreVersion.findMany({ orderBy: [{ name: 'asc' }, { version: 'desc' }] }));
  }

  async createScoreVersion(userId: string, name: string, weights: Record<string, number>, notes?: string) {
    await this.authorization.assertPermission(userId, 'relationship.write', {});
    const latest = await this.prisma.scoreVersion.findFirst({ where: { name }, orderBy: { version: 'desc' } });
    const version = (latest?.version ?? 0) + 1;
    return EntityResponseDto.fromUnknown(await this.prisma.scoreVersion.create({ data: { name, version, status: 'DRAFT', weights, calibrationNotes: notes, createdById: userId } }));
  }

  async activateScoreVersion(userId: string, id: string) {
    await this.authorization.assertPermission(userId, 'relationship.write', {});
    const target = await this.prisma.scoreVersion.findUnique({ where: { id } }); if (!target) throw new NotFoundException('Score version not found');
    await this.prisma.$transaction([
      this.prisma.scoreVersion.updateMany({ where: { name: target.name, status: 'ACTIVE' }, data: { status: 'ARCHIVED' } }),
      this.prisma.scoreVersion.update({ where: { id }, data: { status: 'ACTIVE' } }),
    ]);
    return EntityResponseDto.fromUnknown(await this.prisma.scoreVersion.findUnique({ where: { id } }));
  }

  async calibrate(userId: string, scoreVersionId: string, relationshipId: string | undefined, observedOutcome: string, expectedScore: number, observedScore: number, notes?: string) {
    await this.authorization.assertPermission(userId, 'relationship.write', {});
    if (relationshipId) await this.getRelationship(userId, relationshipId);
    return EntityResponseDto.fromUnknown(await this.prisma.scoreCalibration.create({ data: { scoreVersionId, relationshipId, observedOutcome, expectedScore: clamp(expectedScore), observedScore: clamp(observedScore), notes } }));
  }

  async calibrationSummary(userId: string, scoreVersionId: string) {
    await this.authorization.assertPermission(userId, 'relationship.read', {});
    const rows = await this.prisma.scoreCalibration.findMany({ where: { scoreVersionId }, select: { expectedScore: true, observedScore: true, observedOutcome: true }, take: 10000 });
    const mae = rows.length ? rows.reduce((sum, r) => sum + Math.abs(r.expectedScore - r.observedScore), 0) / rows.length : 0;
    const distinctOutcomes = [...new Set(rows.map(r => r.observedOutcome))];
    return { scoreVersionId, samples: rows.length, bounded: true, maxSamples: 10000, meanAbsoluteError: Math.round(mae * 100) / 100, outcomes: distinctOutcomes }; 
  }

  async opportunityDetection(userId: string, organizationId?: string) {
    const ids = await this.authorization.accessibleOrganizationIds(userId); const scope = organizationId ? (ids ? (ids.includes(organizationId) ? [organizationId] : []) : [organizationId]) : ids;
    const relationships = await this.prisma.relationship.findMany({ where: { deletedAt: null, OR: [{ sourceOrganizationId: { in: scope } }, { targetOrganizationId: { in: scope } }] }, select: { id:true, sourceOrganizationId:true, targetOrganizationId:true, opportunityScore:true, healthScore:true, strategicScore:true }, orderBy: [{ opportunityScore:'desc' }, { healthScore:'desc' }], take: 5000 });
    const opportunities = await this.prisma.opportunity.findMany({ where: { deletedAt: null, organizationId: { in: scope } }, select: { relationshipId:true }, take: 10000 });
    const linked = new Set(opportunities.map(o => o.relationshipId).filter(Boolean));
    return relationships.filter(r => r.opportunityScore >= 60 && r.healthScore >= 45 && !linked.has(r.id)).map(r => ({ relationshipId: r.id, type: 'RELATIONSHIP_OPPORTUNITY', confidence: clamp((r.opportunityScore + r.healthScore + r.strategicScore) / 3), evidence: { opportunityScore: r.opportunityScore, healthScore: r.healthScore, strategicScore: r.strategicScore }, reason: 'High opportunity and healthy relationship without a linked active opportunity', sourceOrganizationId: r.sourceOrganizationId, targetOrganizationId: r.targetOrganizationId }));
  }

  async strategicCoverage(userId: string, organizationId?: string) {
    const ids = await this.authorization.accessibleOrganizationIds(userId); const scope = organizationId ? (ids ? (ids.includes(organizationId) ? [organizationId] : []) : [organizationId]) : ids;
    const [strategicRelationships, healthyStrategicRelationships, resilientStrategicRelationships] = await Promise.all([
      this.prisma.relationship.count({ where: { deletedAt: null, strategicScore: { gte: 60 }, OR: [{ sourceOrganizationId: { in: scope } }, { targetOrganizationId: { in: scope } }] } }),
      this.prisma.relationship.count({ where: { deletedAt: null, strategicScore: { gte: 60 }, healthScore: { gte: 60 }, OR: [{ sourceOrganizationId: { in: scope } }, { targetOrganizationId: { in: scope } }] } }),
      this.prisma.relationship.count({ where: { deletedAt: null, strategicScore: { gte: 60 }, resilienceScore: { gte: 60 }, OR: [{ sourceOrganizationId: { in: scope } }, { targetOrganizationId: { in: scope } }] } }),
    ]);
    return { scopeOrganizations: scope.length, strategicRelationships, healthyStrategicRelationships, resilientStrategicRelationships, coveragePercent: strategicRelationships ? clamp(healthyStrategicRelationships / strategicRelationships * 100) : 100, bounded: true }; 
  }

  async networkIntelligence(userId: string, organizationId?: string) {
    const [centrality, bridges, bottlenecks, singlePoints] = await Promise.all([this.network.centrality(userId, organizationId, 10), this.network.bridgePeople(userId, organizationId, 10), this.network.bottlenecks(userId, organizationId, 10), this.network.singlePointsOfFailure(userId, organizationId, 10)]);
    return { centrality, bridgePeople: bridges, bottlenecks, singlePointsOfFailure: singlePoints };
  }
}
