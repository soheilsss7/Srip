import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service'; import { AuditService } from '../audit/audit.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';
import { DataLifecycleService } from '../common/data-lifecycle/data-lifecycle.service';
import { RelationshipPresenter } from '../common/authorization/relationship-presenter';
import { EntityResponseDto } from '../common/dto/entity-response.dto'; import { ApprovalService, APPROVAL_ACTIONS } from '../approvals/approval.service';
import { RelationshipLifecycleStage } from '@prisma/client';

@Injectable()
export class RelationshipsService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService, private readonly eventBus: EventBusService, private readonly lifecycle: DataLifecycleService, private readonly presenter: RelationshipPresenter, private readonly approvals: ApprovalService) {}

  async list(userId: string, organizationId?: string, status?: any, lifecycleStage?: RelationshipLifecycleStage, page = 1, pageSize = 50) {
    page = Math.max(1, Math.min(page, 10000)); pageSize = Math.max(1, Math.min(pageSize, 100));
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    if (organizationId) await this.authorization.assertPermission(userId, 'relationship.read', { organizationId: organizationId });
    const [rows,total] = await Promise.all([this.prisma.relationship.findMany({
      where: {
        deletedAt: null,
        ...(ids ? { sourceOrganizationId: { in: ids }, targetOrganizationId: { in: ids } } : {}),
        ...(organizationId ? { OR: [{ sourceOrganizationId: organizationId }, { targetOrganizationId: organizationId }] } : {}),
        ...(status ? { status } : {}),
        ...(lifecycleStage ? { lifecycleStage } : {}),
      },
      include: {
        sourceOrganization: { select: { id: true, name: true, type: true } },
        targetOrganization: { select: { id: true, name: true, type: true } },
        owner: { select: { id: true, name: true, email: true } },
        backupOwner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }), this.prisma.relationship.count({ where: { deletedAt: null, ...(ids ? { sourceOrganizationId: { in: ids }, targetOrganizationId: { in: ids } } : {}), ...(organizationId ? { OR: [{ sourceOrganizationId: organizationId }, { targetOrganizationId: organizationId }] } : {}), ...(status ? { status } : {}), ...(lifecycleStage ? { lifecycleStage } : {}) } })]);
    return { data: this.presenter.presentMany(userId, rows), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  async get(userId: string, id: string) {
    const r = await this.prisma.relationship.findFirst({ where: { id, deletedAt: null }, include: { sourceOrganization: { select: { id: true, name: true, type: true } }, targetOrganization: { select: { id: true, name: true, type: true } }, owner: { select: { id: true, name: true, email: true } }, backupOwner: { select: { id: true, name: true, email: true } }, scoreSnapshots: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, healthScore: true, strategicScore: true, riskScore: true, trustScore: true, accessScore: true, influenceScore: true, opportunityScore: true, resilienceScore: true, engagementScore: true, reason: true, createdAt: true } }, interactions: { where: { deletedAt: null }, orderBy: { occurredAt: 'desc' }, take: 25, select: { id: true, type: true, subject: true, summary: true, outcome: true, occurredAt: true, importance: true } }, meetings: { where: { deletedAt: null }, orderBy: { startAt: 'desc' }, take: 25, select: { id: true, title: true, objective: true, startAt: true, outcome: true, relationshipId: true } }, projects: { take: 25, select: { relevance: true, required: true, status: true, project: { select: { id: true, name: true, status: true, priority: true, organizationId: true, ownerId: true } } } } } });
    if (!r) throw new NotFoundException('Relationship not found');
    const resourceContext = { organizationId: r.sourceOrganizationId, relationshipOrganizationIds: [r.sourceOrganizationId, r.targetOrganizationId], entityType: 'Relationship', entityId: r.id, classification: r.sensitivity, sensitivity: r.sensitivity, ownerId: r.ownerId ?? undefined };
    await this.authorization.assertPermission(userId, 'relationship.read', resourceContext);
    await this.authorization.assertPermission(userId, 'relationship.read', { ...resourceContext, organizationId: r.targetOrganizationId });
    return this.presenter.present(userId, r);
  }

  async timeline(userId: string, id: string) {
    const r = await this.prisma.relationship.findFirst({ where: { id, deletedAt: null } });
    if (!r) throw new NotFoundException('Relationship not found');
    const resourceContext = { organizationId: r.sourceOrganizationId, relationshipOrganizationIds: [r.sourceOrganizationId, r.targetOrganizationId], entityType: 'Relationship', entityId: r.id, classification: r.sensitivity, sensitivity: r.sensitivity, ownerId: r.ownerId ?? undefined };
    await this.authorization.assertPermission(userId, 'relationship.read', resourceContext);
    await this.authorization.assertPermission(userId, 'relationship.read', { ...resourceContext, organizationId: r.targetOrganizationId });
    const [interactions, meetings, actions, commitments, opportunities] = await Promise.all([
      this.prisma.interaction.findMany({ where: { relationshipId: id, deletedAt: null }, orderBy: { occurredAt: 'desc' }, take: 50, select: { id: true, type: true, subject: true, summary: true, occurredAt: true } }),
      this.prisma.meeting.findMany({ where: { relationshipId: id, deletedAt: null }, orderBy: { startAt: 'desc' }, take: 50, select: { id: true, title: true, startAt: true, outcome: true } }),
      this.prisma.action.findMany({ where: { relationshipId: id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true, status: true, dueAt: true, createdAt: true } }),
      this.prisma.commitment.findMany({ where: { relationshipId: id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, description: true, status: true, dueAt: true, createdAt: true } }),
      this.prisma.opportunity.findMany({ where: { relationshipId: id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, name: true, status: true, probability: true, createdAt: true } }),
    ]);
    return { relationshipId: id, items: [
      ...interactions.map(x => ({ kind: 'interaction', date: x.occurredAt, ...x })),
      ...meetings.map(x => ({ kind: 'meeting', date: x.startAt, ...x })),
      ...actions.map(x => ({ kind: 'action', date: x.createdAt, ...x })),
      ...commitments.map(x => ({ kind: 'commitment', date: x.createdAt, ...x })),
      ...opportunities.map(x => ({ kind: 'opportunity', date: x.createdAt, ...x })),
    ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,100) };
  }

  async create(userId: string, data: { sourceOrganizationId: string; targetOrganizationId: string; relationshipType: string; status?: any; lifecycleStage?: RelationshipLifecycleStage; healthScore?: number; strategicScore?: number; riskScore?: number; trustScore?: number; accessScore?: number; influenceScore?: number; opportunityScore?: number; resilienceScore?: number; engagementScore?: number; sensitivity?: any; reviewCadenceDays?: number; ownerId?: string; backupOwnerId?: string }) {if(data.sourceOrganizationId===data.targetOrganizationId)throw new BadRequestException('A relationship requires two distinct organizations');await this.authorization.assertPermission(userId,'relationship.write',{organizationId:data.sourceOrganizationId});await this.authorization.assertPermission(userId,'relationship.write',{organizationId:data.targetOrganizationId});if(data.ownerId)await this.authorization.assertPermission(userId,'relationship.write',{organizationId:data.sourceOrganizationId,ownerId:data.ownerId});if(data.backupOwnerId)await this.authorization.assertPermission(userId,'relationship.write',{organizationId:data.sourceOrganizationId,ownerId:data.backupOwnerId});const relationshipType=await this.prisma.relationshipType.findUnique({where:{key:data.relationshipType.trim()}});if(!relationshipType||!relationshipType.isActive)throw new ForbiddenException('Unknown or inactive relationship type');const duplicate=await this.prisma.relationship.findFirst({where:{sourceOrganizationId:data.sourceOrganizationId,targetOrganizationId:data.targetOrganizationId,relationshipType:data.relationshipType.trim(),deletedAt:null}});if(duplicate)throw new ForbiddenException('This relationship already exists');const sensitivityRank:Record<string,number>={PUBLIC:0,INTERNAL:1,CONFIDENTIAL:2,RESTRICTED:3,PRIVATE:4,HIGHLY_CONFIDENTIAL:5};const requestedSensitivity=String(data.sensitivity??'INTERNAL');if((sensitivityRank[requestedSensitivity]??0)>=sensitivityRank.RESTRICTED)return this.approvals.request(userId,{entityType:'Relationship',entityId:`PENDING:${data.sourceOrganizationId}:${data.targetOrganizationId}:${relationshipType.key}`,actionType:APPROVAL_ACTIONS.SENSITIVE_RELATIONSHIP_CREATE,organizationId:data.sourceOrganizationId,reason:'Sensitive relationship creation requires approval',after:{...data,relationshipType:relationshipType.key}});const created=await this.eventBus.transaction(async tx=>{const row=await tx.relationship.create({data:{...data,relationshipType:relationshipType.key,relationshipTypeId:relationshipType.id,ownerId:data.ownerId??userId}});await this.audit.logMutation({userId,action:'CREATE',entityType:'Relationship',entityId:row.id,organizationId:row.sourceOrganizationId,after:row},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RELATIONSHIP_CREATED,aggregateType:'Relationship',aggregateId:row.id,organizationId:row.sourceOrganizationId??undefined,actorId:userId,payload:row as any});return row;});return this.presenter.present(userId,created);}

  async update(userId: string, id: string, data: Record<string, unknown>) { const existing=await this.prisma.relationship.findFirst({where:{id,deletedAt:null}});if(!existing)throw new NotFoundException('Relationship not found');const resourceContext={organizationId:existing.sourceOrganizationId,relationshipOrganizationIds:[existing.sourceOrganizationId,existing.targetOrganizationId],entityType:'Relationship',entityId:existing.id,classification:existing.sensitivity,sensitivity:existing.sensitivity,ownerId:existing.ownerId??undefined};await this.authorization.assertPermission(userId,'relationship.write',resourceContext);await this.authorization.assertPermission(userId,'relationship.write',{...resourceContext,organizationId:existing.targetOrganizationId});const sourceOrganizationId=typeof data.sourceOrganizationId==='string'?String(data.sourceOrganizationId):existing.sourceOrganizationId;const targetOrganizationId=typeof data.targetOrganizationId==='string'?String(data.targetOrganizationId):existing.targetOrganizationId;if(sourceOrganizationId===targetOrganizationId)throw new BadRequestException('A relationship requires two distinct organizations');if(sourceOrganizationId!==existing.sourceOrganizationId)await this.authorization.assertPermission(userId,'relationship.write',{organizationId:sourceOrganizationId});if(targetOrganizationId!==existing.targetOrganizationId)await this.authorization.assertPermission(userId,'relationship.write',{organizationId:targetOrganizationId});if(data.ownerId)await this.authorization.assertPermission(userId,'relationship.write',{organizationId:sourceOrganizationId,ownerId:String(data.ownerId)});if(data.backupOwnerId)await this.authorization.assertPermission(userId,'relationship.write',{organizationId:sourceOrganizationId,ownerId:String(data.backupOwnerId)});const allowed=['sourceOrganizationId','targetOrganizationId','relationshipType','status','lifecycleStage','healthScore','strategicScore','riskScore','trustScore','accessScore','influenceScore','opportunityScore','resilienceScore','engagementScore','sensitivity','reviewCadenceDays','ownerId','backupOwnerId','nextActionAt','nextReviewAt','lastInteractionAt'];const safeData:any=Object.fromEntries(Object.entries(data).filter(([key])=>allowed.includes(key)));if(Object.prototype.hasOwnProperty.call(safeData,'strategicScore')&&Number(safeData.strategicScore)!==Number(existing.strategicScore))return this.approvals.request(userId,{entityType:'Relationship',entityId:existing.id,actionType:APPROVAL_ACTIONS.STRATEGIC_SCORE_CHANGE,organizationId:existing.sourceOrganizationId,reason:'Strategic Score change requires approval',before:{strategicScore:existing.strategicScore},after:safeData});const nextType=typeof safeData.relationshipType==='string'?await this.prisma.relationshipType.findUnique({where:{key:String(safeData.relationshipType).trim()}}):null;if(typeof safeData.relationshipType==='string'&&(!nextType||!nextType.isActive))throw new ForbiddenException('Unknown or inactive relationship type');const updated=await this.eventBus.transaction(async tx=>{const row=await tx.relationship.update({where:{id},data:{...safeData,sourceOrganizationId,targetOrganizationId,...(nextType?{relationshipType:nextType.key,relationshipTypeId:nextType.id}:{}),...(safeData.relationshipType===undefined?{}:{relationshipType:String(safeData.relationshipType).trim()})}});await this.audit.logMutation({userId,action:'UPDATE',entityType:'Relationship',entityId:id,organizationId:existing.sourceOrganizationId,before:existing,after:row},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RELATIONSHIP_UPDATED,aggregateType:'Relationship',aggregateId:row.id,organizationId:row.sourceOrganizationId??undefined,actorId:userId,payload:row as any});const scoreFields=['healthScore','strategicScore','riskScore','trustScore','accessScore','influenceScore','opportunityScore','resilienceScore','engagementScore'];if(scoreFields.some(k=>(existing as any)[k]!== (row as any)[k]))await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RELATIONSHIP_SCORE_CHANGED,aggregateType:'Relationship',aggregateId:row.id,organizationId:row.sourceOrganizationId??undefined,actorId:userId,payload:{before:Object.fromEntries(scoreFields.map(k=>[k,(existing as any)[k]])),after:Object.fromEntries(scoreFields.map(k=>[k,(row as any)[k]]))}});if(existing.status!==row.status)await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RELATIONSHIP_STATUS_CHANGED,aggregateType:'Relationship',aggregateId:row.id,organizationId:row.sourceOrganizationId??undefined,actorId:userId,payload:{before:existing.status,after:row.status}});if(existing.lifecycleStage!==row.lifecycleStage)await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RELATIONSHIP_LIFECYCLE_CHANGED,aggregateType:'Relationship',aggregateId:row.id,organizationId:row.sourceOrganizationId??undefined,actorId:userId,payload:{before:existing.lifecycleStage,after:row.lifecycleStage}});return row;});return this.presenter.present(userId,updated); }

  async updateLifecycle(userId: string, id: string, lifecycleStage: RelationshipLifecycleStage) {
    const existing = await this.prisma.relationship.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Relationship not found');
    const resourceContext = {
      organizationId: existing.sourceOrganizationId,
      relationshipOrganizationIds: [existing.sourceOrganizationId, existing.targetOrganizationId],
      entityType: 'Relationship',
      entityId: existing.id,
      classification: existing.sensitivity,
      sensitivity: existing.sensitivity,
      ownerId: existing.ownerId ?? undefined,
    };
    await this.authorization.assertPermission(userId, 'relationship.write', resourceContext);
    await this.authorization.assertPermission(userId, 'relationship.write', { ...resourceContext, organizationId: existing.targetOrganizationId });
    if (existing.lifecycleStage === lifecycleStage) return this.presenter.present(userId, existing);
    const updated = await this.eventBus.transaction(async tx => {
      const row = await tx.relationship.update({ where: { id }, data: { lifecycleStage } });
      await this.audit.logMutation({
        userId,
        action: 'UPDATE',
        entityType: 'Relationship',
        entityId: id,
        organizationId: existing.sourceOrganizationId,
        before: { lifecycleStage: existing.lifecycleStage },
        after: { lifecycleStage: row.lifecycleStage },
        reason: 'Relationship lifecycle stage changed',
      }, tx);
      await this.eventBus.publishInTransaction(tx, {
        eventType: DOMAIN_EVENT_TYPES.RELATIONSHIP_LIFECYCLE_CHANGED,
        aggregateType: 'Relationship',
        aggregateId: row.id,
        organizationId: row.sourceOrganizationId ?? undefined,
        actorId: userId,
        payload: { before: existing.lifecycleStage, after: row.lifecycleStage },
      });
      return row;
    });
    return this.presenter.present(userId, updated);
  }

  async restore(userId: string, id: string) {
    const restored = await this.eventBus.transaction(async tx => {
      const row = await this.lifecycle.restore(userId, 'Relationship', id, 'restore', tx);
      await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.RELATIONSHIP_UPDATED, aggregateType: 'Relationship', aggregateId: id, organizationId: (row as any).sourceOrganizationId ?? undefined, actorId: userId, payload: { lifecycle: 'RESTORED' } });
      return row;
    });
    return this.presenter.present(userId, restored);
  }

  async archive(userId: string, id: string) { const existing=await this.prisma.relationship.findFirst({where:{id,deletedAt:null}});if(!existing)throw new NotFoundException('Relationship not found');const resourceContext={organizationId:existing.sourceOrganizationId,relationshipOrganizationIds:[existing.sourceOrganizationId,existing.targetOrganizationId],entityType:'Relationship',entityId:existing.id,classification:existing.sensitivity,sensitivity:existing.sensitivity,ownerId:existing.ownerId??undefined};await this.authorization.assertPermission(userId,'relationship.write',resourceContext);await this.authorization.assertPermission(userId,'relationship.write',{...resourceContext,organizationId:existing.targetOrganizationId});const archived=await this.eventBus.transaction(async tx=>{const next=await this.lifecycle.softDelete(userId,'Relationship',id,'archive',tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RELATIONSHIP_DELETED,aggregateType:'Relationship',aggregateId:next.id,organizationId:next.sourceOrganizationId??undefined,actorId:userId,payload:next as any});return next;});return this.presenter.present(userId,archived); }
}
