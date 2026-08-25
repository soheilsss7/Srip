import { ForbiddenException, Injectable } from '@nestjs/common';
import { AccessScopeType, DataClassification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS, ROLES } from './access.constants';
import { AccessAttributes, AuthorizationSubject, attributesAllow, evaluateConditions, canGrantRole, roleCanManageAccess } from './access-policy';

const CLASSIFICATION_RANKS: Record<string, number> = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, RESTRICTED: 3, PRIVATE: 4, HIGHLY_CONFIDENTIAL: 5 };

export type AuthorizationContext = AccessAttributes & {
  organizationId?: string;
  ownerId?: string;
  createdById?: string;
  classification?: DataClassification | string;
  entityType?: string;
  entityId?: string;
  sensitivity?: DataClassification | string;
  departmentId?: string;
  field?: string;
};

export function classificationAllows(maxDataClassification: string | null | undefined, requestedClassification: string | null | undefined): boolean {
  if (!maxDataClassification || !requestedClassification) return true;
  const requestedRank = CLASSIFICATION_RANKS[String(requestedClassification)] ?? 5;
  const maxRank = CLASSIFICATION_RANKS[maxDataClassification] ?? 0;
  return requestedRank <= maxRank;
}

type Membership = {
  id: string; userId: string; organizationId: string; role: string; department: string | null; departmentUnitId: string | null;
  dataScope: DataClassification; accessScope: AccessScopeType; scope: unknown; isPrimary: boolean;
};

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async memberships(userId: string): Promise<Membership[]> {
    const rows = await this.prisma.membership.findMany({ where: { userId }, select: { id: true, userId: true, organizationId: true, role: true, department: true, departmentUnitId: true, dataScope: true, accessScope: true, scope: true, isPrimary: true } });
    if (!rows.length) throw new ForbiddenException('No organization membership');
    return rows;
  }

  async isSuperAdmin(userId: string) {
    return (await this.prisma.membership.count({ where: { userId, role: ROLES.SUPER_ADMIN } })) > 0;
  }

  private async descendants(rootIds: string[]) {
    const seen = new Set(rootIds);
    let frontier = [...rootIds];
    while (frontier.length) {
      const children = await this.prisma.organization.findMany({ where: { parentOrganizationId: { in: frontier }, deletedAt: null }, select: { id: true } });
      frontier = children.map(x => x.id).filter(id => !seen.has(id));
      frontier.forEach(id => seen.add(id));
    }
    return [...seen];
  }

  async accessibleOrganizationIds(userId: string) {
    if (await this.isSuperAdmin(userId)) return null;
    const memberships = await this.memberships(userId);
    const ids: string[] = [];
    for (const m of memberships) {
      if ([ROLES.HOLDING_ADMIN, ROLES.HOLDING_EXECUTIVE].includes(m.role as any) || m.accessScope === AccessScopeType.SUBSIDIARIES) ids.push(...await this.descendants([m.organizationId]));
      else ids.push(m.organizationId);
    }
    return [...new Set(ids)];
  }

  async subjectFor(userId: string, organizationId?: string): Promise<AuthorizationSubject[]> {
    const memberships = await this.memberships(userId);
    return memberships.filter(m => !organizationId || m.organizationId === organizationId || [ROLES.HOLDING_ADMIN, ROLES.HOLDING_EXECUTIVE, ROLES.SUPER_ADMIN].includes(m.role as any)).map(m => ({
      userId, role: m.role, organizationId: m.organizationId, department: m.department, departmentUnitId: m.departmentUnitId,
      dataScope: m.dataScope, accessScope: m.accessScope, scope: (m.scope && typeof m.scope === 'object' ? m.scope : null) as Record<string, unknown> | null,
    }));
  }

  private async organizationAllowed(userId: string, organizationId?: string) {
    if (!organizationId || await this.isSuperAdmin(userId)) return true;
    const scope = await this.accessibleOrganizationIds(userId);
    return !!scope?.includes(organizationId);
  }

  private delegateForEntity(entityType: string): { delegate: string; organizationFields: string[] } | null {
    const map: Record<string, { delegate: string; organizationFields: string[] }> = {
      Organization: { delegate: 'organization', organizationFields: ['id'] },
      Person: { delegate: 'person', organizationFields: ['organizationId'] },
      Relationship: { delegate: 'relationship', organizationFields: ['sourceOrganizationId', 'targetOrganizationId'] },
      Interaction: { delegate: 'interaction', organizationFields: ['organizationId'] },
      Meeting: { delegate: 'meeting', organizationFields: ['organizationId'] },
      Action: { delegate: 'action', organizationFields: ['organizationId'] },
      Commitment: { delegate: 'commitment', organizationFields: ['organizationId'] },
      Project: { delegate: 'project', organizationFields: ['organizationId'] },
      Opportunity: { delegate: 'opportunity', organizationFields: ['organizationId'] },
      Document: { delegate: 'document', organizationFields: ['organizationId'] },
      Recommendation: { delegate: 'recommendation', organizationFields: ['organizationId'] },
      Workflow: { delegate: 'workflow', organizationFields: ['organizationId'] },
      IntegrationConnection: { delegate: 'integrationConnection', organizationFields: ['organizationId'] },
    };
    return map[entityType] ?? null;
  }

  private async assertResourceScope(userId: string, context: AuthorizationContext) {
    if (!context.entityType || !context.entityId || await this.isSuperAdmin(userId)) return;
    const config = this.delegateForEntity(context.entityType);
    if (!config) throw new ForbiddenException(`Unsupported resource type: ${context.entityType}`);
    const delegate: any = (this.prisma as any)[config.delegate];
    if (!delegate?.findUnique) throw new ForbiddenException(`Unsupported resource delegate: ${context.entityType}`);
    const select: Record<string, boolean> = {};
    for (const field of config.organizationFields) select[field] = true;
    const row = await delegate.findUnique({ where: { id: context.entityId }, select });
    if (!row) throw new ForbiddenException('Resource scope unavailable');
    const resourceOrganizations = config.organizationFields.map(f => row[f]).filter(Boolean) as string[];
    if (resourceOrganizations.length) {
      const scope = await this.accessibleOrganizationIds(userId);
      if (scope && resourceOrganizations.some(id => !scope.includes(id))) throw new ForbiddenException('Resource organization scope violation');
    } else if (context.ownerId && context.ownerId !== userId) {
      const subjects = await this.subjectFor(userId);
      const owned = subjects.some(s => s.accessScope !== AccessScopeType.OWNED || s.userId === context.ownerId);
      if (!owned) throw new ForbiddenException('Resource ownership violation');
    }
  }

  async assertPermission(userId: string, permission: string, context: AuthorizationContext = {}) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, deletedAt: true } });
    if (!user?.isActive || user.deletedAt) throw new ForbiddenException('Inactive user');
    if (!PERMISSIONS.includes(permission as any)) throw new ForbiddenException(`Unknown permission: ${permission}`);

    const organizationIds = [context.organizationId, ...(context.relationshipOrganizationIds ?? [])].filter(Boolean) as string[];
    if (organizationIds.length) {
      if (await this.isSuperAdmin(userId)) return true;
      const scope = await this.accessibleOrganizationIds(userId);
      if (scope && organizationIds.some(id => !scope.includes(id))) throw new ForbiddenException('Organization scope violation');
    }
    await this.assertResourceScope(userId, context);

    const primaryOrganizationId = context.organizationId ?? organizationIds[0];
    const subjects = await this.subjectFor(userId, primaryOrganizationId);
    if (!subjects.length) throw new ForbiddenException('No matching organization scope');
    if (!(await this.organizationAllowed(userId, primaryOrganizationId))) throw new ForbiddenException('Organization scope violation');

    const attributes: AccessAttributes = { ...context, organizationId: primaryOrganizationId, departmentUnitId: context.departmentId ?? context.departmentUnitId };
    const policies = await this.prisma.authorizationPolicy.findMany({ where: { enabled: true, permissionKey: permission, OR: [{ organizationId: null }, ...(primaryOrganizationId ? [{ organizationId: primaryOrganizationId }] : [])] } });
    const applicable = subjects.filter(subject => {
      if (primaryOrganizationId && subject.organizationId !== primaryOrganizationId && ![ROLES.HOLDING_ADMIN, ROLES.HOLDING_EXECUTIVE, ROLES.SUPER_ADMIN].includes(subject.role as any)) return false;
      return attributesAllow(subject, attributes);
    });
    if (!applicable.length) throw new ForbiddenException('ABAC attribute policy denied access');

    for (const subject of applicable) {
      const relevant = policies.filter(p => (!p.role || p.role === subject.role) && (!p.department || p.department === subject.department) && (!p.subjectScope || p.subjectScope === subject.accessScope));
      for (const policy of relevant) {
        const requestedClassification = attributes.classification ?? attributes.sensitivity;
        // A policy's maxDataClassification is a hard ABAC ceiling. If the
        // requested data is above that ceiling, the policy must deny access;
        // silently skipping the policy would turn a deny condition into an allow.
        if (policy.maxDataClassification && requestedClassification && !classificationAllows(policy.maxDataClassification, requestedClassification)) {
          throw new ForbiddenException(`ABAC classification ceiling denied access: ${policy.key}`);
        }
        if (policy.ownerOnly && attributes.ownerId !== userId && attributes.createdById !== userId) continue;
        if (!evaluateConditions(subject, attributes, policy.conditions)) continue;
        if (policy.effect === 'DENY') throw new ForbiddenException(`ABAC policy denied access: ${policy.key}`);
      }
    }

    const grants = await this.prisma.rolePermission.findMany({ where: { role: { in: applicable.map(s => s.role) }, permission: { key: permission } }, select: { role: true } });
    if (!grants.length) throw new ForbiddenException(`Missing permission: ${permission}`);
    return true;
  }

  async assertAnyOrganizationAccess(userId: string, organizationIds: string[]) {
    if (!organizationIds.length || await this.isSuperAdmin(userId)) return true;
    const scope = await this.accessibleOrganizationIds(userId);
    if (!scope || organizationIds.some(id => scope.includes(id))) return true;
    throw new ForbiddenException('Organization scope violation');
  }

  async assertCanManageMembership(actorId: string, targetOrganizationId: string, targetRole?: string) {
    const memberships = await this.subjectFor(actorId);
    const scope = await this.accessibleOrganizationIds(actorId);
    if (await this.isSuperAdmin(actorId)) return true;
    if (!scope?.includes(targetOrganizationId)) throw new ForbiddenException('Cannot manage membership outside actor scope');
    const manager = memberships.find(m => m.organizationId === targetOrganizationId || [ROLES.HOLDING_ADMIN, ROLES.HOLDING_EXECUTIVE].includes(m.role as any));
    if (!manager || !roleCanManageAccess(manager.role)) throw new ForbiddenException('Role management not permitted');
    if (targetRole && !canGrantRole(manager.role, targetRole)) throw new ForbiddenException('Cannot grant requested role');
    return true;
  }
}
