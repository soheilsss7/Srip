import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataClassification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';
import { DataLifecycleService } from '../common/data-lifecycle/data-lifecycle.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

export const APPROVAL_ACTIONS = {
  SENSITIVE_RELATIONSHIP_CREATE: 'SENSITIVE_RELATIONSHIP_CREATE',
  STRATEGIC_SCORE_CHANGE: 'STRATEGIC_SCORE_CHANGE',
  DATA_SHARING: 'DATA_SHARING',
  DATA_IMPORT: 'DATA_IMPORT',
  EXPORT: 'EXPORT',
  DELETE: 'DELETE',
} as const;

type ApprovalAction = typeof APPROVAL_ACTIONS[keyof typeof APPROVAL_ACTIONS];

const APPROVAL_PERMISSIONS: Record<ApprovalAction, string> = {
  SENSITIVE_RELATIONSHIP_CREATE: 'relationship.write',
  STRATEGIC_SCORE_CHANGE: 'relationship.write',
  DATA_SHARING: 'enterprise.export',
  DATA_IMPORT: 'data.import',
  EXPORT: 'report.export',
  DELETE: 'data.permanent_delete',
};

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly eventBus: EventBusService,
    private readonly lifecycle: DataLifecycleService,
  ) {}

  private normalizeAction(actionType: string): ApprovalAction {
    if (!(Object.values(APPROVAL_ACTIONS) as string[]).includes(actionType)) {
      throw new BadRequestException(`Unsupported approval action: ${actionType}`);
    }
    return actionType as ApprovalAction;
  }

  private async resourceScope(userId: string, organizationId?: string, entityType?: string, entityId?: string) {
    await this.authorization.assertPermission(userId, 'approval.request', {
      organizationId,
      entityType,
      entityId,
    });
  }

  async request(userId: string, input: {
    entityType: string;
    entityId: string;
    actionType: string;
    organizationId?: string;
    reason?: string;
    before?: unknown;
    after?: unknown;
  }) {
    const action = this.normalizeAction(input.actionType);
    await this.resourceScope(userId, input.organizationId, input.entityType, input.entityId);
    await this.authorization.assertPermission(userId, APPROVAL_PERMISSIONS[action], {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
    });

    const existing = await this.prisma.approvalRequest.findFirst({
      where: { entityType: input.entityType, entityId: input.entityId, actionType: action, status: 'PENDING' },
    });
    if (existing) return EntityResponseDto.fromUnknown(existing);

    let approval: any;
    try {
      approval = await this.eventBus.transaction(async tx => {
        const row = await tx.approvalRequest.create({ data: {
          entityType: input.entityType, entityId: input.entityId, actionType: action,
          organizationId: input.organizationId, requestedById: userId, status: 'PENDING',
          reason: input.reason, before: input.before as any, after: input.after as any,
        }});
        await this.audit.logMutation({ userId, action: 'APPROVAL_REQUESTED', entityType: 'ApprovalRequest', entityId: row.id, organizationId: input.organizationId, after: row, reason: input.reason }, tx);
        await this.eventBus.publishInTransaction(tx, {
          eventType: DOMAIN_EVENT_TYPES.APPROVAL_REQUESTED, aggregateType: 'ApprovalRequest',
          aggregateId: row.id, organizationId: input.organizationId, actorId: userId,
          payload: { actionType: action, entityType: input.entityType, entityId: input.entityId },
        });
        return row;
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      const existingAfterRace = await this.prisma.approvalRequest.findFirst({
        where: { entityType: input.entityType, entityId: input.entityId, actionType: action, status: 'PENDING' },
      });
      if (!existingAfterRace) throw error;
      approval = existingAfterRace;
    }
    return EntityResponseDto.fromUnknown(approval);
  }

  async list(userId: string, status = 'PENDING') {
    await this.authorization.assertPermission(userId, 'approval.read', {});
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    const where: any = { status };
    if (ids) where.organizationId = { in: ids };
    return EntityResponseDto.manyUnknown(await this.prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 500,
    }));
  }

  async assertApproved(userId: string, approvalId: string, actionType: string, entityType: string, entityId: string) {
    const action = this.normalizeAction(actionType);
    await this.authorization.assertPermission(userId, APPROVAL_PERMISSIONS[action], { entityType, entityId });
    const approval = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!approval || approval.status !== 'APPROVED' || approval.actionType !== action ||
        approval.entityType !== entityType || approval.entityId !== entityId) {
      throw new ForbiddenException('A valid approved request is required');
    }
    if (approval.organizationId) {
      await this.authorization.assertPermission(userId, APPROVAL_PERMISSIONS[action], {
        organizationId: approval.organizationId, entityType, entityId,
      });
    }
    return approval;
  }

  async approve(deciderId: string, approvalId: string, reason = 'approved') {
    await this.authorization.assertPermission(deciderId, 'approval.decide', {});
    const approval = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!approval || approval.status !== 'PENDING') throw new NotFoundException('Pending approval not found');
    if (approval.requestedById === deciderId) throw new ForbiddenException('Requester cannot approve their own request');
    const action = this.normalizeAction(approval.actionType);
    await this.authorization.assertPermission(deciderId, APPROVAL_PERMISSIONS[action], {
      organizationId: approval.organizationId ?? undefined, entityType: approval.entityType, entityId: approval.entityId,
    });
    const result = await this.eventBus.transaction(async tx => {
      const claim = await tx.approvalRequest.updateMany({
        where: { id: approval.id, status: 'PENDING' },
        data: { status: 'APPROVED', decidedById: deciderId, decidedAt: new Date() },
      });
      if (claim.count !== 1) throw new ConflictException('Approval was already decided');
      const updated = await tx.approvalRequest.findUnique({ where: { id: approval.id } });
      if (!updated) throw new NotFoundException('Approval not found after claim');
      await this.audit.logMutation({ userId: deciderId, action: 'APPROVAL_APPROVED', entityType: 'ApprovalRequest', entityId: approval.id, organizationId: approval.organizationId ?? undefined, before: approval, after: updated, reason }, tx);
      const applied = await this.applyApproved(deciderId, updated, reason, tx);
      await this.eventBus.publishInTransaction(tx, {
        eventType: DOMAIN_EVENT_TYPES.APPROVAL_APPROVED, aggregateType: 'ApprovalRequest',
        aggregateId: approval.id, organizationId: approval.organizationId ?? undefined, actorId: deciderId,
        payload: { actionType: approval.actionType, entityType: approval.entityType, entityId: approval.entityId },
      });
      return applied;
    });
    return EntityResponseDto.fromUnknown(result);
  }

  async reject(deciderId: string, approvalId: string, reason = 'rejected') {
    await this.authorization.assertPermission(deciderId, 'approval.decide', {});
    const approval = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!approval || approval.status !== 'PENDING') throw new NotFoundException('Pending approval not found');
    const action = this.normalizeAction(approval.actionType);
    const actionContext = approval.entityType === 'DataLifecycle'
      ? { organizationId: approval.organizationId ?? undefined }
      : { organizationId: approval.organizationId ?? undefined, entityType: approval.entityType, entityId: approval.entityId };
    await this.authorization.assertPermission(deciderId, APPROVAL_PERMISSIONS[action], actionContext);
    const updated = await this.eventBus.transaction(async tx => {
      const claim = await tx.approvalRequest.updateMany({
        where: { id: approval.id, status: 'PENDING' },
        data: { status: 'REJECTED', decidedById: deciderId, decidedAt: new Date() },
      });
      if (claim.count !== 1) throw new ConflictException('Approval was already decided');
      const row = await tx.approvalRequest.findUnique({ where: { id: approval.id } });
      if (!row) throw new NotFoundException('Approval not found after claim');
      await this.audit.logMutation({ userId: deciderId, action: 'APPROVAL_REJECTED', entityType: 'ApprovalRequest', entityId: approval.id, organizationId: approval.organizationId ?? undefined, before: approval, after: row, reason }, tx);
      await this.eventBus.publishInTransaction(tx, {
        eventType: DOMAIN_EVENT_TYPES.APPROVAL_REJECTED, aggregateType: 'ApprovalRequest',
        aggregateId: approval.id, organizationId: approval.organizationId ?? undefined, actorId: deciderId,
        payload: { actionType: approval.actionType, entityType: approval.entityType, entityId: approval.entityId, reason },
      });
      return row;
    });
    return EntityResponseDto.fromUnknown(updated);
  }

  private async applyApproved(deciderId: string, approval: any, reason: string, tx: any) {
    switch (approval.actionType as ApprovalAction) {
      case APPROVAL_ACTIONS.SENSITIVE_RELATIONSHIP_CREATE: {
        if (approval.entityType !== 'Relationship') throw new BadRequestException('Invalid sensitive relationship approval target');
        const d = approval.after as any;
        if (!d?.sourceOrganizationId || !d?.targetOrganizationId || !d?.relationshipType) throw new BadRequestException('Approval payload is incomplete');
        await this.authorization.assertPermission(deciderId, 'relationship.write', { organizationId: d.sourceOrganizationId, entityType: 'Relationship' });
        await this.authorization.assertPermission(deciderId, 'relationship.write', { organizationId: d.targetOrganizationId, entityType: 'Relationship' });
        const type = await tx.relationshipType.findUnique({ where: { key: String(d.relationshipType).trim() } });
        if (!type || !type.isActive) throw new BadRequestException('Unknown or inactive relationship type');
        const duplicate = await tx.relationship.findFirst({
          where: { sourceOrganizationId: d.sourceOrganizationId, targetOrganizationId: d.targetOrganizationId, relationshipType: type.key, deletedAt: null },
        });
        if (duplicate) throw new ConflictException('This relationship already exists');
        const created = await tx.relationship.create({
          data: { ...d, relationshipType: type.key, relationshipTypeId: type.id, ownerId: d.ownerId ?? approval.requestedById },
        });
        await this.audit.logMutation({ userId: deciderId, action: 'CREATE', entityType: 'Relationship', entityId: created.id, organizationId: created.sourceOrganizationId, after: created, reason: `approval:${approval.id}` }, tx);
        await this.eventBus.publishInTransaction(tx,{ eventType: DOMAIN_EVENT_TYPES.RELATIONSHIP_CREATED, aggregateType: 'Relationship', aggregateId: created.id, organizationId: created.sourceOrganizationId, actorId: deciderId, payload: created as any });
        return created;
      }
      case APPROVAL_ACTIONS.STRATEGIC_SCORE_CHANGE: {
        if (approval.entityType !== 'Relationship') throw new BadRequestException('Invalid strategic score approval target');
        const d = { ...(approval.after as any) };
        delete d.id; delete d.createdAt; delete d.updatedAt; delete d.deletedAt; delete d.deletedById;
        const existing = await tx.relationship.findUnique({ where: { id: approval.entityId } });
        if (!existing || existing.deletedAt) throw new NotFoundException('Relationship not found');
        const resourceContext = { organizationId: existing.sourceOrganizationId, relationshipOrganizationIds: [existing.sourceOrganizationId, existing.targetOrganizationId], entityType: 'Relationship', entityId: existing.id, classification: existing.sensitivity, sensitivity: existing.sensitivity, ownerId: existing.ownerId ?? undefined };
        await this.authorization.assertPermission(deciderId, 'relationship.write', resourceContext);
        await this.authorization.assertPermission(deciderId, 'relationship.write', { ...resourceContext, organizationId: existing.targetOrganizationId });
        const next = await tx.relationship.update({ where: { id: existing.id }, data: d });
        await this.audit.logMutation({ userId: deciderId, action: 'UPDATE', entityType: 'Relationship', entityId: existing.id, organizationId: existing.sourceOrganizationId, before: existing, after: next, reason: `approval:${approval.id}` }, tx);
        await this.eventBus.publishInTransaction(tx,{ eventType: DOMAIN_EVENT_TYPES.RELATIONSHIP_UPDATED, aggregateType: 'Relationship', aggregateId: existing.id, organizationId: existing.sourceOrganizationId, actorId: deciderId, payload: { ...next, approvalId: approval.id, reason } as any }); if (existing.strategicScore !== next.strategicScore || existing.healthScore !== next.healthScore || existing.riskScore !== next.riskScore || existing.trustScore !== next.trustScore || existing.accessScore !== next.accessScore || existing.influenceScore !== next.influenceScore || existing.opportunityScore !== next.opportunityScore || existing.resilienceScore !== next.resilienceScore || existing.engagementScore !== next.engagementScore) { await this.eventBus.publishInTransaction(tx,{ eventType: DOMAIN_EVENT_TYPES.RELATIONSHIP_SCORE_CHANGED, aggregateType:'Relationship', aggregateId:next.id, organizationId:next.sourceOrganizationId, actorId:deciderId, payload:{approvalId:approval.id,before:{strategicScore:existing.strategicScore},after:{strategicScore:next.strategicScore}} }); } if (existing.status !== next.status) { await this.eventBus.publishInTransaction(tx,{ eventType: DOMAIN_EVENT_TYPES.RELATIONSHIP_STATUS_CHANGED, aggregateType:'Relationship', aggregateId:next.id, organizationId:next.sourceOrganizationId, actorId:deciderId, payload:{approvalId:approval.id,before:existing.status,after:next.status} }); }
        return next;
      }
      case APPROVAL_ACTIONS.DELETE:
        if (approval.entityType !== 'DataLifecycle') throw new BadRequestException('Invalid delete approval target');
        return this.lifecycle.permanentDelete(deciderId, String((approval.after as any)?.entityType), approval.entityId, approval.id, reason, tx);
      case APPROVAL_ACTIONS.EXPORT:
      case APPROVAL_ACTIONS.DATA_SHARING:
      case APPROVAL_ACTIONS.DATA_IMPORT:
        return { approved: true, approvalId: approval.id, actionType: approval.actionType, entityType: approval.entityType, entityId: approval.entityId };
      default:
        throw new BadRequestException('Unsupported approval action');
    }
  }
}
