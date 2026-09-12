'use client';
import { useEffect } from 'react';

// On the static GitHub Pages build (SRIP_PAGES=1) the app has no backend:
// a Service Worker (public/sw.js) answers /Srip/api/v1/* with the embedded
// deterministic mock API. In dev this component does nothing.
const PAGES_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/api\/v1\/?$/, '');
const EXPECTED_MOCK_VERSION = process.env.NEXT_PUBLIC_MOCK_VERSION ?? '';

/** ثابتِ نسخهٔ Mock API — در هر نسخه از make-demo-sw.mjs تزریق می‌شود. */
const HEAL_KEY = 'srip_sw_heal_tried';

/**
 * اگر سرویس‌کارگرِ کهنه (از نسخه‌های پیش‌تر) روی صفحه کنترل داشته باشد، API های
 * جدید را نمی‌شناسد (مثلاً /knowledge وجود ندارد و «مرکز دانش» خالی دیده می‌شود).
 * این جا نسخهٔ جاری را از /health می‌خوانیم؛ اگر با انتظار فرانت‌اند فرق داشت،
 * سرویس‌کارگر را به‌روزرسانی، تا فعال‌شدن نسخهٔ جدید صبر و صفحه را یک‌بار خودکار
 * رفرش می‌کنیم — رفرشِ بی‌وقت ممکن است هنوز توسط SW کهنه سرو شود (مسابقهٔ فعال‌سازی).
 */
function waitForNewActive(reg: ServiceWorkerRegistration, old: ServiceWorker | null, timeoutMs = 6000): Promise<void> {
  if (reg.active && reg.active !== old) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeoutMs);
    function done() { clearTimeout(timer); reg.removeEventListener('updatefound', onUpdate); resolve(); }
    function onUpdate() {
      const w = reg.installing ?? reg.waiting;
      if (w) {
        w.addEventListener('statechange', check);
        if (w.state === 'activated') check();
      }
    }
    function check() { if (reg.active && reg.active !== old) done(); }
    reg.addEventListener('updatefound', onUpdate);
    onUpdate();
    check();
  });
}

async function healStaleWorker(reg: ServiceWorkerRegistration): Promise<void> {
  if (!EXPECTED_MOCK_VERSION || !navigator.serviceWorker.controller) return;
  try {
    const r = await fetch(`${PAGES_BASE}/api/v1/health`, { cache: 'no-store' });
    const h: any = await r.json().catch(() => null);
    if (h?.mockVersion === EXPECTED_MOCK_VERSION) {
      // تازه است — قفلِ تلاشِ قبلی را هم پاک کن تا انتشارهای بعدی دوباره بتوانند ترمیم کنند
      sessionStorage.removeItem(HEAL_KEY);
      return;
    }
    if (sessionStorage.getItem(HEAL_KEY)) return; // این نشست قبلاً تلاش شد — جلوگیری از حلقه
    sessionStorage.setItem(HEAL_KEY, '1');
    const oldController = navigator.serviceWorker.controller;
    try { await reg.update(); } catch { /* CDN/offline — رفرش همچنان امتحان می‌شود */ }
    await waitForNewActive(reg, oldController);
    window.location.reload();
  } catch { /* عدم دسترسی به /health یعنی احتمالاً SW ندارد؛ رها کن */ }
}

/**
 * صفحه‌ای که هیچ سرویس‌کارگری آن را کنترل نمی‌کند (نصب تازه، یا رفرشِ سخت
 * Ctrl+Shift+R که صفحه را عمداً بی‌کنترل می‌گذارد) هیچ APIای جواب نمی‌گیرد و
 * ورود با پیام «سرویس در حال راه‌اندازی» شکست می‌خورد. یک ناوبری عادی صفحه
 * را دوباره کنترل‌شده می‌کند؛ پس در چنین حالتی یک reload می‌زنیم.
 * قدیماً این کار «فقط یک‌بار در هر تب» بود و رفرش سختِ بعدی صفحه را برای همیشه
 * بی‌کنترل رها می‌کرد؛ حالا نرخ‌محدود است (حداکثر ۲ بار در ۶۰ ثانیه) تا هم
 * همهٔ حالت‌ها ترمیم شوند و هم حلقهٔ بی‌نهایت ممکن نشود.
 */
function recontrolOrphanedPage(): void {
  if (navigator.serviceWorker.controller) return;
  const KEY = 'srip_sw_recontrol_at';
  let attempts: number[] = [];
  try { attempts = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') ?? []; } catch { attempts = []; }
  const now = Date.now();
  attempts = attempts.filter((t: number) => now - t < 60_000);
  if (attempts.length >= 2) return;
  attempts.push(now);
  try { sessionStorage.setItem(KEY, JSON.stringify(attempts)); } catch { /* حالت خصوصی */ }
  window.location.reload();
}

export default function SwRegister() {
  useEffect(() => {
    if (!PAGES_BASE || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    /* ── ترمیم ریشهٔ بدون اسلش (ریشهٔ باگ ۴۰۴ روی هاست استاتیک) ──
       scope سرویس‌ورکر «/Srip/srip2/» است (با اسلش). ناوبری سمت کلاینت به
       پیشخوان URL را به «/Srip/srip2» (بدون اسلش) می‌برد که بیرون از scope
       است؛ آنگاه هیچ APIای از SW پاسخ نمی‌گیرد و سرور استاتیک برای همهٔ
       /api/v1/* خطای ۴۰۴ می‌دهد. یک‌بار به همان مسیرِ با اسلش می‌رویم تا
       سند همیشه در scope بماند. */
    if (window.location.pathname === PAGES_BASE) {
      window.location.replace(PAGES_BASE + '/' + window.location.search + window.location.hash);
      return;
    }
    navigator.serviceWorker
      .register(PAGES_BASE + '/sw.js', { scope: PAGES_BASE + '/' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // First load / hard-refresh: SW activates + claims, then reload so this
        // page is controlled too (otherwise the first batch of API calls misses).
        recontrolOrphanedPage();
        if (navigator.serviceWorker.controller) {
          // Stale-worker self-heal (works for everyone with an outdated SW).
          void healStaleWorker(reg);
        }
      })
      .catch(() => { /* mock SW not present (dev) */ });
  }, []);
  return null;
}
