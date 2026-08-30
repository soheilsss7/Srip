import { Injectable, NotFoundException } from '@nestjs/common';
import { ActionStatus, Priority, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';
import { DataLifecycleService } from '../common/data-lifecycle/data-lifecycle.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { parsePagination } from '../common/pagination';

@Injectable()
export class ActionsService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService, private readonly eventBus: EventBusService, private readonly lifecycle: DataLifecycleService) {}

  private async resolveContext(userId: string, data: any) {
    const orgIds: string[] = [];
    if (data.organizationId) orgIds.push(data.organizationId);
    if (data.relationshipId) {
      const r = await this.prisma.relationship.findUnique({ where: { id: data.relationshipId }, select: { sourceOrganizationId: true, targetOrganizationId: true } });
      if (!r) throw new NotFoundException('Relationship not found');
      orgIds.push(r.sourceOrganizationId, r.targetOrganizationId);
    }
    if (data.meetingId) {
      const m = await this.prisma.meeting.findUnique({ where: { id: data.meetingId }, select: { organizationId: true, relationshipId: true } });
      if (!m) throw new NotFoundException('Meeting not found');
      if (m.organizationId) orgIds.push(m.organizationId);
      if (m.relationshipId) {
        const r = await this.prisma.relationship.findUniqueOrThrow({ where: { id: m.relationshipId }, select: { sourceOrganizationId: true, targetOrganizationId: true } });
        orgIds.push(r.sourceOrganizationId, r.targetOrganizationId);
      }
    }
    if (data.personId) {
      const p = await this.prisma.person.findUnique({ where: { id: data.personId }, select: { organizationId: true } });
      if (!p) throw new NotFoundException('Person not found');
      orgIds.push(p.organizationId);
    }
    if (data.projectId) {
      const p = await this.prisma.project.findUnique({ where: { id: data.projectId }, select: { organizationId: true, ownerId: true } });
      if (!p) throw new NotFoundException('Project not found');
      if (p.organizationId) orgIds.push(p.organizationId);
      else if (p.ownerId !== userId) throw new NotFoundException('Project not found');
    }
    const unique = [...new Set(orgIds.filter(Boolean))];
    if (unique.length) await this.authorization.assertAnyOrganizationAccess(userId, unique);
    return unique[0];
  }

  private normalize(data: any, userId: string, organizationId?: string) {
    const allowed = ['title', 'status', 'priority', 'dueAt', 'reminderAt', 'ownerId', 'createdById', 'relationshipId', 'meetingId', 'personId', 'projectId', 'organizationId', 'recommendationId', 'completionAt', 'outcome', 'attachments'];
    const out: any = {};
    for (const key of allowed) if (data[key] !== undefined) out[key] = data[key];
    out.ownerId ??= userId;
    out.createdById ??= userId;
    if (organizationId && !out.organizationId) out.organizationId = organizationId;
    for (const key of ['dueAt', 'reminderAt', 'completionAt']) if (out[key] !== undefined && out[key] !== null) out[key] = new Date(out[key]);
    if (out.status === ActionStatus.DONE && !out.completionAt) out.completionAt = new Date();
    return out;
  }

  async list(userId: string, page?: string, pageSize?: string, organizationId?: string, search?: string) {
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    const p = parsePagination(page, pageSize, { page: 1, pageSize: 50 });
    const where: Prisma.ActionWhereInput = { deletedAt: null, ...(ids ? { OR: [{ ownerId: userId }, { organizationId: { in: ids } }, { relationship: { OR: [{ sourceOrganizationId: { in: ids } }, { targetOrganizationId: { in: ids } }] } }, { meeting: { organizationId: { in: ids } } }, { project: { organizationId: { in: ids } } }] } : { ownerId: userId }), ...((organizationId || search?.trim()) ? { AND: [...(organizationId ? [{ OR: [{ organizationId }, { relationship: { OR: [{ sourceOrganizationId: organizationId }, { targetOrganizationId: organizationId }] } }, { meeting: { organizationId } }, { project: { organizationId } }] }] : []), ...(search?.trim() ? [{ OR: [{ title: { contains: search.trim(), mode: 'insensitive' } }, { description: { contains: search.trim(), mode: 'insensitive' } }] }] : [])] } : {}) };
    const [items, total] = await this.prisma.$transaction([this.prisma.action.findMany({ where, include: { owner: true, createdBy: true, organization: true, relationship: true, meeting: true, project: true, person: true, dependencies: true, blockedBy: true }, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }], skip: p.skip, take: p.take }), this.prisma.action.count({ where })]);
    return { items: EntityResponseDto.many('Action', items), page: p.page, pageSize: p.pageSize, total, totalPages: Math.ceil(total / p.pageSize) };
  }

  async get(userId: string, id: string) {
    const row = await this.prisma.action.findUnique({ where: { id }, include: { relationship: true, meeting: true, project: true, person: true, owner: true, createdBy: true, organization: true, dependencies: { include: { dependsOnAction: true } }, blockedBy: { include: { action: true } } } });
    if (!row || row.deletedAt) throw new NotFoundException('Action not found');
    await this.resolveContext(userId, row);
    if (!row.relationship && !row.meeting && !row.project && !row.organizationId && row.ownerId !== userId) throw new NotFoundException('Action not found');
    return EntityResponseDto.from('Action', row);
  }

  async create(userId: string, data: any) {
    const organizationId = await this.resolveContext(userId, data);
    const payload = this.normalize(data, userId, organizationId);
    const created = await this.eventBus.transaction(async tx => {
      const row = await tx.action.create({ data: payload });
      await this.audit.logMutation({ userId, action: 'CREATE', entityType: 'Action', entityId: row.id, organizationId: row.organizationId ?? undefined, after: row }, tx);
      await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.ACTION_CREATED, aggregateType: 'Action', aggregateId: row.id, organizationId: row.organizationId ?? undefined, actorId: userId, payload: row as any });
      return row;
    });
    return EntityResponseDto.from('Action', created);
  }

  async update(userId: string, id: string, data: any) {
    const current = await this.prisma.action.findUnique({ where: { id } });
    if (!current || current.deletedAt) throw new NotFoundException('Action not found');
    await this.resolveContext(userId, current);
    const targetOrg = await this.resolveContext(userId, { ...current, ...data });
    const payload = this.normalize(data, userId, targetOrg);
    delete payload.createdById;
    const updated = await this.eventBus.transaction(async tx => {
      const next = await tx.action.update({ where: { id }, data: payload });
      await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'Action', entityId: id, organizationId: next.organizationId ?? undefined, before: current, after: next }, tx);
      await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.ACTION_UPDATED, aggregateType: 'Action', aggregateId: next.id, organizationId: next.organizationId ?? undefined, actorId: userId, payload: next as any });
      if (current.status !== ActionStatus.DONE && next.status === ActionStatus.DONE) await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.ACTION_COMPLETED, aggregateType: 'Action', aggregateId: next.id, organizationId: next.organizationId ?? undefined, actorId: userId, payload: next as any });
      return next;
    });
    return EntityResponseDto.from('Action', updated);
  }

  async remove(userId: string, id: string) { const row = await this.get(userId, id); const updated = await this.eventBus.transaction(async tx => { const next = await this.lifecycle.softDelete(userId, 'Action', row.id as string, 'remove', tx as Prisma.TransactionClient); await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.ACTION_DELETED, aggregateType: 'Action', aggregateId: next.id, organizationId: (next as any).organizationId ?? undefined, actorId: userId, payload: next as any }); return next; }); return EntityResponseDto.from('Action', updated); }

  async addDependency(userId: string, id: string, dependsOnActionId: string) {
    if (id === dependsOnActionId) throw new NotFoundException('An action cannot depend on itself');
    await this.get(userId, id); await this.get(userId, dependsOnActionId);
    const row = await this.prisma.actionDependency.create({ data: { actionId: id, dependsOnActionId } });
    await this.audit.logMutation({ userId, action: 'CREATE', entityType: 'ActionDependency', entityId: row.id, after: row });
    return EntityResponseDto.fromUnknown(row);
  }
  async removeDependency(userId: string, id: string, dependsOnActionId: string) {
    await this.get(userId, id); await this.get(userId, dependsOnActionId);
    const row = await this.prisma.actionDependency.delete({ where: { actionId_dependsOnActionId: { actionId: id, dependsOnActionId } } });
    await this.audit.logMutation({ userId, action: 'DELETE', entityType: 'ActionDependency', entityId: row.id, before: row });
    return EntityResponseDto.fromUnknown(row);
  }

  async listOverdue(userId: string, page?: string, pageSize?: string, organizationId?: string) { const ids = await this.authorization.accessibleOrganizationIds(userId); const p = parsePagination(page, pageSize); const where: Prisma.ActionWhereInput = { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] }, dueAt: { lt: new Date() }, ...(ids ? { OR: [{ ownerId: userId }, { organizationId: { in: ids } }, { relationship: { OR: [{ sourceOrganizationId: { in: ids } }, { targetOrganizationId: { in: ids } }] } }] } : { ownerId: userId }), ...(organizationId ? { AND: [{ OR: [{ organizationId }, { relationship: { OR: [{ sourceOrganizationId: organizationId }, { targetOrganizationId: organizationId }] } }] }] } : {}) }; const [items,total]=await this.prisma.$transaction([this.prisma.action.findMany({where,orderBy:{dueAt:'asc'},skip:p.skip,take:p.take}),this.prisma.action.count({where})]); return {items:EntityResponseDto.many('Action',items),page:p.page,pageSize:p.pageSize,total,totalPages:Math.ceil(total/p.pageSize)}; }
  async listDueSoon(userId: string, days = 7, page?: string, pageSize?: string, organizationId?: string) { const ids = await this.authorization.accessibleOrganizationIds(userId); const p = parsePagination(page,pageSize); const horizon = new Date(Date.now()+Math.max(1,days)*86400000); const where: Prisma.ActionWhereInput={deletedAt:null,status:{in:['OPEN','IN_PROGRESS','BLOCKED']},dueAt:{gte:new Date(),lte:horizon},...(ids?{OR:[{ownerId:userId},{organizationId:{in:ids}},{relationship:{OR:[{sourceOrganizationId:{in:ids}},{targetOrganizationId:{in:ids}}]}}]}:{ownerId:userId}),...(organizationId?{AND:[{OR:[{organizationId},{relationship:{OR:[{sourceOrganizationId:organizationId},{targetOrganizationId:organizationId}]}}]}]}:{} )}; const [items,total]=await this.prisma.$transaction([this.prisma.action.findMany({where,orderBy:{dueAt:'asc'},skip:p.skip,take:p.take}),this.prisma.action.count({where})]); return {items:EntityResponseDto.many('Action',items),page:p.page,pageSize:p.pageSize,total,totalPages:Math.ceil(total/p.pageSize)}; }
}
