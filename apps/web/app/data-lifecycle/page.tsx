'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { Badge, ErrorCard, Loading, PageHeader, StatCard } from '../_components/page-ui';
import {
  ArchiveRestore, BadgeCheck, Building2, CalendarDays, CircleDot, ClipboardList, DatabaseBackup,
  FileJson, Handshake, Hourglass, NotebookPen, RefreshCw, RotateCcw, ScrollText, Search,
  ShieldCheck, Timer, Trash2, UserRound,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  چرخهٔ حیات داده — پاریتی DataLifecycleController.status            */
/* ------------------------------------------------------------------ */

type LcRecord = {
  id: string; entityType?: string; entityId?: string; state?: string;
  reason?: string | null; actorId?: string | null; actorName?: string | null; transitionedAt?: string;
};
type Status = {
  totalLifecycleRecords?: number; byState?: Record<string, number>; byEntityType?: Record<string, number>;
  pendingDeletionApprovals?: number; entities?: string[]; states?: string[];
  recent?: { records?: LcRecord[] };
};

const STATE_META: Record<string, { fa: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; color: string; desc: string }> = {
  CREATION: { fa: 'ایجاد', tone: 'info', color: '#2563eb', desc: 'پس از ساخت رکورد' },
  ACTIVE: { fa: 'فعال', tone: 'success', color: '#16a34a', desc: 'در حال استفاده' },
  ARCHIVED: { fa: 'بایگانی‌شده', tone: 'warning', color: '#f59e0b', desc: 'حذف نرم و خارج از دید' },
  RETENTION: { fa: 'دورهٔ نگهداری', tone: 'info', color: '#0891b2', desc: 'تحت سیاست نگهداشت' },
  DELETION: { fa: 'در صف حذف', tone: 'warning', color: '#f59e0b', desc: 'نامزد پاک‌سازی' },
  DELETED: { fa: 'حذف‌شده', tone: 'warning', color: '#f59e0b', desc: 'حذف نرم' },
  RESTORED: { fa: 'بازگردانی‌شده', tone: 'success', color: '#16a34a', desc: 'از بایگانی برگشت' },
  PURGED: { fa: 'پاک‌سازی نهایی', tone: 'danger', color: '#dc2626', desc: 'غیرقابل بازیابی' },
  PERMANENT: { fa: 'حذف دائمی', tone: 'danger', color: '#dc2626', desc: 'پس از تأیید' },
  PENDING: { fa: 'در انتظار', tone: 'info', color: '#2563eb', desc: 'منتظر تصمیم' },
};
const ENTITY_COLOR: Record<string, string> = {
  Organization: '#7c3aed', Person: '#2563eb', Relationship: '#16a34a', Interaction: '#0ea5e9',
  Meeting: '#f59e0b', Project: '#db2777', Opportunity: '#65a30d', Commitment: '#0891b2',
  Action: '#64748b', UserPrivacyData: '#dc2626',
};
const ENTITY_META: Record<string, { fa: string; icon: React.ReactNode }> = {
  Organization: { fa: 'سازمان', icon: <Building2 size={14} /> },
  Person: { fa: 'شخص', icon: <UserRound size={14} /> },
  Relationship: { fa: 'رابطه', icon: <Handshake size={14} /> },
  Interaction: { fa: 'تعامل', icon: <NotebookPen size={14} /> },
  Meeting: { fa: 'جلسه', icon: <CalendarDays size={14} /> },
  Project: { fa: 'پروژه', icon: <ClipboardList size={14} /> },
  Opportunity: { fa: 'فرصت', icon: <FileJson size={14} /> },
  Commitment: { fa: 'تعهد', icon: <BadgeCheck size={14} /> },
  Action: { fa: 'اقدام', icon: <CircleDot size={14} /> },
  UserPrivacyData: { fa: 'دادهٔ کاربر', icon: <ShieldCheck size={14} /> },
};

const fmtNum = (v: unknown) => (v == null || v === '' ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v)));
const fmtDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' }) + `، ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
};

function Bars({ rows, max, width = 60, meta }: { rows: Array<[string, number]>; max: number; width?: number; meta?: Record<string, { fa?: string; color?: string }> }) {
  if (rows.length === 0) return <div className="empty-state">داده‌ای ثبت نشده است.</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map(([k, v]) => {
        const m = meta?.[k] ?? STATE_META[k] ?? { color: '#64748b', fa: fa(k) };
        const color = m.color ?? '#64748b';
        const label = m.fa ?? fa(k);
        const pct = max > 0 ? Math.max((v / max) * 100, 3) : 0;
        return (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: `${width}px 1fr 44px`, gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary, #475569)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
            <span style={{ background: 'var(--card-bg-soft, #f1f5f9)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width .3s' }} />
            </span>
            <b style={{ fontSize: 11.5, textAlign: 'left', color: 'var(--text, #0f172a)' }}>{fmtNum(v)}</b>
          </div>
        );
      })}
    </div>
  );
}

export default function DataLifecycle() {
  const [d, setD] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  async function load(silent = false) {
    if (!silent) setError('');
    setRefreshing(true);
    try { setD(await api<Status>('/data-lifecycle/status')); }
    catch (x) { setError((x as Error).message); }
    finally { setRefreshing(false); }
  }
  useEffect(() => { load(); }, []);

  const byState = d?.byState ?? {};
  const byEntity = d?.byEntityType ?? {};
  const recent = d?.recent?.records ?? [];
  const maxState = Math.max(1, ...Object.values(byState).map(Number));
  const maxEntity = Math.max(1, ...Object.values(byEntity).map(Number));
  const purged = (byState.PURGED ?? 0) + (byState.PERMANENT ?? 0) + (byState.DELETED ?? 0) + (byState.DELETION ?? 0);
  const pending = d?.pendingDeletionApprovals ?? 0;
  const knownStates = [...new Set([...(d?.states ?? []), ...Object.keys(STATE_META)])];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return recent.filter(r => {
      if (stateFilter && r.state !== stateFilter) return false;
      if (!term) return true;
      const hay = `${r.entityType ?? ''} ${ENTITY_META[r.entityType ?? '']?.fa ?? ''} ${r.entityId ?? ''} ${r.state ?? ''} ${STATE_META[r.state ?? '']?.fa ?? ''} ${r.reason ?? ''} ${r.actorName ?? ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [recent, q, stateFilter]);

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="حاکمیت داده"
        title="چرخهٔ حیات داده"
        description="سوابق گذار هر نهاد (ایجاد ← فعال ← بایگانی/نگهداری ← حذف ← پاک‌سازی نهایی) همراه با توزیع وضعیت‌ها و نهادها، و تأییدیه‌های حذف دائمی در انتظار."
        actions={
          <div className="toolbar">
            {pending > 0
              ? <Badge tone="danger"><Hourglass size={13} /> {fmtNum(pending)} حذف دائمی در انتظار تأیید</Badge>
              : <Badge tone="success"><ShieldCheck size={13} /> هیچ حذف دائمی در انتظار نیست</Badge>}
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
            </button>
          </div>
        }
      />
      <ErrorCard message={error} />

      {!d && !error ? <Loading label="در حال بارگذاری چرخهٔ حیات…" /> : (
        <>
          <div className="stat-grid">
            <StatCard icon={<ScrollText size={18} />} label="کل سوابق گذار" value={fmtNum(d?.totalLifecycleRecords ?? 0)} iconClass="ic-blue" sub="رکوردهای ثبت‌شدهٔ DataLifecycle" />
            <StatCard icon={<DatabaseBackup size={18} />} label="انواع نهاد تحت مدیریت" value={fmtNum(d?.entities?.length ?? 0)} iconClass="ic-purple" sub={`${fmtNum(new Set(recent.map(r => r.entityType)).size)} نهاد دارای سابقه`} />
            <StatCard icon={<Trash2 size={18} />} label="حذف/پاک‌سازی‌ها" value={fmtNum(purged)} iconClass="ic-red" sub="DELETION · DELETED · PURGED" />
            <StatCard icon={<Hourglass size={18} />} label="حذف دائمی در انتظار" value={fmtNum(pending)} iconClass="ic-gold" sub="ApprovalRequest از نوع DELETE" />
          </div>

          <div className="grid2">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><CircleDot size={16} /> توزیع بر اساس وضعیت</h2>
                  <p>گذاری که نهادها اکنون در آن قرار دارند.</p>
                </div>
                <Badge tone="info">{fmtNum(Object.keys(byState).length)} وضعیت</Badge>
              </div>
              <Bars rows={Object.entries(byState).sort((a, b) => b[1] - a[1])} max={maxState} />
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><DatabaseBackup size={16} /> توزیع بر اساس نوع نهاد</h2>
                  <p>کدام دسته از داده‌ها گذارهای بیشتری داشته‌اند.</p>
                </div>
                <Badge tone="info">{fmtNum(Object.keys(byEntity).length)} نهاد</Badge>
              </div>
              <Bars rows={Object.entries(byEntity).sort((a, b) => b[1] - a[1])} max={maxEntity} width={86} meta={Object.fromEntries(Object.entries(ENTITY_META).map(([k, v]) => [k, { fa: v.fa, color: ENTITY_COLOR[k] }]))} />
            </section>
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><RotateCcw size={16} /> آخرین گذارهای ثبت‌شده</h2>
                <p>بیست گذار اخیر به‌ترتیب زمان؛ جستجو یا فیلتر بر اساس وضعیت.</p>
              </div>
              <Badge tone="info">{fmtNum(filtered.length)} گذار</Badge>
            </div>
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
                <Search size={14} style={{ position: 'absolute', insetInlineStart: 9, top: 10, color: 'var(--text-muted)' }} />
                <input placeholder="جستجو در نهاد، شناسه، دلیل، بازیگر…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingInlineStart: 30, width: '100%' }} />
              </div>
              <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} style={{ maxWidth: 190 }}>
                <option value="">همهٔ وضعیت‌ها</option>
                {knownStates.map(s => <option key={s} value={s}>{STATE_META[s]?.fa ?? fa(s)}</option>)}
              </select>
            </div>
            {filtered.length === 0 ? (
              <div className="empty-state">گذاری برای این فیلترها ثبت نشده است.</div>
            ) : (
              <div className="list">
                {filtered.map(r => {
                  const sm = STATE_META[r.state ?? ''] ?? { color: '#64748b', tone: 'info' as const, fa: fa(r.state) };
                  const em = ENTITY_META[r.entityType ?? ''] ?? { fa: r.entityType ?? '—', icon: <DatabaseBackup size={14} /> };
                  return (
                    <article className="listRow" key={r.id} style={{ alignItems: 'center' }}>
                      <span style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: `color-mix(in srgb, ${sm.color} 12%, transparent)`, color: sm.color }}>
                        {em.icon}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <b>{em.fa}</b>
                          <code dir="ltr" style={{ fontSize: 9.5, opacity: .7 }}>{String(r.entityId ?? '').slice(0, 16)}</code>
                          <Badge tone={sm.tone}>{sm.fa}</Badge>
                        </span>
                        <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 1 }}>
                          {r.reason ? `دلیل: ${r.reason} · ` : ''}
                          بازیگر: {r.actorName ?? '—'} · {fmtDT(r.transitionedAt)}
                        </span>
                      </span>
                      <span className="t-muted" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                        <code dir="ltr" style={{ fontSize: 9.5 }}>{String(r.id).slice(0, 12)}</code>
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid2">
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div><h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ArchiveRestore size={16} /> معنی وضعیت‌ها</h2></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 6 }}>
                {knownStates.map(s => {
                  const sm = STATE_META[s];
                  if (!sm) return null;
                  return (
                    <span key={s} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10.5, color: 'var(--text-secondary,#475569)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: sm.color, flex: '0 0 auto' }} />
                      <b>{sm.fa}</b> — {sm.desc}
                    </span>
                  );
                })}
              </div>
            </section>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Hourglass size={16} /> حذف دائمی و تأییدیه‌ها</h2>
                  <p>درخواست‌های «حذف دائمی» از جریان ApprovalRequest (عمل DELETE) عبور می‌کنند.</p>
                </div>
              </div>
              {pending > 0 ? (
                <>
                  <p style={{ fontSize: 12, margin: '0 0 8px' }}><b>{fmtNum(pending)} درخواست حذف دائمی</b> در انتظار تأیید مالک/مدیر است؛ پس از تأیید، نهاد به وضعیت PURGED (پاک‌سازی نهایی) منتقل می‌شود و از داده‌های عملیاتی حذف می‌گردد.</p>
                  <p className="t-muted" style={{ fontSize: 10.5, margin: 0 }}>
                    <Timer size={11} style={{ verticalAlign: -2 }} /> مسیر تأیید/رد این درخواست‌ها از بخش مدیریت تأییدیه‌ها در دسترس است.
                  </p>
                </>
              ) : (
                <div className="empty-state" style={{ padding: 14 }}>
                  <ShieldCheck size={16} /> هیچ حذف دائمی در انتظار تأیید نیست — وضعیت سالم چرخهٔ حیات.
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
