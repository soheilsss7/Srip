import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessScopeType, DataClassification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { canGrantRole } from '../common/authorization/access-policy';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

const RESERVED = new Set(['SUPER_ADMIN']);

@Injectable()
export class AuthorizationAdminService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService) {}

  async listRoles(userId: string, organizationId?: string) {
    await this.authorization.assertPermission(userId, 'role.manage', { organizationId: organizationId });
    return EntityResponseDto.manyUnknown(await this.prisma.role.findMany({ where: { isActive: true }, include: { rolePermissions: { include: { permission: true } } }, orderBy: { key: 'asc' } }));
  }

  async createRole(userId: string, data: { key: string; name: string; description?: string; permissions?: string[] }) {
    const key = String(data.key || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(key) || RESERVED.has(key)) throw new BadRequestException('Invalid or reserved role key');
    await this.authorization.assertPermission(userId, 'role.manage', {});
    const role = await this.prisma.role.create({ data: { key, name: data.name, description: data.description, isSystem: false } });
    for (const permissionKey of [...new Set(data.permissions ?? [])]) {
      const permission = await this.prisma.permission.findUnique({ where: { key: permissionKey } });
      if (!permission) throw new BadRequestException(`Unknown permission: ${permissionKey}`);
      await this.prisma.rolePermission.create({ data: { role: key, permissionId: permission.id } });
    }
    await this.audit.logMutation({ userId, action: 'PERMISSION_CHANGE', entityType: 'Role', entityId: role.id, after: role, reason: 'RBAC custom role created' });
    return EntityResponseDto.fromUnknown(await this.prisma.role.findUnique({ where: { id: role.id }, include: { rolePermissions: { include: { permission: true } } } }));
  }

  async setRolePermissions(userId: string, roleKey: string, permissionKeys: string[]) {
    await this.authorization.assertPermission(userId, 'role.manage', {});
    const role = await this.prisma.role.findUnique({ where: { key: roleKey } });
    if (!role || !role.isActive) throw new NotFoundException('Role not found');
    const keys = [...new Set(permissionKeys)];
    const permissions = await this.prisma.permission.findMany({ where: { key: { in: keys } } });
    if (permissions.length !== keys.length) throw new BadRequestException('One or more permissions do not exist');
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { role: roleKey } }),
      ...permissions.map(permission => this.prisma.rolePermission.create({ data: { role: roleKey, permissionId: permission.id } })),
    ]);
    await this.audit.logMutation({ userId, action: 'PERMISSION_CHANGE', entityType: 'Role', entityId: role.id, after: { roleKey, permissions: keys }, reason: 'RBAC permissions updated' });
    return EntityResponseDto.fromUnknown(await this.prisma.role.findUnique({ where: { key: roleKey }, include: { rolePermissions: { include: { permission: true } } } }));
  }

  async listMemberships(userId: string, organizationId: string, page = 1, limit = 100) {
    await this.authorization.assertPermission(userId, 'access.manage', { organizationId: organizationId });
    await this.authorization.assertCanManageMembership(userId, organizationId);
    const safePage = Math.max(1, Math.trunc(Number(page) || 1));
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(Number(limit) || 100)));
    const where = { organizationId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({ where, include: { user: { select: { id: true, email: true, name: true, isActive: true } }, roleRef: true, departmentUnit: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (safePage - 1) * safeLimit, take: safeLimit }),
      this.prisma.membership.count({ where }),
    ]);
    return { items: EntityResponseDto.manyUnknown(items), page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) };
  }

  async assignMembership(actorId: string, data: { userId: string; organizationId: string; role: string; department?: string; departmentUnitId?: string; dataScope?: DataClassification; accessScope?: AccessScopeType; scope?: Record<string, unknown>; isPrimary?: boolean }) {
    const role = await this.prisma.role.findUnique({ where: { key: data.role } });
    if (!role || !role.isActive) throw new BadRequestException('Role does not exist or is inactive');
    await this.authorization.assertCanManageMembership(actorId, data.organizationId, data.role);
    if (data.departmentUnitId) {
      const unit = await this.prisma.organizationUnit.findFirst({ where: { id: data.departmentUnitId, organizationId: data.organizationId, status: 'ACTIVE' } });
      if (!unit) throw new BadRequestException('Department unit is not in target organization');
    }
    if (data.accessScope === AccessScopeType.DEPARTMENT && !data.departmentUnitId && !data.department) throw new BadRequestException('Department scope requires department or departmentUnitId');
    if (data.accessScope === AccessScopeType.OWNED && !data.scope) data.scope = {};
    const row = await this.prisma.membership.upsert({
      where: { userId_organizationId: { userId: data.userId, organizationId: data.organizationId } },
      update: { role: data.role, department: data.department, departmentUnitId: data.departmentUnitId, dataScope: data.dataScope ?? DataClassification.INTERNAL, accessScope: data.accessScope ?? AccessScopeType.ORGANIZATION, scope: data.scope, isPrimary: !!data.isPrimary },
      create: { userId: data.userId, organizationId: data.organizationId, role: data.role, department: data.department, departmentUnitId: data.departmentUnitId, dataScope: data.dataScope ?? DataClassification.INTERNAL, accessScope: data.accessScope ?? AccessScopeType.ORGANIZATION, scope: data.scope, isPrimary: !!data.isPrimary },
    });
    await this.audit.logMutation({ userId: actorId, action: 'PERMISSION_CHANGE', entityType: 'Membership', entityId: row.id, organizationId: data.organizationId, after: row, reason: 'RBAC membership assigned/updated' });
    return EntityResponseDto.fromUnknown(row);
  }

  async revokeMembership(actorId: string, membershipId: string) {
    const membership = await this.prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership) throw new NotFoundException('Membership not found');
    await this.authorization.assertCanManageMembership(actorId, membership.organizationId, membership.role);
    if (membership.role === 'SUPER_ADMIN' && !(await this.authorization.isSuperAdmin(actorId))) throw new ForbiddenException('Only super admin can revoke super-admin membership');
    await this.prisma.membership.delete({ where: { id: membershipId } });
    await this.audit.logMutation({ userId: actorId, action: 'PERMISSION_CHANGE', entityType: 'Membership', entityId: membershipId, organizationId: membership.organizationId, before: membership, reason: 'RBAC membership revoked' });
    return { revoked: true, membershipId };
  }

  async evaluate(userId: string, permission: string, context: any) {
    await this.authorization.assertPermission(userId, permission, { ...context });
    return { allowed: true, permission, userId, evaluatedAt: new Date().toISOString() };
  }
}
