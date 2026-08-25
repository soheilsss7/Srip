import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { ScoringBaseService, clampScore } from './scoring-base.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OpportunityScoreService extends ScoringBaseService {
  constructor(prisma: PrismaService, eventBus: EventBusService, private readonly authorization: AuthorizationService, audit: AuditService) { super(prisma, eventBus, audit); }

  async calculate(userId: string, opportunityId: string, persist = true) {
    const opportunity = await this.prisma.opportunity.findUnique({ where: { id: opportunityId }, include: { relationship: true, project: true } });
    if (!opportunity || opportunity.deletedAt) throw new NotFoundException('Opportunity not found');
    if (opportunity.organizationId) await this.authorization.assertPermission(userId, 'opportunity.read', { organizationId: opportunity.organizationId });
    else if (opportunity.relationship) await this.authorization.assertAnyOrganizationAccess(userId, [opportunity.relationship.sourceOrganizationId, opportunity.relationship.targetOrganizationId]);
    else if (opportunity.project?.organizationId) await this.authorization.assertPermission(userId, 'opportunity.read', { organizationId: opportunity.project.organizationId });
    const active = await this.activeVersion('OPPORTUNITY');
    const value = opportunity.value ? Number(opportunity.value) : 0;
    const valueScore = clampScore(Math.log10(Math.max(1, value)) * 18);
    const probability = clampScore(opportunity.probability);
    const relationshipPotential = clampScore(opportunity.relationship?.opportunityScore ?? 0);
    const weights = { probability: .5, value: .3, relationshipPotential: .2, ...(active.weights as any) };
    const score = clampScore(probability * weights.probability + valueScore * weights.value + relationshipPotential * weights.relationshipPotential);
    const result = { score, version: active.version?.version ?? 1, versionId: active.version?.id, type: 'OPPORTUNITY' as const, subjectType: 'Opportunity', subjectId: opportunityId, explanation: 'Opportunity score combines probability, economic value and relationship opportunity potential using the active version.', factors: { probability, valueScore, relationshipPotential, value } };
    return persist ? this.persist(userId, result, opportunity.organizationId ?? opportunity.relationship?.sourceOrganizationId) : result;
  }
}
