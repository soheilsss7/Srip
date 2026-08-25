import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service'; import { AuditService } from '../audit/audit.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';
import { DataLifecycleService } from '../common/data-lifecycle/data-lifecycle.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService, private readonly eventBus: EventBusService, private readonly lifecycle: DataLifecycleService) {}

  private async assertReadable(userId: string, organizationId: string) {
    await this.authorization.assertPermission(userId, 'org.read', { organizationId: organizationId });
    const organization = await this.prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null } });
    if (!organization) throw new NotFoundException('Organization not found');
    return EntityResponseDto.fromUnknown(organization);
  }

  async list(userId: string, parentOrganizationId?: string, page = 1, pageSize = 50) {
    page = Math.max(1, Math.min(Number(page) || 1, 10000)); pageSize = Math.max(1, Math.min(Number(pageSize) || 50, 100));
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    const [rows,total] = await Promise.all([this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        ...(ids ? { id: { in: ids } } : {}),
        ...(parentOrganizationId ? { parentOrganizationId } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        parentOrganization: { select: { id: true, name: true, type: true } },
        _count: { select: { people: true, sourceRelationships: true, targetRelationships: true, projects: true, opportunities: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }), this.prisma.organization.count({ where: { deletedAt: null, ...(ids ? { id: { in: ids } } : {}), ...(parentOrganizationId ? { parentOrganizationId } : {}) } })]);
    return { data: EntityResponseDto.many('Organization', rows), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  async get(userId: string, id: string) {
    await this.assertReadable(userId, id);
    return EntityResponseDto.fromUnknown(await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        parentOrganization: { select: { id: true, name: true, type: true } },
        children: { where: { deletedAt: null }, select: { id: true, name: true, type: true, status: true } },
        people: { where: { deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 50 },
        sourceRelationships: { where: { deletedAt: null }, include: { targetOrganization: { select: { id: true, name: true, type: true } } }, take: 50 },
        targetRelationships: { where: { deletedAt: null }, include: { sourceOrganization: { select: { id: true, name: true, type: true } } }, take: 50 },
        _count: { select: { people: true, sourceRelationships: true, targetRelationships: true, projects: true, opportunities: true, meetings: true, interactions: true } },
      },
    }));
  }

  async timeline(userId: string, id: string) {
    const org = await this.assertReadable(userId, id);
    const [interactions, meetings, actions] = await Promise.all([
      this.prisma.interaction.findMany({ where: { organizationId: id, deletedAt: null }, orderBy: { occurredAt: 'desc' }, take: 50, select: { id: true, type: true, subject: true, summary: true, occurredAt: true } }),
      this.prisma.meeting.findMany({ where: { organizationId: id, deletedAt: null }, orderBy: { startAt: 'desc' }, take: 50, select: { id: true, title: true, startAt: true, outcome: true } }),
      this.prisma.action.findMany({ where: { organizationId: id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true, status: true, dueDate: true, createdAt: true } }),
    ]);
    return { organization: { id: org.id, name: org.name }, items: [
      ...interactions.map(x => ({ kind: 'interaction', date: x.occurredAt, ...x })),
      ...meetings.map(x => ({ kind: 'meeting', date: x.startAt, ...x })),
      ...actions.map(x => ({ kind: 'action', date: x.createdAt, ...x })),
    ].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,100) };
  }

  async create(userId: string, data: { name: string; legalName?: string; englishName?: string; displayName?: string; type?: any; industry?: string; country?: string; city?: string; address?: string; website?: string; phone?: string; email?: string; strategicImportance?: number; registrationId?: string; parentOrganizationId?: string; ownerId?: string }) {if(data.parentOrganizationId)await this.authorization.assertPermission(userId,'org.write',{organizationId:data.parentOrganizationId});else if(!(await this.authorization.isSuperAdmin(userId)))throw new ForbiddenException('Root organization creation requires Super Admin');if(data.ownerId)await this.authorization.assertPermission(userId,'org.write',{organizationId:data.parentOrganizationId??undefined,ownerId:data.ownerId});const duplicate=await this.prisma.organization.findFirst({where:{name:data.name.trim(),deletedAt:null,...(data.parentOrganizationId?{parentOrganizationId:data.parentOrganizationId}:{parentOrganizationId:null})}});if(duplicate)throw new ForbiddenException('An organization with this name already exists in this scope');const created=await this.eventBus.transaction(async tx=>{const row=await tx.organization.create({data:{...data,name:data.name.trim(),displayName:data.displayName?.trim()||data.name.trim(),ownerId:data.ownerId??userId}});await this.audit.logMutation({userId,action:'CREATE',entityType:'Organization',entityId:row.id,organizationId:row.id,after:row},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.ORGANIZATION_CREATED,aggregateType:'Organization',aggregateId:row.id,organizationId:row.id,actorId:userId,payload:row as any});return row;});return EntityResponseDto.from('Organization',created);}

  async update(userId: string, id: string, data: Record<string, unknown>) { const existing=await this.assertReadable(userId,id); await this.authorization.assertPermission(userId,'org.write',{organizationId:existing.id}); if(data.parentOrganizationId&&data.parentOrganizationId===id)throw new ForbiddenException('Organization cannot be its own parent'); if(data.parentOrganizationId)await this.authorization.assertPermission(userId,'org.write',{organizationId:String(data.parentOrganizationId)}); const name=typeof data.name==='string'?data.name.trim():undefined; if(name){const duplicate=await this.prisma.organization.findFirst({where:{id:{not:id},name,deletedAt:null,parentOrganizationId:(data.parentOrganizationId as string|null|undefined)??existing.parentOrganizationId}});if(duplicate)throw new ForbiddenException('An organization with this name already exists in this scope');} const updated=await this.eventBus.transaction(async tx=>{const safeData:any={...data}; if (typeof safeData.email==='string') safeData.email=safeData.email.trim().toLowerCase(); if (typeof safeData.website==='string') safeData.website=safeData.website.trim(); if (typeof safeData.legalName==='string') safeData.legalName=safeData.legalName.trim(); if (typeof safeData.englishName==='string') safeData.englishName=safeData.englishName.trim(); if (typeof safeData.city==='string') safeData.city=safeData.city.trim(); if (typeof safeData.country==='string') safeData.country=safeData.country.trim(); delete safeData.status; const row=await tx.organization.update({where:{id},data:{...safeData,...(name?{name,displayName:(data.displayName as string|undefined)?.trim()||name}:{})}});await this.audit.logMutation({userId,action:'UPDATE',entityType:'Organization',entityId:id,organizationId:id,before:existing,after:row},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.ORGANIZATION_UPDATED,aggregateType:'Organization',aggregateId:row.id,organizationId:row.id,actorId:userId,payload:row as any});return row;});return EntityResponseDto.from('Organization',updated); }

  async restore(userId: string, id: string) { const restored = await this.eventBus.transaction(async tx => { const row = await this.lifecycle.restore(userId, 'Organization', id, 'restore', tx); await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.ORGANIZATION_UPDATED, aggregateType: 'Organization', aggregateId: id, organizationId: id, actorId: userId, payload: { lifecycle: 'RESTORED' } }); return row; }); return EntityResponseDto.fromUnknown(restored); }

  async archive(userId: string, id: string) { const existing=await this.assertReadable(userId,id); await this.authorization.assertPermission(userId,'org.write',{organizationId:existing.id}); const archived=await this.eventBus.transaction(async tx=>{const next=await this.lifecycle.softDelete(userId,'Organization',id,'archive',tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.ORGANIZATION_DELETED,aggregateType:'Organization',aggregateId:next.id,organizationId:next.id,actorId:userId,payload:next as any});return next;});return EntityResponseDto.fromUnknown(archived); }
}
