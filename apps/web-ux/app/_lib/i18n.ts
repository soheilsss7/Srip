/* ============================================================================
   i18n.ts — زیرساخت دوزبانه (مسترپلن فاز ۴/۲۳)
   ----------------------------------------------------------------------------
   معماری:
   • زبان جاری در یک متغیر ماژول-سطح نگه داشته می‌شود که در زمان بارگذاری ماژول از
     localStorage خوانده می‌شود (در بیلد/سرور همیشه «fa»). به این ترتیب ثابت‌های
     ماژول-سطح (فهرست‌های گزینه، برچسب‌های ناوبری و…) هم از همان ابتدا درست
     ارزیابی می‌شوند.
   • تغییر زبان = ذخیره در localStorage + بارگذاری مجدد صفحه (الگوی استاندارد
     برای خروجی استاتیک) — هیچ رشتهٔ منجمد/کهنه‌ای باقی نمی‌ماند.
   • t(x): در فارسی همان x را برمی‌گرداند؛ در انگلیسی معادل فرهنگ لغت یا خود x
     (fallback صادقانه — رشتهٔ ترجمه‌نشده به فارسی می‌ماند، نه متن ساختگی).
   • localeTag(): برچسب locale برای Intl (fa-IR / en-GB) — تاریخ و ارقام.
   • TRANSLATED_ROUTES: مسیرهایی که رابط آن‌ها به‌طور کامل ترجمه شده است؛
     صفحات بیرون از این فهرست در حالت انگلیسی یک یادداشت پوشش صادقانه می‌گیرند.
   ========================================================================== */

export type Locale = 'fa' | 'en';

const LOCALE_KEY = 'srip_locale';

/* فاز ۴/۲۳ (بازنگری معماری): مقدار اولیه همیشه «fa» است — حتی روی کلاینت.
   دلیل: HTML استاتیک همیشه فارسی pre-render شده؛ اگر اولین رندر کلاینت با
   زبان دیگری باشد React خطای hydration (#418) می‌دهد و کل درخت را از نو
   می‌سازد. الگوی درست: هیدراسیون با فارسی (تطابق کامل)، سپس «دروازهٔ زبان»
   (LocaleGate) پس از mount اگر زبان ذخیره‌شده انگلیسی بود، locale را عوض و
   کل درخت را دوباره رندر می‌کند. ثابت‌های ماژول-سطح با lt() در زمان خواندن
   ترجمه می‌شوند، پس پس از این سوییچ هم درست‌اند. */
let current: Locale = 'fa';

/** خواندن زبان ذخیره‌شده — فقط برای LocaleGate/تنظیمات؛ مقداردهندهٔ module نیست */
export function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'fa';
  try {
    return window.localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'fa';
  } catch {
    return 'fa';
  }
}

export const getLocale = (): Locale => current;
export const setLocale = (l: Locale): void => {
  current = l;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* حافظهٔ محلی در دسترس نیست — فقط همین نشست */
    }
  }
};
export const isEn = (): boolean => current === 'en';

/* برچسب locale برای قالب‌بندی تاریخ/عدد — ارقام فارسی در فارسی، لاتین در انگلیسی */
export const localeTag = (): string => (current === 'en' ? 'en-GB' : 'fa-IR');

/* مسیرهایی که رابط کاربری آن‌ها کاملاً انگلیسی‌سازی شده است (پیشوند-محور) */
export const TRANSLATED_ROUTES: readonly string[] = [
  '/', '/login', '/register', '/forgot-password', '/password-reset', '/mfa',
  '/dashboard', '/organizations', '/people', '/relationships', '/network',
  '/referrals', '/actions', '/notifications', '/search', '/settings',
  '/board', '/ai', '/qbr', '/enrichment', '/push', '/directory',
];

export function isTranslatedRoute(pathname: string): boolean {
  const p = (pathname ?? '').split('?')[0];
  return TRANSLATED_ROUTES.some((r) => (r === '/' ? p === '/' : p === r || p.startsWith(r + '/')));
}

/* فرهنگ لغت انگلیسی — سه بخش برای نگهداری آسان (ترتیب ادغام اهمیتی ندارد) */
import { EN_DICT_A } from './i18n-dict-a';
import { EN_DICT_B } from './i18n-dict-b';
import { EN_DICT_C } from './i18n-dict-c';

const EN: Record<string, string> = { ...EN_DICT_A, ...EN_DICT_B, ...EN_DICT_C };

export const dictionarySize = (): number => Object.keys(EN).length;

/** ترجمهٔ نمایشی: فارسی → کلید؛ انگلیسی → معادل فرهنگ لغت یا خود رشته */
export function t(s: string): string {
  if (current !== 'en') return s;
  return EN[s] ?? s;
}

/* ─── lt() — ترجمهٔ تنبل ساختارهای دادهٔ ماژول-سطح ───
   ثابت‌های ماژول (فهرست‌های گزینه، برچسب‌های ناوبری، نگاشت‌های enum) فقط یک‌بار
   در زمان import ارزیابی می‌شوند؛ اگر t() داخل تعریفشان باشد، در زبانِ لحظهٔ
   import منجمد می‌شوند. lt() کل ساختار را پشت یک Proxy می‌گذارد که رشته‌ها را
   «موقع خواندن» ترجمه می‌کند — توابع/عناصر React/مقدارهای غیرمتنی دست‌نخورده
   برمی‌گردند و کدهای خواننده ([key]، .map، destructure) بدون تغییر کار می‌کنند. */
const lazyHandler: ProxyHandler<any> = {
  get(target, key, receiver) {
    const v = Reflect.get(target, key, receiver);
    if (typeof v === 'string') return t(v);
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v as any).$$typeof) {
      return new Proxy(v, lazyHandler);
    }
    if (Array.isArray(v)) return new Proxy(v, lazyHandler);
    return v;
  },
};
export function lt<T extends object>(o: T): T {
  return new Proxy(o, lazyHandler) as T;
}
