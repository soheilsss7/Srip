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

export const NAV_ZONES: readonly NavZone[] = [
  ['خانه', 'کار امروز من', [
    ['/', 'پیشخوان', 'dashboard.read'],
  ]],
  ['مخاطب‌ها', 'سازمان‌ها و افراد کلیدی', [
    ['/organizations', 'سازمان‌ها', 'organization.read'],
    ['/people', 'اشخاص', 'person.read'],
  ]],
  ['روابط', 'وضعیت پیوندها و شبکه', [
    ['/relationships', 'روابط', 'relationship.read'],
    ['/network', 'شبکهٔ روابط', 'network.read'],
    ['/publics', 'عموم‌ها', 'publics.read'],
    ['/interactions', 'تعاملات', 'interaction.read'],
    ['/referrals', 'معرفی‌ها', 'relationship.read'],
  ]],
  ['کار و اجرا', 'جلسه‌ها، قول‌ها و پروژه‌ها', [ /* ۷ آیتم — مرز قانون Miller؛ آیتم هشتم = شکستن به دو Workspace */
    ['/meetings', 'جلسات', 'meeting.read'],
    ['/calendar', 'تقویم', 'meeting.read'],
    ['/actions', 'اقدامات', 'action.read'],
    ['/commitments', 'تعهدات', 'commitment.read'],
    ['/projects', 'پروژه‌ها', 'project.read'],
    ['/opportunities', 'فرصت‌ها', 'opportunity.read'],
    ['/requirements', 'نیازمندی‌ها', 'project.read'],
  ]],
  ['هوش', 'دستیار، بریف و تحلیل‌ها', [
    ['/alerts', 'هشدارها', 'dashboard.read'],
    ['/intelligence', 'هوشمندی و توصیه‌ها', 'analytics.read'],
    ['/board', 'هیئت‌مدیره', 'analytics.read'],
    ['/ai', 'دستیار هوشمند', 'ai.query'],
    ['/strategy', 'تحلیل راهبردی', 'strategy.read'],
  ]],
  ['اتوماسیون و هماهنگی', 'گردش کار، اسناد و داده', [
    ['/workflows', 'گردش کار و تأییدها', 'workflow.read'],
    ['/documents', 'مرکز دانش', 'document.read'],
    ['/data-management', 'داده و کیفیت', 'data.quality.read'],
    ['/data-exchange', 'تبادل داده', 'report.read'],
    ['/settings', 'تنظیمات من', 'user.read'],
    ['/sessions', 'نشست‌های من', 'session.read'],
  ]],
];

/** زیرصفحه‌های «مرکز سیستم» — از هاب /admin در دسترس‌اند (نه در سایدبار) */
export const ADMIN_SUBS: readonly AdminSection[] = [
  ['کاربران و مجوزها', [
    ['/admin', 'مرکز سیستم', 'admin.users'],
    ['/admin/users', 'کاربران و دسترسی‌ها', 'admin.users'],
    ['/admin/roles', 'نقش‌ها', 'admin.users'],
    ['/admin/permissions', 'مجوزها', 'admin.users'],
    ['/admin/audit', 'ممیزی', 'audit.read'],
    ['/admin/feature-flags', 'پرچم‌های ویژگی', 'feature_flag.read'],
    ['/admin/scoring', 'قواعد امتیازدهی', 'admin.users'],
    ['/admin/tags', 'برچسب‌ها', 'admin.users'],
    ['/admin/custom-fields', 'فیلدهای سفارشی', 'admin.users'],
    ['/admin/criteria', 'معیارهای ارزیابی', 'admin.users'],
    ['/admin/notification-rules', 'قواعد اعلان', 'admin.users'],
    ['/admin/exports', 'کنترل خروجی داده', 'audit.read'],
    ['/admin/sessions', 'مدیریت نشست‌ها', 'session.read'],
    ['/admin/retention', 'نگهداری داده', 'privacy.manage'],
  ]],
  ['امنیت و حاکمیت', [
    ['/security', 'امنیت', 'security.read'],
    ['/security-events', 'رویدادهای امنیتی', 'security.read'],
    ['/governance', 'حاکمیت', 'enterprise.security'],
    ['/enterprise', 'حاکمیت سازمانی', 'enterprise.read'],
    ['/privacy', 'حریم خصوصی', 'privacy.read'],
    ['/data-lifecycle', 'چرخهٔ حیات داده', 'data.lifecycle_status'],
  ]],
  ['داده و یکپارچه‌سازی', [
    ['/data-management', 'داده و کیفیت', 'data.manage'],
    ['/data-quality', 'کیفیت داده', 'data.quality.read'],
    ['/admin/master-data', 'داده‌های مبنایی', 'org.read'],
    ['/integrations', 'یکپارچه‌سازی', 'integration.read'],
    ['/workflows', 'گردش کار', 'workflow.read'],
    ['/approvals', 'تأییدها', 'approval.read'],
  ]],
  ['پایش و سلامت', [
    ['/monitoring', 'مرکز پایش', 'metrics.read'],
    ['/analytics', 'تحلیل محصول', 'analytics.read'],
    ['/health', 'سلامت زمان اجرا', 'health.read'],
    ['/observability', 'مشاهده‌پذیری', 'metrics.read'],
    ['/metrics', 'سنجه‌ها', 'metrics.read'],
  ]],
];

/** نوار تب پایین موبایل — چهار خانهٔ اصلی؛ بقیه از دکمهٔ «بیشتر» */
export const MOBILE_TABS: readonly NavItem[] = [
  ['/', 'خانه', 'dashboard.read'],
  ['/organizations', 'سازمان‌ها', 'organization.read'],
  ['/network', 'شبکه', 'network.read'],
  ['/interactions', 'تعامل‌ها', 'interaction.read'],
];

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
export const GLOSS: Record<string, string> = {
  '/': 'کار امروز شما: اولویت‌ها، هشدارها و جلسات پیش رو در یک نگاه',
  '/organizations': 'شرکت‌ها/سازمان‌های عضو شبکه و اطلاعات هرکدام',
  '/people': 'افراد کلیدی هر سازمان و ارتباطات آن‌ها',
  '/relationships': 'پیوند رسمی بین دو سازمان — با تفکیک بازاری/غیربازاری، نقطهٔ ورود به بازار، امتیاز سلامت/ریسک و هشدار هوشمند',
  '/network': 'نقشهٔ گرافیکی روابط: خوشه‌ها، مسیرها و تحلیل شبکه',
  '/interactions': 'هر تماس/جلسه/مکاتبه‌ای که روی یک رابطه رخ داده است',
  '/referrals': 'معرفی‌ها و واسطه‌های رسیدن به یک سازمان',
  '/alerts': 'همهٔ هشدارهای فعال سیستم در یک نگاه — فیلترپذیر بر اساس ماژول و شدت',
  '/intelligence': 'سیگنال‌های ریسک، فرصت‌های در جریان و پیشنهاد رشد',
  '/board': 'گزارش هیئت‌مدیره: بازده سرمایهٔ رابطه، سرمایه، سلامت پرتفوی و ریسک تک‌نقطه',
  '/meetings': 'جلسات برنامه‌ریزی‌شده با ثبت دستور و خلاصه',
  '/calendar': 'نمای تقویمی جلسات در محدودهٔ شما',
  '/actions': 'کارهایی که کسی قول داده تا موعد معین انجام دهد',
  '/commitments': 'قول‌های بلندمدت‌تر میان طرفین با سررسید',
  '/projects': 'پروژه‌های مشترک و مرحله‌های آن‌ها',
  '/opportunities': 'فرصت‌های تجاری شناسایی‌شده با ارزش و احتمال',
  '/ai': 'گفتگو با داده‌های شبکه: بپرسید و توصیه بگیرید',
  '/ai-executive-brief': 'گزارش دوره‌ای خودکار وضعیت روابط و هشدارها',
  '/recommendations': 'توصیه‌های داده‌محور برای قدم بعدی',
  '/reports': 'گزارش‌ها و خروجی‌های تحلیلی',
  '/documents': 'اسناد، دانش و قالب‌های اشتراکی',
  '/requirements': 'نیازمندی‌های پروژه‌ها',
  '/approvals': 'درخواست‌های در انتظار تأیید شما',
  '/data-exchange': 'ورود/خروج و تبادل داده بین سامانه‌ها',
  '/settings': 'تنظیمات حساب و ترجیحات شما',
  '/sessions': 'نشست‌های فعال ورود شما در دستگاه‌ها',
  '/data-management': 'مرکز داده: کیفیت، ورود و حاکمیت داده در یک نگاه',
  '/workflows': 'زنجیره‌های خودکار تصمیم، اجرا و تأییدها',
  '/publics': 'نقشهٔ عموم‌ها: شناسنامهٔ سازمان، دسته‌بندی بازیگران و شکاف‌های اثرگذار',
  '/strategy': 'تحلیل رقابت و تعامل راهبردی',
};
