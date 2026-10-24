import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService, DomainEvent } from '../event-bus/event-bus.service';
import { NotificationsService } from './notifications.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';

export type NotificationRuleEvaluation = {
  ruleId: string;
  userId: string;
  channel: string;
  created: boolean;
  skipped?: string;
};

@Injectable()
export class NotificationRuleEngineService implements OnModuleInit {
  private readonly logger = new Logger(NotificationRuleEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe(async (event) => {
      try {
        await this.evaluate(event);
      } catch (error: any) {
        this.logger.error(`Notification rule evaluation failed for ${event.eventType}/${event.id}: ${error?.message ?? error}`);
      }
    });
  }

  async evaluate(event: DomainEvent): Promise<NotificationRuleEvaluation[]> {
    if (!event?.eventType || !Object.values(DOMAIN_EVENT_TYPES).includes(event.eventType as any)) return [];
    const rules = await this.prisma.notificationRule.findMany({
      where: {
        active: true,
        OR: [{ eventType: event.eventType }, { eventType: '*' }],
        ...(event.organizationId ? { AND: [{ OR: [{ organizationId: null }, { organizationId: event.organizationId }] }] } : { organizationId: null }),
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    const results: NotificationRuleEvaluation[] = [];
    for (const rule of rules) {
      if (rule.organizationId && rule.organizationId !== event.organizationId) continue;
      if (!this.matchesConditions(rule.conditions, event)) continue;

      const template: any = rule.template ?? {};
      const recipients = await this.resolveRecipients(template.recipients, event);
      const channels = this.normalizeChannels(rule.channels);
      for (const userId of recipients) {
        const preferences = await this.notifications.getPreferenceSnapshot(userId);
        for (const channel of channels) {
          const enabled = this.channelEnabled(preferences, channel, template.priority ?? 'MEDIUM');
          if (!enabled) {
            await this.notifications.recordDeliveryLog({ userId, channel, provider: 'preference', accepted: false, title: this.render(template.title ?? rule.name, event) ?? rule.name, errorMessage: 'Notification channel disabled by user preference', notificationRuleId: rule.id, eventId: event.id });
            results.push({ ruleId: rule.id, userId, channel, created: false, skipped: 'preference' });
            continue;
          }
          try {
            let dispatch;
            try {
              dispatch = await this.prisma.notificationRuleDelivery.create({ data: { notificationRuleId: rule.id, eventId: event.id, userId, channel, status: 'PROCESSING' } });
            } catch (dedupeError: any) {
              if (dedupeError?.code === 'P2002') continue;
              throw dedupeError;
            }
            const notification = await this.notifications.create(userId, {
              type: template.type ?? 'INFO',
              title: this.render(template.title ?? rule.name, event) ?? rule.name,
              body: this.render(template.body ?? '', event) ?? '',
              channel,
              priority: template.priority ?? 'MEDIUM',
              groupKey: template.groupKey ? this.render(template.groupKey, event) : `${rule.key}:${event.aggregateType}:${event.aggregateId}`,
              deepLink: this.render(template.deepLink, event),
              data: { ruleId: rule.id, eventId: event.id, eventType: event.eventType, aggregateType: event.aggregateType, aggregateId: event.aggregateId, ...(template.data ?? {}) },
            }, { skipPreferenceCheck: true });
            await this.prisma.notificationRuleDelivery.update({ where: { id: dispatch.id }, data: { status: 'SENT', notificationId: (notification as any)?.id ?? undefined, errorMessage: null } });
            results.push({ ruleId: rule.id, userId, channel, created: true });
          } catch (error: any) {
            await this.prisma.notificationRuleDelivery.updateMany({ where: { notificationRuleId: rule.id, eventId: event.id, userId, channel, status: 'PROCESSING' }, data: { status: 'FAILED', errorMessage: String(error?.message ?? error) } }).catch(() => undefined);
            this.logger.warn(`Notification rule ${rule.key} failed for user ${userId}/${channel}: ${error?.message ?? error}`);
            results.push({ ruleId: rule.id, userId, channel, created: false, skipped: 'provider-error' });
          }
        }
      }
    }
    return results;
  }

  private normalizeChannels(value: unknown): Array<'IN_APP'|'EMAIL'|'PUSH'> {
    const raw = Array.isArray(value) ? value : [];
    return raw.map(String).filter((x): x is 'IN_APP'|'EMAIL'|'PUSH' => ['IN_APP','EMAIL','PUSH'].includes(x));
  }

  private channelEnabled(pref: any, channel: string, priority = 'MEDIUM') {
    if (pref.criticalOnly && priority !== 'CRITICAL') return false;
    if (channel === 'IN_APP') return pref.inAppEnabled !== false;
    if (channel === 'EMAIL') return pref.emailEnabled === true;
    if (channel === 'PUSH') return pref.pushEnabled === true;
    return false;
  }

  private matchesConditions(raw: unknown, event: DomainEvent): boolean {
    if (!raw) return true;
    const conditions = Array.isArray(raw) ? raw : [raw];
    return conditions.every((condition: any) => {
      if (!condition || typeof condition !== 'object') return true;
      const path = condition.path ?? condition.field;
      if (!path) return true;
      const value = this.path(event, path);
      if (condition.exists !== undefined) return condition.exists === (value !== undefined && value !== null);
      if (condition.equals !== undefined) return value === condition.equals;
      if (condition.notEquals !== undefined) return value !== condition.notEquals;
      if (Array.isArray(condition.in)) return condition.in.includes(value);
      if (condition.contains !== undefined) return Array.isArray(value) ? value.includes(condition.contains) : String(value ?? '').includes(String(condition.contains));
      if (condition.gt !== undefined) return Number(value) > Number(condition.gt);
      if (condition.gte !== undefined) return Number(value) >= Number(condition.gte);
      if (condition.lt !== undefined) return Number(value) < Number(condition.lt);
      if (condition.lte !== undefined) return Number(value) <= Number(condition.lte);
      return true;
    });
  }

  private path(event: DomainEvent, path: string) {
    const root: any = { ...event, payload: event.payload };
    return path.split('.').reduce((value, key) => value == null ? undefined : value[key], root);
  }

  private async resolveRecipients(config: unknown, event: DomainEvent): Promise<string[]> {
    const raw = Array.isArray(config) ? config : ['actor'];
    const recipients = new Set<string>();
    for (const item of raw) {
      if (typeof item === 'string') {
        if (item.startsWith('user:')) recipients.add(item.slice(5));
        else if (item === 'actor' && event.actorId) recipients.add(event.actorId);
        else if (item === 'owner') {
          const owner = await this.resolveOwner(event);
          if (owner) recipients.add(owner);
        } else if (item === 'organizationMembers' && event.organizationId) {
          const members = await this.prisma.membership.findMany({ where: { organizationId: event.organizationId, user: { isActive: true, deletedAt: null } }, select: { userId: true } });
          members.forEach(m => recipients.add(m.userId));
        }
      } else if (item && typeof item === 'object') {
        const type = (item as any).type;
        if (type === 'user' && (item as any).userId) recipients.add((item as any).userId);
        if (type === 'actor' && event.actorId) recipients.add(event.actorId);
        if (type === 'owner') { const owner = await this.resolveOwner(event); if (owner) recipients.add(owner); }
        if (type === 'organizationMembers' && event.organizationId) {
          const members = await this.prisma.membership.findMany({ where: { organizationId: event.organizationId, user: { isActive: true, deletedAt: null } }, select: { userId: true } });
          members.forEach(m => recipients.add(m.userId));
        }
      }
    }
    return [...recipients];
  }

  private async resolveOwner(event: DomainEvent): Promise<string | undefined> {
    const id = event.aggregateId;
    switch (event.aggregateType.toLowerCase()) {
      case 'relationship': return (await this.prisma.relationship.findUnique({ where: { id }, select: { ownerId: true } }))?.ownerId ?? undefined;
      case 'meeting': return (await this.prisma.meeting.findUnique({ where: { id }, select: { ownerId: true } }))?.ownerId ?? undefined;
      case 'action': return (await this.prisma.action.findUnique({ where: { id }, select: { ownerId: true } }))?.ownerId ?? undefined;
      case 'commitment': return (await this.prisma.commitment.findUnique({ where: { id }, select: { ownerId: true } }))?.ownerId ?? undefined;
      case 'project': return (await this.prisma.project.findUnique({ where: { id }, select: { ownerId: true } }))?.ownerId ?? undefined;
      case 'organization': return (await this.prisma.organization.findUnique({ where: { id }, select: { ownerId: true } }))?.ownerId ?? undefined;
      case 'recommendation': { const r = await this.prisma.recommendation.findUnique({ where: { id }, select: { assignedToId: true, userId: true } }); return r?.assignedToId ?? r?.userId ?? undefined; }
      default: return undefined;
    }
  }

  private render(template: unknown, event: DomainEvent): string | undefined {
    if (template == null) return undefined;
    if (typeof template !== 'string') return String(template);
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, path) => {
      const value = this.path(event, String(path).trim());
      return value == null ? '' : String(value);
    });
  }
}
