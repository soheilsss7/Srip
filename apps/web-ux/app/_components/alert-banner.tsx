'use client';
import { faNum } from '../_lib/jalali';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { Siren, X, ArrowLeft } from 'lucide-react';

/* <AlertBanner> — نوار هشدار بحرانی بالای پیشخوان (فاز ۳ · ADR-0007).
   تا ۲ هشدار «بحرانی» فعال از GET /alerts?severity=CRITICAL را نشان می‌دهد.
   با بستن، تا پایان نشست مخفی می‌ماند (داده پاک نمی‌شود؛ فقط نمایش).
   اگر هشدار بحرانی نباشد، هیچ چیزی رندر نمی‌شود. */
type UnifiedAlert = {
  id: string; moduleFa: string; severity: string;
  title: string; reason: string; actionLabel: string | null; actionUrl: string | null;
};

const DISMISS_KEY = 'srip-alert-banner-dismissed';

export function AlertBanner() {
  const [top, setTop] = useState<UnifiedAlert[]>([]);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let off = false;
    try { off = sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { /* حالت خصوصی */ }
    if (off) return;
    setDismissed(false);
    api<any>('/alerts?severity=CRITICAL')
      .then(d => setTop((d?.items ?? []).slice(0, 2)))
      .catch(() => {});
  }, []);

  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }

  if (dismissed || top.length === 0) return null;

  return (
    <div className="alert-banner" role="alert" aria-live="assertive">
      <div className="ab-icon" aria-hidden="true"><Siren size={17} /></div>
      <div className="ab-body">
        <div className="ab-title">
          <b>{top.length === 1 ? 'یک هشدار بحرانی' : `${faNum(top.length)} هشدار بحرانی`} نیازمند اقدام فوری است</b>
          <Link className="ab-link" href="/alerts">همهٔ هشدارها <ArrowLeft size={12} /></Link>
        </div>
        <ul className="ab-list">
          {top.map(a => (
            <li key={a.id}>
              <span className="chip danger">{a.moduleFa}</span>
              <span className="ab-item-title">{a.title}</span>
              {a.actionUrl && <Link className="btn btn-ghost btn-sm" href={a.actionUrl}>{a.actionLabel ?? 'مشاهده'}</Link>}
            </li>
          ))}
        </ul>
      </div>
      <button className="ab-close" onClick={dismiss} aria-label="بستن نوار هشدار (تا پایان نشست دوباره نشان داده نمی‌شود)"><X size={14} /></button>
    </div>
  );
}
