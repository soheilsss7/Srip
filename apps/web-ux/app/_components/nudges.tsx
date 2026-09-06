'use client';
/* ============================================================================
   اعلان‌های مزاحم (nudge) — دادهٔ ناقص/کهنه، تنظیم دستی فعال.
   سیستم باید کاربر را اذیت کند تا امتیازها دقیق بمانند: هر مورد اینجا با دکمهٔ
   «یادآوری» یک اعلان درون‌برنامه‌ای واقعی می‌سازد و به خودِ رکورد لینک می‌دهد.
   ============================================================================ */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { AlertTriangle, BellRing, CalendarClock, Link2, RefreshCw, SlidersHorizontal } from 'lucide-react';

export type NudgeType = {
  kind: string;
  subjectType: string;
  subjectId: string;
  severity?: string;
  title: string;
  body: string;
  criterionCode?: string;
  age?: number;
  data?: any;
};

const TYPE_FA: Record<string, string> = {
  STALE_ANSWER: 'ارزیابی کهنه',
  MANUAL_ACTIVE: 'تنظیم دستی',
  REVIEW: 'بازبینی',
};
const TYPE_ICON: Record<string, React.ReactNode> = {
  STALE_ANSWER: <CalendarClock size={13} />,
  MANUAL_ACTIVE: <SlidersHorizontal size={13} />,
  REVIEW: <AlertTriangle size={13} />,
};
const sevTone = (k?: string): string => (k === 'HIGH' || k === 'CRITICAL' ? 'danger' : k === 'MEDIUM' ? 'warning' : 'info');
const hrefFor = (type: string, id: string): string =>
  type === 'OPPORTUNITY' ? `/opportunities/${id}` : type === 'PERSON' ? `/people/${id}` : type === 'ORGANIZATION' ? `/organizations/${id}` : `/relationships/${id}`;

export function useNudges() {
  const [items, setItems] = useState<NudgeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res: any = await api('/criteria/nudges');
      setItems((Array.isArray(res) ? res : res?.items ?? []) as NudgeType[]);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { items, loading, error, refresh: load };
}

/** نوار یادآوری یکپارچه: وقتی دادهٔ معیارها کهنه/ناقص یا تنظیم دستی فعال است دیده می‌شود. */
export function NudgeBanner({ items, loading, onRefresh, compact }: { items: NudgeType[]; loading?: boolean; onRefresh?: () => void; compact?: boolean }) {
  const [busy, setBusy] = useState('');
  if (loading) return null;
  if (!items.length) return null;
  async function remind(n: NudgeType) {
    setBusy(n.subjectId);
    try {
      await api(`/criteria/nudges/${n.subjectType}/${n.subjectId}`, { method: 'POST', body: JSON.stringify({ kind: n.kind, note: n.body }) });
      onRefresh?.();
    } catch { /* نادیده: حالت نمایشی */ }
    finally { setBusy(''); }
  }
  const sev = items.some((n) => n.severity === 'HIGH' || n.severity === 'CRITICAL');
  return (
    <section className={`nudge-banner ${sev ? 'nudge-banner-danger' : ''}`}>
      <div className="nudge-banner-head">
        <span className="stat-ico ic-gold"><BellRing size={14} /></span>
        <div>
          <strong>امتیازها نیاز به توجه دارند</strong>
          <small>{items.length} مورد — پاسخ کهنه، دادهٔ ناقص یا تنظیم دستی</small>
        </div>
        {onRefresh && <button className="btn btn-ghost btn-sm" onClick={onRefresh} aria-label="بازخوانی"><RefreshCw size={13} /></button>}
      </div>
      <div className={`nudge-banner-list${compact ? ' compact' : ''}`}>
        {items.slice(0, compact ? 3 : 8).map((n, i) => (
          <div key={`${n.subjectType}-${n.subjectId}-${i}`} className="nudge-item">
            <span className={`nudge-ico ${sevTone(n.severity)}`}>{TYPE_ICON[n.kind] ?? <AlertTriangle size={13} />}</span>
            <div className="nudge-body">
              <a href={hrefFor(n.subjectType, n.subjectId)} className="nudge-link">{n.body}</a>
              {n.age != null && <small>{n.age} روز پیش</small>}
            </div>
            <button className="btn btn-secondary btn-sm" disabled={busy === n.subjectId} onClick={() => remind(n)}>
              <BellRing size={12} /> {busy === n.subjectId ? 'ارسال…' : 'یادآوری'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/** فهرست کاملِ یادآوری‌ها برای دیده‌بانی (ادمین). */
export function NudgeList({ items, refresh }: { items: NudgeType[]; refresh: () => void }) {
  const grouped = useMemo(() => {
    const m = new Map<string, NudgeType[]>();
    for (const n of items) {
      const k = `${n.subjectType}:${n.subjectId}`;
      m.set(k, [...(m.get(k) ?? []), n]);
    }
    return Array.from(m.entries());
  }, [items]);
  if (!items.length) return <p className="criteria-saved">هیچ موردی برای یادآوری نیست — داده‌ها تازه‌اند.</p>;
  return (
    <div className="nudge-list">
      {grouped.map(([key, rows]) => {
        const first = rows[0];
        return (
          <div key={key} className="nudge-row">
            <div>
              <a href={hrefFor(first.subjectType, first.subjectId)} className="t-primary" style={{ fontWeight: 700 }}>{first.body.split('—')[0].trim()}</a>
              <small style={{ display: 'block' }}>{rows.map((r) => `${TYPE_FA[r.kind] ?? r.kind}: ${r.body}`).join('؛ ')}</small>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => api(`/criteria/nudges/${first.subjectType}/${first.subjectId}`, { method: 'POST', body: JSON.stringify({ kind: 'REVIEW' }) }).then(refresh).catch(() => undefined)}>
              <BellRing size={12} /> یادآوری دوباره
            </button>
          </div>
        );
      })}
    </div>
  );
}
