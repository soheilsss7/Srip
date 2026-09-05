'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { fa } from '../../_lib/fa';
import { Badge, ErrorCard, Loading, PageHeader } from '../../_components/page-ui';
import { CalendarDays, HeartPulse, RefreshCw, Archive, RotateCcw, AlertTriangle, ChevronLeft } from 'lucide-react';

const arr = (x: any): any[] => Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : Array.isArray(x?.rows) ? x.rows : [];
const fmtNum = (v: any): string => (v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v));
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
const timeAgo = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 0) return '—';
  if (d === 0) return 'امروز';
  if (d === 1) return 'دیروز';
  if (d < 30) return fmtNum(d) + ' روز پیش';
  if (d < 365) return fmtNum(Math.floor(d / 30)) + ' ماه پیش';
  return fmtNum(Math.floor(d / 365)) + ' سال پیش';
};

const STATUS_OPTIONS = ['PROSPECTIVE', 'ACTIVE', 'WATCH', 'AT_RISK', 'DORMANT', 'ARCHIVED'];
const LIFECYCLE_OPTIONS = ['IDENTIFIED', 'INTRODUCED', 'INITIAL_CONTACT', 'DEVELOPING', 'ACTIVE', 'STRATEGIC', 'DORMANT', 'AT_RISK', 'LOST'];
const SCORE_META: Array<{ key: string; label: string; invert?: boolean }> = [
  { key: 'healthScore', label: 'سلامت رابطه' },
  { key: 'strategicScore', label: 'ارزش راهبردی' },
  { key: 'riskScore', label: 'ریسک', invert: true },
  { key: 'trustScore', label: 'اعتماد' },
  { key: 'influenceScore', label: 'نفوذ' },
  { key: 'opportunityScore', label: 'پتانسیل فرصت' },
  { key: 'resilienceScore', label: 'تاب‌آوری' },
  { key: 'engagementScore', label: 'درگیری' },
];
const clsOf = (v: any, invert = false): string => {
  if (v == null) return 'h-null';
  const n = invert ? 100 - v : v;
  if (n >= 75) return 'h-hi';
  if (n >= 55) return 'h-mid';
  if (n >= 40) return 'h-low';
  return 'h-crit';
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [r, setR] = useState<any>(null);
  const [tl, setTl] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [a, b] = await Promise.all([api(`/relationships/${id}`), api(`/relationships/${id}/timeline`)]);
      setR(a); setTl(arr(b));
    } catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function doIt(label: string, fn: () => Promise<any>, doneMsg: string) {
    setBusy(label); setError(''); setInfo('');
    try { await fn(); setInfo(doneMsg); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }

  const name = r ? `${r.sourceOrganization?.name ?? '—'} ↔ ${r.targetOrganization?.name ?? '—'}` : 'رابطه';
  const TONE_MAP: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
    ACTIVE: 'success', PROSPECTIVE: 'info', WATCH: 'warning', AT_RISK: 'danger', DORMANT: 'neutral', ARCHIVED: 'neutral',
  };
  const statusTone = TONE_MAP[r?.status ?? ''] ?? 'neutral';

  const scores = useMemo(
    () => SCORE_META.filter(m => r?.[m.key] != null),
    [r],
  );

  if (!r && !error) return <main className="feature-page"><PageHeader eyebrow="حوزهٔ اصلی · پروفایل رابطه" title="رابطه" description="" actions={<></>} /><Loading /></main>;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="حوزهٔ اصلی · پروفایل رابطه"
        title={name}
        description={`${fa(r?.relationshipType ?? '')} · ${fa(r?.status ?? '')}`}
        actions={
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            <button className="secondary-action" onClick={load} disabled={!!busy}><RefreshCw size={14} /> بازخوانی</button>
            <label className="inline-label">وضعیت
              <select value={r?.status ?? 'ACTIVE'} disabled={!!busy} onChange={e => doIt('status', () => api(`/relationships/${id}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }), 'وضعیت به‌روزرسانی شد.')}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select>
            </label>
            <label className="inline-label">مرحلهٔ چرخهٔ زندگی
              <select value={r?.lifecycleStage ?? 'ACTIVE'} disabled={!!busy} onChange={e => doIt('lifecycle', () => api(`/relationships/${id}/lifecycle`, { method: 'PATCH', body: JSON.stringify({ lifecycleStage: e.target.value }) }), 'مرحلهٔ چرخهٔ زندگی به‌روزرسانی شد.')}>
                {LIFECYCLE_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select>
            </label>
            <button className="secondary-action" disabled={!!busy} onClick={() => doIt('recalc', () => api(`/relationships/${id}/recalculate-score`, { method: 'POST' }), 'امتیازها دوباره محاسبه شدند.')}>
              <RefreshCw size={14} /> محاسبهٔ مجدد امتیاز
            </button>
            {r?.status === 'ARCHIVED' ? (
              <button className="primary-action" disabled={!!busy} onClick={() => doIt('restore', () => api(`/relationships/${id}/restore`, { method: 'POST' }), 'رابطه بازیابی شد.')}>
                <RotateCcw size={14} /> بازیابی رابطه
              </button>
            ) : (
              <button className="danger-action" disabled={!!busy} onClick={() => { if (window.confirm('این رابطه بایگانی شود؟ از فهرست روابط فعال حذف می‌شود.')) doIt('archive', () => api(`/relationships/${id}/archive`, { method: 'PATCH' }), 'رابطه بایگانی شد.'); }}>
                <Archive size={14} /> بایگانی رابطه
              </button>
            )}
          </div>
        }
      />
      <ErrorCard message={error} />
      {info && <div className="success-card" role="status">{info}</div>}

      {r && (
        <>
          {/* خلاصهٔ وضعیت */}
          <section className="rel-status-card">
            <div className="rel-status-head">
              <span className="rel-status-ico"><HeartPulse size={17} /></span>
              <div>
                <h2>وضعیت رابطه</h2>
                <p>سلامت، ریسک، راهبردی و گام بعدی — محاسبهٔ زنده از امتیازها و رویدادها</p>
              </div>
              <Badge tone={statusTone}>{fa(r.status)}</Badge>
            </div>
            <div className="rel-status-metrics">
              <div className="rel-metric">
                <span>سلامت رابطه</span>
                <div className="rel-metric-value"><b className={clsOf(r.healthScore)}>{fmtNum(r.healthScore)}</b><small>از ۱۰۰</small></div>
                <div className="rel-metric-bar"><span className={clsOf(r.healthScore)} style={{ width: `${Math.min(100, r.healthScore ?? 0)}%` }} /></div>
              </div>
              <div className="rel-metric">
                <span>ریسک</span>
                <div className="rel-metric-value"><b className={clsOf(r.riskScore, true)}>{fmtNum(r.riskScore)}</b><small>از ۱۰۰</small></div>
                <div className="rel-metric-bar"><span className={clsOf(r.riskScore, true)} style={{ width: `${Math.min(100, r.riskScore ?? 0)}%` }} /></div>
              </div>
              <div className="rel-metric">
                <span>ارزش راهبردی</span>
                <div className="rel-metric-value"><b className={clsOf(r.strategicScore)}>{fmtNum(r.strategicScore)}</b><small>از ۱۰۰</small></div>
                <div className="rel-metric-bar"><span className={clsOf(r.strategicScore)} style={{ width: `${Math.min(100, r.strategicScore ?? 0)}%` }} /></div>
              </div>
              <div className="rel-metric">
                <span>آخرین تعامل</span>
                <div className="rel-metric-value"><b>{timeAgo(r.lastInteractionAt)}</b><small>{r.lastInteractionAt ? fmtDate(r.lastInteractionAt) : 'ثبت نشده'}</small></div>
              </div>
              <div className="rel-metric">
                <span>اقدام بعدی</span>
                <div className="rel-metric-value">
                  <b>{r.nextActionAt ? fmtNum(new Date(r.nextActionAt).getDate()) : '—'}</b>
                  <small>{r.nextActionAt ? new Date(r.nextActionAt).toLocaleDateString('fa-IR', { month: 'short' }) : 'اقدامی ثبت نشده'}</small>
                </div>
              </div>
            </div>
            {(r.riskScore ?? 0) >= 40 && (
              <div className="wf-alert"><AlertTriangle size={13} /> این رابطه در معرض ریسک است — برای کاهش آن اقدام برنامه‌ریزی کنید.</div>
            )}
            {Array.isArray(r.riskDrivers) && r.riskDrivers.length > 0 && (
              <div className="risk-why" role="note">
                <div className="risk-why-head"><AlertTriangle size={14}/><span><b>چرا این رابطه در معرض ریسک است؟</b><small>دلایل استخراج‌شده از امتیازها و سیگنال‌های واقعی رابطه</small></span></div>
                <div className="risk-why-list">
                  {r.riskDrivers.map((d:any,i:number)=>(
                    <div className="risk-why-item" key={i} style={{borderInlineStartColor:d.tone==='critical'?'var(--srip-danger,#dc2626)':d.tone==='warning'?'var(--srip-warning,#f59e0b)':'var(--srip-accent)'}}>
                      <b>{d.label}</b>
                      <span>{d.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="split-panels">
            {/* امتیازها */}
            <section className="panel">
              <div className="panel-title"><div><h2>امتیازهای رابطه</h2><p>هشت مؤلفهٔ سلامت — از موتور امتیازدهی</p></div></div>
              {scores.length ? (
                <div className="scores">
                  {scores.map(m => (
                    <div className="score-block" key={m.key}>
                      <div className="score-head"><span>{m.label}</span><b>{fmtNum(r[m.key])}</b></div>
                      <div className="score-track">
                        <span className={`score-fill ${clsOf(r[m.key], m.invert)}`} style={{ width: `${Math.min(100, r[m.key] ?? 0)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state">امتیازی ثبت نشده — «محاسبهٔ مجدد امتیاز» را بزنید.</p>}
            </section>

            {/* اطلاعات */}
            <section className="panel">
              <div className="panel-title"><div><h2>اطلاعات رابطه</h2><p>مالکیت و طرفین</p></div></div>
              <div className="detail-grid">
                {[
                  ['سازمان مبدأ', r.sourceOrganization?.name],
                  ['سازمان مقصد', r.targetOrganization?.name],
                  ['نوع رابطه', r.relationshipType ? fa(r.relationshipType) : null],
                  ['مرحلهٔ چرخهٔ زندگی', r.lifecycleStage ? fa(r.lifecycleStage) : null],
                  ['مالک', r.owner?.name],
                  ['مالک جایگزین', r.backupOwner?.name],
                  ['آخرین تعامل', r.lastInteractionAt ? timeAgo(r.lastInteractionAt) : null],
                  ['اقدام بعدی', r.nextActionAt ? fmtDate(r.nextActionAt) : null],
                ].filter(([, v]) => v != null).map(([k, v]) => (
                  <div className="detail-item" key={String(k)}><small>{k}</small><strong>{String(v)}</strong></div>
                ))}
              </div>
              <div className="panel-title" style={{ marginTop: 18 }}><div><h2>سازمان‌های طرفین</h2></div></div>
              <div className="rel-status-list">
                <Link className="rel-status-row" href={`/organizations/${r.sourceOrganization?.id}`}>
                  <span className="health-dot h-hi" />
                  <span className="rel-status-row-name">{r.sourceOrganization?.name ?? '—'} <small>(مبدأ)</small></span>
                  <ChevronLeft size={14} className="muted" />
                </Link>
                <Link className="rel-status-row" href={`/organizations/${r.targetOrganization?.id}`}>
                  <span className="health-dot h-mid" />
                  <span className="rel-status-row-name">{r.targetOrganization?.name ?? '—'} <small>(مقصد)</small></span>
                  <ChevronLeft size={14} className="muted" />
                </Link>
              </div>
            </section>
          </div>

          {/* خط زمانی */}
          <section className="panel">
            <div className="panel-title">
              <div><h2>خط زمانی رابطه</h2><p>جلسات، تعاملات و اقدامات مرتبط با این رابطه</p></div>
              <Badge>{fmtNum(tl.length)}</Badge>
            </div>
            {tl.length ? (
              <div className="list">
                {tl.slice(0, 60).map((x: any, i: number) => {
                  const inner = (<>
                    <Badge tone={x.kind === 'MEETING' ? 'success' : x.kind === 'ACTION' ? 'warning' : x.kind === 'INTERACTION' ? 'info' : 'neutral'}>{fa(x.kind ?? 'EVENT')}</Badge>
                    <span style={{ flex: 1 }}>
                      <strong>{x.title || x.subject || x.description || x.name || x.eventType || '—'}</strong>
                      {(x.date || x.createdAt) && <small><CalendarDays size={11} style={{ verticalAlign: '-1px' }} /> {new Date(x.date ?? x.createdAt).toLocaleString('fa-IR')}</small>}
                    </span>
                    {x.status && (
                      <Badge tone={x.status === 'DONE' ? 'success' : x.status === 'UPCOMING' ? 'info' : x.status === 'OPEN' ? 'warning' : x.status === 'CALL' || x.status === 'EMAIL' || x.status === 'MEETING' || x.status === 'NOTE' || x.status === 'MESSAGE' ? 'info' : 'neutral'}>{x.kind === 'INTERACTION' && ['CALL','EMAIL','MEETING','NOTE','MESSAGE','OTHER'].includes(x.status) ? fa(x.status) : fa(x.status)}</Badge>
                    )}
                  </>);
                  return x.kind === 'INTERACTION' && x.id && !String(x.id).startsWith('t-')
                    ? <Link href={`/interactions/${x.id}`} key={x.id ?? i} className="listRow linkRow" style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link>
                    : <div className="listRow" key={x.id ?? i}>{inner}</div>;
                })}
              </div>
            ) : <p className="empty-state">رویدادی در خط زمانی این رابطه ثبت نشده است — نخستین جلسه یا تعامل را ثبت کنید.</p>}
          </section>
        </>
      )}
    </main>
  );
}
