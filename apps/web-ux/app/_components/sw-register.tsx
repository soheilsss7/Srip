'use client';
import { useEffect } from 'react';

// On the static GitHub Pages build (SRIP_PAGES=1) the app has no backend:
// a Service Worker (public/sw.js) answers /Srip/api/v1/* with the embedded
// deterministic mock API. In dev this component does nothing.
const PAGES_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/api\/v1\/?$/, '');

export default function SwRegister() {
  useEffect(() => {
    if (!PAGES_BASE || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const KEY = 'srip_sw_reloaded';
    navigator.serviceWorker
      .register(PAGES_BASE + '/sw.js', { scope: PAGES_BASE + '/' })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        // First load: SW activates + claims, then reload so this page is
        // controlled too (otherwise the first batch of API calls misses).
        if (!navigator.serviceWorker.controller && !sessionStorage.getItem(KEY)) {
          sessionStorage.setItem(KEY, '1');
          window.location.reload();
        }
      })
      .catch(() => { /* mock SW not present (dev) */ });
  }, []);
  return null;
}
