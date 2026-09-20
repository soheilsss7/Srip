'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import HubTabs from './hub-tabs';
import { lt, t } from '../_lib/i18n';

/* ═══════════════════════════════════════════════════════════════════════════
   هاب «هوش» — نوار بالا که در همهٔ صفحات این هوش همان می‌ماند:
   هوش رابطه · دستیار هوشمند · پیشنهادها · بریف هفتگی · گزارش‌ها
   + زیرمجموعه‌های «پیشنهادهای هوشمند»: خود پیشنهادها و غنی‌سازی منابع رسمی.
   ═══════════════════════════════════════════════════════════════════════════ */

export const INTEL_HUB_TABS = lt([
  { href: '/intelligence', label: t('هوش رابطه') },
  { href: '/ai', label: t('دستیار هوشمند') },
  { href: '/recommendations', label: t('پیشنهادها') },
  { href: '/ai-executive-brief', label: t('بریف هفتگی') },
  { href: '/reports', label: t('گزارش‌ها') },
]);

/** نوار اصلی هاب هوش — در همهٔ صفحات هوش رندر می‌شود تا منو هرگز «حرف» نشود */
export default function IntelHub() {
  const pathname = usePathname();
  // غنی‌سازی منابع رسمی زیرمجموعهٔ «پیشنهادها»ست — تب مادرِ همان، فعال می‌ماند
  const force = pathname === '/enrichment' ? '/recommendations' : undefined;
  return <HubTabs base tabs={INTEL_HUB_TABS} activeHref={force} />;
}

/** زیرمجموعه‌های «پیشنهادهای هوشمند» — روی /recommendations و /enrichment */
export function RecSubTabs() {
  const pathname = usePathname();
  const subs = [
    { href: '/recommendations', label: t('پیشنهادهای هوشمند') },
    { href: '/enrichment', label: t('غنی‌سازی منابع رسمی') },
  ];
  return (
    <nav className="tabs sub-tabs" role="tablist" aria-label={t('زیربخش‌های پیشنهادها')}>
      {subs.map(s => {
        const active = pathname === s.href || (s.href === '/recommendations' && pathname.startsWith('/recommendations/'));
        return (
          <Link key={s.href} href={s.href} role="tab" aria-selected={active} className={active ? 'tab-active' : ''}>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
