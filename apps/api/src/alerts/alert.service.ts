import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertModule as AlertModuleEnum, AlertSeverity, Prisma } from '@prisma/client';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/* ============================================================================
   AlertService — فاز ۳ پلن یکپارچه‌سازی (ADR-0007)
   ----------------------------------------------------------------------------
   یک منبع واحد برای همهٔ هشدارها. منطق تشخیصِ هر ماژول عیناً حفظ شده و فقط
   خروجی‌اش به رکورد Alert با شکل واحد می‌نشیند (نگاشت قفل‌شده در
   INTEGRATION-PLAN.md فاز ۳ — هیچ آستانه‌ای تغییر نکرده):

   RELATIONSHIP: سلامت < ۵۵ → WARNING · ریسک ≥ ۴۰ → CRITICAL ·
                 کیدنس شکسته (بدون تعامل بیش از cadence+۲۰ روز) → CRITICAL/WARNING
   ACTION/COMMITMENT: overdue → CRITICAL · dueSoon (≤۷ روز) → WARNING
   (تشخیص‌گرهای PUBLICS/MEETING/WORKFLOW/DATA_QUALITY/SECURITY/MONITORING
   در Sprint 2 به همین سرویس اضافه می‌شوند — فقط detector جدید، بدون UI جدید.)
   ========================================================================== */

export type CreateAlertInput = {
  module: AlertModuleEnum;
  severity: AlertSeverity;
  entityType: string;
  entityId: string;
  title: string;
  reason: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AlertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  /** ساخت/به‌روزرسانی هشدار — idempotent بر اساس (module, entityId, title) */
  async create(input: CreateAlertInput) {
    const existing = await this.prisma.alert.findFirst({
      where: { module: input.module, entityId: input.entityId, title: input.title, resolvedAt: null },
    });
    if (existing) {
      return this.prisma.alert.update({
        where: { id: existing.id },
        data: { severity: input.severity, reason: input.reason, actionLabel: input.actionLabel ?? existing.actionLabel, actionUrl: input.actionUrl ?? existing.actionUrl },
      });
    }
    return this.prisma.alert.create({ data: input as Prisma.AlertUncheckedCreateInput });
  }

  async list(userId: string, filters: { module?: AlertModuleEnum; severity?: AlertSeverity; open?: boolean; page?: number; pageSize?: number }) {
    await this.authorization.assertPermission(userId, 'dashboard.read', {});
    const where: Prisma.AlertWhereInput = {
      ...(filters.module ? { module: filters.module } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(filters.open === false ? {} : { resolvedAt: null }),
    };
    const page = filters.page ?? 1;
    const pageSize = Math.min(200, filters.pageSize ?? 100);
    const [items, total, counts] = await Promise.all([
      this.prisma.alert.findMany({ where, orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.alert.count({ where }),
      this.prisma.alert.groupBy({ by: ['module', 'severity'], where: { resolvedAt: null }, _count: { _all: true } }),
    ]);
    const summary: Record<string, number> = { total: counts.reduce((s, c) => s + c._count._all, 0), CRITICAL: 0, WARNING: 0, INFO: 0 };
    for (const c of counts) summary[c.severity] = (summary[c.severity] ?? 0) + c._count._all;
    return { items, total, page, pageSize, summary, byModule: counts.map((c) => ({ module: c.module, severity: c.severity, count: c._count._all })) };
  }

  async resolve(userId: string, id: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    const resolved = await this.prisma.alert.update({ where: { id }, data: { resolvedAt: new Date(), resolvedBy: userId } });
    await this.audit.logMutation({
      userId,
      action: 'UPDATE' as any,
      entityType: 'Alert',
      entityId: id,
      after: { resolved: true, module: alert.module, title: alert.title },
    }).catch(() => undefined);
    return resolved;
  }

  /* ------------------------------ تشخیص‌گرها ------------------------------ */

  /** RELATIONSHIP — همان آستانه‌های موجود /relationships/alerts (بدون تغییر) */
  async detectRelationshipAlerts(userId: string) {
    await this.authorization.assertPermission(userId, 'relationship.read', {});
    const scope = (await this.authorization.accessibleOrganizationIds(userId)) ?? [];
    const rels = await this.prisma.relationship.findMany({
      where: { deletedAt: null, OR: [{ sourceOrganizationId: { in: scope } }, { targetOrganizationId: { in: scope } }] },
    });
    const created: CreateAlertInput[] = [];
    const now = Date.now();
    for (const rel of rels) {
      const label = rel.id;
      if (rel.healthScore < 55) {
        created.push({
          module: AlertModuleEnum.RELATIONSHIP, severity: AlertSeverity.WARNING, entityType: 'RELATIONSHIP', entityId: rel.id,
          title: `سلامت رابطه پایین: ${label}`,
          reason: `امتیاز سلامت ${rel.healthScore} است؛ کمتر از آستانهٔ ۵۵.`,
          actionLabel: 'بررسی رابطه', actionUrl: `/relationships/${rel.id}`,
        });
      }
      if (rel.riskScore >= 40) {
        created.push({
          module: AlertModuleEnum.RELATIONSHIP, severity: AlertSeverity.CRITICAL, entityType: 'RELATIONSHIP', entityId: rel.id,
          title: `ریسک رابطه بحرانی: ${label}`,
          reason: `امتیاز ریسک ${rel.riskScore} است؛ بالاتر از آستانهٔ ۴۰.`,
          actionLabel: 'بررسی ریسک', actionUrl: `/relationships/${rel.id}`,
        });
      }
      if (rel.lastInteractionAt) {
        const stale = Math.floor((now - rel.lastInteractionAt.getTime()) / DAY);
        const cadence = rel.reviewCadenceDays || 90;
        if (stale > cadence + 20) {
          created.push({
            module: AlertModuleEnum.RELATIONSHIP, severity: AlertSeverity.CRITICAL, entityType: 'RELATIONSHIP', entityId: rel.id,
            title: `کیدنس شکسته: ${label}`,
            reason: `${stale} روز بدون تعامل (هدف ${cadence} روز).`,
            actionLabel: 'ثبت تعامل', actionUrl: `/relationships/${rel.id}`,
          });
        } else if (stale > cadence) {
          created.push({
            module: AlertModuleEnum.RELATIONSHIP, severity: AlertSeverity.WARNING, entityType: 'RELATIONSHIP', entityId: rel.id,
            title: `کیدنس عقب‌افتاده: ${label}`,
            reason: `${stale} روز بدون تعامل (هدف ${cadence} روز).`,
            actionLabel: 'ثبت تعامل', actionUrl: `/relationships/${rel.id}`,
          });
        }
      }
    }
    for (const input of created) await this.create(input);
    return { module: 'RELATIONSHIP', detected: created.length };
  }

  /** ACTION — overdue → CRITICAL · dueSoon ≤ ۷ روز → WARNING */
  async detectActionAlerts(userId: string) {
    await this.authorization.assertPermission(userId, 'action.read', {});
    const scope = (await this.authorization.accessibleOrganizationIds(userId)) ?? [];
    const actions = await this.prisma.action.findMany({
      where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { not: null } },
      include: { relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } } },
    });
    const visible = actions.filter((a) => !a.relationship || scope.includes(a.relationship.sourceOrganizationId) || scope.includes(a.relationship.targetOrganizationId));
    const created: CreateAlertInput[] = [];
    const now = Date.now();
    for (const action of visible) {
      const due = action.dueAt!.getTime();
      if (due < now) {
        created.push({
          module: AlertModuleEnum.ACTION, severity: AlertSeverity.CRITICAL, entityType: 'ACTION', entityId: action.id,
          title: `اقدام عقب‌افتاده: ${action.title}`,
          reason: `سررسید ${action.dueAt!.toISOString().slice(0, 10)} گذشته است.`,
          actionLabel: 'رفتن به اقدام', actionUrl: '/actions',
        });
      } else if (due - now <= 7 * DAY) {
        created.push({
          module: AlertModuleEnum.ACTION, severity: AlertSeverity.WARNING, entityType: 'ACTION', entityId: action.id,
          title: `اقدام نزدیک به سررسید: ${action.title}`,
          reason: `سررسید ${action.dueAt!.toISOString().slice(0, 10)} در ۷ روز آینده است.`,
          actionLabel: 'رفتن به اقدام', actionUrl: '/actions',
        });
      }
    }
    for (const input of created) await this.create(input);
    return { module: 'ACTION', detected: created.length };
  }

  /** COMMITMENT — overdue → CRITICAL · dueSoon ≤ ۷ روز → WARNING */
  async detectCommitmentAlerts(userId: string) {
    await this.authorization.assertPermission(userId, 'commitment.read', {});
    const scope = (await this.authorization.accessibleOrganizationIds(userId)) ?? [];
    const commitments = await this.prisma.commitment.findMany({
      where: { deletedAt: null, status: { in: ['OPEN', 'OVERDUE'] }, dueAt: { not: null }, organizationId: { in: scope } },
    });
    const created: CreateAlertInput[] = [];
    const now = Date.now();
    for (const c of commitments) {
      const due = c.dueAt!.getTime();
      if (due < now) {
        created.push({
          module: AlertModuleEnum.COMMITMENT, severity: AlertSeverity.CRITICAL, entityType: 'COMMITMENT', entityId: c.id,
          title: `تعهد عقب‌افتاده: ${c.description}`,
          reason: `سررسید ${c.dueAt!.toISOString().slice(0, 10)} گذشته است.`,
          actionLabel: 'رفتن به تعهد', actionUrl: '/commitments',
        });
      } else if (due - now <= 7 * DAY) {
        created.push({
          module: AlertModuleEnum.COMMITMENT, severity: AlertSeverity.WARNING, entityType: 'COMMITMENT', entityId: c.id,
          title: `تعهد نزدیک به سررسید: ${c.description}`,
          reason: `سررسید ${c.dueAt!.toISOString().slice(0, 10)} در ۷ روز آینده است.`,
          actionLabel: 'رفتن به تعهد', actionUrl: '/commitments',
        });
      }
    }
    for (const input of created) await this.create(input);
    return { module: 'COMMITMENT', detected: created.length };
  }

  /** اجرای همهٔ تشخیص‌گرهای فعال (برای job زمان‌بندی‌شده یا دکمهٔ دستی) */
  async detectAll(userId: string) {
    const results = [] as Array<{ module: string; detected: number; error?: string }>;
    const runners: Array<[string, () => Promise<{ detected: number }>]> = [
      ['RELATIONSHIP', () => this.detectRelationshipAlerts(userId)],
      ['ACTION', () => this.detectActionAlerts(userId)],
      ['COMMITMENT', () => this.detectCommitmentAlerts(userId)],
    ];
    for (const [name, run] of runners) {
      try { results.push({ module: name, ...(await run()) }); }
      catch (error) { results.push({ module: name, detected: 0, error: (error as Error).message }); }
    }
    return results;
  }
}
