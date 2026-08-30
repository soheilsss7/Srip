'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { ScopeBadge, useWorkspace, ROLE_LABELS } from '../_components/workspace';
import { Card, Badge, EmptyState } from '@srip/design-system';
import {
  Building2, Users, Share2, CalendarDays, Zap, ShieldCheck, FolderKanban, Target,
  Activity, HeartPulse, TrendingUp, Gauge, Bell, Workflow, Sparkles
} from 'lucide-react';

type Summary = {
  counts: Record<string, number>;
  engagement?: { activeUsers30d?: number; recommendationAcceptance?: number; recommendationAcceptanceRate?: number; successfulConnections?: number; relationshipUpdates?: number; featureUsage?: Array<{ feature: string; count: number }> };
};
type Network = {
  relationshipCount?: number; peopleCount?: number; opportunityCount?: number;
  networkCapital?: { score?: number; components?: Record<string, number> };
  strategicRelationshipIndex?: { score?: number; breakdown?: Record<string, number> };
  relationshipResilienceScore?: number; weightedOpportunityValue?: number;
  referralSuccessRate?: { total?: number; successful?: number; rate?: number };
};
type Funnel = { stages?: Record<string, number>; conversion?: Record<string, number> };
type Workflows = { executions?: Array<{ status: string; count: number }> };
type Holding = { roots?: Array<{ id: string; name: string; type: string; status: string; children?: Array<any> }>; organizations?: number };
type Health = { status?: string; uptime?: number; services?: Record<string, any>; module?: string };

const KPI_CARDS: Array<{ key: string; label: string; href: string; icon: React.ReactNode; grad: string }> = [
  { key: 'organizations', label: 'سازمان‌ها', href: '/organizations', icon: <Building2 size={18}/>, grad: 'ic-blue' },
  { key: 'people', label: 'اشخاص', href: '/people', icon: <Users size={18}/>, grad: 'ic-purple' },
  { key: 'relationships', label: 'روابط فعال', href: '/relationships', icon: <Share2 size={18}/>, grad: 'ic-teal' },
  { key: 'meetings', label: 'جلسات', href: '/meetings', icon: <CalendarDays size={18}/>, grad: 'ic-indigo' },
  { key: 'actions', label: 'اقدامات', href: '/actions', icon: <Zap size={18}/>, grad: 'ic-gold' },
  { key: 'commitments', label: 'تعهدات', href: '/commitments', icon: <ShieldCheck size={18}/>, grad: 'ic-red' },
  { key: 'projects', label: 'پروژه‌ها', href: '/projects', icon: <FolderKanban size={18}/>, grad: 'ic-blue' },
  { key: 'opportunities', label: 'فرصت‌ها', href: '/opportunities', icon: <Target size={18}/>, grad: 'ic-purple' },
];

const COMPONENT_LABELS: Record<string, string> = {
  relationshipQuality: 'کیفیت رابطه', influence: 'نفوذ', strategicValue: 'ارزش استراتژیک',
  opportunityPotential: 'پتانسیل فرصت', resilience: 'تاب‌آوری', coverage: 'پوشش',
  diversity: 'تنوع', engagement: 'تعامل', riskAdjusted: 'ریسک‌پذیر (تعدیل)',
};
const SRI_LABELS: Record<string, string> = {
  coverage: 'پوشش', strength: 'قوت', influence: 'نفوذ', opportunity: 'فرصت', resilience: 'تاب‌آوری',
};

function Score({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className="score-block">
      <div className="score-head"><span>{label}</span><b>{value ?? '—'}</b></div>
      <div className="score-track"><span className="score-fill" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} /></div>
    </div>
  );
}

function FunnelVisual({ stages, conversion }: { stages?: Record<string, number>; conversion?: Record<string, number> }) {
  const viewed = stages?.viewed ?? 0;
  const steps: Array<[string, number, string]> = [
    ['دیده شده', stages?.accepted ?? 0, 'accepted'],
    ['پذیرفته', stages?.actionCreated ?? 0, 'acceptedToActionCreatedPct'],
    ['ایجاد اقدام', stages?.actionCompleted ?? 0, 'actionCreatedToCompletedPct'],
    ['تکمیل اقدام', stages?.outcome ?? 0, 'actionCompletedToOutcomePct'],
  ];
  if (!viewed) return <div className="empty-inline">فعلاً داده فانل پیشنهاد وجود ندارد.</div>;
  return (
    <div className="funnel">
      {steps.map(([label, value, key], i) => {
        const pct = viewed ? Math.round((value / viewed) * 100) : 0;
        return (
          <div className="funnel-step" key={label}>
            <div className="funnel-bar" style={{ width: `${Math.max(8, pct)}%` }}>
              <span>{label}</span><b>{value}</b>
            </div>
          </div>
        );
      })}
      <div className="funnel-caption">بیشترین تبدیل: {conversion && conversion.viewedToAcceptedPct != null ? `${conversion.viewedToAcceptedPct}٪ دیده→پذیرفته` : '—'}</div>
    </div>
  );
}

export default function Dashboard() {
  const { me, role, scopeId, can } = useWorkspace();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [workflows, setWorkflows] = useState<Workflows | null>(null);
  const [holding, setHolding] = useState<Holding | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    const q = scopeId === 'all' ? '' : '?organizationId=' + encodeURIComponent(scopeId);
    Promise.all([
      api<Summary>('/analytics/summary'),
      api<Network>('/analytics/network' + q),
      api<Funnel>('/analytics/recommendations/funnel'),
      api<Workflows>('/analytics/workflows'),
      can('report.read') ? api<Holding>('/reports/holding' + q) : Promise.resolve(null),
    ]).then(([s, n, f, w, h]) => {
      if (!alive) return;
      setSummary(s); setNetwork(n); setFunnel(f); setWorkflows(w); setHolding(h);
    }).catch(e => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [scopeId, can]);

  const counts = summary?.counts ?? {};
  const capital = network?.networkCapital?.components ?? {};
  const sri = network?.strategicRelationshipIndex?.breakdown ?? {};
  const eng = summary?.engagement ?? {};
  const featureUsage = eng.featureUsage ?? [];
  const hasCapital = Object.keys(capital).length > 0;
  const hasSri = Object.keys(sri).length > 0;
  const greeting = me?.name ? `سلام ${me.name} 🤝` : 'سلام';
  const healthOk = !health ? null : health.status !== 'error';

  const totalExecutions = workflows?.executions?.reduce((a, e) => a + e.count, 0) ?? 0;

  return (
    <div className="dashboard-page dash">
      {/* HEADER */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">EXECUTIVE / STRATEGIC INTELLIGENCE</div>
          <h1>{greeting}</h1>
          <p className="subtitle">Command Center یکپارچه — همهٔ شاخص‌ها زنده از Backend، بر اساس نقش، Permission و محدودهٔ سازمانی.</p>
        </div>
        <div className="heading-tools">
          <ScopeBadge />
          <a className="primary-action" href="/today"><Activity size={14}/> عملیات امروز</a>
          <a className="secondary-action" href="/organizations"><Building2 size={14}/> + سازمان</a>
          <a className="secondary-action" href="/people"><Users size={14}/> + شخص</a>
          <a className="secondary-action" href="/relationships"><Share2 size={14}/> + رابطه</a>
        </div>
      </div>

      {error && <div className="error-card" role="alert">خطا در دریافت داده: {error} — نمایش داده‌های محلی در دسترس نیست.</div>}

      {/* STRATEGIC BANNER */}
      <section className="strategic-banner">
        <div><span>نقش فعال</span><strong>{ROLE_LABELS[role]}</strong></div>
        <div><span>محدوده</span><strong>{scopeId === 'all' ? 'همه محدودهٔ مجاز' : scopeId}</strong></div>
        <div><span>اصل محصول</span><strong>Relationship First · Network First · Intelligence-Driven</strong></div>
      </section>

      {/* KPI ROW */}
      <section className="kpi-grid" aria-label="Strategic KPIs">
        {KPI_CARDS.map(({ key, label, href, icon, grad }) => (
          <a className="kpi-card" href={href} key={key}>
            <div className="kpi-top"><span className={`kpi-ico ${grad}`}>{icon}</span><small>مشاهده ←</small></div>
            <strong>{loading ? '…' : counts[key] ?? 0}</strong>
            <span>{label}</span>
          </a>
        ))}
      </section>

      {/* TOP GRID: Network Capital + Engagement */}
      <section className="dash-grid-top">
        <Card className="dash-panel">
          <div className="panel-title">
            <div><h2>Network Capital · Components</h2><p>نه مؤلفهٔ سرمایهٔ شبکه — محاسبهٔ زنده توسط موتور تحلیلی</p></div>
            <Badge className="info">Network Capital {network?.networkCapital?.score ?? '—'}</Badge>
          </div>
          {hasCapital ? (
            <div className="scores">
              {Object.entries(capital).map(([k, v]) => (
                <Score key={k} value={v as number} label={COMPONENT_LABELS[k] ?? k} />
              ))}
            </div>
          ) : (
            <EmptyState title="دادهٔ سرمایهٔ شبکه در دسترس نیست" description="آمار مؤلفه‌ها از /analytics/network محاسبه می‌شود." />
          )}
        </Card>

        <Card className="dash-panel">
          <div className="panel-title">
            <div><h2>Strategic Relationship Index</h2><p>شکست‌نهٔ وزن‌دار امتیاز استراتژیک</p></div>
            <Badge className="success">SRI {network?.strategicRelationshipIndex?.score ?? '—'}</Badge>
          </div>
          {hasSri ? (
            <div className="scores">
              {Object.entries(sri).map(([k, v]) => (<Score key={k} value={v as number} label={SRI_LABELS[k] ?? k} />))}
            </div>
          ) : (
            <EmptyState title="دادهٔ SRI در دسترس نیست" />
          )}
          <div className="mini-metrics">
            <div><span>تاب‌آوری رابطه</span><strong>{network?.relationshipResilienceScore ?? '—'}</strong></div>
            <div><span>ارزش وزنی فرصت</span><strong>{network?.weightedOpportunityValue != null ? Math.round(network.weightedOpportunityValue).toLocaleString('en-US') : '—'}</strong></div>
            <div><span>میزان موفقیت معرفی</span><strong>{network?.referralSuccessRate?.rate != null ? `${network.referralSuccessRate.rate}٪` : '—'}</strong></div>
          </div>
        </Card>
      </section>

      {/* MID GRID: Engagement + Funnel + Workflows */}
      <section className="dash-grid-mid">
        <Card className="dash-panel">
          <div className="panel-title"><div><h2>Engagement & Activity</h2><p>فعالیت ۳۰ روز اخیر</p></div><Badge>Active {eng.activeUsers30d ?? 0}</Badge></div>
          <div className="mini-metrics">
            <div><span>کاربران فعال</span><strong>{eng.activeUsers30d ?? 0}</strong></div>
            <div><span>پذیرش پیشنهادها</span><strong>{eng.recommendationAcceptance ?? 0} <small>{eng.recommendationAcceptanceRate != null ? `(${eng.recommendationAcceptanceRate}٪)` : ''}</small></strong></div>
            <div><span>ارتباط موفق</span><strong>{eng.successfulConnections ?? 0}</strong></div>
            <div><span>به‌روزرسانی رابطه</span><strong>{eng.relationshipUpdates ?? 0}</strong></div>
          </div>
          {featureUsage.length > 0 && (
            <div className="feature-list">
              {featureUsage.slice(0, 8).map((f) => (
                <div className="feature-row" key={f.feature}>
                  <span>{f.feature.replace(/_/g, ' ')}</span>
                  <div className="feature-track"><span style={{ width: `${Math.min(100, f.count * 4)}%` }} /></div>
                  <b>{f.count}</b>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="dash-panel">
          <div className="panel-title"><div><h2>Recommendation Funnel</h2><p>قیف تبدیل پیشنهادهای هوشمند</p></div><a className="head-link" href="/recommendations">پیشنهادها ←</a></div>
          <FunnelVisual stages={funnel?.stages} conversion={funnel?.conversion} />
        </Card>

        <Card className="dash-panel">
          <div className="panel-title"><div><h2>Workflow Executions</h2><p>اجرای Workflow بر اساس وضعیت</p></div><Badge className="info">{totalExecutions} اجرا</Badge></div>
          {workflows?.executions?.length ? (
            <div className="wf-grid">
              {workflows.executions.map((e) => (
                <div className="wf-item" key={e.status}>
                  <span className={`wf-dot wf-${(e.status || '').toLowerCase()}`} />
                  <span>{e.status}</span>
                  <b>{e.count}</b>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="اجرای Workflow ثبت نشده" description="وضعیت اجراها از /analytics/workflows می‌آید." />
          )}
        </Card>
      </section>

      {/* BOTTOM GRID: Holding + Health + Priorities */}
      <section className="dash-grid-bottom">
        <Card className="dash-panel">
          <div className="panel-title"><div><h2>Holding / Company View</h2><p>ساختار شرکت‌های در محدودهٔ دسترسی</p></div><a className="head-link" href="/reports">گزارش‌ها ←</a></div>
          {holding?.roots?.length ? (
            <div className="holding-tree">
              {(() => {
                const rows: any[] = [];
                const walk = (nodes: any[], depth: number) => { nodes.forEach((r: any) => { rows.push({ name: r.name, depth, type: r.type ?? '—', status: r.status ?? '—', subs: r.children?.length ?? 0 }); if (r.children?.length) walk(r.children, depth + 1); }); };
                walk(holding.roots, 0);
                return rows.slice(0, 12).map((r, i) => (
                  <div className="holding-row" key={i} style={{ paddingInlineStart: (r.depth * 22 + 4) }}>
                    <span>{r.name}</span>
                    <div><Badge className="neutral">{r.type}</Badge><Badge className={(r.status || '').toLowerCase() === 'active' ? 'success' : 'neutral'}>{r.status}</Badge>{r.subs ? <small>{r.subs} زیرمجموعه</small> : null}</div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <EmptyState title="دادهٔ مقایسه‌ای در دسترس نیست" description="ساختار شرکت‌ها از /reports/holding می‌آید." />
          )}
        </Card>

        <Card className="dash-panel">
          <div className="panel-title"><div><h2>Platform Health</h2><p>وضعیت زندهٔ ماژول‌های Backend</p></div><Badge className={healthOk === false ? 'danger' : 'success'}>{healthOk === false ? 'Degraded' : 'Healthy'}</Badge></div>
          <div className="health-list">
            <div className="health-row"><Activity size={16}/><span>Analytics Engine</span><Badge className="success">implemented</Badge></div>
            <div className="health-row"><Gauge size={16}/><span>شاخص‌های سنجش</span><Badge className="success">live</Badge></div>
            <div className="health-row"><HeartPulse size={16}/><span>Resilience</span><strong>{network?.relationshipResilienceScore ?? '—'}</strong></div>
            <div className="health-row"><Bell size={16}/><span>اعلان‌های خوانده‌نشده</span><strong>{counts.unreadNotifications ?? 0}</strong></div>
            <div className="health-row"><Workflow size={16}/><span>اجرای Workflow</span><strong>{totalExecutions}</strong></div>
            <div className="health-row"><TrendingUp size={16}/><span>Network Capital</span><strong>{network?.networkCapital?.score ?? '—'}</strong></div>
          </div>
        </Card>

        <Card className="dash-panel">
          <div className="panel-title"><div><h2>Today's Priorities</h2><p>اقداماتی که باید پیگیری شوند</p></div><a className="head-link" href="/actions">اقدامات ←</a></div>
          <div className="priority-list">
            <a href="/actions"><b>اقدامات</b><span>{counts.actions ?? 0} مورد</span></a>
            <a href="/commitments"><b>تعهدات</b><span>{counts.commitments ?? 0} مورد</span></a>
            <a href="/meetings"><b>جلسات</b><span>{counts.meetings ?? 0} مورد</span></a>
            <a href="/relationships"><b>روابط</b><span>{counts.relationships ?? 0} مورد</span></a>
            <a href="/projects"><b>پروژه‌ها</b><span>{counts.projects ?? 0} مورد</span></a>
          </div>
        </Card>
      </section>

      {/* QUICK CREATE */}
      <section className="quick-create panel">
        <div><h2>ثبت سریع</h2><p>مدیر مجاز می‌تواند موجودیت‌های اصلی را مستقیم ایجاد کند.</p></div>
        <div className="quick-actions">
          <a href="/organizations"><Building2 size={13}/> سازمان</a>
          <a href="/people"><Users size={13}/> شخص</a>
          <a href="/relationships"><Share2 size={13}/> رابطه</a>
          <a href="/meetings"><CalendarDays size={13}/> جلسه</a>
          <a href="/actions"><Zap size={13}/> اقدام</a>
          <a href="/commitments"><ShieldCheck size={13}/> تعهد</a>
          <a href="/projects"><FolderKanban size={13}/> پروژه</a>
          <a href="/opportunities"><Target size={13}/> فرصت</a>
          <a href="/ai"><Sparkles size={13}/> هوش مصنوعی</a>
        </div>
      </section>
    </div>
  );
}
