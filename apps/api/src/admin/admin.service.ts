import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InteractionKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly customFields: CustomFieldsService,
  ) {}

  private async assertAdmin(userId: string, organizationId?: string) {
    await this.authorization.assertPermission(userId, 'enterprise.admin', { organizationId: organizationId });
  }

  async overview(userId: string, organizationId?: string) {
    await this.assertAdmin(userId, organizationId);
    const orgWhere = organizationId ? { organizationId } : {};
    const [users, organizations, roles, permissions, workflows, integrations, customFields, scoringRules, notificationRules, aiSettings, tags] =
      await Promise.all([
        this.prisma.user.count({ where: { isActive: true, deletedAt: null } }),
        this.prisma.organization.count({ where: { ...orgWhere, deletedAt: null } }),
        this.prisma.role.count({ where: { isActive: true } }),
        this.prisma.permission.count(),
        this.prisma.workflow.count({ where: { ...orgWhere, isActive: true, deletedAt: null } }),
        this.prisma.integrationConnection.count({ where: { ...orgWhere, deletedAt: null } }),
        this.prisma.customField.count({ where: { ...orgWhere, active: true } }),
        this.prisma.scoringRule.count({ where: { ...orgWhere, active: true } }),
        this.prisma.notificationRule.count({ where: { ...orgWhere, active: true } }),
        this.prisma.aiSetting.count({ where: { ...orgWhere, active: true } }),
        this.prisma.tag.count(),
      ]);
    return { users, organizations, roles, permissions, workflows, integrations, customFields, scoringRules, notificationRules, aiSettings, tags };
  }

  async listUsers(userId: string, organizationId?: string, search?: string) {
    await this.assertAdmin(userId, organizationId);
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (search?.trim()) where.OR = [{ email: { contains: search.trim(), mode: 'insensitive' } }, { name: { contains: search.trim(), mode: 'insensitive' } }];
    if (organizationId) where.memberships = { some: { organizationId } };
    return EntityResponseDto.manyUnknown(await this.prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 200,
      select: { id: true, email: true, name: true, isActive: true, emailVerifiedAt: true, lastLoginAt: true, createdAt: true,
        memberships: { where: organizationId ? { organizationId } : undefined, select: { organizationId: true, role: true, department: true, isPrimary: true } } },
    }));
  }

  async setUserActive(actorId: string, userId: string, active: boolean) {
    await this.assertAdmin(actorId);
    if (actorId === userId && !active) throw new ForbiddenException('Administrator cannot deactivate the current account');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { isActive: active } });
    await this.audit.logMutation({ userId: actorId, action: 'UPDATE', entityType: 'User', entityId: userId, after: { isActive: active }, reason: 'Admin user activation changed' });
    return { id: updated.id, isActive: updated.isActive };
  }

  async listOrganizations(userId: string, organizationId?: string) {
    await this.assertAdmin(userId, organizationId);
    return EntityResponseDto.manyUnknown(await this.prisma.organization.findMany({
      where: { ...(organizationId ? { id: organizationId } : {}), deletedAt: null },
      orderBy: { name: 'asc' }, take: 500,
      select: { id: true, name: true, legalName: true, type: true, status: true, country: true, ownerId: true, parentOrganizationId: true, createdAt: true, updatedAt: true },
    }));
  }

  async setOrganizationActive(actorId: string, id: string, active: boolean) {
    await this.assertAdmin(actorId, id);
    const organization = await this.prisma.organization.findUnique({ where: { id } });
    if (!organization || organization.deletedAt) throw new NotFoundException('Organization not found');
    const updated = await this.prisma.organization.update({ where: { id }, data: { status: active ? 'ACTIVE' : 'INACTIVE' } });
    await this.audit.logMutation({ userId: actorId, action: 'UPDATE', entityType: 'Organization', entityId: id, organizationId: id, before: organization, after: updated, reason: 'Admin organization status changed' });
    return EntityResponseDto.fromUnknown(updated);
  }

  async listRoles(userId: string) {
    await this.assertAdmin(userId);
    return EntityResponseDto.manyUnknown(await this.prisma.role.findMany({ where: { isActive: true }, orderBy: { key: 'asc' }, include: { rolePermissions: { include: { permission: true } } } }));
  }

  async listPermissions(userId: string) {
    await this.assertAdmin(userId);
    return EntityResponseDto.manyUnknown(await this.prisma.permission.findMany({ orderBy: { key: 'asc' }, include: { rolePermissions: { select: { role: true } } } }));
  }

  async listTags(userId: string, search?: string) {
    await this.assertAdmin(userId);
    return EntityResponseDto.manyUnknown(await this.prisma.tag.findMany({ where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined, orderBy: { name: 'asc' }, take: 500 }));
  }

  async upsertTag(userId: string, name: string) {
    await this.assertAdmin(userId);
    const normalized = String(name || '').trim();
    if (normalized.length < 1 || normalized.length > 100) throw new BadRequestException('Invalid tag name');
    const tag = await this.prisma.tag.upsert({ where: { name: normalized }, update: {}, create: { name: normalized } });
    await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'Tag', entityId: tag.id, after: tag, reason: 'Admin tag upsert' });
    return EntityResponseDto.fromUnknown(tag);
  }

  async deleteTag(userId: string, id: string) {
    await this.assertAdmin(userId);
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.tag.delete({ where: { id } });
    await this.audit.logMutation({ userId, action: 'DELETE', entityType: 'Tag', entityId: id, before: tag, reason: 'Admin tag deleted' });
    return { deleted: true, id };
  }

  async renameTag(userId: string, id: string, name: string) {
    await this.assertAdmin(userId);
    const normalized = String(name || '').trim();
    if (normalized.length < 1 || normalized.length > 100) throw new BadRequestException('Invalid tag name');
    const existing = await this.prisma.tag.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Tag not found');
    const tag = await this.prisma.tag.upsert({ where: { name: normalized }, create: { name: normalized }, update: {} });
    if (tag.id !== id) {
      await this.prisma.tagAssignment.updateMany({ where: { tagId: id }, data: { tagId: tag.id } }).catch(() => undefined);
      await this.prisma.relationshipTag.updateMany({ where: { tagId: id }, data: { tagId: tag.id } }).catch(() => undefined);
      await this.prisma.tag.delete({ where: { id } }).catch(() => undefined);
    }
    await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'Tag', entityId: tag.id, after: tag, reason: 'Admin tag renamed' });
    return EntityResponseDto.fromUnknown(await this.prisma.tag.findUnique({ where: { id: tag.id } }));
  }

  async listRelationshipTypes(userId: string) {
    await this.assertAdmin(userId);
    return EntityResponseDto.manyUnknown(await this.prisma.relationshipType.findMany({ orderBy: { key: 'asc' } }));
  }

  async upsertRelationshipType(userId: string, data: { key: string; name: string; description?: string; isActive?: boolean }) {
    await this.assertAdmin(userId);
    const key = String(data.key || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(key)) throw new BadRequestException('Invalid relationship type key');
    const row = await this.prisma.relationshipType.upsert({
      where: { key }, update: { name: data.name, description: data.description, isActive: data.isActive ?? true },
      create: { key, name: data.name, description: data.description, isActive: data.isActive ?? true },
    });
    await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'RelationshipType', entityId: row.id, after: row, reason: 'Admin relationship type changed' });
    return EntityResponseDto.fromUnknown(row);
  }

  async listInteractionTypes(userId: string) {
    await this.assertAdmin(userId);
    return EntityResponseDto.manyUnknown(await this.prisma.interactionType.findMany({ orderBy: { key: 'asc' } }));
  }

  async updateInteractionType(userId: string, key: string, data: { name?: string; description?: string; isActive?: boolean }) {
    await this.assertAdmin(userId);
    let enumKey: InteractionKind;
    try { enumKey = key as InteractionKind; if (!Object.values(InteractionKind).includes(enumKey)) throw new Error(); } catch { throw new BadRequestException('Invalid interaction type'); }
    const row = await this.prisma.interactionType.findUnique({ where: { key: enumKey } });
    if (!row) throw new NotFoundException('Interaction type not found');
    const updated = await this.prisma.interactionType.update({ where: { key: enumKey }, data });
    await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'InteractionType', entityId: updated.id, after: updated, reason: 'Admin interaction type changed' });
    return EntityResponseDto.fromUnknown(updated);
  }

  async listWorkflows(userId: string, organizationId?: string) {
    await this.assertAdmin(userId, organizationId);
    return EntityResponseDto.manyUnknown(await this.prisma.workflow.findMany({ where: { ...(organizationId ? { organizationId } : {}), deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 500 }));
  }

  async listIntegrations(userId: string, organizationId?: string) {
    await this.assertAdmin(userId, organizationId);
    return EntityResponseDto.manyUnknown(await this.prisma.integrationConnection.findMany({
      where: { ...(organizationId ? { organizationId } : {}), deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 500,
      select: { id: true, organizationId: true, provider: true, kind: true, status: true, accountLabel: true, scopes: true, expiresAt: true, lastSyncAt: true, lastError: true, createdAt: true, updatedAt: true },
    }));
  }

  async listAudit(userId: string, organizationId?: string, entityType?: string) {
    await this.authorization.assertPermission(userId, 'audit.read', { organizationId: organizationId });
    return EntityResponseDto.manyUnknown(await this.prisma.auditLog.findMany({
      where: { ...(organizationId ? { organizationId } : {}), ...(entityType ? { entityType } : {}) },
      orderBy: { createdAt: 'desc' }, take: 500,
    }));
  }

  async listCustomFields(userId: string, organizationId?: string) {
    return this.customFields.listDefinitions(userId, undefined, organizationId);
  }

  async upsertCustomField(userId: string, data: { key: string; label: string; entityType: string; fieldType: string; options?: unknown; required?: boolean; active?: boolean; organizationId?: string }) {
    return this.customFields.upsertDefinition(userId, data);
  }

  async listScoringRules(userId: string, organizationId?: string) {
    await this.assertAdmin(userId, organizationId);
    return EntityResponseDto.manyUnknown(await this.prisma.scoringRule.findMany({ where: { ...(organizationId ? { organizationId } : {}) }, orderBy: { createdAt: 'desc' }, take: 500 }));
  }

  async upsertScoringRule(userId: string, data: { key: string; name: string; scoreType: string; entityType: string; weight?: number; definition: unknown; version?: number; active?: boolean; organizationId?: string }) {
    await this.assertAdmin(userId, data.organizationId);
    if (!data.key || !data.name || !data.scoreType || !data.entityType || data.definition == null) throw new BadRequestException('Incomplete scoring rule');
    if (typeof data.weight === 'number' && !Number.isFinite(data.weight)) throw new BadRequestException('Invalid weight');
    const row = await this.prisma.scoringRule.upsert({
      where: { key: data.key }, update: { name: data.name, scoreType: data.scoreType, entityType: data.entityType, weight: data.weight ?? 1, definition: data.definition as Prisma.InputJsonValue, version: data.version ?? 1, active: data.active ?? true, organizationId: data.organizationId },
      create: { key: data.key, name: data.name, scoreType: data.scoreType, entityType: data.entityType, weight: data.weight ?? 1, definition: data.definition as Prisma.InputJsonValue, version: data.version ?? 1, active: data.active ?? true, organizationId: data.organizationId, createdById: userId },
    });
    await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'ScoringRule', entityId: row.id, organizationId: data.organizationId, after: row, reason: 'Admin scoring rule changed' });
    return EntityResponseDto.fromUnknown(row);
  }

  async listNotificationRules(userId: string, organizationId?: string) {
    await this.assertAdmin(userId, organizationId);
    return EntityResponseDto.manyUnknown(await this.prisma.notificationRule.findMany({ where: { ...(organizationId ? { organizationId } : {}) }, orderBy: { createdAt: 'desc' }, take: 500 }));
  }

  async upsertNotificationRule(userId: string, data: { key: string; name: string; eventType: string; channels: unknown; conditions?: unknown; template: unknown; active?: boolean; organizationId?: string }) {
    await this.assertAdmin(userId, data.organizationId);
    if (!data.key || !data.name || !data.eventType || !Array.isArray(data.channels) || data.channels.length === 0 || data.template == null) throw new BadRequestException('Incomplete notification rule');
    const allowed = new Set(['IN_APP','EMAIL','PUSH']);
    if (!data.channels.every((x: any) => allowed.has(String(x)))) throw new BadRequestException('Unsupported notification channel');
    const allowedEvents = new Set<string>([...(Object.values(DOMAIN_EVENT_TYPES) as string[]), '*']);
    if (!allowedEvents.has(data.eventType)) throw new BadRequestException('Unsupported canonical notification event type');
    const row = await this.prisma.notificationRule.upsert({
      where: { key: data.key }, update: { name: data.name, eventType: data.eventType, channels: data.channels as Prisma.InputJsonValue, conditions: data.conditions as Prisma.InputJsonValue | undefined, template: data.template as Prisma.InputJsonValue, active: data.active ?? true, organizationId: data.organizationId },
      create: { key: data.key, name: data.name, eventType: data.eventType, channels: data.channels as Prisma.InputJsonValue, conditions: data.conditions as Prisma.InputJsonValue | undefined, template: data.template as Prisma.InputJsonValue, active: data.active ?? true, organizationId: data.organizationId, createdById: userId },
    });
    await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'NotificationRule', entityId: row.id, organizationId: data.organizationId, after: row, reason: 'Admin notification rule changed' });
    return EntityResponseDto.fromUnknown(row);
  }

  async listAiSettings(userId: string, organizationId?: string) {
    await this.assertAdmin(userId, organizationId);
    return EntityResponseDto.manyUnknown(await this.prisma.aiSetting.findMany({ where: { ...(organizationId ? { organizationId } : {}) }, orderBy: { key: 'asc' } }));
  }

  async upsertAiSetting(userId: string, data: { key: string; value: unknown; active?: boolean; organizationId?: string }) {
    await this.assertAdmin(userId, data.organizationId);
    if (!data.key || data.value === undefined) throw new BadRequestException('AI setting key and value are required');
    const existing = await this.prisma.aiSetting.findFirst({ where: { organizationId: data.organizationId ?? null, key: data.key } });
    const row = existing
      ? await this.prisma.aiSetting.update({ where: { id: existing.id }, data: { value: data.value as Prisma.InputJsonValue, active: data.active ?? true, updatedById: userId } })
      : await this.prisma.aiSetting.create({ data: { key: data.key, value: data.value as Prisma.InputJsonValue, active: data.active ?? true, organizationId: data.organizationId, updatedById: userId } });
    await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'AiSetting', entityId: row.id, organizationId: data.organizationId, after: { key: row.key, active: row.active }, reason: 'Admin AI setting changed' });
    return EntityResponseDto.fromUnknown(row);
  }
}
