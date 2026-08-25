import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataClassification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

@Injectable()
export class EnterpriseService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService) {}

  async policies(userId: string, organizationId?: string) {
    await this.authorization.assertPermission(userId, 'enterprise.read', { organizationId: organizationId });
    return EntityResponseDto.manyUnknown(await this.prisma.authorizationPolicy.findMany({ where: { ...(organizationId ? { organizationId } : {}) }, orderBy: { updatedAt: 'desc' } }));
  }
  async upsertPolicy(userId: string, data: any) {
    const effect = data.effect === 'DENY' ? 'DENY' : data.effect === 'ALLOW' ? 'ALLOW' : null;
    if (!effect || !data.key || !data.permissionKey) throw new ForbiddenException('Invalid authorization policy');
    await this.authorization.assertPermission(userId, 'enterprise.admin', { organizationId: data.organizationId });
    const permission = await this.prisma.permission.findUnique({ where: { key: data.permissionKey } });
    if (!permission) throw new ForbiddenException('Unknown permission in policy');
    const row = await this.prisma.authorizationPolicy.upsert({
      where: { key: data.key },
      update: { permissionKey: data.permissionKey, effect, role: data.role ?? null, organizationId: data.organizationId ?? null, department: data.department ?? null, maxDataClassification: data.maxDataClassification ?? null, ownerOnly: !!data.ownerOnly, subjectScope: data.subjectScope ?? null, conditions: data.conditions ?? null, enabled: data.enabled !== false, createdById: userId },
      create: { key: data.key, permissionKey: data.permissionKey, effect, role: data.role ?? null, organizationId: data.organizationId ?? null, department: data.department ?? null, maxDataClassification: data.maxDataClassification ?? null, ownerOnly: !!data.ownerOnly, subjectScope: data.subjectScope ?? null, conditions: data.conditions ?? null, enabled: data.enabled !== false, createdById: userId },
    });
    await this.audit.logMutation({ userId, action: 'PERMISSION_CHANGE', entityType: 'AuthorizationPolicy', entityId: row.id, organizationId: row.organizationId ?? undefined, after: row });
    return EntityResponseDto.fromUnknown(row);
  }

  async deletePolicy(userId: string, id: string) {
    const row = await this.prisma.authorizationPolicy.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Authorization policy not found');
    await this.authorization.assertPermission(userId, 'enterprise.admin', { organizationId: row.organizationId ?? undefined });
    const deleted = await this.prisma.authorizationPolicy.update({ where: { id }, data: { enabled: false } });
    await this.audit.logMutation({ userId, action: 'PERMISSION_CHANGE', entityType: 'AuthorizationPolicy', entityId: id, organizationId: row.organizationId ?? undefined, before: row, after: deleted, reason: 'ABAC policy disabled' });
    return EntityResponseDto.fromUnknown(deleted);
  }
  async exports(userId: string, organizationId?: string) {
    await this.authorization.assertPermission(userId, 'enterprise.read', { organizationId: organizationId });
    return EntityResponseDto.manyUnknown(await this.prisma.dataExportLog.findMany({ where: { ...(organizationId ? { organizationId } : {}) }, orderBy: { createdAt: 'desc' }, take: 100 }));
  }
  async createExportRecord(userId: string, data: { organizationId?: string; exportType: string; entityType?: string; recordCount?: number; classification?: DataClassification; requestId?: string; ipAddress?: string }) {
    await this.authorization.assertPermission(userId, 'enterprise.export', { organizationId: data.organizationId, classification: data.classification ?? 'INTERNAL' });
    return EntityResponseDto.fromUnknown(await this.prisma.dataExportLog.create({ data: { userId, ...data } }));
  }
  async securityEvents(userId: string, organizationId?: string) {
    await this.authorization.assertPermission(userId, 'enterprise.security', { organizationId: organizationId });
    return EntityResponseDto.manyUnknown(await this.prisma.securityEvent.findMany({ where: { ...(organizationId ? { organizationId } : {}) }, orderBy: { createdAt: 'desc' }, take: 200 }));
  }
  async flags(userId: string, organizationId?: string) {
    await this.authorization.assertPermission(userId, 'feature_flag.read', { organizationId: organizationId });
    return EntityResponseDto.manyUnknown(await this.prisma.featureFlag.findMany({ where: { ...(organizationId ? { OR: [{ organizationId }, { organizationId: null }] } : {}) }, orderBy: { key: 'asc' } }));
  }
  async setFlag(userId: string, data: any) {
    await this.authorization.assertPermission(userId, 'feature_flag.write', { organizationId: data.organizationId });
    return EntityResponseDto.fromUnknown(await this.prisma.featureFlag.upsert({ where: { key: data.key }, update: { enabled: !!data.enabled, rollout: data.rollout ?? 100, organizationId: data.organizationId ?? null, description: data.description }, create: { key: data.key, enabled: !!data.enabled, rollout: data.rollout ?? 100, organizationId: data.organizationId ?? null, description: data.description } }));
  }
  async isEnabled(key: string, organizationId?: string) {
    const rows = await this.prisma.featureFlag.findMany({ where: { key, ...(organizationId ? { OR: [{ organizationId }, { organizationId: null }] } : {}) }, orderBy: { organizationId: 'desc' } });
    const row = rows[0]; return !!row?.enabled && row.rollout > 0;
  }
}
