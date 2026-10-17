import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { ScoringBaseService, clampScore } from './scoring-base.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ConnectorScoreService extends ScoringBaseService {
  constructor(prisma: PrismaService, eventBus: EventBusService, private readonly authorization: AuthorizationService, audit: AuditService) { super(prisma, eventBus, audit); }

  async calculate(userId: string, personId: string, persist = true) {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!person || person.deletedAt) throw new NotFoundException('Person not found');
    await this.authorization.assertPermission(userId, 'person.read', { organizationId: person.organizationId });
    const [relationshipAgg, referralGroups] = await Promise.all([
      this.prisma.personRelationship.aggregate({ where: { OR: [{ sourcePersonId: personId }, { targetPersonId: personId }], deletedAt: null }, _count: { _all: true }, _avg: { healthScore: true, trustScore: true, accessScore: true, influenceScore: true } }),
      this.prisma.referral.groupBy({ by: ['status'], where: { sourcePersonId: personId, deletedAt: null }, _count: { _all: true } }),
    ]);
    const totalConnections = relationshipAgg._count._all;
    const connectionBreadth = clampScore(totalConnections * 8);
    const relationshipQuality = totalConnections ? clampScore(((relationshipAgg._avg.healthScore ?? 0) + (relationshipAgg._avg.trustScore ?? 0) + (relationshipAgg._avg.accessScore ?? 0)) / 3) : 0;
    const relationshipInfluence = totalConnections ? clampScore(relationshipAgg._avg.influenceScore ?? 0) : 0;
    const organizationLevel = clampScore(person.influenceScore * 0.45 + person.decisionPower * 0.35 + person.accessibilityScore * 0.2);
    const referralCount = referralGroups.reduce((sum, row) => sum + row._count._all, 0);
    const successfulReferrals = referralGroups.filter(r => r.status === 'COMPLETED' || r.status === 'ACCEPTED').reduce((sum, row) => sum + row._count._all, 0);
    const referralSuccess = referralCount ? clampScore(successfulReferrals / referralCount * 100) : 0;
    const active = await this.activeVersion('CONNECTOR');
    const weights = { connections: .2, quality: .25, organizationLevel: .2, influence: .15, referrals: .2, ...(active.weights as any) };
    const score = clampScore(connectionBreadth * weights.connections + relationshipQuality * weights.quality + organizationLevel * weights.organizationLevel + relationshipInfluence * weights.influence + referralSuccess * weights.referrals);
    const result = { score, version: active.version?.version ?? 1, versionId: active.version?.id, type: 'CONNECTOR' as const, subjectType: 'Person', subjectId: personId, explanation: 'Connector score combines connection count, relationship quality, organization level, influence and successful referral activity using the active version.', factors: { totalConnections, connectionBreadth, relationshipQuality, organizationLevel, relationshipInfluence, referralCount, successfulReferrals, referralSuccess } };
    return persist ? this.persist(userId, result, person.organizationId) : result;
  }
}
