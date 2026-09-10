'use client';
import { Suspense, lazy, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ErrorCard, Loading, PageHeader } from '../_components/page-ui';
import { ArrowRight, ExternalLink } from 'lucide-react';
import type { ComponentType } from 'react';

/* ============================================================================
   /view?type=…&id=… — مسیر جایگزین جزئیات برای بیلد استاتیک (GitHub Pages)
   ----------------------------------------------------------------------------
   در خروجی استاتیک، فقط صفحاتِ موجودیت‌های seed (فهرست pages-ids) پیش‌ساخت
   می‌شوند؛ موجودیت‌هایی که کاربر در همان نشست می‌سازد صفحهٔ استاتیک ندارند و
   مسیر مستقیمشان ۴۰۴ می‌شود. این صفحه همان کامپوننت جزئیات را با شناسهٔ
   دلخواه سمت کلاینت رندر می‌کند و not-found هوشمند مسیرهای ۴۰۴ را اینجا
   می‌فرستد. برای seedها مسیر مستقیم (پیش‌ساخت و SEO-دار) همچنان اصلی است.
   ========================================================================== */

const TYPE_FA: Record<string, string> = {
  organizations: 'سازمان', people: 'شخص', relationships: 'رابطه', meetings: 'جلسه',
  actions: 'اقدام', commitments: 'تعهد', projects: 'پروژه', opportunities: 'فرصت',
  interactions: 'تعامل', recommendations: 'پیشنهاد',
};

type DetailPage = ComponentType<{ params: Promise<{ id: string }> }>;

/* ایمپورتهای lazy: هر نوع فقط وقتی لازم شود بارگذاری می‌شود (تقسیم کد) */
const LOADERS: Record<string, () => Promise<{ default: DetailPage }>> = {
  organizations: () => import('../organizations/[id]/page'),
  people: () => import('../people/[id]/page'),
  relationships: () => import('../relationships/[id]/page'),
  meetings: () => import('../meetings/[id]/page'),
  actions: () => import('../actions/[id]/page'),
  commitments: () => import('../commitments/[id]/page'),
  projects: () => import('../projects/[id]/page'),
  opportunities: () => import('../opportunities/[id]/page'),
  interactions: () => import('../interactions/[id]/page'),
  recommendations: () => import('../recommendations/[id]/page'),
};

function ViewInner() {
  const sp = useSearchParams();
  const type = sp.get('type') ?? '';
  const id = sp.get('id') ?? '';

  const Page = useMemo(() => (LOADERS[type] ? lazy(LOADERS[type]) : null), [type]);

  if (!Page || !id) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="نمای جزئیات" title="نشانی ناقص است" description="پارامتر type و id لازم است؛ از فهرست‌ها وارد شوید." />
        <ErrorCard message="نوع یا شناسهٔ موجودیت مشخص نشده است." />
      </main>
    );
  }

  return (
    <>
      {/* نوار راهنما: این نمای جایگزین است؛ برای seedها مسیر مستقیم اصلی است */}
      <div className="notice" role="note" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <ExternalLink size={13} />
        <span>نمای جزئیاتِ «{TYPE_FA[type] ?? type}» با شناسهٔ <code dir="ltr">{id}</code></span>
        <Link className="btn btn-ghost btn-sm" href={`/${type}`}><ArrowRight size={13} /> بازگشت به فهرست</Link>
      </div>
      <Suspense fallback={<Loading label="در حال بارگذاری جزئیات…" />}>
        <Page params={Promise.resolve({ id })} />
      </Suspense>
    </>
  );
}

export default function ViewPage() {
  return (
    <Suspense fallback={<Loading label="در حال بارگذاری…" />}>
      <ViewInner />
    </Suspense>
  );
}
