import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { isTagEntityType, TagEntityType } from './tag.types';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

type TagBody = { name: string };
type ListOptions = { q?: string; take?: string; skip?: string };

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  private normalizeName(name: string) {
    const normalized = String(name ?? '').trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length > 100) throw new ConflictException('Tag name must be between 1 and 100 characters');
    return normalized;
  }

  private assertEntityType(entityType: string): asserts entityType is TagEntityType {
    if (!isTagEntityType(entityType)) throw new NotFoundException(`Unsupported tag entity type: ${entityType}`);
  }

  private async entityOrganizationIds(entityType: TagEntityType, entityId: string): Promise<string[]> {
    switch (entityType) {
      case 'Organization': {
        const row = await this.prisma.organization.findFirst({ where: { id: entityId, deletedAt: null }, select: { id: true } });
        if (!row) throw new NotFoundException('Entity not found'); return [row.id];
      }
      case 'Person': {
        const row = await this.prisma.person.findFirst({ where: { id: entityId, deletedAt: null }, select: { organizationId: true } });
        if (!row) throw new NotFoundException('Entity not found'); return [row.organizationId];
      }
      case 'Relationship': {
        const row = await this.prisma.relationship.findFirst({ where: { id: entityId, deletedAt: null }, select: { sourceOrganizationId: true, targetOrganizationId: true } });
        if (!row) throw new NotFoundException('Entity not found'); return [row.sourceOrganizationId, row.targetOrganizationId];
      }
      case 'Interaction': {
        const row = await this.prisma.interaction.findFirst({ where: { id: entityId, deletedAt: null }, select: { organizationId: true, relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } } } });
        if (!row) throw new NotFoundException('Entity not found');
        return [row.organizationId, row.relationship?.sourceOrganizationId, row.relationship?.targetOrganizationId].filter(Boolean) as string[];
      }
      case 'Meeting': {
        const row = await this.prisma.meeting.findFirst({ where: { id: entityId, deletedAt: null }, select: { organizationId: true, relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } } } });
        if (!row) throw new NotFoundException('Entity not found');
        return [row.organizationId, row.relationship?.sourceOrganizationId, row.relationship?.targetOrganizationId].filter(Boolean) as string[];
      }
      case 'Action': {
        const row = await this.prisma.action.findFirst({ where: { id: entityId, deletedAt: null }, select: { person: { select: { organizationId: true } }, project: { select: { organizationId: true } }, relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } }, meeting: { select: { organizationId: true } } } });
        if (!row) throw new NotFoundException('Entity not found');
        return [row.person?.organizationId, row.project?.organizationId, row.relationship?.sourceOrganizationId, row.relationship?.targetOrganizationId, row.meeting?.organizationId].filter(Boolean) as string[];
      }
      case 'Commitment': {
        const row = await this.prisma.commitment.findFirst({ where: { id: entityId, deletedAt: null }, select: { organizationId: true, person: { select: { organizationId: true } }, project: { select: { organizationId: true } }, relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } }, meeting: { select: { organizationId: true } } } });
        if (!row) throw new NotFoundException('Entity not found');
        return [row.organizationId, row.person?.organizationId, row.project?.organizationId, row.relationship?.sourceOrganizationId, row.relationship?.targetOrganizationId, row.meeting?.organizationId].filter(Boolean) as string[];
      }
      case 'Project': {
        const row = await this.prisma.project.findFirst({ where: { id: entityId, deletedAt: null }, select: { organizationId: true } });
        if (!row) throw new NotFoundException('Entity not found'); return row.organizationId ? [row.organizationId] : [];
      }
      case 'Requirement': {
        const row = await this.prisma.projectRequirement.findFirst({ where: { id: entityId, deletedAt: null }, select: { organizationId: true, project: { select: { organizationId: true } } } });
        if (!row) throw new NotFoundException('Entity not found');
        return [row.organizationId, row.project.organizationId].filter(Boolean) as string[];
      }
      case 'Opportunity': {
        const row = await this.prisma.opportunity.findFirst({ where: { id: entityId, deletedAt: null }, select: { organizationId: true, project: { select: { organizationId: true } }, relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } } } });
        if (!row) throw new NotFoundException('Entity not found');
        return [row.organizationId, row.project?.organizationId, row.relationship?.sourceOrganizationId, row.relationship?.targetOrganizationId].filter(Boolean) as string[];
      }
      case 'Recommendation': {
        const row = await this.prisma.recommendation.findFirst({ where: { id: entityId, deletedAt: null }, select: { relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } } } });
        if (!row) throw new NotFoundException('Entity not found');
        return [row.relationship?.sourceOrganizationId, row.relationship?.targetOrganizationId].filter(Boolean) as string[];
      }
      case 'Document': {
        const row = await this.prisma.document.findFirst({ where: { id: entityId, deletedAt: null }, select: { organizationId: true } });
        if (!row) throw new NotFoundException('Entity not found'); return row.organizationId ? [row.organizationId] : [];
      }
      case 'Note': {
        const row = await this.prisma.note.findFirst({ where: { id: entityId, deletedAt: null }, select: { organizationId: true, person: { select: { organizationId: true } } } });
        if (!row) throw new NotFoundException('Entity not found');
        return [row.organizationId, row.person?.organizationId].filter(Boolean) as string[];
      }
      case 'Workflow': {
        const row = await this.prisma.workflow.findFirst({ where: { id: entityId, deletedAt: null }, select: { organizationId: true } });
        if (!row) throw new NotFoundException('Entity not found'); return row.organizationId ? [row.organizationId] : [];
      }
      case 'Referral': {
        const row = await this.prisma.referral.findFirst({ where: { id: entityId, deletedAt: null }, select: { sourceOrganizationId: true, targetOrganizationId: true, sourcePerson: { select: { organizationId: true } }, targetPerson: { select: { organizationId: true } } } });
        if (!row) throw new NotFoundException('Entity not found');
        return [row.sourceOrganizationId, row.targetOrganizationId, row.sourcePerson?.organizationId, row.targetPerson?.organizationId].filter(Boolean) as string[];
      }
      case 'ConnectionPath': {
        const row = await this.prisma.connectionPath.findFirst({ where: { id: entityId }, select: { sourceOrganizationId: true, targetOrganizationId: true } });
        if (!row) throw new NotFoundException('Entity not found'); return [row.sourceOrganizationId, row.targetOrganizationId];
      }
      case 'OrganizationUnit': {
        const row = await this.prisma.organizationUnit.findFirst({ where: { id: entityId }, select: { organizationId: true } });
        if (!row) throw new NotFoundException('Entity not found'); return [row.organizationId];
      }
    }
  }

  private async assertEntityAccess(userId: string, entityType: TagEntityType, entityId: string, write: boolean, requestedOrganizationId?: string) {
    const orgIds = [...new Set(await this.entityOrganizationIds(entityType, entityId))];
    if (requestedOrganizationId && !orgIds.includes(requestedOrganizationId)) throw new ForbiddenException('Tag assignment organization does not belong to the entity');
    if (!orgIds.length) {
      if (requestedOrganizationId) {
        await this.authorization.assertPermission(userId, write ? 'entity.write' : 'entity.read', { organizationId: requestedOrganizationId });
        return { organizationId: requestedOrganizationId };
      }
      if (!(await this.authorization.isSuperAdmin(userId))) throw new ForbiddenException('Entity has no organization scope');
      return { organizationId: undefined };
    }
    const accessible = await this.authorization.accessibleOrganizationIds(userId);
    if (accessible !== null && !orgIds.some(id => accessible.includes(id))) throw new ForbiddenException('Organization scope denied');
    for (const id of orgIds) await this.authorization.assertPermission(userId, write ? 'entity.write' : 'entity.read', { organizationId: id });
    return { organizationId: requestedOrganizationId ?? orgIds[0] };
  }

  async create(userId: string, body: TagBody) {
    await this.authorization.assertPermission(userId, 'tag.write', {});
    const name = this.normalizeName(body.name);
    const existing = await this.prisma.tag.findUnique({ where: { name } });
    if (existing) throw new ConflictException('Tag already exists');
    const tag = await this.prisma.tag.create({ data: { name } });
    await this.audit.logMutation({ userId, action: AuditAction.TAG_CREATED, entityType: 'Tag', entityId: tag.id, after: tag });
    return EntityResponseDto.fromUnknown(tag);
  }

  async list(userId: string, options: ListOptions) {
    await this.authorization.assertPermission(userId, 'tag.read', {});
    const take = Math.min(Math.max(Number(options.take ?? 100) || 100, 1), 200);
    const skip = Math.max(Number(options.skip ?? 0) || 0, 0);
    const q = options.q?.trim();
    return EntityResponseDto.many('Tag', await this.prisma.tag.findMany({ where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined, orderBy: { name: 'asc' }, skip, take, include: { _count: { select: { assignments: true, relationships: true } } } }));
  }

  async update(userId: string, id: string, body: TagBody) {
    await this.authorization.assertPermission(userId, 'tag.write', {});
    const name = this.normalizeName(body.name);
    const before = await this.prisma.tag.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Tag not found');
    const conflict = await this.prisma.tag.findFirst({ where: { name, NOT: { id } } });
    if (conflict) throw new ConflictException('Tag already exists');
    const tag = await this.prisma.tag.update({ where: { id }, data: { name } });
    await this.audit.logMutation({ userId, action: AuditAction.TAG_UPDATED, entityType: 'Tag', entityId: tag.id, before, after: tag });
    return EntityResponseDto.fromUnknown(tag);
  }

  async remove(userId: string, id: string) {
    await this.authorization.assertPermission(userId, 'tag.write', {});
    const before = await this.prisma.tag.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Tag not found');
    await this.prisma.tag.delete({ where: { id } });
    await this.audit.logMutation({ userId, action: AuditAction.TAG_REMOVED, entityType: 'Tag', entityId: id, before, reason: 'TagDeleted' });
    return { deleted: true, id };
  }

  async getEntityTags(userId: string, entityType: string, entityId: string) {
    this.assertEntityType(entityType);
    await this.assertEntityAccess(userId, entityType, entityId, false);
    return EntityResponseDto.manyUnknown(await this.prisma.tagAssignment.findMany({ where: { entityType, entityId }, orderBy: { createdAt: 'asc' }, include: { tag: true } }));
  }

  async assign(userId: string, entityType: string, entityId: string, body: { tagId: string; organizationId?: string }) {
    this.assertEntityType(entityType);
    const scope = await this.assertEntityAccess(userId, entityType, entityId, true, body.organizationId);
    await this.authorization.assertPermission(userId, 'tag.write', { organizationId: scope.organizationId });
    const tag = await this.prisma.tag.findUnique({ where: { id: body.tagId } });
    if (!tag) throw new NotFoundException('Tag not found');
    const existing = await this.prisma.tagAssignment.findUnique({ where: { tagId_entityType_entityId: { tagId: body.tagId, entityType, entityId } } });
    if (existing) throw new ConflictException('Tag is already assigned');
    const assignment = await this.prisma.tagAssignment.create({ data: { tagId: body.tagId, entityType, entityId, organizationId: scope.organizationId, createdById: userId }, include: { tag: true } });
    await this.audit.logMutation({ userId, action: AuditAction.TAG_ASSIGNED, entityType: 'TagAssignment', entityId: assignment.id, organizationId: assignment.organizationId ?? undefined, after: assignment });
    return EntityResponseDto.fromUnknown(assignment);
  }

  async removeAssignment(userId: string, entityType: string, entityId: string, tagId: string) {
    this.assertEntityType(entityType);
    const scope = await this.assertEntityAccess(userId, entityType, entityId, true);
    await this.authorization.assertPermission(userId, 'tag.write', { organizationId: scope.organizationId });
    const assignment = await this.prisma.tagAssignment.findUnique({ where: { tagId_entityType_entityId: { tagId, entityType, entityId } }, include: { tag: true } });
    if (!assignment) throw new NotFoundException('Tag assignment not found');
    const deleted = await this.prisma.tagAssignment.delete({ where: { id: assignment.id } });
    await this.audit.logMutation({ userId, action: AuditAction.TAG_REMOVED, entityType: 'TagAssignment', entityId: deleted.id, organizationId: scope.organizationId, before: assignment });
    return { deleted: true, id: deleted.id };
  }
}
