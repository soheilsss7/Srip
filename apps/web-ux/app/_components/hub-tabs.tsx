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
  return (
    <nav className="tabs" role="tablist" aria-label="بخش‌های این مرکز">
      {tabs.map(({ href, label, icon }) => {
        const active = pathname.startsWith(href) && (base ? pathname === href || pathname.startsWith(href + '/') : pathname === href);
        return (
          <Link key={href} href={href} role="tab" aria-selected={active} className={active ? 'tab-active' : ''}>
            {icon}{label}
          </Link>
        );
      })}
    </nav>
  );
}
