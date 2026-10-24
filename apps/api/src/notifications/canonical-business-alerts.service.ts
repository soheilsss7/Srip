import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CANONICAL_BUSINESS_ALERTS } from './canonical-business-alerts';

@Injectable()
export class CanonicalBusinessAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the product-level alert contract without creating duplicate rules. */
  catalog() {
    return CANONICAL_BUSINESS_ALERTS;
  }

  async status() {
    const keys = CANONICAL_BUSINESS_ALERTS.map(x => x.key);
    const rules = await this.prisma.notificationRule.findMany({
      where: { key: { in: keys as string[] } },
      select: { key: true, active: true, eventType: true, channels: true, organizationId: true },
      orderBy: { key: 'asc' },
    });
    const byKey = new Map(rules.map(r => [r.key, r]));
    return CANONICAL_BUSINESS_ALERTS.map(alert => ({
      ...alert,
      configured: byKey.has(alert.key),
      active: byKey.get(alert.key)?.active ?? false,
      configuredEventType: byKey.get(alert.key)?.eventType ?? null,
      channels: byKey.get(alert.key)?.channels ?? null,
    }));
  }
}
