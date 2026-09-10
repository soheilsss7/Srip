'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { faNum } from '../_lib/jalali';

/* زنگولهٔ هشدارهای یکپارچه (فاز ۳ · ADR-0007) — شمارندهٔ هشدارهای «بحرانی»
   را از GET /alerts می‌گیرد و به صفحهٔ هشدارها می‌برد. منطق تشخیص در سرور
   است؛ این‌جا فقط نمایش. هر ۶۰ ثانیه و پس از هر بازگشت به تب، تازه می‌شود. */
export function AlertBell() {
  const [critical, setCritical] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => api<any>('/alerts')
      .then(d => { if (alive) setCritical(d?.summary?.CRITICAL ?? 0); })
      .catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <Link
      className="icon-btn alert-bell"
      href="/alerts"
      title={critical != null && critical > 0 ? `هشدارهای یکپارچه — ${faNum(critical)} مورد بحرانی` : 'هشدارهای یکپارچه — همهٔ سیگنال‌ها در یک نگاه'}
      aria-label={critical != null && critical > 0 ? `هشدارها: ${faNum(critical)} مورد بحرانی` : 'هشدارها'}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" />
      </svg>
      {critical != null && critical > 0 && (
        <span className="alert-badge" aria-hidden="true">{critical > 99 ? '۹۹+' : faNum(critical)}</span>
      )}
    </Link>
  );
}
