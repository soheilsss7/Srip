'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { ScopeBadge, useWorkspace, ROLE_LABELS } from '../_components/workspace';
import { Card, Badge, EmptyState } from '@srip/design-system';
import { suggestGlobal } from '../_lib/connections';
import {
  Building2, Users, Share2, CalendarDays, Zap, ShieldCheck, FolderKanban, Target,
  Activity, HeartPulse, TrendingUp, Gauge, Bell, Workflow, Sparkles, Crown,
  AlertTriangle, Clock, ChevronLeft, CircleCheck, Flame, ListTodo,
} from 'lucide-react';

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
  v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }) : '—';
const fmtTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '—';
const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};
const scoreTone = (v: number): 'success' | 'info' | 'warning' | 'danger' =>
  v >= 75 ? 'success' : v >= 55 ? 'info' : v >= 40 ? 'warning' : 'danger';
const toneClass = (t: string): string =>
  t === 'success' ? 's' : t === 'warning' ? 'w' : t === 'danger' ? 'd' : '';

const KPI_CARDS: Array<{ key: string; label: string; href: string; icon: React.ReactNode; grad: string }> = [
  { key: 'organizations', label: 'سازمان‌ها', href: '/organizations', icon: <Building2 size={18} />, grad: 'ic-blue' },
  { key: 'people', label: 'اشخاص', href: '/people', icon: <Users size={18} />, grad: 'ic-purple' },
  { key: 'relationships', label: 'روابط فعال', href: '/relationships', icon: <Share2 size={18} />, grad: 'ic-teal' },
  { key: 'meetings', label: 'جلسات', href: '/meetings', icon: <CalendarDays size={18} />, grad: 'ic-indigo' },
  { key: 'actions', label: 'اقدامات باز', href: '/actions', icon: <Zap size={18} />, grad: 'ic-gold' },
  { key: 'commitments', label: 'تعهدات باز', href: '/commitments', icon: <ShieldCheck size={18} />, grad: 'ic-red' },
  { key: 'projects', label: 'پروژه‌ها', href: '/projects', icon: <FolderKanban size={18} />, grad: 'ic-blue' },
  { key: 'opportunities', label: 'فرصت‌ها', href: '/opportunities', icon: <Target size={18} />, grad: 'ic-purple' },
];

const COMPONENT_LABELS: Record<string, string> = {
  relationshipQuality: 'کیفیت رابطه', influence: 'نفوذ', strategicValue: 'ارزش راهبردی',
  opportunityPotential: 'پتانسیل فرصت', resilience: 'تاب‌آوری', coverage: 'پوشش',
  diversity: 'تنوع', engagement: 'درگیری', riskAdjusted: 'تعدیل‌شده با ریسک',
};
const SRI_LABELS: Record<string, string> = {
  coverage: 'پوشش', strength: 'قوت', influence: 'نفوذ', opportunity: 'فرصت', resilience: 'تاب‌آوری',
};
const FEATURE_LABELS: Record<string, string> = {
  network_explorer: 'کاوش شبکه', smart_search: 'جستجوی هوشمند', meeting_briefs: 'بریف جلسه',
  recommendations: 'پیشنهادها', executive_brief: 'گزارش راهبردی', meeting_summary: 'خلاصهٔ جلسه',
  action_extraction: 'استخراج اقدام', commitment_extraction: 'استخراج تعهد',
  risk_detection: 'تشخیص ریسک', opportunity_detection: 'تشخیص فرصت', next_best_action: 'اقدام بعدی',
};

function Score({ value, label }: { value: number | undefined; label: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="score-block">
      <div className="score-head"><span>{label}</span><b>{value ?? '—'}</b></div>
      <div className="score-track"><span className={`score-fill ${toneClass(scoreTone(v))}`} style={{ width: `${v}%` }} /></div>    </div>
  );
}

function FunnelVisual({ stages, conversion }: { stages?: Record<string, number>; conversion?: Record<string, number> }) {
  const viewed = stages?.viewed ?? 0;
  const steps: Array<{ label: string; value: number }> = [
    { label: 'دیده شده', value: viewed },
    { label: 'پذیرفته', value: stages?.accepted ?? 0 },
    { label: 'ایجاد اقدام', value: stages?.actionCreated ?? 0 },
    { label: 'تکمیل اقدام', value: stages?.actionCompleted ?? 0 },
    { label: 'نتیجه', value: stages?.outcome ?? 0 },
  ];
  const convLabels: Record<string, string> = {
    viewedToAcceptedPct: 'دیده‌شده ← پذیرفته',
    acceptedToActionCreatedPct: 'پذیرفته ← ایجاد اقدام',
    actionCreatedToCompletedPct: 'ایجاد ← تکمیل',
    actionCompletedToOutcomePct: 'تکمیل ← نتیجه',
  };
  if (!viewed) return <div className="empty-inline">فعلاً داده‌ای از قیف پیشنهادها ثبت نشده است.</div>;
  return (
    <div className="funnel">
      {steps.map((s, i) => {
        const pct = viewed ? Math.round((s.value / viewed) * 100) : 0;
        const convKey = i === 0 ? null : (Object.keys(convLabels)[i - 1]);
        const convVal = convKey && conversion ? conversion[convKey] : null;
        return (
          <div className="funnel-step" key={s.label}>
            <div className="funnel-bar" style={{ width: `${Math.max(10, pct)}%` }}>
              <span>{s.label}</span><b>{fmtNum(s.value)}</b>
            </div>
            {convKey && convVal != null && (
              <span className="funnel-conv" title={convLabels[convKey]}>{fmtNum(convVal)}٪</span>
            )}
          </div>
        );
      })}
      <div className="funnel-caption">نسبت‌ها بر پایهٔ «دیده شده» (۱۰۰٪) محاسبه شده‌اند.</div>    </div>
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
  const todayLabel = new Date().toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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
          <div className="eyebrow">پیشخوان — برنامهٔ کار امروز شما</div>
          <h1>{me?.name ? `سلام، ${me.name}` : 'سلام'}</h1>
          <p className="subtitle">امروز چه چیزی نیازمند اقدام شماست؟ اولویت‌ها، هشدارها و جلسات پیش رو — هر عدد با دلیلی از دادهٔ واقعی.</p>
        </div>
        <div className="heading-tools">
          <span className={`chip ${isOwnerMode ? 'purple' : 'info'}`}>
            {isOwnerMode ? <Crown size={12} /> : <Building2 size={12} />}
            {isOwnerMode ? 'نمای مالک — همهٔ محدوده' : 'نمای سازمانی'}
          </span>
          <span className="chip info"><CalendarDays size={12} /> {todayLabel}</span>
          <ScopeBadge />
          <Link className="primary-action" href="/organizations"><Building2 size={14} /> + سازمان</Link>
          <Link className="secondary-action" href="/people"><Users size={14} /> + شخص</Link>
          <Link className="secondary-action" href="/relationships"><Share2 size={14} /> + رابطه</Link>
        </div>
      </div>

      {!loading && !error && (lists?.rels?.length ?? 0) === 0 && meetings.length === 0 && actions.length === 0 && (
        <section className="onboarding-strip" aria-label="از کجا شروع کنم؟">
          <div className="ob-step"><b>۱</b><span>سازمان‌ها را ثبت کنید</span></div>
          <div className="ob-step"><b>۲</b><span>بین آن‌ها رابطه بسازید</span></div>
          <div className="ob-step"><b>۳</b><span>اولین تعامل و اقدام را ثبت کنید — هوشمندی فعال می‌شود</span></div>
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
        <div><span>نقش فعال</span><strong>{ROLE_LABELS[role] ?? '—'}</strong></div>
        <div><span>محدوده</span><strong>{scopeId === 'all' ? 'همهٔ محدودهٔ مجاز' : scopeId}</strong></div>
        <div><span>اصل محصول</span><strong>رابطه‌محور · شبکه‌محور · هوشمحور</strong></div>
      </section>

      {/* ACTION CENTER — پاسخ به «امروز چه کاری مهم است» */}
      <section className="action-center" aria-label="مرکز اقدام امروز">
        <div className="action-center-head">
          <div className="action-center-title">
            <span className="action-center-ico"><ListTodo size={15} /></span>
            <div>
              <h2>اولویت‌های امروز</h2>
              <p>پاسخ به پرسش «امروز چه کاری مهم است» — بر اساس سررسیدها، ریسک‌ها و رویدادها</p>
            </div>
          </div>
          <Badge className="danger">{fmtNum(unreadAlerts)} مورد نیازمند توجه</Badge>
        </div>
        <div className="action-center-grid">
          <div className="ac-card ac-overdue">
            <div className="ac-card-head"><AlertTriangle size={14} /><b>اقدامات عقب‌افتاده</b><span>{fmtNum(overdue.length)} مورد</span></div>
            {overdue.length ? overdue.slice(0, 3).map((a) => (
              <Link className="ac-item" href={`/actions/${a.id}`} key={a.id}>
                <span className="ac-dot d" /><span className="ac-name">{a.title}</span>
                <span className="ac-date">موعد: {fmtDate(a.dueAt)}</span>
              </Link>
            )) : <div className="ac-none"><CircleCheck size={14} /> اقدام عقب‌افتاده‌ای ندارید</div>}
          </div>
          <div className="ac-card ac-soon">
            <div className="ac-card-head"><Clock size={14} /><b>سررسید تا ۳ روز</b><span>{fmtNum(dueSoon.length)} مورد</span></div>
            {dueSoon.length ? dueSoon.slice(0, 3).map((a) => (
              <Link className="ac-item" href={`/actions/${a.id}`} key={a.id}>
                <span className="ac-dot w" /><span className="ac-name">{a.title}</span>
                <span className="ac-date">{fmtDate(a.dueAt)}</span>
              </Link>
            )) : <div className="ac-none"><CircleCheck size={14} /> سررسید فوری‌ای ندارید</div>}
          </div>
          <div className="ac-card ac-next">
            <div className="ac-card-head"><CalendarDays size={14} /><b>جلسهٔ بعدی</b><span>{meetings.length ? fmtNum(meetings.length) + ' جلسهٔ پیش رو' : ''}</span></div>
            {nextMeeting ? (
              <Link className="ac-item" href={`/meetings/${nextMeeting.id}`} key={nextMeeting.id}>
                <span className="ac-dot s" /><span className="ac-name">{nextMeeting.title}</span>
                <span className="ac-date">{fmtDate(nextMeeting.startAt)} · {fmtTime(nextMeeting.startAt)}</span>
              </Link>
            ) : <div className="ac-none"><CalendarDays size={14} /> جلسهٔ پیش روی برنامه‌ریزی‌شده ندارید</div>}
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
      <section className="kpi-grid" aria-label="شاخص‌های راهبردی">
        {KPI_CARDS.map(({ key, label, href, icon, grad }) => (
          <Link className="kpi-card" href={href} key={key}>
            <div className="kpi-top"><span className={`kpi-ico ${grad}`}>{icon}</span><small>مشاهده ←</small></div>
            {loading ? <strong className="skeleton" style={{ width: 52, height: 26, display: 'inline-block', borderRadius: 8 }}>&nbsp;</strong> : <strong>{fmtNum(counts[key])}</strong>}
            <span>{label}</span>
          </Link>
        ))}
      </section>


      {/* RISK STRIP */}
      {riskyRels.length > 0 && (
        <section className="alert-strip" aria-label="هشدارهای شبکه">
          <div className="alert-strip-head">
            <Flame size={15} />
            <span>روابط در معرض ریسک</span>
            <b>{fmtNum(riskyRels.length)} رابطه</b>
          </div>
          <div className="alert-strip-list">
            {riskyRels.map((r: any) => (
              <Link className="alert-pill" href={`/relationships/${r.id}`} key={r.id}>
                <span className="alert-pill-name">{r.name}</span>
                {r.risk ? <span className="alert-pill-meta">ریسک {fmtNum(r.risk)} · سلامت {fmtNum(r.health)}</span> : <span className="alert-pill-meta">هشدار تحلیلی</span>}
                {r.why ? <span className="alert-pill-why">{r.why}</span> : null}
              </Link>
            ))}
          </div>
          <Link className="alert-strip-more" href="/relationships"><ChevronLeft size={13} /> همهٔ روابط</Link>
        </section>
      )}

      {/* UPCOMING MEETINGS — کار امروز */}
      <section className="dash-upcoming">
        <Card className="dash-panel">
          <div className="panel-title"><div><h2>جلسات پیش رو</h2><p>رویدادهای برنامه‌ریزی‌شده در محدودهٔ شما</p></div><Link className="head-link" href="/meetings">تقویم ←</Link></div>
          {meetings.length ? (
            <div className="meeting-list">
              {meetings.slice(0, 5).map((m) => (
                <Link className="meeting-row" href={`/meetings/${m.id}`} key={m.id}>
                  <span className="meeting-date">
                    <b>{fmtNum(new Date(m.startAt).getDate())}</b>
                    <small>{new Date(m.startAt).toLocaleDateString('fa-IR', { month: 'short' })}</small>
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
            <EmptyState title="جلسهٔ پیش روی ثبت نشده" description="جلسات آیندهٔ برنامه‌ریزی‌شده اینجا ظاهر می‌شوند." />
          )}
        </Card>
      </section>

      {/* CONNECTION SUGGESTIONS */}
      {suggestions.length > 0 && (
        <section className="section-card">
          <div className="section-head">
            <div>
              <h2><Sparkles size={17} /> پیشنهاد ارتباط جدید</h2>
              <p>بر اساس ارتباطات مشترک، تعاملات اخیر و هم‌صنف‌بودن — محاسبهٔ قطعی موتور، بدون سرویس خارجی.</p>
            </div>
            <Link className="btn btn-ghost btn-sm" href="/network">مشاهدهٔ شبکه ←</Link>
          </div>
          <div className="suggestions-grid">
            {suggestions.map((s) => (
              <Link className="ai-match-card" href={s.href} key={s.id}>
                <div className="match-meta">
                  <Badge className="info">{s.kind === 'person' ? 'شخص' : 'سازمان'}</Badge>
                  {s.via.length > 0 && <span>از طریق: {s.via.join('، ')}</span>}
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
            <div><h2>سرمایهٔ شبکه · اجزا</h2><p>نه مؤلفهٔ سرمایهٔ شبکه — محاسبهٔ زنده توسط موتور تحلیلی</p></div>
            <Badge className="info">سرمایهٔ شبکه: {fmtNum(network?.networkCapital?.score)}</Badge>
          </div>
          {hasCapital ? (
            <div className="scores">
              {Object.entries(capital).map(([k, v]) => <Score key={k} value={v as number} label={COMPONENT_LABELS[k] ?? k} />)}
            </div>
          ) : (
            <EmptyState title="دادهٔ سرمایهٔ شبکه در دسترس نیست" description="پس از ثبت نخستین روابط، این بخش به‌روز می‌شود." />
          )}
        </Card>

        <Card className="dash-panel">
          <div className="panel-title">
            <div><h2>شاخص رابطهٔ راهبردی</h2><p>شکستِ وزن‌دار امتیاز راهبردی روابط</p></div>
            <Badge className="success">شاخص راهبردی: {fmtNum(network?.strategicRelationshipIndex?.score)}</Badge>
          </div>
          {hasSri ? (
            <div className="scores">
              {Object.entries(sri).map(([k, v]) => <Score key={k} value={v as number} label={SRI_LABELS[k] ?? k} />)}
            </div>
          ) : (
            <EmptyState title="دادهٔ شاخص راهبردی در دسترس نیست" />
          )}
          <div className="mini-metrics">
            <div><span>تاب‌آوری رابطه</span><strong>{fmtNum(network?.relationshipResilienceScore)}</strong></div>
            <div><span>ارزش وزنی فرصت</span><strong>{fmtNum(network?.weightedOpportunityValue != null ? Math.round(network.weightedOpportunityValue) : null)}</strong></div>
            <div><span>میزان موفقیت معرفی</span><strong>{network?.referralSuccessRate?.rate != null ? `${fmtNum(network.referralSuccessRate.rate)}٪` : '—'}</strong></div>
            <div><span>میانگین سلامت روابط</span><strong>{avgHealth != null ? fmtNum(avgHealth) : '—'}</strong></div>
          </div>
        </Card>
      </section>

      {/* MID GRID: Engagement + Funnel + Workflows */}
      <section className="dash-grid-mid">
        <Card className="dash-panel">
          <div className="panel-title"><div><h2>درگیری و فعالیت</h2><p>فعالیت ۳۰ روز اخیر کاربران</p></div><Badge>کاربر فعال: {fmtNum(eng.activeUsers30d)}</Badge></div>
          <div className="mini-metrics">
            <div><span>کاربران فعال ۳۰ روز</span><strong>{fmtNum(eng.activeUsers30d)}</strong></div>
            <div><span>پذیرش پیشنهادها</span><strong>{fmtNum(eng.recommendationAcceptance)}{eng.recommendationAcceptanceRate != null ? <small> · {fmtNum(eng.recommendationAcceptanceRate)}٪</small> : null}</strong></div>
            <div><span>ارتباط موفق</span><strong>{fmtNum(eng.successfulConnections)}</strong></div>
            <div><span>به‌روزرسانی رابطه</span><strong>{fmtNum(eng.relationshipUpdates)}</strong></div>
          </div>
          {featureUsage.length > 0 && (
            <>
              <div className="sub-panel-title">بیشترین استفاده از امکانات</div>
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
          <div className="panel-title"><div><h2>قیف پیشنهادات</h2><p>مسیر پیشنهاد هوشمند تا نتیجه</p></div><Link className="head-link" href="/recommendations">پیشنهادها ←</Link></div>
          <FunnelVisual stages={funnel?.stages} conversion={funnel?.conversion} />
        </Card>

        <Card className="dash-panel">
          <div className="panel-title"><div><h2>اجراهای گردش کار</h2><p>وضعیت اجرای گردش‌های کاری</p></div><Badge className="info">{fmtNum(totalExecutions)} اجرا</Badge></div>
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
            <EmptyState title="اجرای گردش کاری ثبت نشده" description="با اجرای نخستین گردش کار، وضعیت اینجا نمایش داده می‌شود." />
          )}
          {wfFailed > 0 && (
            <div className="wf-alert"><AlertTriangle size={13} /> {fmtNum(wfFailed)} اجرای ناموفق نیازمند بررسی</div>
          )}
        </Card>
      </section>

      {/* BOTTOM GRID: Meetings + Holding + Health */}
      <section className="dash-grid-bottom">


        <Card className="dash-panel">
          <div className="panel-title"><div><h2>نمای هلدینگ / شرکت</h2><p>ساختار شرکت‌های در محدودهٔ دسترسی</p></div><Link className="head-link" href="/reports">گزارش‌ها ←</Link></div>
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
            <EmptyState title="دادهٔ ساختار در دسترس نیست" description="ساختار شرکت‌های هلدینگ پس از ثبت نخستین رابطهٔ مالکیت نمایش داده می‌شود." />
          )}
        </Card>

        <Card className="dash-panel">
          <div className="panel-title"><div><h2>سلامت پلتفرم</h2><p>وضعیت زندهٔ ماژول‌های سرویس</p></div><Badge className="success">سالم</Badge></div>
          <div className="health-list">
            <div className="health-row"><Activity size={16} /><span>موتور تحلیلی</span><Badge className="success">پیاده‌سازی‌شده</Badge></div>
            <div className="health-row"><Gauge size={16} /><span>شاخص‌های سنجش</span><Badge className="success">فعال</Badge></div>
            <div className="health-row"><HeartPulse size={16} /><span>تاب‌آوری کل شبکه</span><strong>{fmtNum(network?.relationshipResilienceScore)}</strong></div>
            <div className="health-row"><Bell size={16} /><span>اعلان خوانده‌نشده</span><strong>{fmtNum(counts.unreadNotifications)}</strong></div>
            <div className="health-row"><Workflow size={16} /><span>اجرای گردش کار</span><strong>{fmtNum(totalExecutions)}</strong></div>
            <div className="health-row"><TrendingUp size={16} /><span>سرمایهٔ شبکه</span><strong>{fmtNum(network?.networkCapital?.score)}</strong></div>
          </div>
        </Card>
      </section>

      {/* QUICK CREATE */}
      <section className="quick-create panel">
        <div><h2>شروع سریع</h2><p>مدیر مجاز می‌تواند موجودیت‌های اصلی را مستقیم ایجاد کند.</p></div>
        <div className="quick-actions">
          <Link href="/organizations"><Building2 size={13} /> سازمان</Link>
          <Link href="/people"><Users size={13} /> شخص</Link>
          <Link href="/relationships"><Share2 size={13} /> رابطه</Link>
          <Link href="/meetings"><CalendarDays size={13} /> جلسه</Link>
          <Link href="/actions"><Zap size={13} /> اقدام</Link>
          <Link href="/commitments"><ShieldCheck size={13} /> تعهد</Link>
          <Link href="/projects"><FolderKanban size={13} /> پروژه</Link>
          <Link href="/opportunities"><Target size={13} /> فرصت</Link>
          <Link href="/ai"><Sparkles size={13} /> هوش مصنوعی</Link>
        </div>
      </section>
      {tour > 0 && (
        <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="تور خوش‌آمد">
          <div className="tour-card">
            <span className="tour-step">گام {tour} از ۳</span>
            {tour === 1 && (<>
              <div className="tour-ico">👋</div>
              <h2>به SRIP خوش آمدید</h2>
              <p>این «پیشخوان» پاسخِ «امروز چه کاری مهم است» است: اولویت‌های نیازمند اقدام، روابط در معرض ریسک و جلسات پیش رو — همه با لینک مستقیم به همان کار.</p>
            </>)}
            {tour === 2 && (<>
              <div className="tour-ico">🧭</div>
              <h2>منو در «خانه‌های کاری»</h2>
              <p>به‌جای فهرست بلند، منو به شش خانهٔ کاری تقسیم شده: اشخاص و سازمان‌ها، روابط و شبکه، جریان کار، هوش و بینش، دانش. با «نمای ساده / نمای کامل» بالای منو، می‌توانید فقط کارهای روزمره را ببینید.</p>
            </>)}
            {tour === 3 && (<>
              <div className="tour-ico">✨</div>
              <h2>هر عدد یک «چرا» دارد</h2>
              <p>روی هر رابطهٔ پرریسک بزنید تا دلیلش را ببینید، و اگر نام بخشی را نمی‌دانید، دکمهٔ «؟» پایین منو واژه‌نامهٔ یک‌خطی را باز می‌کند.</p>
            </>)}
            <div className="tour-actions">
              <button className="tour-skip" onClick={finishTour}>رد شدن</button>
              {tour < 3
                ? <button className="primary-action" onClick={() => setTour(t => t + 1)}>بعدی</button>
                : <button className="primary-action" onClick={finishTour}>شروع کار</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
