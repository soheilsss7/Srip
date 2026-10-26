import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessLevel, FunctionalRole, Prisma, ScopeType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/* ============================================================================
   UserAccessService — فاز ۴ پلن یکپارچه‌سازی (ADR-0008)
   ----------------------------------------------------------------------------
   RBAC سه‌بعدی: scope × accessLevel × functionalRole (جایگزین تدریجی ۱۰ نقش
   سلسله‌مراتبی). مدل Role قدیمی دست‌نخورده می‌ماند (rollback)؛ سوییچ can()
   در Sprint 2 انجام می‌شود. نگاشت ۱۰→۳بعد دقیقاً طبق جدول فاز ۴ پلن.
   ========================================================================== */

/** نقش‌های قدیم → (scope, accessLevel, functionalRole) — بدون از دست رفتن هیچ سطح دسترسی */
export const ROLE_TO_ACCESS: Record<string, { scope: ScopeType; accessLevel: AccessLevel; functionalRole: FunctionalRole | null }> = {
  SUPER_ADMIN: { scope: 'ALL', accessLevel: 'ADMIN', functionalRole: null },
  HOLDING_ADMIN: { scope: 'ALL', accessLevel: 'ADMIN', functionalRole: null },
  HOLDING_EXECUTIVE: { scope: 'ALL', accessLevel: 'EXECUTIVE', functionalRole: null },
  SUBSIDIARY_ADMIN: { scope: 'ORGANIZATION', accessLevel: 'ADMIN', functionalRole: null },
  SUBSIDIARY_EXECUTIVE: { scope: 'ORGANIZATION', accessLevel: 'EXECUTIVE', functionalRole: null },
  RELATIONSHIP_MANAGER: { scope: 'ORGANIZATION', accessLevel: 'STANDARD', functionalRole: 'RELATIONSHIP_MANAGER' },
  PROJECT_MANAGER: { scope: 'ORGANIZATION', accessLevel: 'STANDARD', functionalRole: 'PROJECT_MANAGER' },
  ANALYST: { scope: 'ORGANIZATION', accessLevel: 'STANDARD', functionalRole: 'ANALYST' },
  STANDARD_USER: { scope: 'ORGANIZATION', accessLevel: 'STANDARD', functionalRole: null },
  READ_ONLY: { scope: 'ORGANIZATION', accessLevel: 'READ_ONLY', functionalRole: null },
};

/** خط پایهٔ مجوزها بر اساس سطح دسترسی (سلسله‌مراتبی: ADMIN ⊇ EXECUTIVE ⊇ STANDARD ⊇ READ_ONLY)
 *  کلیدها از کاتالوگ واقعی `common/authorization/access.constants.ts` */
const ACCESS_LEVEL_PERMISSIONS: Record<AccessLevel, string[]> = {
  READ_ONLY: [
    'org.read', 'entity.read', 'tag.read', 'person.read', 'relationship.read', 'interaction.read',
    'meeting.read', 'action.read', 'commitment.read', 'project.read', 'document.read', 'opportunity.read',
    'search.read', 'analytics.read', 'network.read', 'report.read', 'recommendation.read', 'workflow.read',
  ],
  STANDARD: [
    'org.write', 'entity.write', 'tag.write', 'person.write', 'interaction.write', 'meeting.write',
    'action.write', 'commitment.write', 'project.write', 'document.write', 'opportunity.write',
    'recommendation.write', 'search.write', 'workflow.execute', 'approval.request', 'data.quality.read',
  ],
  EXECUTIVE: [
    'analytics.write', 'report.export', 'ai.executive_brief', 'ai.query',
    'relationship.strategic.read', 'relationship.risk.read', 'relationship.notes.read',
    'approval.read', 'enterprise.read', 'metrics.read', 'security.read', 'integration.read',
    'person.sensitive_contacts.read',
  ],
  ADMIN: [
    'org.admin', 'person.delete', 'relationship.delete', 'relationship.internal.read', 'relationship.sensitive_contacts.read',
    'access.manage', 'role.manage', 'admin.users', 'admin.organizations', 'admin.catalog', 'admin.custom_fields',
    'admin.scoring_rules', 'admin.notification_rules', 'admin.ai_settings', 'admin.integrations', 'admin.audit',
    'scoring.admin', 'feature_flag.read', 'feature_flag.write', 'enterprise.admin', 'enterprise.export',
    'enterprise.security', 'approval.decide', 'data.import', 'data.import.approve', 'data.quality.execute',
    'data.restore', 'data.permanent_delete', 'data.lifecycle_status', 'privacy.read', 'privacy.export',
    'privacy.access', 'privacy.erase', 'privacy.manage', 'privacy.audit', 'session.admin.revoke',
    'integration.write', 'workflow.write', 'audit.read',
  ],
};

/** مجوزهای افزودهٔ هر تخصص کاری (روی خط پایه) */
const FUNCTIONAL_ROLE_PERMISSIONS: Record<FunctionalRole, string[]> = {
  RELATIONSHIP_MANAGER: ['relationship.write', 'interaction.write', 'meeting.write', 'commitment.write', 'action.write'],
  PROJECT_MANAGER: ['project.write', 'opportunity.write', 'workflow.execute'],
  ANALYST: ['analytics.read', 'analytics.write', 'report.read', 'report.export', 'scoring.read'],
};

export function resolveEffectivePermissions(access: { accessLevel: AccessLevel; functionalRole?: FunctionalRole | null; permissionOverrides?: Prisma.JsonValue | null }): string[] {
  const base = new Set<string>();
  // وراثت سلسله‌مراتبی سطح دسترسی
  const chain: AccessLevel[] = access.accessLevel === 'ADMIN'
    ? ['READ_ONLY', 'STANDARD', 'EXECUTIVE', 'ADMIN']
    : access.accessLevel === 'EXECUTIVE'
      ? ['READ_ONLY', 'STANDARD', 'EXECUTIVE']
      : access.accessLevel === 'STANDARD'
        ? ['READ_ONLY', 'STANDARD']
        : ['READ_ONLY'];
  for (const level of chain) for (const p of ACCESS_LEVEL_PERMISSIONS[level]) base.add(p);
  // تخصص کاری
  if (access.functionalRole) for (const p of FUNCTIONAL_ROLE_PERMISSIONS[access.functionalRole]) base.add(p);
  // استثناها (فقط موارد استثنایی، نه کل لیست)
  const overrides = access.permissionOverrides as { add?: string[]; remove?: string[] } | null | undefined;
  if (overrides && typeof overrides === 'object') {
    for (const p of overrides.add ?? []) base.add(p);
    for (const p of overrides.remove ?? []) base.delete(p);
  }
  return [...base].sort();
}

@Injectable()
export class UserAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** مهاجرت نقش قدیمی یک کاربر به مدل سه‌بعدی (idempotent) */
  async migrateRoleToAccess(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { memberships: { include: { organization: { select: { parentOrganizationId: true } } } } } });
    if (!user) throw new NotFoundException('User not found');
    const primary = user.memberships.find((m) => m.isPrimary) ?? user.memberships[0];
    const legacyRole = primary?.role ?? 'STANDARD_USER';
    const mapped = ROLE_TO_ACCESS[legacyRole] ?? ROLE_TO_ACCESS.STANDARD_USER;
    const scopeOrgIds = mapped.scope === 'ORGANIZATION' && primary ? [primary.organizationId] : [];
    const data = {
      scope: mapped.scope,
      scopeOrgIds,
      accessLevel: mapped.accessLevel,
      functionalRole: mapped.functionalRole,
    };
    const record = await this.prisma.userAccess.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    return { ...record, legacyRole, effectivePermissions: resolveEffectivePermissions(record) };
  }

  /** مهاجرت همهٔ کاربران (اسکریپت استقرار) */
  async migrateAll() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    let migrated = 0;
    for (const u of users) {
      try { await this.migrateRoleToAccess(u.id); migrated++; } catch { /* کاربر بدون membership — رد شد */ }
    }
    return { total: users.length, migrated };
  }

  async get(userId: string) {
    const record = await this.prisma.userAccess.findUnique({ where: { userId } });
    if (!record) throw new NotFoundException('UserAccess not found — run migrateRoleToAccess first');
    return { ...record, effectivePermissions: resolveEffectivePermissions(record) };
  }
}
