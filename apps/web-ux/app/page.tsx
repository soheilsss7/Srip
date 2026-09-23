'use client';
import { faFullDate } from './_lib/jalali';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from './_lib/api';
import { fa } from './_lib/fa';
import { ScopeBadge, useWorkspace, ROLE_LABELS } from './_components/workspace';
import { AlertBanner } from './_components/alert-banner';
import { FunnelVisual } from './_components/funnel-visual';
import { Card, Badge, EmptyState } from '@srip/design-system';
import { suggestGlobal } from './_lib/connections';
import {
  Building2, Users, Share2, CalendarDays, Zap, ShieldCheck, FolderKanban, Target,
  Activity, HeartPulse, TrendingUp, Gauge, Bell, Workflow, Sparkles, Crown,
  AlertTriangle, Clock, ChevronLeft, CircleCheck, Flame, ListTodo, Store, Landmark, Layers, DoorOpen, Siren, Globe,
} from 'lucide-react';
import { localeTag, lt, t } from './_lib/i18n';

/* ---------------------------------- types --------------------------------- */
type Summary = {
  counts: Record<string, number>;
  engagement?: {
    activeUsers30d?: number; recommendationAcceptance?: number;
    recommendationAcceptanceRate?: number; successfulConnections?: number;
    relationshipUpdates?: number;
    featureUsage?: Array<{ feature: string; count: number }>;
  };
};
type Network = {
  networkCapital?: { score?: number; components?: Record<string, number> };
  strategicRelationshipIndex?: { score?: number; breakdown?: Record<string, number> };
  relationshipResilienceScore?: number; weightedOpportunityValue?: number;
  referralSuccessRate?: { total?: number; successful?: number; rate?: number };
};
type Funnel = { stages?: Record<string, number>; conversion?: Record<string, number> };
type Workflows = { executions?: Array<{ status: string; count: number }> };
type Holding = { roots?: Array<{ id: string; name: string; type: string; status: string; children?: any[] }> };
type Meeting = { id: string; title: string; startAt: string; endAt?: string | null; objective?: string | null; organization?: { id: string; name: string } | null };
type ActionItem = { id: string; title: string; status: string; priority: string; dueAt?: string | null; relationshipId?: string | null };
type RiskSignal = { id: string; title: string; severity: string; description?: string; relationshipId?: string; detectedAt?: string };
type RelItem = { id: string; name: string; health: number; risk: number; strategic: number };
type GraphLists = { orgs: any[]; people: any[]; rels: any[]; interactions: any[] };

/* ---------------------------------- utils --------------------------------- */
const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat(localeTag()).format(v);
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(localeTag(), { month: 'short', day: 'numeric' }) : '—';
const fmtTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' }) : '—';
const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};
const scoreTone = (v: number): 'success' | 'info' | 'warning' | 'danger' =>
  v >= 75 ? 'success' : v >= 55 ? 'info' : v >= 40 ? 'warning' : 'danger';
const toneClass = (t: string): string =>
  t === 'success' ? 's' : t === 'warning' ? 'w' : t === 'danger' ? 'd' : '';

const KPI_CARDS: Array<{ key: string; label: string; href: string; icon: React.ReactNode; grad: string }> = lt([
  { key: 'organizations', label: t('سازمان‌ها'), href: '/organizations', icon: <Building2 size={18} />, grad: 'ic-blue' },
  { key: 'people', label: t('اشخاص'), href: '/people', icon: <Users size={18} />, grad: 'ic-purple' },
  { key: 'relationships', label: t('روابط فعال'), href: '/relationships', icon: <Share2 size={18} />, grad: 'ic-teal' },
  { key: 'meetings', label: t('جلسات'), href: '/meetings', icon: <CalendarDays size={18} />, grad: 'ic-indigo' },
  { key: 'actions', label: t('اقدامات باز'), href: '/actions', icon: <Zap size={18} />, grad: 'ic-gold' },
  { key: 'commitments', label: t('تعهدات باز'), href: '/commitments', icon: <ShieldCheck size={18} />, grad: 'ic-red' },
  { key: 'projects', label: t('پروژه‌ها'), href: '/projects', icon: <FolderKanban size={18} />, grad: 'ic-blue' },
  { key: 'opportunities', label: t('فرصت‌ها'), href: '/opportunities', icon: <Target size={18} />, grad: 'ic-purple' },
]);

const COMPONENT_LABELS: Record<string, string> = lt({
  relationshipQuality: t('کیفیت رابطه'), influence: t('نفوذ'), strategicValue: t('ارزش راهبردی'),
  opportunityPotential: t('پتانسیل فرصت'), resilience: t('تاب‌آوری'), coverage: t('پوشش'),
  diversity: t('تنوع'), engagement: t('درگیری'), riskAdjusted: t('تعدیل‌شده با ریسک'),
});
const SRI_LABELS: Record<string, string> = lt({
  coverage: t('پوشش'), strength: t('قوت'), influence: t('نفوذ'), opportunity: t('فرصت'), resilience: t('تاب‌آوری'),
});
const FEATURE_LABELS: Record<string, string> = lt({
  network_explorer: t('کاوش شبکه'), smart_search: t('جستجوی هوشمند'), meeting_briefs: t('بریف جلسه'),
  recommendations: t('پیشنهادها'), executive_brief: t('گزارش راهبردی'), meeting_summary: t('خلاصهٔ جلسه'),
  action_extraction: t('استخراج اقدام'), commitment_extraction: t('استخراج تعهد'),
  risk_detection: t('تشخیص ریسک'), opportunity_detection: t('تشخیص فرصت'), next_best_action: t('اقدام بعدی'),
});

function Score({ value, label }: { value: number | undefined; label: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="score-block">
      <div className="score-head"><span>{label}</span><b>{value ?? '—'}</b></div>
      <div className="score-track"><span className={`score-fill ${toneClass(scoreTone(v))}`} style={{ width: `${v}%` }} /></div>    </div>
  );
}

export default function Dashboard() {
  const { me, role, scopeId, can } = useWorkspace();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [workflows, setWorkflows] = useState<Workflows | null>(null);
  const [holding, setHolding] = useState<Holding | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [riskSignals, setRiskSignals] = useState<RiskSignal[]>([]);
  const [relAlerts, setRelAlerts] = useState<any[]>([]);
  const [relAlertSummary, setRelAlertSummary] = useState<any>(null);
  const [lists, setLists] = useState<GraphLists | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // تور خوش‌آمد ۳ مرحله‌ای — فقط بار اول (تا «رد شدن»/پایان)
  const [tour, setTour] = useState(0);
  useEffect(() => {
    if (loading) return;
    try { if (!localStorage.getItem('srip2_tour_done')) setTour(1); } catch {}
  }, [loading]);
  const finishTour = () => { try { localStorage.setItem('srip2_tour_done', '1'); } catch {} setTour(0); };
  /* بستن تور با Esc — بدون آن، لایهٔ تمام‌صفحهٔ تور دکمه‌های سربرگ (مثل تغییر زبان) را می‌پوشاند */
  useEffect(() => {
    if (tour <= 0) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finishTour(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour > 0]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    const q = scopeId === 'all' ? '' : '?organizationId=' + encodeURIComponent(scopeId);
    const meetingsQ = scopeId === 'all' ? '?upcoming=true' : `?upcoming=true&organizationId=${encodeURIComponent(scopeId)}`;
    const task: Array<Promise<any>> = [
      api<Summary>('/analytics/summary'),
      api<Network>('/analytics/network' + q),
      api<Funnel>('/analytics/recommendations/funnel'),
      api<Workflows>('/analytics/workflows'),
    ];
    if (can('report.read')) task.push(api<Holding>('/reports/holding' + q));
    if (can('meeting.read')) task.push(api<Meeting[]>('/meetings' + meetingsQ));
    if (can('action.read')) task.push(api<ActionItem[]>('/actions' + q));
    if (can('analytics.read')) task.push(api<RiskSignal[]>('/intelligence/risk-signals'));
    Promise.all(task).then((res) => {
      if (!alive) return;
      let i = 0;
      setSummary(res[i++]); setNetwork(res[i++]); setFunnel(res[i++]); setWorkflows(res[i++]);
      if (can('report.read')) setHolding(res[i++]);
      if (can('meeting.read')) setMeetings(res[i++] ?? []);
      if (can('action.read')) setActions(res[i++] ?? []);
      if (can('analytics.read')) setRiskSignals(res[i++] ?? []);
    }).catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [scopeId, can]);

  useEffect(() => {
    if (!can('organization.read')) return;
    let alive = true;
    const unwrap = (x: any): any[] => Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? [];
    Promise.all([
      api<any>('/organizations'), api<any>('/people'), api<any>('/relationships'), api<any>('/interactions'),
    ]).then(([o, p, r, i]) => {
      if (!alive) return;
      setLists({ orgs: unwrap(o), people: unwrap(p), rels: unwrap(r), interactions: unwrap(i) });
    }).catch(() => { });
    api<any>('/relationships/alerts').then((a:any)=>{ if(!alive) return; setRelAlerts(a.items ?? []); setRelAlertSummary(a.summary ?? null); }).catch(()=>{});
    return () => { alive = false; };
  }, [scopeId, can]);

  const suggestions = useMemo(
    () => lists ? suggestGlobal({ orgs: lists.orgs, people: lists.people, rels: lists.rels, interactions: lists.interactions }, 6) : [],
    [lists],
  );
  const isOwnerMode = scopeId === 'all';
  const counts = summary?.counts ?? {};
  const capital = network?.networkCapital?.components ?? {};
  const sri = network?.strategicRelationshipIndex?.breakdown ?? {};
  const eng = summary?.engagement ?? {};
  const featureUsage = eng.featureUsage ?? [];
  const hasCapital = Object.keys(capital).length > 0;
  const hasSri = Object.keys(sri).length > 0;
  /* تاریخ «امروز» پس از هیدراسیون ست می‌شود — اگر در رندر اولیه محاسبه شود،
     تاریخِ لحظهٔ بیلد در HTML استاتیک می‌ماند و روز بعد با تاریخ کلاینت
     می‌خواند و mismatch هیدراسیون (React #418) می‌دهد. */
  const [todayLabel, setTodayLabel] = useState('');
  useEffect(() => { setTodayLabel(faFullDate()); }, []); // ترتیب دستوری درست: «پنجشنبه ۱۹ شهریور ۱۴۰۵» (Intl در برخی ICUها ترتیب را می‌شکند)
  const totalExecutions = workflows?.executions?.reduce((a, e) => a + e.count, 0) ?? 0;
  const wfFailed = (workflows?.executions ?? []).find((e) => ['FAILED', 'ERROR'].includes(e.status ?? ''))?.count ?? 0;

  /* ---- رابطه‌های در معرض ریسک (از دادهٔ واقعی روابط + سیگنال‌های ریسک) ---- */
  const riskyRels: RelItem[] = useMemo(() => {
    const rels = lists?.rels ?? [];
    const byRisk: RelItem[] = rels
      .filter((r: any) => (r.riskScore ?? 0) >= 40 || (r.healthScore ?? 100) < 50)
      .map((r: any) => ({
        id: r.id,
        name: [r.sourceOrganization?.name, r.targetOrganization?.name].filter(Boolean).join(' ↔ ') || r.id,
        health: r.healthScore ?? 0, risk: r.riskScore ?? 0, strategic: r.strategicScore ?? 0,
        why: (r.riskDrivers ?? []).slice(0, 2).map((d: any) => d.label).join(' · ') || null,
      }))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 4);
    // ادغام سیگنال‌های ریسک موتور تحلیلی
    const signals = riskSignals.map((s) => ({ id: s.id, name: s.title, health: 0, risk: 90, strategic: 0, fromSignal: true, why: null }));
    const merged = [...byRisk];
    signals.forEach((s: any) => { if (!merged.some((m: any) => m.name === s.name)) merged.push(s); });
    return merged.slice(0, 5) as RelItem[];
  }, [lists, riskSignals]);

  /* ---- اقدامات عقب‌افتاده و نزدیک‌الموعد (دادهٔ واقعی) ---- */
  const { overdue, dueSoon } = useMemo(() => {
    const open = actions.filter((a) => !['DONE', 'COMPLETED', 'CANCELLED'].includes(a.status ?? ''));
    const over = open.filter((a) => a.dueAt && daysUntil(a.dueAt) !== null && daysUntil(a.dueAt)! < 0)
      .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
    const soon = open.filter((a) => {
      const d = daysUntil(a.dueAt);
      return d !== null && d >= 0 && d <= 3;
    }).sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
    return { overdue: over, dueSoon: soon };
  }, [actions]);

  const nextMeeting = useMemo(
    () => [...meetings].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0] ?? null,
    [meetings],
  );
  const unreadAlerts = (counts.unreadNotifications ?? 0) + riskyRels.length + overdue.length;
  const avgHealth = (() => {
    const rels = lists?.rels ?? [];
    if (!rels.length) return null;
    return Math.round(rels.reduce((a: number, r: any) => a + (r.healthScore ?? 0), 0) / rels.length);
  })();

  return (
    <div className="dashboard-page dash">
      {/* HEADER */}
      <div className="page-heading">
        <div>
          <h1>{me?.name ? `${t('سلام،')} ${me.name}` : t('سلام')}</h1>
          <p className="subtitle">{t('امروز چه چیزی نیازمند اقدام شماست؟ اولویت‌ها، هشدارها و جلسات پیش رو — هر عدد با دلیلی از دادهٔ واقعی.')}</p>
        </div>
        <div className="heading-tools">
          <span className={`chip ${isOwnerMode ? 'purple' : 'info'}`}>
            {isOwnerMode ? <Crown size={12} /> : <Building2 size={12} />}
            {isOwnerMode ? t('نمای مالک — همهٔ محدوده') : t('نمای سازمانی')}
          </span>
          <span className="chip info"><CalendarDays size={12} /> {todayLabel}</span>
          <ScopeBadge />
          <Link className="primary-action" href="/organizations"><Building2 size={14} /> {t('+ سازمان')}</Link>
          <Link className="secondary-action" href="/people"><Users size={14} /> {t('+ شخص')}</Link>
          <Link className="secondary-action" href="/relationships"><Share2 size={14} /> {t('+ رابطه')}</Link>
        </div>
      </div>

      {/* نوار هشدار بحرانی — فاز ۳ (ADR-0007): بحرانی‌ترین سیگنال‌ها قبل از هر چیز */}
      <AlertBanner />

      {!loading && !error && (lists?.rels?.length ?? 0) === 0 && meetings.length === 0 && actions.length === 0 && (
        <section className="onboarding-strip" aria-label={t('از کجا شروع کنم؟')}>
          <div className="ob-step"><b>{t('۱')}</b><span>{t('سازمان‌ها را ثبت کنید')}</span></div>
          <div className="ob-step"><b>{t('۲')}</b><span>{t('بین آن‌ها رابطه بسازید')}</span></div>
          <div className="ob-step"><b>{t('۳')}</b><span>{t('اولین تعامل و اقدام را ثبت کنید — هوشمندی فعال می‌شود')}</span></div>
        </section>
      )}

      {/* ERROR */}
      {error && (
        <div className="error-card" role="alert">
          خطا در دریافت داده: {error} — لطفاً دوباره تلاش کنید.
        </div>
      )}

      {/* STRATEGIC BANNER */}
      <section className="strategic-banner">
        <div><span>{t('نقش فعال')}</span><strong>{ROLE_LABELS[role] ?? '—'}</strong></div>
        <div><span>{t('محدوده')}</span><strong>{scopeId === 'all' ? t('همهٔ محدودهٔ مجاز') : scopeId}</strong></div>
        <div><span>{t('اصل محصول')}</span><strong>{t('رابطه‌محور · شبکه‌محور · هوشمحور')}</strong></div>
      </section>

      {/* ACTION CENTER — پاسخ به «امروز چه کاری مهم است» */}
      <section className="action-center" aria-label={t('مرکز اقدام امروز')}>
        <div className="action-center-head">
          <div className="action-center-title">
            <span className="action-center-ico"><ListTodo size={15} /></span>
            <div>
              <h2>{t('اولویت‌های امروز')}</h2>
              <p>{t('پاسخ به پرسش «امروز چه کاری مهم است» — بر اساس سررسیدها، ریسک‌ها و رویدادها')}</p>
            </div>
          </div>
          <Badge className="danger">{fmtNum(unreadAlerts)} مورد نیازمند توجه</Badge>
        </div>
        <div className="action-center-grid">
          <div className="ac-card ac-overdue">
            <div className="ac-card-head"><AlertTriangle size={14} /><b>{t('اقدامات عقب‌افتاده')}</b><span>{fmtNum(overdue.length)} مورد</span></div>
            {overdue.length ? overdue.slice(0, 3).map((a) => (
              <Link className="ac-item" href={`/actions/${a.id}`} key={a.id}>
                <span className="ac-dot d" /><span className="ac-name">{a.title}</span>
                <span className="ac-date">موعد: {fmtDate(a.dueAt)}</span>
              </Link>
            )) : <div className="ac-none"><CircleCheck size={14} /> {t('اقدام عقب‌افتاده‌ای ندارید')}</div>}
          </div>
          <div className="ac-card ac-soon">
            <div className="ac-card-head"><Clock size={14} /><b>{t('سررسید تا ۳ روز')}</b><span>{fmtNum(dueSoon.length)} مورد</span></div>
            {dueSoon.length ? dueSoon.slice(0, 3).map((a) => (
              <Link className="ac-item" href={`/actions/${a.id}`} key={a.id}>
                <span className="ac-dot w" /><span className="ac-name">{a.title}</span>
                <span className="ac-date">{fmtDate(a.dueAt)}</span>
              </Link>
            )) : <div className="ac-none"><CircleCheck size={14} /> {t('سررسید فوری‌ای ندارید')}</div>}
          </div>
          <div className="ac-card ac-next">
            <div className="ac-card-head"><CalendarDays size={14} /><b>{t('جلسهٔ بعدی')}</b><span>{meetings.length ? fmtNum(meetings.length) + t('جلسهٔ پیش رو') : ''}</span></div>
            {nextMeeting ? (
              <Link className="ac-item" href={`/meetings/${nextMeeting.id}`} key={nextMeeting.id}>
                <span className="ac-dot s" /><span className="ac-name">{nextMeeting.title}</span>
                <span className="ac-date">{fmtDate(nextMeeting.startAt)} · {fmtTime(nextMeeting.startAt)}</span>
              </Link>
            ) : <div className="ac-none"><CalendarDays size={14} /> {t('جلسهٔ پیش روی برنامه‌ریزی‌شده ندارید')}</div>}
            {meetings.filter((m) => m.id !== nextMeeting?.id).slice(0, 2).map((m) => (
              <Link className="ac-item" href={`/meetings/${m.id}`} key={m.id}>
                <span className="ac-dot n" /><span className="ac-name">{m.title}</span>
                <span className="ac-date">{fmtDate(m.startAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* KPI ROW — در یک نگاه */}
      <section className="kpi-grid" aria-label={t('شاخص‌های راهبردی')}>
        {KPI_CARDS.map(({ key, label, href, icon, grad }) => (
          <Link className="kpi-card" href={href} key={key}>
            <div className="kpi-top"><span className={`kpi-ico ${grad}`}>{icon}</span><small>{t('مشاهده ←')}</small></div>
            {loading ? <strong className="skeleton" style={{ width: 52, height: 26, display: 'inline-block', borderRadius: 8 }}>&nbsp;</strong> : <strong>{fmtNum(counts[key])}</strong>}
            <span>{label}</span>
          </Link>
        ))}
      </section>

      {/* بازار — در یک نگاه — کجا ورود ما به بازار است؟ */}
      {lists?.rels?.length ? (
        <section className="panel" aria-label={t('نقشهٔ بازار در پیشخوان')} style={{marginTop:14}}>
          <div className="panel-title">
            <div><h2 style={{display:'inline-flex', gap:6, alignItems:'center'}}><Globe size={16}/> {t('نقشهٔ بازار — تفکیک بازاری / غیربازاری')}</h2><p>{t('روابط بازاری ارزش می‌سازند، روابط غیربازاری مسیر را باز/مسدود می‌کنند — نقطهٔ ورود، دروازهٔ شما به هر سگمنت است')}</p></div>
            <Link className="head-link" href="/relationships">{t('همهٔ روابط ←')}</Link>
          </div>
          <div className="stats-row" style={{margin:0}}>
            <div className="stat-card"><div className="st-top"><span className={`kpi-ico ic-teal`}><Store size={16}/></span><span>{t('بازاری')}</span></div><strong className="st-value">{fmtNum(lists.rels.filter((x:any)=>(x.marketKind??'MARKET')==='MARKET').length)}</strong><small className="t-muted">{t('در زنجیرهٔ ارزش')}</small></div>
            <div className="stat-card"><div className="st-top"><span className={`kpi-ico ic-purple`}><Landmark size={16}/></span><span>{t('غیربازاری')}</span></div><strong className="st-value">{fmtNum(lists.rels.filter((x:any)=>x.marketKind==='NON_MARKET').length)}</strong><small className="t-muted">{t('نهاد/تنظیم‌گر')}</small></div>
            <div className="stat-card"><div className="st-top"><span className={`kpi-ico ic-gold`}><DoorOpen size={16}/></span><span>{t('نقاط ورود')}</span></div><strong className="st-value">{fmtNum(lists.rels.filter((x:any)=>x.isMarketEntry).length)}</strong><small className="t-muted">{fmtNum(lists.rels.filter((x:any)=>x.isMarketEntry && (x.marketKind??'MARKET')==='MARKET').length)} بازاری · {fmtNum(lists.rels.filter((x:any)=>x.isMarketEntry && x.marketKind==='NON_MARKET').length)} غیربازاری</small></div>
            <div className="stat-card"><div className="st-top"><span className={`kpi-ico ic-red`}><Layers size={16}/></span><span>{t('هیبرید')}</span></div><strong className="st-value">{fmtNum(lists.rels.filter((x:any)=>x.marketKind==='HYBRID').length)}</strong><small className="t-muted">{t('دو نقش همزمان')}</small></div>
          </div>
        </section>
      ) : null}

      {/* RISK STRIP — بازاری / غیربازاری و نقاط ورود */}
      {(relAlerts.length > 0 || riskyRels.length > 0) && (
        <section className="alert-strip" aria-label={t('هشدارهای شبکه — بازاری و غیربازاری')} style={{borderColor: (relAlertSummary?.danger ?? 0) > 0 ? 'var(--danger, #dc2626)' : undefined}}>
          <div className="alert-strip-head">
            <Siren size={15} />
            <span>{t('هشدارهای هوشمند — بازاری / غیربازاری و نقاط ورود')}</span>
            <b>{fmtNum(relAlerts.length || riskyRels.length)} هشدار</b>
            {relAlertSummary ? <><span className="chip danger" style={{fontSize:11}}>{fmtNum(relAlertSummary.danger)} بحرانی</span><span className="chip warning" style={{fontSize:11}}>{fmtNum(relAlertSummary.warning)} هشدار</span><span className="chip info" style={{fontSize:11}}><DoorOpen size={11} style={{display:'inline'}}/> {fmtNum(relAlertSummary.entry)} ورودی</span></> : null}
          </div>
          <div className="alert-strip-list">
            {(relAlerts.length ? relAlerts.slice(0,5) : riskyRels).map((r: any) => (
              <Link className={`alert-pill ${r.tone==='danger'?'ap-danger':r.tone==='warning'?'ap-warning':''}`} href={r.relationshipId ? `/relationships/${r.relationshipId}` : `/relationships/${r.id}`} key={r.id}>
                <span className="alert-pill-name">{r.title ?? r.name}</span>
                <span className="alert-pill-meta">{r.marketKind ? (r.marketKind==='MARKET'?t('بازاری'):r.marketKind==='NON_MARKET'?t('غیربازاری'):t('دوگانه')) : ''}{r.isMarketEntry ? t('· نقطهٔ ورود') : ''}{r.segment ? ` · ${r.segment}` : ''}{r.risk ? ` ${t('· ریسک')} ${fmtNum(r.risk)}` : ''}</span>
                {r.body || r.why ? <span className="alert-pill-why">{r.body ?? r.why}</span> : null}
              </Link>
            ))}
          </div>
          <Link className="alert-strip-more" href="/relationships"><ChevronLeft size={13} /> {t('همهٔ روابط · نقشهٔ بازار')}</Link>
        </section>
      )}

      {/* UPCOMING MEETINGS — کار امروز */}
      <section className="dash-upcoming">
        <Card className="dash-panel">
          <div className="panel-title"><div><h2>{t('جلسات پیش رو')}</h2><p>{t('رویدادهای برنامه‌ریزی‌شده در محدودهٔ شما')}</p></div><Link className="head-link" href="/meetings">{t('تقویم ←')}</Link></div>
          {meetings.length ? (
            <div className="meeting-list">
              {meetings.slice(0, 5).map((m) => (
                <Link className="meeting-row" href={`/meetings/${m.id}`} key={m.id}>
                  <span className="meeting-date">
                    <b>{fmtNum(new Date(m.startAt).getDate())}</b>
                    <small>{new Date(m.startAt).toLocaleDateString(localeTag(), { month: 'short' })}</small>
                  </span>
                  <span className="meeting-body">
                    <strong>{m.title}</strong>
                    <small>{m.organization?.name ?? ''} · {fmtTime(m.startAt)}{m.objective ? ` — ${m.objective}` : ''}</small>
                  </span>
                  <ChevronLeft size={14} className="meeting-arrow" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title={t('جلسهٔ پیش روی ثبت نشده')} description={t('جلسات آیندهٔ برنامه‌ریزی‌شده اینجا ظاهر می‌شوند.')} />
          )}
        </Card>
      </section>

      {/* CONNECTION SUGGESTIONS */}
      {suggestions.length > 0 && (
        <section className="section-card">
          <div className="section-head">
            <div>
              <h2><Sparkles size={17} /> {t('پیشنهاد ارتباط جدید')}</h2>
              <p>{t('بر اساس ارتباطات مشترک، تعاملات اخیر و هم‌صنف‌بودن — محاسبهٔ قطعی موتور، بدون سرویس خارجی.')}</p>
            </div>
            <Link className="btn btn-ghost btn-sm" href="/network">{t('مشاهدهٔ شبکه ←')}</Link>
          </div>
          <div className="suggestions-grid">
            {suggestions.map((s) => (
              <Link className="ai-match-card" href={s.href} key={s.id}>
                <div className="match-meta">
                  <Badge className="info">{s.kind === 'person' ? t('شخص') : t('سازمان')}</Badge>
                  {s.via.length > 0 && <span>از طریق: {s.via.join(t('،'))}</span>}
                </div>
                <strong>{s.name}</strong>
                {s.reasons.length > 0 && (
                  <div className="match-meta">
                    {s.reasons.slice(0, 3).map((r) => <span className="chip info" key={r}>{r}</span>)}
                  </div>
                )}
                <div className="confidence-wrap">
                  <span className="confidence-num">{fmtNum(s.score)}٪</span>
                  <div className="confidence-track"><span className="confidence-fill" style={{ width: `${s.score}%` }} /></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* TOP GRID: Network Capital + SRI */}
      <section className="dash-grid-top">
        <Card className="dash-panel">
          <div className="panel-title">
            <div><h2>{t('سرمایهٔ شبکه · اجزا')}</h2><p>{t('نه مؤلفهٔ سرمایهٔ شبکه — محاسبهٔ زنده توسط موتور تحلیلی')}</p></div>
            <Badge className="info">سرمایهٔ شبکه: {fmtNum(network?.networkCapital?.score)}</Badge>
          </div>
          {hasCapital ? (
            <div className="scores">
              {Object.entries(capital).map(([k, v]) => <Score key={k} value={v as number} label={COMPONENT_LABELS[k] ?? k} />)}
            </div>
          ) : (
            <EmptyState title={t('دادهٔ سرمایهٔ شبکه در دسترس نیست')} description={t('پس از ثبت نخستین روابط، این بخش به‌روز می‌شود.')} />
          )}
        </Card>

        <Card className="dash-panel">
          <div className="panel-title">
            <div><h2>{t('شاخص رابطهٔ راهبردی')}</h2><p>{t('شکستِ وزن‌دار امتیاز راهبردی روابط')}</p></div>
            <Badge className="success">شاخص راهبردی: {fmtNum(network?.strategicRelationshipIndex?.score)}</Badge>
          </div>
          {hasSri ? (
            <div className="scores">
              {Object.entries(sri).map(([k, v]) => <Score key={k} value={v as number} label={SRI_LABELS[k] ?? k} />)}
            </div>
          ) : (
            <EmptyState title={t('دادهٔ شاخص راهبردی در دسترس نیست')} />
          )}
          <div className="mini-metrics">
            <div><span>{t('تاب‌آوری رابطه')}</span><strong>{fmtNum(network?.relationshipResilienceScore)}</strong></div>
            <div><span>{t('ارزش وزنی فرصت')}</span><strong>{fmtNum(network?.weightedOpportunityValue != null ? Math.round(network.weightedOpportunityValue) : null)}</strong></div>
            <div><span>{t('میزان موفقیت معرفی')}</span><strong>{network?.referralSuccessRate?.rate != null ? `${fmtNum(network.referralSuccessRate.rate)}${t('٪')}` : '—'}</strong></div>
            <div><span>{t('میانگین سلامت روابط')}</span><strong>{avgHealth != null ? fmtNum(avgHealth) : '—'}</strong></div>
          </div>
        </Card>
      </section>

      {/* MID GRID: Engagement + Funnel + Workflows */}
      <section className="dash-grid-mid">
        <Card className="dash-panel">
          <div className="panel-title"><div><h2>{t('درگیری و فعالیت')}</h2><p>{t('فعالیت ۳۰ روز اخیر کاربران')}</p></div><Badge>کاربر فعال: {fmtNum(eng.activeUsers30d)}</Badge></div>
          <div className="mini-metrics">
            <div><span>{t('کاربران فعال ۳۰ روز')}</span><strong>{fmtNum(eng.activeUsers30d)}</strong></div>
            <div><span>{t('پذیرش پیشنهادها')}</span><strong>{fmtNum(eng.recommendationAcceptance)}{eng.recommendationAcceptanceRate != null ? <small> · {fmtNum(eng.recommendationAcceptanceRate)}٪</small> : null}</strong></div>
            <div><span>{t('ارتباط موفق')}</span><strong>{fmtNum(eng.successfulConnections)}</strong></div>
            <div><span>{t('به‌روزرسانی رابطه')}</span><strong>{fmtNum(eng.relationshipUpdates)}</strong></div>
          </div>
          {featureUsage.length > 0 && (
            <>
              <div className="sub-panel-title">{t('بیشترین استفاده از امکانات')}</div>
              <div className="feature-list">
                {featureUsage.slice(0, 7).map((f) => (
                  <div className="feature-row" key={f.feature}>
                    <span>{FEATURE_LABELS[f.feature] ?? f.feature.replace(/_/g, ' ')}</span>
                    <div className="feature-track"><span style={{ width: `${Math.min(100, f.count * 4)}%` }} /></div>
                    <b>{fmtNum(f.count)}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="dash-panel">
          <div className="panel-title"><div><h2>{t('قیف پیشنهادات')}</h2><p>{t('مسیر پیشنهاد هوشمند تا نتیجه')}</p></div><Link className="head-link" href="/recommendations">{t('پیشنهادها ←')}</Link></div>
          <FunnelVisual stages={funnel?.stages} conversion={funnel?.conversion} />
        </Card>

        <Card className="dash-panel">
          <div className="panel-title"><div><h2>{t('اجراهای گردش کار')}</h2><p>{t('وضعیت اجرای گردش‌های کاری')}</p></div><Badge className="info">{fmtNum(totalExecutions)} اجرا</Badge></div>
          {workflows?.executions?.length ? (
            <div className="wf-grid">
              {workflows.executions.map((e) => (
                <div className="wf-item" key={e.status}>
                  <span className={`wf-dot wf-${(e.status || '').toLowerCase()}`} />
                  <span>{fa(e.status)}</span>
                  <b>{fmtNum(e.count)}</b>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={t('اجرای گردش کاری ثبت نشده')} description={t('با اجرای نخستین گردش کار، وضعیت اینجا نمایش داده می‌شود.')} />
          )}
          {wfFailed > 0 && (
            <div className="wf-alert"><AlertTriangle size={13} /> {fmtNum(wfFailed)} اجرای ناموفق نیازمند بررسی</div>
          )}
        </Card>
      </section>

      {/* BOTTOM GRID: Meetings + Holding + Health */}
      <section className="dash-grid-bottom">


        <Card className="dash-panel">
          <div className="panel-title"><div><h2>{t('نمای هلدینگ / شرکت')}</h2><p>{t('ساختار شرکت‌های در محدودهٔ دسترسی')}</p></div><Link className="head-link" href="/reports">{t('گزارش‌ها ←')}</Link></div>
          {holding?.roots?.length ? (
            <div className="holding-tree">
              {(() => {
                const rows: any[] = [];
                const walk = (nodes: any[], depth: number) => {
                  nodes.forEach((r: any) => {
                    rows.push({ name: r.name, depth, type: r.type ?? '—', status: r.status ?? '—', subs: r.children?.length ?? 0 });
                    if (r.children?.length) walk(r.children, depth + 1);
                  });
                };
                walk(holding.roots, 0);
                return rows.slice(0, 10).map((r, i) => (
                  <div className="holding-row" key={i} style={{ paddingInlineStart: (r.depth * 22 + 4) }}>
                    <span>{r.name}</span>
                    <div><Badge className="neutral">{fa(r.type)}</Badge><Badge className={String(r.status).toLowerCase() === 'active' ? 'success' : 'neutral'}>{fa(r.status)}</Badge>{r.subs ? <small>{fmtNum(r.subs)} زیرمجموعه</small> : null}</div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <EmptyState title={t('دادهٔ ساختار در دسترس نیست')} description={t('ساختار شرکت‌های هلدینگ پس از ثبت نخستین رابطهٔ مالکیت نمایش داده می‌شود.')} />
          )}
        </Card>

        <Card className="dash-panel">
          <div className="panel-title"><div><h2>{t('سلامت پلتفرم')}</h2><p>{t('وضعیت زندهٔ ماژول‌های سرویس')}</p></div><Badge className="success">{t('سالم')}</Badge></div>
          <div className="health-list">
            <div className="health-row"><Activity size={16} /><span>{t('موتور تحلیلی')}</span><Badge className="success">{t('پیاده‌سازی‌شده')}</Badge></div>
            <div className="health-row"><Gauge size={16} /><span>{t('شاخص‌های سنجش')}</span><Badge className="success">{t('فعال')}</Badge></div>
            <div className="health-row"><HeartPulse size={16} /><span>{t('تاب‌آوری کل شبکه')}</span><strong>{fmtNum(network?.relationshipResilienceScore)}</strong></div>
            <div className="health-row"><Bell size={16} /><span>{t('اعلان خوانده‌نشده')}</span><strong>{fmtNum(counts.unreadNotifications)}</strong></div>
            <div className="health-row"><Workflow size={16} /><span>{t('اجرای گردش کار')}</span><strong>{fmtNum(totalExecutions)}</strong></div>
            <div className="health-row"><TrendingUp size={16} /><span>{t('سرمایهٔ شبکه')}</span><strong>{fmtNum(network?.networkCapital?.score)}</strong></div>
          </div>
        </Card>
      </section>

      {/* QUICK CREATE */}
      <section className="quick-create panel">
        <div><h2>{t('شروع سریع')}</h2><p>{t('مدیر مجاز می‌تواند موجودیت‌های اصلی را مستقیم ایجاد کند.')}</p></div>
        <div className="quick-actions">
          <Link href="/organizations"><Building2 size={13} /> {t('سازمان')}</Link>
          <Link href="/people"><Users size={13} /> {t('شخص')}</Link>
          <Link href="/relationships"><Share2 size={13} /> {t('رابطه')}</Link>
          <Link href="/meetings"><CalendarDays size={13} /> {t('جلسه')}</Link>
          <Link href="/actions"><Zap size={13} /> {t('اقدام')}</Link>
          <Link href="/commitments"><ShieldCheck size={13} /> {t('تعهد')}</Link>
          <Link href="/projects"><FolderKanban size={13} /> {t('پروژه')}</Link>
          <Link href="/opportunities"><Target size={13} /> {t('فرصت')}</Link>
          <Link href="/ai"><Sparkles size={13} /> {t('هوش مصنوعی')}</Link>
        </div>
      </section>
      {tour > 0 && (
        <div
          className="tour-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('تور خوش‌آمد')}
          onClick={(e) => { if (e.target === e.currentTarget) finishTour(); /* کلیک روی پس‌زمینهٔ تیره = بستن */ }}
        >
          <div className="tour-card">
            <span className="tour-step">گام {tour} از ۳</span>
            {tour === 1 && (<>
              <div className="tour-ico">👋</div>
              <h2>{t('به SRIP خوش آمدید')}</h2>
              <p>{t('این «پیشخوان» پاسخِ «امروز چه کاری مهم است» است: اولویت‌های نیازمند اقدام، روابط در معرض ریسک و جلسات پیش رو — همه با لینک مستقیم به همان کار.')}</p>
            </>)}
            {tour === 2 && (<>
              <div className="tour-ico">🧭</div>
              <h2>{t('منو در «خانه‌های کاری»')}</h2>
              <p>{t('به‌جای فهرست بلند، منو به شش خانهٔ کاری تقسیم شده: اشخاص و سازمان‌ها، روابط و شبکه، جریان کار، هوش و بینش، دانش. با «نمای ساده / نمای کامل» بالای منو، می‌توانید فقط کارهای روزمره را ببینید.')}</p>
            </>)}
            {tour === 3 && (<>
              <div className="tour-ico">✨</div>
              <h2>{t('هر عدد یک «چرا» دارد')}</h2>
              <p>{t('روی هر رابطهٔ پرریسک بزنید تا دلیلش را ببینید، و اگر نام بخشی را نمی‌دانید، دکمهٔ «؟» پایین منو واژه‌نامهٔ یک‌خطی را باز می‌کند.')}</p>
            </>)}
            <div className="tour-actions">
              <button className="tour-skip" onClick={finishTour}>{t('رد شدن')}</button>
              {tour < 3
                ? <button className="primary-action" onClick={() => setTour(t => t + 1)}>{t('بعدی')}</button>
                : <button className="primary-action" onClick={finishTour}>{t('شروع کار')}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
