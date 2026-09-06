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
 * سرویس‌کارگر را به‌روزرسانی و صفحه را یک‌بار خودکار رفرش می‌کنیم.
 */
async function healStaleWorker(reg: ServiceWorkerRegistration): Promise<void> {
  if (!EXPECTED_MOCK_VERSION || !navigator.serviceWorker.controller) return;
  if (sessionStorage.getItem(HEAL_KEY)) return; // این نشست قبلاً تلاش شد — جلوگیری از حلقه
  try {
    const r = await fetch(`${PAGES_BASE}/api/v1/health`, { cache: 'no-store' });
    const h: any = await r.json().catch(() => null);
    if (h?.mockVersion === EXPECTED_MOCK_VERSION) return; // تازه است؛ کاری نکن
    sessionStorage.setItem(HEAL_KEY, '1');
    try { await reg.update(); } catch { /* CDN/offline — رفرش همچنان امتحان می‌شود */ }
    window.location.reload();
  } catch { /* عدم دسترسی به /health یعنی احتمالاً SW ندارد؛ رها کن */ }
}

export default function SwRegister() {
  useEffect(() => {
    if (!PAGES_BASE || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const KEY = 'srip_sw_reloaded';
    navigator.serviceWorker
      .register(PAGES_BASE + '/sw.js', { scope: PAGES_BASE + '/' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // First load: SW activates + claims, then reload so this page is
        // controlled too (otherwise the first batch of API calls misses).
        if (!navigator.serviceWorker.controller && !sessionStorage.getItem(KEY)) {
          sessionStorage.setItem(KEY, '1');
          window.location.reload();
          return;
        }
        // Stale-worker self-heal (works for everyone with an outdated SW).
        void healStaleWorker(reg);
      })
      .catch(() => { /* mock SW not present (dev) */ });
  }, []);
  return null;
}
