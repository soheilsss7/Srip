import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { ScoringBaseService, clampScore } from './scoring-base.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class NetworkScoreService extends ScoringBaseService {
  constructor(prisma: PrismaService, eventBus: EventBusService, private readonly authorization: AuthorizationService, audit: AuditService) { super(prisma, eventBus, audit); }

  async calculate(userId: string, organizationId: string, persist = true) {
    await this.authorization.assertPermission(userId, 'network.read', { organizationId: organizationId });
    const [relationshipAgg, people, opportunities] = await Promise.all([
      this.prisma.relationship.aggregate({ where: { deletedAt: null, OR: [{ sourceOrganizationId: organizationId }, { targetOrganizationId: organizationId }] }, _count: { _all: true }, _avg: { healthScore: true, trustScore: true, accessScore: true, resilienceScore: true } }),
      this.prisma.person.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.opportunity.count({ where: { organizationId, deletedAt: null } }),
    ]);
    const relationshipCount = relationshipAgg._count._all;
    const strength = relationshipCount ? ((relationshipAgg._avg.healthScore ?? 0) + (relationshipAgg._avg.trustScore ?? 0) + (relationshipAgg._avg.accessScore ?? 0)) / 3 : 0;
    const resilience = relationshipCount ? (relationshipAgg._avg.resilienceScore ?? 0) : 0;
    const opportunityCoverage = clampScore(opportunities * 10);
    const peopleCoverage = clampScore(people * 5);
    const active = await this.activeVersion('NETWORK');
    const weights = { strength: .45, resilience: .25, opportunityCoverage: .15, peopleCoverage: .15, ...(active.weights as any) };
    const score = clampScore(strength * weights.strength + resilience * weights.resilience + opportunityCoverage * weights.opportunityCoverage + peopleCoverage * weights.peopleCoverage);
    const result = { score, version: active.version?.version ?? 1, versionId: active.version?.id, type: 'NETWORK' as const, subjectType: 'Organization', subjectId: organizationId, explanation: 'Network score combines relationship strength, resilience, opportunity coverage and people coverage using the active version.', factors: { relationshipCount: relationshipCount, peopleCount: people, opportunityCount: opportunities, strength: clampScore(strength), resilience: clampScore(resilience), opportunityCoverage, peopleCoverage } };
    return persist ? this.persist(userId, result, organizationId) : result;
  }
}
