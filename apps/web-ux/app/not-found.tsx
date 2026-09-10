'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

/* ============================================================================
   ۴۰۴ هوشمند (بیلد استاتیک GitHub Pages)
   ----------------------------------------------------------------------------
   در خروجی استاتیک فقط صفحاتِ seed پیش‌ساخت‌اند. اگر مسیرِ جزئیاتِ موجودیتی
   (مثل r-1694… که کاربر همین حالا ساخته) ۴۰۴ شد، به‌جای دیوار «یافت نشد»،
   همان موجودیت را در /view?type=…&id=… باز می‌کنیم — کامپوننت جزئیات همان
   است، فقط رندر سمت کلاینت. برای مسیرهای غیرمرتبط، صفحهٔ ۴۰۴ معمولی.
   ========================================================================== */

/* type مسیر → پارامتر /view (برابر همان کلیدهای LOADERS در app/view) */
const TYPES: Record<string, string> = {
  organizations: 'organizations', people: 'people', relationships: 'relationships',
  meetings: 'meetings', actions: 'actions', commitments: 'commitments',
  projects: 'projects', opportunities: 'opportunities', interactions: 'interactions',
  recommendations: 'recommendations',
};
/* پیشوند basePath استاتیک (مثل /Srip/srip2) — همان الگوی layout/sw-register */
const PAGES_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/api\/v1\/?$/, '');

export default function NotFound() {
  useEffect(() => {
    try {
      const m = window.location.pathname.replace(PAGES_BASE, '')
        .match(/^\/(organizations|people|relationships|meetings|actions|commitments|projects|opportunities|interactions|recommendations)\/([^/]+)\/?$/);
      if (m && TYPES[m[1]] && m[2]) {
        const url = `${PAGES_BASE}/view?type=${encodeURIComponent(m[1])}&id=${encodeURIComponent(m[2])}`;
        window.location.replace(url);
      }
    } catch { /* پارس نشد → همان ۴۰۴ معمولی */ }
  }, []);

  return (
    <main className="error-page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="route-error" style={{ maxWidth: 460, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div className="empty-ico" style={{ width: 64, height: 64, borderRadius: 20 }}><AlertTriangle size={30} /></div>
        <div>
          <div className="eyebrow" style={{ textAlign: 'center' }}>۴۰۴ · یافت نشد</div>
          <strong style={{ fontSize: 24, display: 'block', marginTop: 4 }}>صفحه پیدا نشد</strong>
          <p style={{ marginTop: 8 }}>مسیر در این Workspace وجود ندارد یا برای شما قابل دسترسی نیست.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link className="btn btn-primary" href="/"><Home size={16} /> بازگشت به داشبورد</Link>
          <Link className="btn btn-secondary" href="/search"><RefreshCw size={16} /> جستجوی سراسری</Link>
        </div>
      </section>
    </main>
  );
}
