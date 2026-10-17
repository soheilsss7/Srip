import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/* ============================================================================
   EntityScoreService — فاز ۲ پلن یکپارچه‌سازی (ADR-0006)
   ----------------------------------------------------------------------------
   یک جدول واحد امتیاز برای همهٔ دامنه‌ها (RELATIONSHIP / PUBLIC_GROUP /
   PUBLIC_MEMBER) با فرمول شفاف و نسخه‌دار:

     composite = Σ (factor.value × factor.weight) / Σ weights

   این سرویس «مدل خواندنِ نمایش» است؛ موتور تحلیلی عمیق (Score/ScoreVersion
   با ۱۲ فاکتور) دست‌نخورده باقی می‌ماند و EntityScore از همان ستون‌های
   رابطه composite نمایشی می‌سازد — هیچ فاکتوری حذف یا دوباره‌نویسی نمی‌شود.

   وزن‌های پیش‌فرض (قابل تنظیم از ScoreVersion در Sprint 2 — per-tenant):
   ========================================================================== */

export const ENTITY_SCORE_FORMULA_VERSION = '1.0.0-plan-phase2';

export type EntityScoreFactorKey =
  | 'health' | 'risk' | 'strategic' | 'trust'
  | 'engagement' | 'influence' | 'opportunity' | 'resilience';

/** risk معکوس وارد فرمول می‌شود (ریسک بالا = امتیاز کمتر) */
export const DEFAULT_FACTOR_WEIGHTS: Record<EntityScoreFactorKey, number> = {
  health: 0.25,
  risk: 0.2,
  strategic: 0.15,
  trust: 0.15,
  engagement: 0.1,
  influence: 0.05,
  opportunity: 0.05,
  resilience: 0.05,
};

const FACTOR_SOURCES: Record<EntityScoreFactorKey, { column: 'healthScore' | 'riskScore' | 'strategicScore' | 'trustScore' | 'engagementScore' | 'influenceScore' | 'opportunityScore' | 'resilienceScore'; inverted: boolean }> = {
  health: { column: 'healthScore', inverted: false },
  risk: { column: 'riskScore', inverted: true },
  strategic: { column: 'strategicScore', inverted: false },
  trust: { column: 'trustScore', inverted: false },
  engagement: { column: 'engagementScore', inverted: false },
  influence: { column: 'influenceScore', inverted: false },
  opportunity: { column: 'opportunityScore', inverted: false },
  resilience: { column: 'resilienceScore', inverted: false },
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function computeComposite(
  values: Record<EntityScoreFactorKey, number>,
  weights: Record<EntityScoreFactorKey, number> = DEFAULT_FACTOR_WEIGHTS,
) {
  const keys = Object.keys(DEFAULT_FACTOR_WEIGHTS) as EntityScoreFactorKey[];
  let weighted = 0;
  let total = 0;
  const factors: Record<string, { value: number; weight: number; inverted: boolean }> = {};
  for (const key of keys) {
    const raw = clamp(Number.isFinite(values[key]) ? values[key] : 0);
    const inverted = FACTOR_SOURCES[key].inverted;
    const value = inverted ? 100 - raw : raw;
    const weight = Math.max(0, weights[key] ?? DEFAULT_FACTOR_WEIGHTS[key]);
    weighted += value * weight;
    total += weight;
    factors[key] = { value, weight, inverted };
  }
  const composite = total > 0 ? clamp(weighted / total) : 0;
  return { composite: Math.round(composite * 10) / 10, factors };
}

@Injectable()
export class EntityScoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  /** محاسبه و ذخیرهٔ امتیاز مرکب یک موجودیت — تنها نقطهٔ نوشتن EntityScore */
  async calculate(userId: string, entityType: 'RELATIONSHIP' | 'PUBLIC_GROUP' | 'PUBLIC_MEMBER', entityId: string) {
    if (entityType !== 'RELATIONSHIP') {
      // عموم‌ها طبق ADR-0009 در Sprint 2 به API واقعی می‌آیند؛ تا آن زمان
      // این نوع صراحتاً «هنوز پیاده نشده» است (نه بی‌صدا خالی).
      throw new NotFoundException(`EntityScore برای «${entityType}» در Sprint 2 فعال می‌شود (ADR-0009).`);
    }
    const rel = await this.prisma.relationship.findUnique({ where: { id: entityId } });
    if (!rel || rel.deletedAt) throw new NotFoundException('Relationship not found');
    await this.authorization.assertPermission(userId, 'relationship.read', { organizationId: rel.sourceOrganizationId });

    const values = {
      health: rel.healthScore,
      risk: rel.riskScore,
      strategic: rel.strategicScore,
      trust: rel.trustScore,
      engagement: rel.engagementScore,
      influence: rel.influenceScore,
      opportunity: rel.opportunityScore,
      resilience: rel.resilienceScore,
    };
    const { composite, factors } = computeComposite(values);
    const record = await this.prisma.entityScore.upsert({
      where: { entityType_entityId: { entityType: 'RELATIONSHIP', entityId } },
      update: { composite, factors: factors as any, formulaVersion: ENTITY_SCORE_FORMULA_VERSION, lastCalculatedAt: new Date() },
      create: { entityType: 'RELATIONSHIP', entityId, composite, factors: factors as any, formulaVersion: ENTITY_SCORE_FORMULA_VERSION },
    });
    await this.audit.logMutation({
      userId,
      action: 'UPDATE' as any,
      entityType: 'EntityScore',
      entityId: record.id,
      organizationId: rel.sourceOrganizationId,
      after: { entityType: 'RELATIONSHIP', target: entityId, composite, formulaVersion: ENTITY_SCORE_FORMULA_VERSION },
    }).catch(() => undefined);
    return record;
  }

  /** خواندن یک امتیاز (با بررسی دسترسی به موجودیت) */
  async get(userId: string, entityType: 'RELATIONSHIP' | 'PUBLIC_GROUP' | 'PUBLIC_MEMBER', entityId: string) {
    const record = await this.prisma.entityScore.findUnique({ where: { entityType_entityId: { entityType, entityId } } });
    if (!record) throw new NotFoundException('EntityScore not found');
    if (entityType === 'RELATIONSHIP') {
      const rel = await this.prisma.relationship.findUnique({ where: { id: entityId } });
      if (rel) await this.authorization.assertPermission(userId, 'relationship.read', { organizationId: rel.sourceOrganizationId });
    }
    return record;
  }

  /** فهرست امتیازهای روابطِ در محدودهٔ دسترسی کاربر */
  async list(userId: string, page = 1, pageSize = 50) {
    await this.authorization.assertPermission(userId, 'relationship.read', {});
    const scope = (await this.authorization.accessibleOrganizationIds(userId)) ?? [];
    const relationships = await this.prisma.relationship.findMany({
      where: { deletedAt: null, OR: [{ sourceOrganizationId: { in: scope } }, { targetOrganizationId: { in: scope } }] },
      select: { id: true },
      take: 1000,
    });
    const ids = relationships.map((r) => r.id);
    if (!ids.length) return { items: [], total: 0, page, pageSize };
    const [items, total] = await Promise.all([
      this.prisma.entityScore.findMany({
        where: { entityType: 'RELATIONSHIP', entityId: { in: ids } },
        orderBy: { composite: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.entityScore.count({ where: { entityType: 'RELATIONSHIP', entityId: { in: ids } } }),
    ]);
    return { items, total, page, pageSize };
  }
}
