/* ============================================================================
   nav-structure.ts — تک‌منبع حقیقت ساختار ناوبری (فاز ۵ پلن یکپارچه‌سازی)
   ----------------------------------------------------------------------------
   قواعد این فایل (از INTEGRATION-PLAN.md فاز ۵):
   ۱) تنها جایی که ساختار منو تعریف می‌شود — هیچ شرط ناوبری‌ای در کامپوننت‌ها
      نوشته نمی‌شود؛ کامپوننت‌ها فقط از NAV_ZONES/ADMIN_SUBS/MOBILE_TABS و
      توابع خالص getVisible* مصرف می‌کنند.
   ۲) سطح ۲ — فیلتر نمایشی: تابع خالص بر اساس مجوز؛ ساختار ثابت است.
   ۳) حداکثر عمق ۳ سطح (Workspace → Section → Page). موارد عمیق‌تر باید به
      Workspace مستقل ارتقا یابند یا با ماژول مرتبط ادغام شوند.
   ۴) حداکثر ۷±۲ آیتم در هر سطح (قانون Miller). «کار و اجرا» با ۷ آیتم در مرز
      بالاست — پیش از افزودن آیتم هشتم، آن را به دو Workspace بشکنید.
   ۵) URLها دست‌نخورده‌اند؛ فقط جای‌گیری و گروه‌بندی.
   ۶) NAV_PERMISSION_MAP: نگاشت متمرکز هر مسیر به مجوزِ دیدنش.
   ========================================================================== */

import { lt, t } from './i18n';
export type NavItem = readonly [href: string, label: string, permission: string];
export type NavZone = readonly [title: string, subtitle: string, items: readonly NavItem[]];
export type AdminSection = readonly [title: string, items: readonly NavItem[]];

/** چه چیزی همیشه دیده می‌شود (مستقل از مجوز) */
const ALWAYS_VISIBLE = new Set(['/', 'dashboard.read']);

/** آستانهٔ دیدن یک آیتم: مسیر ریشه، مجوز داشبورد، مجوز خود آیتم، یا مدیرِ کل برای مرکز سیستم */
export function itemVisible(item: NavItem, can: (p: string) => boolean, isAdmin = false): boolean {
  const [href, , permission] = item;
  if (ALWAYS_VISIBLE.has(href) || ALWAYS_VISIBLE.has(permission)) return true;
  if (isAdmin && permission === 'admin.users') return true;
  return can(permission);
}

/* --------------------------- سطح ۱: ساختار ثابت --------------------------- */

export const NAV_ZONES: readonly NavZone[] = lt([
  [t('خانه'), t('کار امروز من'), [
    ['/', t('پیشخوان'), 'dashboard.read'],
    ['/push', t('اعلان‌ها و آفلاین'), 'dashboard.read'],
  ]],
  [t('مخاطب‌ها'), t('سازمان‌ها و افراد کلیدی'), [
    ['/organizations', t('سازمان‌ها'), 'organization.read'],
    ['/people', t('اشخاص'), 'person.read'],
    ['/enrichment', t('غنی‌سازی منابع رسمی'), 'organization.read'],
    ['/directory', t('دیتابیس روابط بیرونی'), 'organization.read'],
  ]],
  [t('روابط'), t('وضعیت پیوندها و شبکه'), [
    ['/relationships', t('روابط'), 'relationship.read'],
    ['/network', t('شبکهٔ روابط'), 'network.read'],
    ['/publics', t('عموم‌ها'), 'publics.read'],
    ['/interactions', t('تعاملات'), 'interaction.read'],
    ['/referrals', t('معرفی‌ها'), 'relationship.read'],
    ['/gis', t('نقشهٔ ذینفعان'), 'organization.read'],
    ['/portal', t('پورتال عمومی'), 'publics.read'],
  ]],
  [t('کار و اجرا'), t('جلسه‌ها، قول‌ها و پروژه‌ها'), [ /* ۷ آیتم — مرز قانون Miller؛ آیتم هشتم = شکستن به دو Workspace */
    ['/meetings', t('جلسات'), 'meeting.read'],
    ['/calendar', t('تقویم'), 'meeting.read'],
    ['/actions', t('اقدامات'), 'action.read'],
    ['/commitments', t('تعهدات'), 'commitment.read'],
    ['/projects', t('پروژه‌ها'), 'project.read'],
    ['/opportunities', t('فرصت‌ها'), 'opportunity.read'],
    ['/requirements', t('نیازمندی‌ها'), 'project.read'],
  ]],
  [t('هوش'), t('دستیار، بریف و تحلیل‌ها'), [
    ['/alerts', t('هشدارها'), 'dashboard.read'],
    ['/intelligence', t('هوشمندی و توصیه‌ها'), 'analytics.read'],
    ['/board', t('هیئت‌مدیره'), 'analytics.read'],
    ['/ai', t('دستیار هوشمند'), 'ai.query'],
    ['/strategy', t('تحلیل راهبردی'), 'strategy.read'],
    ['/mcp', t('سرور MCP'), 'analytics.read'],
    ['/qbr', t('بریف فصلی (QBR)'), 'analytics.read'],
  ]],
  [t('اتوماسیون و هماهنگی'), t('گردش کار، اسناد و داده'), [
    ['/workflows', t('گردش کار و تأییدها'), 'workflow.read'],
    ['/documents', t('مرکز دانش'), 'document.read'],
    ['/data-management', t('داده و کیفیت'), 'data.quality.read'],
    ['/data-exchange', t('تبادل داده'), 'report.read'],
    ['/imports', t('ورود ایمیل/تقویم'), 'interaction.write'],
    ['/developers', t('API و وب‌هوک'), 'integration.read'],
    ['/settings', t('تنظیمات من'), 'user.read'],
    ['/sessions', t('نشست‌های من'), 'session.read'],
  ]],
]);

/** زیرصفحه‌های «مرکز سیستم» — از هاب /admin در دسترس‌اند (نه در سایدبار) */
export const ADMIN_SUBS: readonly AdminSection[] = lt([
  [t('کاربران و مجوزها'), [
    ['/admin', t('مرکز سیستم'), 'admin.users'],
    ['/admin/users', t('کاربران و دسترسی‌ها'), 'admin.users'],
    ['/admin/roles', t('نقش‌ها'), 'admin.users'],
    ['/admin/permissions', t('مجوزها'), 'admin.users'],
    ['/admin/audit', t('ممیزی'), 'audit.read'],
    ['/admin/feature-flags', t('پرچم‌های ویژگی'), 'feature_flag.read'],
    ['/admin/scoring', t('قواعد امتیازدهی'), 'admin.users'],
    ['/admin/tags', t('برچسب‌ها'), 'admin.users'],
    ['/admin/custom-fields', t('فیلدهای سفارشی'), 'admin.users'],
    ['/admin/criteria', t('معیارهای ارزیابی'), 'admin.users'],
    ['/admin/notification-rules', t('قواعد اعلان'), 'admin.users'],
    ['/admin/exports', t('کنترل خروجی داده'), 'audit.read'],
    ['/admin/sessions', t('مدیریت نشست‌ها'), 'session.read'],
    ['/admin/retention', t('نگهداری داده'), 'privacy.manage'],
  ]],
  [t('امنیت و حاکمیت'), [
    ['/security', t('امنیت'), 'security.read'],
    ['/security-events', t('رویدادهای امنیتی'), 'security.read'],
    ['/governance', t('حاکمیت'), 'enterprise.security'],
    ['/enterprise', t('حاکمیت سازمانی'), 'enterprise.read'],
    ['/privacy', t('حریم خصوصی'), 'privacy.read'],
    ['/data-lifecycle', t('چرخهٔ حیات داده'), 'data.lifecycle_status'],
  ]],
  [t('داده و یکپارچه‌سازی'), [
    ['/data-management', t('داده و کیفیت'), 'data.manage'],
    ['/data-quality', t('کیفیت داده'), 'data.quality.read'],
    ['/admin/master-data', t('داده‌های مبنایی'), 'org.read'],
    ['/integrations', t('یکپارچه‌سازی'), 'integration.read'],
    ['/workflows', t('گردش کار'), 'workflow.read'],
    ['/approvals', t('تأییدها'), 'approval.read'],
  ]],
  [t('پایش و سلامت'), [
    ['/monitoring', t('مرکز پایش'), 'metrics.read'],
    ['/analytics', t('تحلیل محصول'), 'analytics.read'],
    ['/health', t('سلامت زمان اجرا'), 'health.read'],
    ['/observability', t('مشاهده‌پذیری'), 'metrics.read'],
    ['/metrics', t('سنجه‌ها'), 'metrics.read'],
  ]],
]);

/** نوار تب پایین موبایل — چهار خانهٔ اصلی؛ بقیه از دکمهٔ «بیشتر» */
export const MOBILE_TABS: readonly NavItem[] = lt([
  ['/', t('خانه'), 'dashboard.read'],
  ['/organizations', t('سازمان‌ها'), 'organization.read'],
  ['/network', t('شبکه'), 'network.read'],
  ['/interactions', t('تعامل‌ها'), 'interaction.read'],
]);

/* ---------------- سطح ۲: فیلتر نمایشی (توابع خالص، بدون تغییر ساختار) ---------------- */

/** نگاشت متمرکز مسیر → مجوز دیدن (برای واژه‌نامه/Command Palette/کاهش فرسایش) */
export const NAV_PERMISSION_MAP: Record<string, string> = {
  '/': 'dashboard.read', '/organizations': 'organization.read', '/people': 'person.read',
  '/relationships': 'relationship.read', '/network': 'network.read', '/interactions': 'interaction.read',
  '/referrals': 'relationship.read', '/intelligence': 'analytics.read', '/board': 'analytics.read',
  '/alerts': 'dashboard.read', '/meetings': 'meeting.read', '/calendar': 'meeting.read',
  '/actions': 'action.read', '/commitments': 'commitment.read', '/projects': 'project.read',
  '/opportunities': 'opportunity.read', '/ai': 'ai.query', '/ai-executive-brief': 'ai.executive_brief',
  '/recommendations': 'recommendation.read', '/reports': 'report.read', '/documents': 'document.read',
  '/requirements': 'project.read', '/approvals': 'approval.read', '/data-exchange': 'report.read',
  '/settings': 'user.read', '/sessions': 'session.read', '/data-management': 'data.quality.read',
  '/workflows': 'workflow.read', '/publics': 'publics.read', '/strategy': 'strategy.read',
  '/gis': 'organization.read', '/portal': 'publics.read', '/mcp': 'analytics.read', '/imports': 'interaction.write',
  '/enrichment': 'organization.read', '/developers': 'integration.read', '/qbr': 'analytics.read',
  '/push': 'dashboard.read',
};

/** نگاشت مسیرهای مرکز سیستم → مجوز (عمق دسترسی مدیریتی، جداست از سایدبار) */
export const ADMIN_PERMISSION_MAP: Record<string, string> = {
  '/admin': 'admin.users', '/admin/feature-flags': 'feature_flag.read', '/admin/exports': 'audit.read',
  '/admin/sessions': 'session.read', '/admin/retention': 'privacy.manage', '/security': 'security.read',
  '/security-events': 'security.read', '/governance': 'enterprise.security', '/enterprise': 'enterprise.read',
  '/privacy': 'privacy.read', '/data-lifecycle': 'data.lifecycle_status', '/data-management': 'data.manage',
  '/data-quality': 'data.quality.read', '/admin/master-data': 'org.read', '/integrations': 'integration.read',
  '/workflows': 'workflow.read', '/analytics': 'analytics.read', '/metrics': 'metrics.read',
  '/observability': 'metrics.read', '/monitoring': 'metrics.read', '/health': 'health.read',
};

/** زون‌های قابل مشاهده برای این کاربر (زون‌های خالی حذف می‌شوند؛ «خانه» همیشه هست) */
export function getVisibleZones(can: (p: string) => boolean, isAdmin = false): NavZone[] {
  return NAV_ZONES
    .map(([title, subtitle, items]) => [title, subtitle, items.filter((i) => itemVisible(i, can, isAdmin))] as NavZone)
    .filter(([, , items]) => items.length > 0);
}

/** بخش‌های مرکز سیستمِ قابل مشاهده */
export function getVisibleAdminSubs(can: (p: string) => boolean): Array<[string, NavItem[]]> {
  return ADMIN_SUBS
    .map(([title, items]) => [title, items.filter((i) => itemVisible(i, can))] as [string, NavItem[]])
    .filter(([, items]) => items.length > 0);
}

/** تب‌های موبایل قابل مشاهده */
export function getVisibleMobileTabs(can: (p: string) => boolean): NavItem[] {
  return MOBILE_TABS.filter((i) => itemVisible(i, can));
}

/** واژه‌نامهٔ یک‌خطی — «این بخش چیست؟» برای هر مسیر */
export const GLOSS: Record<string, string> = lt({
  '/': t('کار امروز شما: اولویت‌ها، هشدارها و جلسات پیش رو در یک نگاه'),
  '/organizations': t('شرکت‌ها/سازمان‌های عضو شبکه و اطلاعات هرکدام'),
  '/people': t('افراد کلیدی هر سازمان و ارتباطات آن‌ها'),
  '/relationships': t('پیوند رسمی بین دو سازمان — با تفکیک بازاری/غیربازاری، نقطهٔ ورود به بازار، امتیاز سلامت/ریسک و هشدار هوشمند'),
  '/network': t('نقشهٔ گرافیکی روابط: خوشه‌ها، مسیرها و تحلیل شبکه'),
  '/interactions': t('هر تماس/جلسه/مکاتبه‌ای که روی یک رابطه رخ داده است'),
  '/referrals': t('معرفی‌ها و واسطه‌های رسیدن به یک سازمان'),
  '/directory': t('کاتالوگ نهادهای عمومی برای جست‌وجو و اتصال به شبکهٔ روابط شما'),
  '/alerts': t('همهٔ هشدارهای فعال سیستم در یک نگاه — فیلترپذیر بر اساس ماژول و شدت'),
  '/intelligence': t('سیگنال‌های ریسک، فرصت‌های در جریان و پیشنهاد رشد'),
  '/board': t('گزارش هیئت‌مدیره: بازده سرمایهٔ رابطه، سرمایه، سلامت پرتفوی و ریسک تک‌نقطه'),
  '/meetings': t('جلسات برنامه‌ریزی‌شده با ثبت دستور و خلاصه'),
  '/calendar': t('نمای تقویمی جلسات در محدودهٔ شما'),
  '/actions': t('کارهایی که کسی قول داده تا موعد معین انجام دهد'),
  '/commitments': t('قول‌های بلندمدت‌تر میان طرفین با سررسید'),
  '/projects': t('پروژه‌های مشترک و مرحله‌های آن‌ها'),
  '/opportunities': t('فرصت‌های تجاری شناسایی‌شده با ارزش و احتمال'),
  '/ai': t('گفتگو با داده‌های شبکه: بپرسید و توصیه بگیرید'),
  '/ai-executive-brief': t('گزارش دوره‌ای خودکار وضعیت روابط و هشدارها'),
  '/recommendations': t('توصیه‌های داده‌محور برای قدم بعدی'),
  '/reports': t('گزارش‌ها و خروجی‌های تحلیلی'),
  '/documents': t('اسناد، دانش و قالب‌های اشتراکی'),
  '/requirements': t('نیازمندی‌های پروژه‌ها'),
  '/approvals': t('درخواست‌های در انتظار تأیید شما'),
  '/data-exchange': t('ورود/خروج و تبادل داده بین سامانه‌ها'),
  '/settings': t('تنظیمات حساب و ترجیحات شما'),
  '/sessions': t('نشست‌های فعال ورود شما در دستگاه‌ها'),
  '/data-management': t('مرکز داده: کیفیت، ورود و حاکمیت داده در یک نگاه'),
  '/workflows': t('زنجیره‌های خودکار تصمیم، اجرا و تأییدها'),
  '/publics': t('نقشهٔ عموم‌ها: شناسنامهٔ سازمان، دسته‌بندی بازیگران و شکاف‌های اثرگذار'),
  '/strategy': t('تحلیل رقابت و تعامل راهبردی'),
});
