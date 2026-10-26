import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEvent, EventBusService } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';
import { SYSTEM_USER_ID } from '../common/system-actor';
import { PerformanceCacheService } from '../common/performance/performance-cache.service';

const FUNNEL_EVENTS = new Set<string>([
  DOMAIN_EVENT_TYPES.RECOMMENDATION_VIEWED,
  DOMAIN_EVENT_TYPES.RECOMMENDATION_ACCEPTED,
  DOMAIN_EVENT_TYPES.RECOMMENDATION_ACTION_CREATED,
  DOMAIN_EVENT_TYPES.RECOMMENDATION_ACTION_COMPLETED,
  DOMAIN_EVENT_TYPES.RECOMMENDATION_OUTCOME,
]);

@Injectable()
export class AnalyticsRecommendationListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsRecommendationListener.name);
  private unsubscribe?: () => void;

  constructor(private readonly prisma: PrismaService, private readonly eventBus: EventBusService, private readonly cache: PerformanceCacheService) {}

  onModuleInit() {
    this.unsubscribe = this.eventBus.subscribe((event) => this.handle(event));
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  private async handle(event: DomainEvent) {
    // Dashboard summary is a cached aggregate. Any domain mutation that can change
    // its counts/engagement must invalidate the cache; funnel events are a subset.
    const dashboardImpacting = new Set<string>([
      DOMAIN_EVENT_TYPES.ORGANIZATION_CREATED, DOMAIN_EVENT_TYPES.ORGANIZATION_UPDATED, DOMAIN_EVENT_TYPES.ORGANIZATION_DELETED,
      DOMAIN_EVENT_TYPES.PERSON_CREATED, DOMAIN_EVENT_TYPES.PERSON_UPDATED, DOMAIN_EVENT_TYPES.PERSON_DELETED,
      DOMAIN_EVENT_TYPES.RELATIONSHIP_CREATED, DOMAIN_EVENT_TYPES.RELATIONSHIP_UPDATED, DOMAIN_EVENT_TYPES.RELATIONSHIP_DELETED,
      DOMAIN_EVENT_TYPES.INTERACTION_CREATED, DOMAIN_EVENT_TYPES.INTERACTION_UPDATED, DOMAIN_EVENT_TYPES.INTERACTION_DELETED,
      DOMAIN_EVENT_TYPES.MEETING_CREATED, DOMAIN_EVENT_TYPES.MEETING_UPDATED, DOMAIN_EVENT_TYPES.MEETING_DELETED, DOMAIN_EVENT_TYPES.MEETING_COMPLETED,
      DOMAIN_EVENT_TYPES.ACTION_CREATED, DOMAIN_EVENT_TYPES.ACTION_UPDATED, DOMAIN_EVENT_TYPES.ACTION_DELETED, DOMAIN_EVENT_TYPES.ACTION_COMPLETED,
      DOMAIN_EVENT_TYPES.COMMITMENT_CREATED, DOMAIN_EVENT_TYPES.COMMITMENT_UPDATED, DOMAIN_EVENT_TYPES.COMMITMENT_DELETED, DOMAIN_EVENT_TYPES.COMMITMENT_COMPLETED,
      DOMAIN_EVENT_TYPES.PROJECT_CREATED, DOMAIN_EVENT_TYPES.PROJECT_UPDATED, DOMAIN_EVENT_TYPES.PROJECT_DELETED,
      DOMAIN_EVENT_TYPES.OPPORTUNITY_CREATED, DOMAIN_EVENT_TYPES.OPPORTUNITY_UPDATED, DOMAIN_EVENT_TYPES.OPPORTUNITY_DELETED, DOMAIN_EVENT_TYPES.OPPORTUNITY_STATUS_CHANGED,
      DOMAIN_EVENT_TYPES.RECOMMENDATION_CREATED, DOMAIN_EVENT_TYPES.RECOMMENDATION_UPDATED, DOMAIN_EVENT_TYPES.RECOMMENDATION_DELETED,
      ...FUNNEL_EVENTS,
    ]);
    if (dashboardImpacting.has(event.eventType)) await this.cache.invalidatePrefix('perf:dashboard:summary:');
    if (!FUNNEL_EVENTS.has(event.eventType)) return;
    const payload = (event.payload ?? {}) as Record<string, any>;
    const recommendationId = String(payload.recommendationId ?? event.aggregateId ?? '');
    if (!recommendationId) return;

    const userId = event.actorId ?? SYSTEM_USER_ID;
    const type = event.eventType === DOMAIN_EVENT_TYPES.RECOMMENDATION_OUTCOME
      ? 'RECOMMENDATION_OUTCOME'
      : event.eventType === DOMAIN_EVENT_TYPES.RECOMMENDATION_ACTION_CREATED
        ? 'RECOMMENDATION_ACTION_CREATED'
        : event.eventType === DOMAIN_EVENT_TYPES.RECOMMENDATION_ACTION_COMPLETED
          ? 'RECOMMENDATION_ACTION_COMPLETED'
          : event.eventType === DOMAIN_EVENT_TYPES.RECOMMENDATION_ACCEPTED
            ? 'RECOMMENDATION_ACCEPTED'
            : 'RECOMMENDATION_VIEWED';

    try {
      // Domain event id is the idempotency key. A duplicate dispatch must never inflate funnel counts.
      const existing = await this.prisma.analyticsEvent.findUnique({
        where: { domainEventId: event.id },
        select: { id: true },
      });
      if (existing) return;

      await this.prisma.analyticsEvent.create({
        data: {
          userId,
          type,
          feature: 'recommendation_funnel',
          domainEventId: event.id,
          organizationId: event.organizationId,
          metadata: {
            recommendationId,
            domainEventId: event.id,
            actionId: payload.actionId ?? undefined,
            outcome: payload.outcome ?? undefined,
            outcomeValue: payload.outcomeValue ?? undefined,
          },
        },
      });
      await this.cache.invalidatePrefix('perf:dashboard:summary:');
    } catch (error: any) {
      if (error?.code === 'P2002') return;
      this.logger.error(`Recommendation analytics failed for ${event.id}: ${error?.message ?? error}`);
    }
  }
}
