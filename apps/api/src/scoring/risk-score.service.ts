import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { ScoringBaseService, clampScore } from './scoring-base.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RiskScoreService extends ScoringBaseService {
  constructor(prisma: PrismaService, eventBus: EventBusService, private readonly authorization: AuthorizationService, audit: AuditService) { super(prisma, eventBus, audit); }

  async calculate(userId: string, relationshipId: string, persist = true) {
    const relationship = await this.prisma.relationship.findUnique({ where: { id: relationshipId } });
    if (!relationship || relationship.deletedAt) throw new NotFoundException('Relationship not found');
    await this.authorization.assertAnyOrganizationAccess(userId, [relationship.sourceOrganizationId, relationship.targetOrganizationId]);
    const latest = await this.prisma.interaction.findFirst({ where: { relationshipId, deletedAt: null }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } });
    const daysSince = latest ? Math.max(0, (Date.now() - latest.occurredAt.getTime()) / 86400000) : 365;
    const recencyRisk = clampScore(daysSince * 1.1);
    const resilienceRisk = clampScore(100 - relationship.resilienceScore);
    const configuredRisk = clampScore(relationship.riskScore);
    const active = await this.activeVersion('RISK');
    const weights = { configuredRisk: .6, resilienceRisk: .2, recencyRisk: .2, ...(active.weights as any) };
    const score = clampScore(configuredRisk * weights.configuredRisk + resilienceRisk * weights.resilienceRisk + recencyRisk * weights.recencyRisk);
    const result = { score, version: active.version?.version ?? 1, versionId: active.version?.id, type: 'RISK' as const, subjectType: 'Relationship', subjectId: relationshipId, explanation: 'Risk score combines configured risk, resilience exposure and interaction recency.', factors: { configuredRisk, resilienceRisk, recencyRisk, daysSinceLastInteraction: Math.round(daysSince) } };
    return persist ? this.persist(userId, result, relationship.sourceOrganizationId) : result;
  }
}
