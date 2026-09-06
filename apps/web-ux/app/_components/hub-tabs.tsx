'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * نوار تب هاب‌های یکپارچه — هر تب یک URL واقعی است؛ تب فعال بر اساس مسیر
 * تشخیص داده می‌شود تا عمق‌بندی (مثلاً /monitoring در برابر /monitoring/…) درست بماند.
 */
export type HubTab = { href: string; label: string; icon?: React.ReactNode };

export default function HubTabs({ tabs, base }: { tabs: HubTab[]; base?: boolean }) {
  const pathname = usePathname();
  // تب فعال = دقیق‌ترین تطابق؛ تا وقتی که مسیر با چند تب هم‌خوانی دارد
  // (مثل /data-management در برابر /data-management/import) فقط یک گزینه بالا بماند.
  const activeHref = (() => {
    let best = '';
    let bestLen = -1;
    for (const { href } of tabs) {
      if (pathname === href) return href; // تطابق دقیق همیشه برنده است
      const nested = base && pathname.startsWith(href + '/');
      if (nested && href.length > bestLen) { best = href; bestLen = href.length; }
    }
    return best;
  })();
  return (
    <nav className="tabs" role="tablist" aria-label="بخش‌های این مرکز">
      {tabs.map(({ href, label, icon }) => {
        const active = href === activeHref;
        return (
          <Link key={href} href={href} role="tab" aria-selected={active} className={active ? 'tab-active' : ''}>
            {icon}{label}
          </Link>
        );
      })}
    </nav>
  );
}
