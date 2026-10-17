import { Injectable } from '@nestjs/common';
import { AuthorizationContext } from './authorization.service';
import { FieldSecurityService } from './field-security.service';
import { RelationshipResponseDto } from '../dto/relationship-response.dto';

@Injectable()
export class RelationshipPresenter {
  constructor(private readonly fields: FieldSecurityService) {}

  async present(userId: string, relationship: any): Promise<RelationshipResponseDto> {
    const base: Record<string, any> = {
      id: relationship.id,
      sourceOrganizationId: relationship.sourceOrganizationId,
      targetOrganizationId: relationship.targetOrganizationId,
      relationshipType: relationship.relationshipType,
      relationshipTypeRef: relationship.relationshipTypeRef ?? undefined,
      status: relationship.status,
      lifecycleStage: relationship.lifecycleStage,
      healthScore: relationship.healthScore,
      strategicScore: relationship.strategicScore,
      riskScore: relationship.riskScore,
      trustScore: relationship.trustScore,
      accessScore: relationship.accessScore,
      influenceScore: relationship.influenceScore,
      opportunityScore: relationship.opportunityScore,
      resilienceScore: relationship.resilienceScore,
      engagementScore: relationship.engagementScore,
      sensitivity: relationship.sensitivity,
      ownerId: relationship.ownerId,
      backupOwnerId: relationship.backupOwnerId,
      reviewCadenceDays: relationship.reviewCadenceDays,
      lastInteractionAt: relationship.lastInteractionAt,
      nextReviewAt: relationship.nextReviewAt,
      nextActionAt: relationship.nextActionAt,
      sourceOrganization: relationship.sourceOrganization,
      targetOrganization: relationship.targetOrganization,
      owner: relationship.owner,
      backupOwner: relationship.backupOwner,
      scoreSnapshots: relationship.scoreSnapshots,
      interactions: relationship.interactions,
      meetings: relationship.meetings,
      projects: relationship.projects,
      recommendations: relationship.recommendations,
      tags: relationship.tags,
      createdAt: relationship.createdAt,
      updatedAt: relationship.updatedAt,
      ...(Object.prototype.hasOwnProperty.call(relationship, 'notes') ? { notes: relationship.notes } : {}),
      ...(Object.prototype.hasOwnProperty.call(relationship, 'strategicAssessment') ? { strategicAssessment: relationship.strategicAssessment } : {}),
      ...(Object.prototype.hasOwnProperty.call(relationship, 'risk') ? { risk: relationship.risk } : {}),
      ...(Object.prototype.hasOwnProperty.call(relationship, 'internalOpinion') ? { internalOpinion: relationship.internalOpinion } : {}),
      ...(Object.prototype.hasOwnProperty.call(relationship, 'sensitiveContacts') ? { sensitiveContacts: relationship.sensitiveContacts } : {}),
    };
    const context: AuthorizationContext = {
      organizationId: relationship.sourceOrganizationId,
      relationshipOrganizationIds: [relationship.sourceOrganizationId, relationship.targetOrganizationId],
      entityType: 'Relationship', entityId: relationship.id,
      classification: relationship.sensitivity, sensitivity: relationship.sensitivity,
      ownerId: relationship.ownerId ?? undefined,
    };
    return (await this.fields.sanitize(userId, 'Relationship', base, context)) as RelationshipResponseDto;
  }

  async presentMany(userId: string, relationships: any[]): Promise<RelationshipResponseDto[]> {
    return Promise.all(relationships.map(r => this.present(userId, r)));
  }
}
