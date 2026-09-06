'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { fa } from '../../_lib/fa';
import { Badge, ErrorCard, Loading, PageHeader } from '../../_components/page-ui';
import { CalendarDays, HeartPulse, RefreshCw, Archive, RotateCcw, AlertTriangle, ChevronLeft, TrendingUp, Gauge, FileClock, MessageCircle, Users } from 'lucide-react';
import { CriteriaScoreCard } from '../../_components/criteria';

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
  const [pulse, setPulse] = useState<any>(null);
  const [survey, setSurvey] = useState<any>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, number>>({});
  const [transfer, setTransfer] = useState<any>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [a, b, p, s, t] = await Promise.all([
        api<any>(`/relationships/${id}`),
        api<any>(`/relationships/${id}/timeline`),
        api<any>(`/relationships/${id}/pulse`).catch(() => null),
        api<any>(`/relationships/${id}/pulse-survey`).catch(() => null),
        api<any>(`/intelligence/knowledge-transfer?relationshipId=${id}`).catch(() => null),
      ]);
      setR(a); setTl(arr(b)); setPulse(p); setSurvey(s); setTransfer(t);
      if (s?.last) setSurveyAnswers(Object.fromEntries(((s.last as any)?.answers ?? []).map((x: any) => [x.questionId, x.score])));
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
            <label className="inline-label">کیدنس (هر چند روز)
              <select value={r?.cadence?.cadenceDays ?? 30} disabled={!!busy} onChange={e => doIt('cadence', () => api(`/relationships/${id}`, { method: 'PATCH', body: JSON.stringify({ cadenceDays: Number(e.target.value) }) }), 'کیدنس رابطه به‌روزرسانی شد.')}>
                {[14, 21, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} روز</option>)}
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
      {r?.cadence && r.cadence.status !== 'FRESH' && (
        <div className="info-card" style={{ background: r.cadence.status === 'CRITICAL' ? 'color-mix(in srgb, var(--srip-danger) 10%, transparent)' : undefined, borderColor: r.cadence.status === 'CRITICAL' ? 'color-mix(in srgb, var(--srip-danger) 32%, transparent)' : undefined, color: r.cadence.status === 'CRITICAL' ? 'var(--srip-danger)' : undefined }} role="status">
          {r.cadence.status === 'CRITICAL' ? 'کیدنس رابطه شکسته است' : 'کیدنس رابطه عقب افتاده است'} — آخرین تعامل {fmtNum(r.cadence.daysSinceLastInteraction)} روز پیش؛ هدف {fmtNum(r.cadence.cadenceDays)} روز. یک تعامل معنادار ثبت کنید یا مهلت را تغییر دهید.
        </div>
      )}

      {r && (
        <>
          {/* خلاصهٔ وضعیت */}
          <CriteriaScoreCard subjectType="RELATIONSHIP" subjectId={id} onEdit={load} />

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

          {/* P1: سرمایهٔ رابطه، روند و برنامهٔ ۹۰ روزه */}
          {pulse && (
            <section className="panel" style={{ marginTop: 14 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Gauge size={16} /> سرمایهٔ رابطه و روند ۹۰ روزه</h2>
                  <p>سرمایه = قدرت (سلامت) × نفوذ × پتانسیل · روند از اسنپ‌شات ۹۰روزه · اعتماد از تعداد منابع و تازگی شواهد</p>
                </div>
                <span className={`chip ${pulse.classKey === 'RISK' ? 'danger' : pulse.classKey === 'GROWTH' ? 'success' : 'info'}`}>{pulse.classLabel}</span>
              </div>
              <div className="rel-status-metrics">
                <div className="rel-metric">
                  <span>سرمایهٔ رابطه</span>
                  <div className="rel-metric-value"><b className={clsOf(pulse.capital?.capital)}>{fmtNum(pulse.capital?.capital)}</b><small>از ۱۰۰</small></div>
                  <div className="rel-metric-bar"><span className={clsOf(pulse.capital?.capital)} style={{ width: `${Math.min(100, pulse.capital?.capital ?? 0)}%` }} /></div>
                </div>
                <div className="rel-metric">
                  <span>قدرت × نفوذ × پتانسیل</span>
                  <div className="rel-metric-value" style={{ flexWrap: 'wrap', gap: 4 }}>
                    <b style={{ fontSize: 14 }}>{fmtNum(pulse.capital?.strength)}</b><small>قدرت</small>
                    <b style={{ fontSize: 14 }}>× {fmtNum(pulse.capital?.influence)}</b><small>نفوذ</small>
                    <b style={{ fontSize: 14 }}>× {fmtNum(pulse.capital?.potential)}</b><small>پتانسیل</small>
                  </div>
                </div>
                <div className="rel-metric">
                  <span>روند ۹۰ روزه</span>
                  <div className="rel-metric-value">
                    <b className={pulse.trend?.trend === 'DOWN' ? 'h-crit' : pulse.trend?.trend === 'UP' ? 'h-hi' : 'h-mid'}>
                      {pulse.trend?.trend === 'UP' ? '↗' : pulse.trend?.trend === 'DOWN' ? '↘' : '→'} {fmtNum(pulse.trend?.current)} ({pulse.trend?.delta90d != null && pulse.trend?.delta90d > 0 ? '+' : ''}{fmtNum(pulse.trend?.delta90d)})
                    </b>
                    <small>پایه: {fmtNum(pulse.trend?.baseline)}</small>
                  </div>
                </div>
                <div className="rel-metric">
                  <span>اعتماد امتیاز</span>
                  <div className="rel-metric-value"><b>{fmtNum(pulse.trend?.confidence)}٪</b><small>{pulse.trend?.evidence?.sources ?? 0} منبع · {(pulse.trend?.evidence?.sourceTypes ?? []).join('، ') || 'شاهد محدود'}</small></div>
                </div>
                <div className="rel-metric">
                  <span>ارزش در معرض ریسک</span>
                  <div className="rel-metric-value">
                    <b style={{ fontSize: 15 }}>{pulse.capital?.valueAtRisk ? new Intl.NumberFormat('fa-IR', { notation: 'compact' }).format(pulse.capital.valueAtRisk) : '—'}</b>
                    <small>از {pulse.capital?.openValue ? new Intl.NumberFormat('fa-IR', { notation: 'compact' }).format(pulse.capital.openValue) : '۰'} تومان فرصت باز</small>
                  </div>
                </div>
              </div>
              {Array.isArray(pulse.trend?.snapshots) && pulse.trend.snapshots.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 52, marginTop: 10 }}>
                  {pulse.trend.snapshots.map((s: any) => (
                    <div key={s.daysAgo} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }} title={`${fmtNum(s.daysAgo)} روز پیش: ${fmtNum(s.score)} · اعتماد ${fmtNum(s.confidence)}٪`}>
                      <span style={{ width: '100%', height: Math.max(6, Math.round(s.score * 0.44)), borderRadius: 4, background: s.daysAgo === 0 ? 'var(--accent,#2563eb)' : 'color-mix(in srgb, var(--accent,#2563eb) 45%, transparent)' }} />
                      <small className="t-muted" style={{ fontSize: 9.5 }}>{s.daysAgo === 0 ? 'اکنون' : fmtNum(s.daysAgo) + 'پ'}</small>
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(pulse.openOpportunities) && pulse.openOpportunities.length > 0 && (
                <div className="t-muted" style={{ marginTop: 8 }}>
                  فرصت‌های باز متصل: {pulse.openOpportunities.map((o: any) => `«${o.name}» (${fmtNum(o.probability)}٪)`).join(' · ')}
                </div>
              )}
            </section>
          )}

          {/* P1: برنامهٔ ۹۰ روزهٔ حساب */}
          <section className="panel" style={{ marginTop: 14 }}>
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><FileClock size={16} /> برنامهٔ ۹۰ روزهٔ حساب {pulse?.plan ? <span className={`chip ${pulse.plan.status === 'ON_TRACK' ? 'success' : 'warning'}`}>{fa(pulse.plan.status)}</span> : null}</h2>
                <p>اقدامات، مالک، مهلت و ریسک‌نامه — مرور ماهانه (هر {fmtNum(pulse?.plan?.reviewCycleDays ?? 30)} روز)</p>
              </div>
            </div>
            {pulse?.plan ? (
              <>
                {pulse.plan.riskNote && (
                  <div className="wf-alert" role="note"><AlertTriangle size={13} /> <b>ریسک‌نامه:</b> {pulse.plan.riskNote}</div>
                )}
                <div className="list" style={{ marginTop: 8 }}>
                  {pulse.plan.items.map((it: any) => {
                    const due = it.dueAt ? new Date(it.dueAt).getTime() : null;
                    const overdue = due != null && due < Date.now() && it.status !== 'DONE';
                    return (
                      <article className="panel compact" key={it.id}>
                        <div className="panel-title">
                          <div>
                            <strong>{it.title} {overdue ? <span className="chip danger">موعد گذشته</span> : null}</strong>
                            <small className="t-muted">{it.focus} · مالک: {it.owner?.name ?? '—'} · مهلت: {fmtDate(it.dueAt)}</small>
                          </div>
                          <select value={it.status} aria-label={`وضعیت ${it.title}`} onChange={async (e) => {
                            setBusy(it.id); setError(''); setInfo('');
                            try {
                              await api(`/relationships/${id}/account-plan/items/${it.id}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
                              setInfo('وضعیت اقدام برنامه به‌روزرسانی شد.'); await load();
                            } catch (x) { setError((x as Error).message); }
                            finally { setBusy(''); }
                          }} disabled={busy === it.id}>
                            {['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'].map(s => <option key={s} value={s}>{fa(s)}</option>)}
                          </select>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <form className="entity-form" style={{ marginTop: 10, gap: 8 }} onSubmit={async (e) => {
                  e.preventDefault();
                  const t = (e.currentTarget.elements.namedItem('plan-title') as HTMLInputElement)?.value ?? '';
                  const d = (e.currentTarget.elements.namedItem('plan-due') as HTMLInputElement)?.value ?? '';
                  if (!t.trim()) { setError('عنوان اقدام الزامی است.'); return; }
                  setBusy('new'); setError(''); setInfo('');
                  try {
                    await api(`/relationships/${id}/account-plan`, { method: 'POST', body: JSON.stringify({ title: t.trim(), dueAt: d ? new Date(d).toISOString() : null, ownerId: '' }) });
                    setInfo('اقدام جدید به برنامهٔ ۹۰ روزه اضافه شد.'); await load();
                    e.currentTarget.reset();
                  } catch (x) { setError((x as Error).message); }
                  finally { setBusy(''); }
                }}>
                  <div className="field" style={{ flex: 2 }}>
                    <label className="field-label" htmlFor="plan-title">اقدام جدید</label>
                    <input id="plan-title" name="plan-title" placeholder="مثلاً: جلسهٔ QBR با مدیر خرید" maxLength={220} />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="plan-due">مهلت</label>
                    <input id="plan-due" name="plan-due" type="date" />
                  </div>
                  <button className="btn btn-primary" style={{ alignSelf: 'flex-end', minHeight: 0, padding: '9px 16px' }} disabled={busy === 'new'}>{busy === 'new' ? 'در حال ثبت…' : 'افزودن'}</button>
                </form>
              </>
            ) : (
              <p className="t-muted">برنامهٔ ۹۰ روزه برای این رابطه ثبت نشده — از فهرست روابط یا صفحهٔ تحلیل، برنامه بسازید.</p>
            )}
          </section>

          {/* P2-5: پالس ۹۰ روزه — پرسش، پیوند به معیار و حلقهٔ بسته */}
          {survey && (
            <section className="panel" style={{ marginTop: 14 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><MessageCircle size={16} /> پالس ۹۰ روزه</h2>
                  <p>۳ پرسش کوتاه از وضعیت رابطه — هر پاسخ به یک خانوادهٔ معیار پیوند می‌خورد و نتیجه در حلقهٔ بسته به اقدام بدل می‌شود</p>
                </div>
                {survey.last ? (
                  <span className={`chip ${survey.last.avgScore >= 70 ? 'success' : survey.last.avgScore >= 45 ? 'warning' : 'danger'}`}>آخرین پالس: {fmtNum(survey.last.avgScore)} از ۱۰۰</span>
                ) : <Badge tone="info">هنوز پاسخ داده نشده</Badge>}
              </div>
              {survey.last && (
                <div className="info-card" role="status">
                  آخرین پاسخ {fmtDate(survey.last.answeredAt)} — {survey.last.interpretation} · موعد بعدی: {fmtDate(survey.last.nextDueAt)} ({fmtNum(survey.cycleDays ?? 90)} روز پس از پاسخ).
                  {!survey.canSubmit && <span style={{ display: 'block', marginTop: 4 }}>برای پاسخ جدید تا موعد بعدی صبر کنید (حلقهٔ بسته: یک پاسخ در هر ۹۰ روز).</span>}
                </div>
              )}
              {survey.canSubmit && (
                <form className="entity-form" style={{ marginTop: 10, gap: 14 }} onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy('survey'); setError(''); setInfo('');
                  try {
                    const answers = (survey.questions ?? []).map((q: any) => ({ questionId: q.id, score: surveyAnswers[q.id] ?? 50 }));
                    const out: any = await api(`/relationships/${id}/pulse-survey`, { method: 'POST', body: JSON.stringify({ answers }) });
                    setSurvey(out.view); setInfo(`پالس ثبت شد: ${fmtNum(out.result.avgScore)} از ۱۰۰ — ${out.result.interpretation} · موعد بعدی ${fmtDate(out.result.nextDueAt)}`);
                  } catch (x) { setError((x as Error).message); }
                  finally { setBusy(''); }
                }}>
                  {(survey.questions ?? []).map((q: any) => (
                    <div key={q.id} className="field" style={{ width: '100%' }}>
                      <label className="field-label" htmlFor={`q-${q.id}`}>{q.text} <span className="t-muted" style={{ fontWeight: 400 }}>— {q.criteriaFamily}</span></label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {[0, 25, 50, 75, 100].map((v) => (
                          <button key={v} type="button" className={`btn ${surveyAnswers[q.id] === v ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ minHeight: 0, padding: '5px 12px', fontSize: 11 }} onClick={() => setSurveyAnswers((s) => ({ ...s, [q.id]: v }))}>
                            {v === 0 ? '۰' : v === 100 ? '۱۰۰' : fmtNum(v)}
                          </button>
                        ))}
                        <span className="t-muted" style={{ fontSize: 10.5, flex: 1 }}>{q.anchor}</span>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy === 'survey'}>{busy === 'survey' ? 'در حال ثبت…' : 'ثبت پالس'}</button>
                </form>
              )}
              {(survey.history ?? []).length > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {(survey.history ?? []).map((h: any) => (
                    <span key={h.id} className={`chip ${h.avgScore >= 70 ? 'success' : h.avgScore >= 45 ? 'warning' : 'danger'}`}>
                      {fmtDate(h.answeredAt)}: {fmtNum(h.avgScore)}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* P3-2: حافظهٔ نهادی و انتقال دانش */}
          {transfer && (
            <section className="panel" style={{ marginTop: 14 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Users size={16} /> حافظهٔ نهادی و انتقال دانش</h2>
                  <p>«چه کسی چه کسی را می‌شناسد» + بستهٔ انتقال + بریف جانشین — برای خروج/جابه‌جایی بدون از دست رفتن دانش رابطه</p>
                </div>
                <Badge tone={transfer.transferred ? 'success' : 'info'}>{transfer.transferred ? `تحویل شده در ${fmtDate(transfer.transferred.handedOverAt)}` : 'در انتظار تحویل'}</Badge>
              </div>
              <div className="split-panels" style={{ marginTop: 4 }}>
                <section>
                  <b style={{ fontSize: 11.5 }}>بریف جانشین</b>
                  <pre className="notice" role="note" style={{ whiteSpace: 'pre-line', fontFamily: 'inherit', fontSize: 11.5, marginTop: 6 }}>{transfer.brief}</pre>
                  {transfer.access === 'full' && (
                    <div style={{ marginTop: 8 }}>
                      <b style={{ fontSize: 11.5 }}>چه کسی چه کسی را می‌شناسد</b>
                      <div className="list" style={{ marginTop: 6 }}>
                        {(transfer.whoKnowsWho ?? []).length === 0 && <p className="t-muted" style={{ fontSize: 11 }}>شناخت متقابل ثبت‌نشده‌ای نیست؛ برای معرفی، از پیشنهاد پیوند شبکه استفاده کنید.</p>}
                        {(transfer.whoKnowsWho ?? []).map((w: any) => (
                          <div className="listRow" key={w.person.id}>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <b style={{ fontSize: 12.5 }}>{w.person.name}</b> <small className="t-muted">{w.person.title} · {w.org}</small>
                              <small className="t-muted" style={{ display: 'block' }}>ما می‌شناسیم: {w.ourContacts.join('، ')}</small>
                            </span>
                            <Badge tone="info">{fmtNum(w.meetingCount)} جلسه</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
                <section>
                  <b style={{ fontSize: 11.5 }}>مخاطبین کلیدی</b>
                  <div className="list" style={{ marginTop: 6 }}>
                    {(transfer.contacts ?? []).map((c: any) => (
                      <div className="listRow" key={c.id}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ fontSize: 12.5 }}>{c.name}</b> {c.champion && <span className="chip success" style={{ marginInlineStart: 4 }}>حامی</span>}
                          <small className="t-muted" style={{ display: 'block' }}>{c.title} · {c.organization}{c.role ? ` · نقش تصمیم: ${c.role}` : ''}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <Link className="btn btn-primary" href={`/people`} style={{ minHeight: 0, padding: '8px 14px' }}>مدیریت اشخاص</Link>
                    {!transfer.transferred && (
                      <button className="btn btn-secondary" style={{ minHeight: 0, padding: '8px 14px' }} disabled={busy === 'handoff'} onClick={async () => {
                        setBusy('handoff'); setError(''); setInfo('');
                        try {
                          const out: any = await api(`/intelligence/knowledge-transfer/${id}/handoff`, { method: 'POST', body: '{}' });
                          setTransfer(out.view);
                          setInfo(`انتقال دانش ثبت شد — بریف برای ${out.transfer?.toName ?? 'جانشین'} ارسال شد.`);
                        } catch (x) { setError((x as Error).message); }
                        finally { setBusy(''); }
                      }}>{busy === 'handoff' ? 'در حال ثبت…' : 'ثبت تحویل دانش'}</button>
                    )}
                  </div>
                </section>
              </div>
            </section>
          )}

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
