/* ============================================================================
   Jalali (Persian) calendar conversion — pure functions, no dependencies.
   Algorithm from the public-domain jalaali-js (Behrooz Abbassi & contributors).
   ============================================================================ */

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const div = (a: number, b: number) => ~~(a / b);
const mod = (a: number, b: number) => a - ~~(a / b) * b;

export interface JalaliDate { jy: number; jm: number; jd: number }

function jalCal(jy: number) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jm: number, jump = 0, leap = 0, n: number, i: number;
  for (i = 1; i < bl; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
    + div(153 * mod(gm + 9, 12) + 2, 5)
    + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): JalaliDate {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jd: number, jm: number, k: number;
  k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) { jm = 1 + div(k, 31); jd = mod(k, 31) + 1; return { jy, jm, jd }; }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export function toJalali(gy: number, gm: number, gd: number): JalaliDate {
  return d2j(g2d(gy, gm, gd));
}

export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  return d2g(j2d(jy, jm, jd));
}

export function jalaaliMonthLength(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalCal(jy).leap === 1 ? 30 : 29;
}

/** Weekday of a Gregorian date (0=Sunday … 6=Saturday) */
export function weekday(gy: number, gm: number, gd: number) {
  return new Date(gy, gm - 1, gd).getDay();
}

/** Saturday-first weekday index (0=شنبه … 6=جمعه) */
export function saturdayFirst(gy: number, gm: number, gd: number) {
  return (weekday(gy, gm, gd) + 1) % 7;
}

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const WEEKDAYS_SAT = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export function faNum(value: number | string): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function todayJalali(): JalaliDate {
  const n = new Date();
  return toJalali(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

/** Local date key for a JS Date, as `jy-jm-jd` */
export function dateKey(d: Date, j: JalaliDate) {
  return `${j.jy}-${j.jm}-${j.jd}`;
}

export function toJalaliKey(d: Date): string {
  const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${j.jy}-${j.jm}-${j.jd}`;
}


/* ================= کمکی‌های رابط کاربری (پیکر شمسی) ================= */

export type JTime = { hh: number; mm: number };

/** سرنام روزهای هفته — شنبه‌محور (برای سرستون تقویم) */
export const WEEKDAYS_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/**
 * تجزیهٔ مقدار ورودی (قالب میلادی استاندارد برنامه):
 *  'YYYY-MM-DD' یا 'YYYY-MM-DDTHH:mm' یا ISO کامل → {JalaliDate, time?}
 */
export function parseIsoParts(value: string): { jd: JalaliDate; time?: JTime } | null {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const gy = Number(m[1]), gm = Number(m[2]), gd = Number(m[3]);
  if (gy < 1900 || gy > 2200 || gm < 1 || gm > 12 || gd < 1 || gd > 31) return null;
  try {
    const jd = toJalali(gy, gm, gd);
    const time = m[4] !== undefined ? { hh: Math.min(23, Number(m[4])), mm: Math.min(59, Number(m[5])) } : undefined;
    return { jd, time };
  } catch {
    return null;
  }
}

/** رشتهٔ ISO میلادی از مؤلفه‌ها — همان قالبی که فرم‌ها به سرور می‌فرستند */
export function toIsoString(gy: number, gm: number, gd: number, time?: JTime | null): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const base = `${gy}-${p(gm)}-${p(gd)}`;
  return time ? `${base}T${p(time.hh)}:${p(time.mm)}` : base;
}

/** نمایش شمسی: «۱۴۰۵/۰۶/۱۴» و با زمان «۱۴۰۵/۰۶/۱۴ ۰۹:۰۵» */
export function formatJalaliDisplay(jd: JalaliDate, time?: JTime | null): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const d = `${faNum(jd.jy)}/${faNum(p(jd.jm))}/${faNum(p(jd.jd))}`;
  return time ? `${d} ${faNum(p(time.hh))}:${faNum(p(time.mm))}` : d;
}

/** روز هفته (شنبه=۰ … جمعه=۶) برای یک روز شمسی */
export function jalaaliWeekday(jy: number, jm: number, jd: number): number {
  const g = toGregorian(jy, jm, jd);
  return saturdayFirst(g.gy, g.gm, g.gd);
}
