import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationRealtimeService } from './notification-realtime.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  LocalLogNotificationProvider,
  NotificationDelivery,
  NotificationProviderPort,
  SmtpNotificationProvider,
  WebPushNotificationProvider,
} from './notification-provider.port';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

@Injectable()
export class NotificationsService {
  private readonly emailProvider: NotificationProviderPort = process.env.SMTP_HOST
    ? new SmtpNotificationProvider()
    : new LocalLogNotificationProvider('EMAIL', 'SMTP_HOST env var not set');
  private readonly pushProvider: NotificationProviderPort = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? new WebPushNotificationProvider()
    : new LocalLogNotificationProvider('PUSH', 'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY env vars not set');
  private readonly providers: Record<'EMAIL' | 'PUSH', NotificationProviderPort> = { EMAIL: this.emailProvider, PUSH: this.pushProvider };

  constructor(private readonly prisma: PrismaService, private readonly realtime: NotificationRealtimeService) {}

  status() {
    return {
      module: 'notifications',
      status: 'implemented',
      channels: ['IN_APP', 'EMAIL', 'PUSH'],
      providers: [
        { channel: 'IN_APP', status: 'always-on' },
        { channel: 'EMAIL', status: process.env.SMTP_HOST ? 'configured' : 'not-configured (falls back to local log, does not fail requests)' },
        { channel: 'PUSH', status: process.env.VAPID_PUBLIC_KEY ? 'configured' : 'not-configured (falls back to local log, does not fail requests)' },
      ],
    };
  }

  async list(userId: string, options: { page?: number; limit?: number; unreadOnly?: boolean; groupKey?: string } = {}) {
    const page = Math.max(1, Math.trunc(Number(options.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.trunc(Number(options.limit) || 50)));
    const where: any = { userId, deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
    if (options.unreadOnly) where.readAt = null;
    if (options.groupKey) where.groupKey = options.groupKey;
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.notification.count({ where }),
    ]);
    return { items: EntityResponseDto.many('Notification', items), page, limit, total, nextPage: page * limit < total ? page + 1 : null };
  }
  unreadCount(userId: string) { return this.prisma.notification.count({ where: { userId, deletedAt: null, readAt: null } }); }
  async markRead(userId: string, id: string) { const item = await this.prisma.notification.findFirst({ where: { id, userId, deletedAt: null } }); if (!item) throw new NotFoundException('Notification not found'); const updated = await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } }); this.realtime.publish({ userId, event: 'notification.read', data: { notificationId: id, readAt: updated.readAt?.toISOString() ?? null } }); return EntityResponseDto.from('Notification', updated); }
  async markAllRead(userId: string) { const readAt = new Date(); const result = await this.prisma.notification.updateMany({ where: { userId, deletedAt: null, readAt: null }, data: { readAt } }); this.realtime.publish({ userId, event: 'notification.read-all', data: { count: result.count, readAt: readAt.toISOString() } }); return EntityResponseDto.fromUnknown(result); }
  async preferences(userId: string) { return EntityResponseDto.fromUnknown(await this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId }, update: {} })); }
  async getPreferenceSnapshot(userId: string) { return this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId }, update: {} }); }
  async recordDeliveryLog(input: { userId: string; channel: string; provider: string; accepted: boolean; title: string; errorMessage?: string; notificationRuleId?: string; eventId?: string }) { return this.prisma.notificationDeliveryLog.create({ data: input }); }
  async updatePreferences(userId: string, b: any) {
    const data = this.clean(b);
    return EntityResponseDto.fromUnknown(await this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...data }, update: data }));
  }


  async dispatchDigest(userId: string, cadence: 'DAILY' | 'WEEKLY') {
    const prefs = await this.getPreferenceSnapshot(userId);
    const enabled = cadence === 'DAILY' ? prefs.dailyDigest : prefs.weeklyDigest;
    if (!enabled || !prefs.emailEnabled) return { sent: false, reason: 'digest-disabled' };
    const since = new Date(Date.now() - (cadence === 'DAILY' ? 24 : 168) * 60 * 60 * 1000);
    const items = await this.prisma.notification.findMany({
      where: { userId, deletedAt: null, createdAt: { gte: since }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 100,
      select: { id: true, title: true, body: true, priority: true, deepLink: true },
    });
    if (!items.length) return { sent: false, reason: 'empty', count: 0 };
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return { sent: false, reason: 'no-email', count: items.length };
    const body = items.map((n, i) => `${i + 1}. [${n.priority}] ${n.title} — ${n.body}${n.deepLink ? ` (${n.deepLink})` : ''}`).join('\n');
    const result = await this.emailProvider.send({ channel: 'EMAIL', userId, title: `SRIP ${cadence.toLowerCase()} notification digest`, body, toEmail: user.email });
    await this.recordDeliveryLog({ userId, channel: 'EMAIL', provider: result.provider, accepted: result.accepted, title: `SRIP ${cadence.toLowerCase()} notification digest`, errorMessage: result.errorMessage });
    return { sent: result.accepted, provider: result.provider, count: items.length, errorMessage: result.errorMessage };
  }

  /** ثبت اشتراک Web Push کلاینت (Web/Mobile). بدون این، Push هرگز مقصدی برای ارسال ندارد. */
  async registerPushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new BadRequestException('Invalid push subscription payload');
    const existing = await this.prisma.pushSubscription.findUnique({ where: { endpoint: sub.endpoint }, select: { userId: true } });
    if (existing && existing.userId !== userId) throw new ForbiddenException('Push subscription endpoint is already owned by another user');
    return EntityResponseDto.fromUnknown(await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
      update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    }));
  }
  async unregisterPushSubscription(userId: string, endpoint: string) {
    return EntityResponseDto.fromUnknown(await this.prisma.pushSubscription.deleteMany({ where: { endpoint, userId } }));
  }

  /** لاگ تحویل اعلان‌های اخیر برای همین کاربر (شفافیت: چرا Email/Push رسید یا نرسید). */
  async deliveryLog(userId: string) { return EntityResponseDto.manyUnknown(await this.prisma.notificationDeliveryLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 })); }

  private clean(b: any) {
    const out: any = {};
    for (const key of ['inAppEnabled','emailEnabled','pushEnabled','digestEnabled','criticalOnly','dailyDigest','weeklyDigest']) {
      if (typeof b?.[key] === 'boolean') out[key] = b[key];
    }
    return out;
  }

  /**
   * ایجاد یک Notification واقعی. برای IN_APP همیشه فقط رکورد دیتابیس کافی
   * است (Real-time در لایه بعدی از طریق polling/`GET /notifications` یا
   * WebSocket خوانده می‌شود). برای EMAIL/PUSH، تلاش واقعی برای ارسال از طریق
   * Providerِ پیکربندی‌شده انجام می‌شود و نتیجه (موفق/ناموفق + دلیل) هم در
   * پاسخ برگردانده می‌شود و هم در NotificationDeliveryLog ذخیره می‌شود —
   * هیچ‌چیزی «بی‌صدا گم» نمی‌شود.
   */
  async create(userId: string, b: any, options: { skipPreferenceCheck?: boolean } = {}) {
    const prefs = await this.preferences(userId);
    const channel = (b.channel || 'IN_APP') as 'IN_APP' | 'EMAIL' | 'PUSH';
    if (!options.skipPreferenceCheck) {
      if (prefs.criticalOnly && (b.priority ?? 'MEDIUM') !== 'CRITICAL') throw new ForbiddenException('Only critical notifications are enabled for this user');
      if (channel === 'EMAIL' && !prefs.emailEnabled) throw new ForbiddenException('Email notifications are disabled for this user');
      if (channel === 'PUSH' && !prefs.pushEnabled) throw new ForbiddenException('Push notifications are disabled for this user');
    }
    const item = await this.prisma.notification.create({ data: { userId, type: b.type ?? 'INFO', title: b.title ?? 'Notification', body: b.body ?? '', channel, priority: b.priority ?? 'MEDIUM', deepLink: b.deepLink, groupKey: b.groupKey, expiresAt: b.expiresAt ? new Date(b.expiresAt) : undefined, data: b.data ?? undefined } });
    this.realtime.publish({ userId, event: 'notification.created', data: { notification: item } });
    if (channel === 'IN_APP') {
      await this.prisma.notificationDeliveryLog.create({ data: { userId, channel, provider: 'in-app', accepted: true, title: item.title, notificationRuleId: b.data?.ruleId, eventId: b.data?.eventId } }).catch(() => undefined);
      return EntityResponseDto.fromUnknown(item);
    }

    const provider = this.providers[channel];
    let delivery: NotificationDelivery = { channel, userId, title: item.title, body: item.body, deepLink: item.deepLink ?? undefined };
    if (channel === 'EMAIL') {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      delivery = { ...delivery, toEmail: user?.email };
    }
    if (channel === 'PUSH') {
      const subs = await this.prisma.pushSubscription.findMany({ where: { userId }, take: 1 });
      if (subs[0]) delivery = { ...delivery, pushSubscription: { endpoint: subs[0].endpoint, keys: { p256dh: subs[0].p256dh, auth: subs[0].auth } } };
    }
    const result = await provider.send(delivery);
    await this.prisma.notificationDeliveryLog.create({ data: { userId, channel, provider: result.provider, accepted: result.accepted, title: item.title, errorMessage: result.errorMessage, notificationRuleId: b.data?.ruleId, eventId: b.data?.eventId } }).catch(() => undefined);
    this.realtime.publish({ userId, event: 'notification.delivery', data: { notificationId: item.id, channel, provider: result.provider, accepted: result.accepted, errorMessage: result.errorMessage ?? null } });
    return { ...item, delivery: result };
  }
}
