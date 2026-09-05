'use client';
import { useEffect, useState } from 'react';

/* ---------------------------------------------------------------------------
   Static-demo (GitHub Pages) API readiness.
   On the static export the whole API is answered by the Service Worker
   (public/sw.js). A freshly opened tab is NOT controlled by the SW until it
   installs/activates (skipWaiting + clients.claim) — any API call made before
   that hits the static host and 404s. UI that performs auth must wait for the
   SW to control the page before enabling "login" actions, otherwise first-time
   users see an error + forced reload race.
   --------------------------------------------------------------------------- */
export const MOCK_PAGES = !!process.env.NEXT_PUBLIC_API_URL?.startsWith('/Srip');
export const MOCK_SW_SCOPE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/api\/v1\/?$/, '');

export function swControllerReady(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
}

/** True when API requests can be served by the embedded mock (SW controls page). */
export function useMockApiReady(): boolean {
  const [ready, setReady] = useState<boolean>(() => {
    if (!MOCK_PAGES) return true; // dev/standalone backend — nothing to wait for
    return false;                 // SSR + first client paint: not ready until SW claims
  });
  useEffect(() => {
    if (!MOCK_PAGES) return;
    if (!('serviceWorker' in navigator)) { setReady(true); return; } // no SW support: let api-retry deal with it
    if (swControllerReady()) { setReady(true); return; }
    let settled = false;
    const finish = () => { if (!settled) { settled = true; setReady(true); } };
    const onController = () => finish();
    navigator.serviceWorker.addEventListener('controllerchange', onController);
    // Kick registration (idempotent — layout already registers) and keep a
    // safety timeout so the UI is never blocked forever.
    navigator.serviceWorker.ready.catch(() => {}).finally(() => setTimeout(finish, 4000));
    try {
      navigator.serviceWorker.register(`${MOCK_SW_SCOPE}/sw.js`, { scope: `${MOCK_SW_SCOPE}/` })
        .then((reg) => { reg.update().catch(() => {}); return navigator.serviceWorker.ready; })
        .then(() => { if (swControllerReady()) finish(); })
        .catch(() => finish());
    } catch { finish(); }
    const t = setTimeout(finish, 6000);
    return () => { clearTimeout(t); navigator.serviceWorker.removeEventListener('controllerchange', onController); };
  }, []);
  return ready;
}

/** One-shot waiter used by the API layer to retry a call that raced SW install. */
export function waitForSwController(timeoutMs = 4000): Promise<void> {
  if (!MOCK_PAGES || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve();
  if (swControllerReady()) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(done, timeoutMs);
    function done() { clearTimeout(t); navigator.serviceWorker.removeEventListener('controllerchange', done); resolve(); }
    navigator.serviceWorker.addEventListener('controllerchange', done);
  });
}
