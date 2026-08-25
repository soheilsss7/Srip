import { Logger } from '@nestjs/common';

export type NotificationDelivery = { channel: 'IN_APP' | 'EMAIL' | 'PUSH'; userId: string; title: string; body: string; deepLink?: string; toEmail?: string; pushSubscription?: unknown };

export interface NotificationProviderPort {
  readonly channel: NotificationDelivery['channel'];
  send(message: NotificationDelivery): Promise<{ accepted: boolean; provider: string; errorMessage?: string }>;
}

/**
 * وقتی هیچ سرویس بیرونی (SMTP / Web Push) پیکربندی نشده، این Provider
 * جایگزین Noop قبلی است: بر خلاف Noop، هیچ چیزی را «تظاهر به موفقیت» نمی‌کند
 * و به‌جای بی‌صدا نادیده گرفتن پیام، آن را با جزئیات کامل Log می‌کند
 * (قابل‌جست‌وجو در Logها و در جدول NotificationDeliveryLog) تا مشخص باشد
 * دقیقاً چرا ارسال واقعی انجام نشد و چه پیامی قرار بود برود.
 */
export class LocalLogNotificationProvider implements NotificationProviderPort {
  private readonly logger = new Logger(`NotificationProvider:${this.channel}`);
  constructor(public readonly channel: NotificationDelivery['channel'], private readonly reason: string) {}
  async send(message: NotificationDelivery) {
    this.logger.warn(`Delivery not sent (provider not configured: ${this.reason}). userId=${message.userId} title="${message.title}"`);
    return { accepted: false, provider: `local-log:${this.channel.toLowerCase()}`, errorMessage: this.reason };
  }
}

/**
 * Provider واقعی SMTP با nodemailer. فعال می‌شود فقط اگر SMTP_HOST تنظیم
 * شده باشد. در صورت خطای اتصال/احراز هویت SMTP، throw نمی‌کند — خطا را
 * برمی‌گرداند تا فراخوان (NotificationsService) بتواند بدون کرش کردن کل
 * درخواست، آن را ثبت کند.
 */
export class SmtpNotificationProvider implements NotificationProviderPort {
  readonly channel = 'EMAIL' as const;
  private readonly logger = new Logger('NotificationProvider:EMAIL');
  private transporterPromise?: Promise<any>;

  private async transporter() {
    if (!this.transporterPromise) {
      this.transporterPromise = (async () => {
        // وابستگی به‌صورت دینامیک import می‌شود تا اگر nodemailer نصب نشده
        // باشد (مثلاً در محیطی که هنوز pnpm install نشده)، کل اپلیکیشن
        // در زمان bootstrap کرش نکند — فقط این Provider غیرفعال می‌ماند.
        const nodemailer: any = await import('nodemailer');
        return nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
        });
      })();
    }
    return this.transporterPromise;
  }

  async send(message: NotificationDelivery) {
    if (!process.env.SMTP_HOST) return { accepted: false, provider: 'smtp:not-configured', errorMessage: 'SMTP_HOST env var not set' };
    const to = message.toEmail;
    if (!to) return { accepted: false, provider: 'smtp', errorMessage: 'Recipient email unknown for this user' };
    try {
      const transport = await this.transporter();
      await transport.sendMail({
        from: process.env.SMTP_FROM ?? 'no-reply@srip.local',
        to,
        subject: message.title,
        text: message.body + (message.deepLink ? `\n\n${message.deepLink}` : ''),
      });
      return { accepted: true, provider: 'smtp' };
    } catch (error: any) {
      this.logger.error(`SMTP send failed: ${error?.message ?? error}`);
      return { accepted: false, provider: 'smtp', errorMessage: error?.message ?? String(error) };
    }
  }
}

/**
 * Provider واقعی Web Push با کتابخانه web-push (VAPID). فقط اگر کلیدهای
 * VAPID تنظیم شده باشند فعال می‌شود.
 */
export class WebPushNotificationProvider implements NotificationProviderPort {
  readonly channel = 'PUSH' as const;
  private readonly logger = new Logger('NotificationProvider:PUSH');
  private webpushPromise?: Promise<any>;

  private async webpush() {
    if (!this.webpushPromise) {
      this.webpushPromise = (async () => {
        const webpush: any = await import('web-push');
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT ?? 'mailto:admin@srip.local',
          process.env.VAPID_PUBLIC_KEY ?? '',
          process.env.VAPID_PRIVATE_KEY ?? '',
        );
        return webpush;
      })();
    }
    return this.webpushPromise;
  }

  async send(message: NotificationDelivery) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return { accepted: false, provider: 'webpush:not-configured', errorMessage: 'VAPID keys not set' };
    if (!message.pushSubscription) return { accepted: false, provider: 'webpush', errorMessage: 'No push subscription registered for this user' };
    try {
      const webpush = await this.webpush();
      await webpush.sendNotification(message.pushSubscription as any, JSON.stringify({ title: message.title, body: message.body, deepLink: message.deepLink }));
      return { accepted: true, provider: 'webpush' };
    } catch (error: any) {
      this.logger.error(`Web Push send failed: ${error?.message ?? error}`);
      return { accepted: false, provider: 'webpush', errorMessage: error?.message ?? String(error) };
    }
  }
}

/** @deprecated نگه‌داشته‌شده فقط برای سازگاری تست‌های قدیمی؛ به‌جای آن از LocalLogNotificationProvider استفاده کنید. */
export class NoopNotificationProvider implements NotificationProviderPort {
  constructor(public readonly channel: NotificationDelivery['channel']) {}
  async send(_message: NotificationDelivery) { return { accepted: false, provider: `noop:${this.channel.toLowerCase()}` }; }
}
