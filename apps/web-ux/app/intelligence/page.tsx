'use client';
import Link from 'next/link';
import HubTabs from '../_components/hub-tabs';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, StatCard } from '../_components/page-ui';
import { NudgeBanner, useNudges } from '../_components/nudges';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, ChevronLeft, Clock3, Coins, GitBranch, Handshake, HeartPulse, Lightbulb, Link2, Network, RefreshCw, ShieldAlert, TrendingUp, User, Zap } from 'lucide-react';;

/* --------------------------------- types --------------------------------- */
type Evidence = { type: string; refId?: string; title: string; at?: string | null };
type RiskSignal = {
  id: string; title: string; severity: 'HIGH' | 'MEDIUM' | 'LOW';
  relationshipId?: string; description?: string; detectedAt?: string;
  relationship?: { id: string; name: string } | null;
  scores?: { riskScore?: number; healthScore?: number; resilienceScore?: number };
  evidence?: Evidence[];
};
type OppItem = {
  id: string; type: 'TRACKING' | 'GROWTH'; title: string; opportunityId?: string | null;
  relationshipId?: string | null; relationshipName?: string | null;
  score: number; probability?: number | null; value?: number | null; expectedValue?: number | null;
  stage?: string | null; detectedAt?: string | null; reason?: string;
};
type CoverageRow = {
  id: string; name: string; status?: string; strategicScore?: number; healthScore?: number;
  resilienceScore?: number; riskScore?: number; covered: boolean;
  coverageGaps?: { type: string; title: string }[]; openActions?: number; openCommitments?: number;
  criteria?: { coverage?: number; rankable?: boolean; rankingScore?: number; effectiveScore?: number } | null;
};
type Intel = {
  generatedAt?: string;
  kpis: { relationships: number; organizations: number; avgHealth: number | null; avgRisk: number | null; avgOpportunity: number | null; openActions: number; openCommitments: number; lateCount: number };
  riskSignals: RiskSignal[];
  opportunities: OppItem[];
  coverage: {
    coveragePercent: number; strategicRelationships: number; coveredStrategicRelationships: number;
    healthyStrategicRelationships: number; resilientStrategicRelationships: number;
    scopeOrganizations: number; relationships: CoverageRow[];
  };
  network: {
    nodes: { id: string; name: string }[];
    edges: number;
    centrality: { node: { id: string; name: string }; degree: number }[];
    bridgePeople: { person: { id: string; name: string; organization?: string | null }; bridgeScore: number; orgs: { id: string; name: string }[] }[];
    bottlenecks: { node: { id: string; name: string }; bottleneckScore: number; riskyConnections?: number }[];
    singlePointsOfFailure: { node: { id: string; name: string }; bottleneckScore: number }[];
  };
};

/* --------------------------------- utils --------------------------------- */
const fmtNum = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDateTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtMoney = (v: number | null | undefined): string => {
  if (v == null || Number.isNaN(v)) return '—';
  const b = v / 1e9;
  if (b >= 1) return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(b)} میلیارد تومان`;
  return `${fmtNum(v)} تومان`;
};
const SEV_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  HIGH: 'danger', MEDIUM: 'warning', LOW: 'info',
};
const SEV_LABEL: Record<string, string> = { HIGH: 'بالا', MEDIUM: 'متوسط', LOW: 'ملایم' };
const STAGE_LABEL: Record<string, string> = {
  IDENTIFIED: 'شناسایی‌شده', QUALIFYING: 'در حال ارزیابی', ACTIVE: 'در مذاکره', WON: 'برنده‌شده', LOST: 'ازدست‌رفته',
};

function EvidenceLine({ ev }: { ev: Evidence }) {
  const map: Record<string, { icon: React.ReactNode; label: string; href?: string }> = {
    ACTION_OVERDUE: { icon: <AlertTriangle size={12} />, label: 'اقدام عقب‌افتاده', href: ev.refId ? `/actions/${ev.refId}` : undefined },
    ACTION_BLOCKED: { icon: <ShieldAlert size={12} />, label: 'اقدام مسدود', href: ev.refId ? `/actions/${ev.refId}` : undefined },
    COMMITMENT_OVERDUE: { icon: <Clock3 size={12} />, label: 'تعهد عقب‌افتاده', href: ev.refId ? `/commitments/${ev.refId}` : undefined },
    RELATIONSHIP_WATCH: { icon: <EyeIcon />, label: 'وضعیت رابطه' },
    LOW_HEALTH: { icon: <HeartPulse size={12} />, label: 'سلامت پایین' },
    STALE_INTERACTION: { icon: <Clock3 size={12} />, label: 'تعامل کهنه' },
  };
  const cfg = map[ev.type] ?? { icon: <Activity size={12} />, label: '' };
  const inner = (
    <span className="evidence-line">
      {cfg.icon} <b>{cfg.label}:</b> {ev.title}
      {ev.type === 'STALE_INTERACTION' && ev.at ? <span className="t-muted"> ({fmtDateTime(ev.at)})</span> : null}
    </span>
  );
  return cfg.href ? <Link href={cfg.href} style={{ color: 'inherit', textDecoration: 'none' }}>{inner}</Link> : inner;
}
function EyeIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
}

export default function IntelligencePage() {
  const { can } = useWorkspace();
  const [data, setData] = useState<Intel | null>(null);
  const [nba, setNba] = useState<any>(null);
  const [leverage, setLeverage] = useState<any>(null);
  const [nbaBusy, setNbaBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const nudges = useNudges();

  const load = useCallback(async () => {
    if (!can('analytics.read')) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [d, nb, lv] = await Promise.all([
        api<Intel>('/intelligence/overview'),
        api<any>('/intelligence/nba').catch(() => null),
        api<any>('/intelligence/risk-leverage').catch(() => null),
      ]);
      setData(d); setNba(nb); setLeverage(lv);
    }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [can]);
  useEffect(() => { load(); }, [load]);

  async function nbaAct(id: string, status: 'EXECUTED' | 'DISMISSED') {
    setNbaBusy(id); setError(''); setInfo('');
    try {
      const out: any = await api(`/intelligence/nba/${id}/${status === 'EXECUTED' ? 'execute' : 'dismiss'}`, { method: 'POST', body: '{}' });
      setNba(out);
      setInfo(status === 'EXECUTED' ? 'اقدام وارد صف اجرا شد (یک اقدام باز روی همان رابطه ساخته شد).' : 'پیشنهاد رد شد و در KPI پذیرش شمرده نمیشود.');
    } catch (e) { setError((e as Error).message); }
    finally { setNbaBusy(''); }
  }

  const k = data?.kpis;
  const coverage = data?.coverage;
  const net = data?.network;
  const tracking = (data?.opportunities ?? []).filter(o => o.type === 'TRACKING');
  const growth = (data?.opportunities ?? []).filter(o => o.type === 'GROWTH');

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری · تحلیل"
        title="هوشمندی"
        description="تحلیل زنده از دادهٔ همین فضای کاری: سیگنال‌های ریسک با شواهد، کشف فرصت، پوشش راهبردی و ساختار شبکه."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading} aria-label="بازخوانی"><RefreshCw size={15} /> بازخوانی</button>
            {data?.generatedAt && <span className="chip info">تولید: {fmtDateTime(data.generatedAt)}</span>}
          </>
        }
      />
      <HubTabs base tabs={[
        {href:'/intelligence',label:'هوش رابطه'},
        {href:'/ai',label:'دستیار هوشمند'},
        {href:'/recommendations',label:'پیشنهادها'},
        {href:'/ai-executive-brief',label:'بریف هفتگی'},
        {href:'/reports',label:'گزارش‌ها'},
      ]}/>
      <ErrorCard message={error} />
      {info && <div className="success-card" role="status">{info}</div>}
      <NudgeBanner items={nudges.items} loading={nudges.loading} onRefresh={nudges.refresh} compact />

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 110 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ marginTop: 14 }} />
        </>
      ) : !data ? (
        !error && <Loading />
      ) : (
        <>
          {/* آمار کل */}
          <div className="stat-grid">
            <StatCard icon={<Handshake size={18} />} label="روابط در محدوده" value={fmtNum(k?.relationships)} iconClass="ic-indigo" sub={`میانگین سلامت ${fmtNum(k?.avgHealth)}`} />
            <StatCard icon={<ShieldAlert size={18} />} label="میانگین ریسک" value={fmtNum(k?.avgRisk)} iconClass={fmtNum(k?.avgRisk) !== '—' && (k?.avgRisk ?? 0) >= 50 ? 'ic-red' : 'ic-gold'} sub={`میانگین ظرفیت فرصت ${fmtNum(k?.avgOpportunity)}`} />
            <StatCard icon={<AlertTriangle size={18} />} label="عقب‌افتادهٔ باز" value={fmtNum(k?.lateCount)} iconClass="ic-red" sub="اقدامات و تعهداتِ موعدگذشته" />
            <StatCard icon={<Activity size={18} />} label="سیگنال فعال" value={fmtNum(data.riskSignals.length)} iconClass="ic-teal" sub="روابطِ نیازمند توجه" />
          </div>

          {/* P2-1: صف قدم بعدی (NBA) */}
          {nba && (
            <section className="panel" aria-label="صف قدم بعدی">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Zap size={16} /> صف «قدم بعدی» — باید الان</h2>
                  <p>اولویت: باید الان ← امروز ← این هفته؛ هر ردیف «چرا» و کانال دارد و اجرا = ساخت اقدام باز روی همان رابطه</p>
                </div>
                <Badge tone={nba.kpis?.acceptanceRate != null && nba.kpis.acceptanceRate >= 50 ? 'success' : 'info'}>
                  نرخ اجرا: {fmtNum(nba.kpis?.acceptanceRate)}٪
                </Badge>
              </div>
              <div className="kpi-grid" style={{ marginBottom: 12 }}>
                <div className="kpi-card" style={{ margin: 0 }}><small>فعال</small><strong>{fmtNum(nba.kpis?.active)}</strong></div>
                <div className="kpi-card" style={{ margin: 0 }}><small>اجرا شده</small><strong>{fmtNum(nba.kpis?.executed)}</strong></div>
                <div className="kpi-card" style={{ margin: 0 }}><small>رد شده</small><strong>{fmtNum(nba.kpis?.dismissed)}</strong></div>
              </div>
              <div className="list">
                {(nba.items ?? []).map((it: any) => (
                  <div className="listRow" key={it.id} style={{ alignItems: 'flex-start' }}>
                    <Badge tone={it.urgency === 'NOW' ? 'danger' : it.urgency === 'TODAY' ? 'warning' : 'info'}>{it.urgencyLabel}</Badge>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 13 }}>
                        {it.relationshipId
                          ? <Link className="t-primary" href={`/relationships/${it.relationshipId}`}>{it.title}</Link>
                          : it.title}
                      </strong>
                      <small style={{ display: 'block', marginTop: 2 }}>{it.text}</small>
                      <small style={{ display: 'block', marginTop: 3 }}>
                        <span className="chip neutral">کانال: {it.channelLabel}</span>
                        {it.expectedValue != null && <span className="chip info">بازده موردانتظار: {fmtMoney(it.expectedValue)}</span>}
                        {Array.isArray(it.why) && it.why.map((w: string, i: number) => <span key={i} className="chip neutral">{w}</span>)}
                      </small>
                    </span>
                    {it.executed ? (
                      <Badge tone="success">اجرا شد</Badge>
                    ) : (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary" style={{ minHeight: 0, padding: '6px 12px', fontSize: 11 }} disabled={nbaBusy === it.id} onClick={() => nbaAct(it.id, 'EXECUTED')}>
                          {nbaBusy === it.id ? '…' : 'اجرا'}
                        </button>
                        <button className="btn btn-ghost" style={{ minHeight: 0, padding: '6px 10px', fontSize: 11 }} disabled={nbaBusy === it.id} onClick={() => nbaAct(it.id, 'DISMISSED')}>رد</button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* P2-4: ریسک متمرکز و اهرم */}
          {leverage && (
            <section className="panel" aria-label="ریسک متمرکز و اهرم">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ShieldAlert size={16} /> ریسک متمرکز و اهرم</h2>
                  <p>درآمد در معرض ریسک = ارزش موزون فرصت‌های باز × ریسک رابطه؛ وابستگی تک‌رابطه/تک‌شخص + اقدام جایگزین</p>
                </div>
                <Badge tone={leverage.kpis?.singleRelationshipCount > 0 ? 'danger' : 'success'}>در معرض ریسک: {fmtMoney(leverage.kpis?.totalRevenueAtRisk)}</Badge>
              </div>
              <div className="kpi-grid" style={{ marginBottom: 12 }}>
                <div className="kpi-card" style={{ margin: 0 }}><small>سبد باز (موزون)</small><strong>{fmtMoney(leverage.kpis?.totalExpectedValue)}</strong></div>
                <div className="kpi-card" style={{ margin: 0 }}><small>درآمد در معرض ریسک</small><strong>{fmtMoney(leverage.kpis?.totalRevenueAtRisk)}</strong></div>
                <div className="kpi-card" style={{ margin: 0 }}><small>وابستگی تک‌رابطه</small><strong>{fmtNum(leverage.kpis?.singleRelationshipCount)}</strong></div>
                <div className="kpi-card" style={{ margin: 0 }}><small>وابستگی تک‌شخص</small><strong>{fmtNum(leverage.kpis?.singlePersonCount)}</strong></div>
              </div>
              <div className="attr-grid">
                {(leverage.exposures ?? []).map((x: any) => (
                  <div key={x.relationshipId} className="kpi-card" style={{ margin: 0, borderColor: x.share >= 40 ? 'color-mix(in srgb, var(--red,#dc2626) 40%, transparent)' : undefined }}>
                    <small>{x.relationshipName}</small>
                    <strong>{fmtMoney(x.revenueAtRisk)}</strong>
                    <span className="t-muted" style={{ fontSize: 10 }}>
                      {fmtNum(x.openCount)} فرصت باز · سهم {fmtNum(x.share)}٪ از سبد · ریسک {fmtNum(x.riskScore)} · {x.classLabel}
                    </span>
                  </div>
                ))}
              </div>
              {(leverage.singlePeople ?? []).length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <b style={{ fontSize: 11.5 }}>تک‌شخص‌ها (اگر بروند؟)</b>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {(leverage.singlePeople ?? []).map((p: any) => (
                      <span key={p.personId} className="chip danger" title={`${p.relationships.length} رابطه · ${fmtMoney(p.revenueAtRisk)} در معرض ریسک`}>
                        {p.name} ({p.organization}) — {fmtMoney(p.revenueAtRisk)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(leverage.alternatives ?? []).length > 0 && (
                <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                  <b style={{ fontSize: 11.5 }}>اقدام جایگزین</b>
                  {(leverage.alternatives ?? []).map((a: any) => (
                    <div key={a.relationshipId} className="wf-alert" role="note">
                      <Link className="t-primary" href={`/relationships/${a.relationshipId}`}>{a.relationshipName}</Link>
                      <span style={{ flex: 1 }} />
                      {a.originalKeyPerson && <span className="chip neutral">مالک: {a.originalKeyPerson.name}</span>}
                      {Array.isArray(a.backupKeyPersons) && a.backupKeyPersons.length > 0 && <span className="chip info">جانشین: {a.backupKeyPersons.map((p: any) => p.name).join('، ')}</span>}
                      {a.alternatePath && <span className="chip success">{a.alternatePath.hops} پرش · امتیاز {a.alternatePath.score}</span>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ۱) سیگنال‌های ریسک */}
          <section className="panel">
            <div className="panel-title">
              <div><h2>سیگنال‌های ریسک</h2><p>هر سیگنال از شواهد عینیِ همین داده‌ها ساخته شده است</p></div>
              <Badge>{fmtNum(data.riskSignals.length)}</Badge>
            </div>
            {data.riskSignals.length === 0 ? (
              <p className="empty-state"><CheckCircle2 size={18} /> سیگنال فعالی نیست — هیچ رابطه‌ای شواهد ریسک ندارد.</p>
            ) : (
              <div className="list">
                {data.riskSignals.map(s => (
                  <div className="listRow signal-card" key={s.id} style={{ alignItems: 'flex-start' }}>
                    <Badge tone={SEV_TONE[s.severity] ?? 'neutral'}>ریسک {SEV_LABEL[s.severity]}</Badge>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 13 }}>
                        {s.relationshipId && s.relationship
                          ? <Link className="t-primary" href={`/relationships/${s.relationshipId}`}>{s.relationship.name}</Link>
                          : s.title}
                      </strong>
                      {(s.scores?.riskScore != null || s.scores?.healthScore != null) && (
                        <small style={{ display: 'block', margin: '2px 0 4px' }}>
                          ریسک {fmtNum(s.scores?.riskScore)} · سلامت {fmtNum(s.scores?.healthScore)} · تاب‌آوری {fmtNum(s.scores?.resilienceScore)}
                        </small>
                      )}
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(s.evidence ?? []).map((ev, i) => <EvidenceLine key={i} ev={ev} />)}
                      </span>
                    </span>
                    <span className="t-muted" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>{fmtDateTime(s.detectedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ۲) کشف فرصت */}
          <div className="split-panels">
            <section className="panel">
              <div className="panel-title"><div><h2>فرصت‌های در جریان</h2><p>مرتب‌شده بر اساس امتیاز (احتمال و ارزش)</p></div><Badge>{fmtNum(tracking.length)}</Badge></div>
              {tracking.length === 0 ? <p className="empty-state"><Lightbulb size={18} /> فرصت بازی در جریان نیست.</p> : (
                <div className="list">
                  {tracking.map(o => (
                    <div className="listRow" key={o.id} style={{ alignItems: 'flex-start' }}>
                      <span className={`opp-score ${(o.score ?? 0) >= 70 ? 'hi' : (o.score ?? 0) >= 40 ? 'mid' : 'lo'}`}>{fmtNum(o.score)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {o.opportunityId
                          ? <Link className="t-primary" href={`/opportunities/${o.opportunityId}`} style={{ fontSize: 13 }}>{o.title}</Link>
                          : <strong style={{ fontSize: 13 }}>{o.title}</strong>}
                        <small style={{ display: 'block', marginTop: 2 }}>{o.reason}</small>
                        <small style={{ display: 'block' }}>
                          {o.stage ? <Badge tone={o.stage === 'ACTIVE' ? 'warning' : 'neutral'}>{STAGE_LABEL[o.stage] ?? fa(o.stage)}</Badge> : null}
                          {o.relationshipName ? <Link className="t-muted" href={`/relationships/${o.relationshipId}`} style={{ fontSize: 10.5 }}> {o.relationshipName}</Link> : null}
                        </small>
                      </span>
                      <span className="cell-count" style={{ whiteSpace: 'nowrap', fontSize: 11 }}><Coins size={12} /> {fmtMoney(o.expectedValue ?? o.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panel-title"><div><h2>پیشنهاد رشد</h2><p>روابطِ آمادهٔ فرصت که اکنون فرصت باز ندارند</p></div><Badge>{fmtNum(growth.length)}</Badge></div>
              {growth.length === 0 ? <p className="empty-state"><TrendingUp size={18} /> پیشنهادی برای رشد نیست.</p> : (
                <div className="list">
                  {growth.map(o => (
                    <div className="listRow" key={o.id} style={{ alignItems: 'flex-start' }}>
                      <span className={`opp-score ${(o.score ?? 0) >= 70 ? 'hi' : 'mid'}`}>{fmtNum(o.score)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: 13 }}>{o.title}</strong>
                        <small style={{ display: 'block', marginTop: 2 }}>{o.reason}</small>
                        <small style={{ display: 'block' }}>
                          {o.relationshipId ? <Link className="t-primary" href={`/relationships/${o.relationshipId}`} style={{ fontSize: 10.5 }}><Link2 size={10} style={{ verticalAlign: '-1px' }} /> مشاهدهٔ رابطه</Link> : null}
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ۳) پوشش راهبردی */}
          {coverage && (
            <section className="panel">
              <div className="panel-title">
                <div><h2>پوشش راهبردی</h2><p>روابط استراتژیک (امتیاز راهبردی ≥ ۶۰) و شکاف‌های عملیاتی آن‌ها</p></div>
                <Badge>{fmtNum(coverage.coveragePercent)}٪</Badge>
              </div>
              <div className="kpi-grid">
                <div className="kpi-card"><small>روابط استراتژیک</small><strong>{fmtNum(coverage.strategicRelationships)}</strong></div>
                <div className="kpi-card"><small>تحت پوشش عملیاتی</small><strong>{fmtNum(coverage.coveredStrategicRelationships)}</strong></div>
                <div className="kpi-card"><small>سالم (سلامت ≥ ۶۰)</small><strong>{fmtNum(coverage.healthyStrategicRelationships)}</strong></div>
                <div className="kpi-card"><small>تاب‌آور (تاب‌آوری ≥ ۶۰)</small><strong>{fmtNum(coverage.resilientStrategicRelationships)}</strong></div>
                <div className="kpi-card"><small>سازمان‌های درگیر</small><strong>{fmtNum(coverage.scopeOrganizations)}</strong></div>
              </div>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr><th>رابطه</th><th>وضعیت</th><th>استراتژیک</th><th>سلامت</th><th>تاب‌آوری</th><th>معیارها</th><th>پوشش</th><th></th></tr>
                  </thead>
                  <tbody>
                    {coverage.relationships.map(r => (
                      <tr key={r.id} className={!r.covered ? 'row-alert' : ''}>
                        <td><Link className="t-primary" href={`/relationships/${r.id}`}>{r.name}</Link>
                          {!r.covered && r.coverageGaps && r.coverageGaps.length > 0 && (
                            <div className="t-muted" style={{ fontSize: 10.5 }}>{r.coverageGaps.map(g => g.title).join('؛ ')}</div>
                          )}
                        </td>
                        <td><Badge tone={r.status === 'WATCH' ? 'danger' : 'neutral'}>{fa(r.status)}</Badge></td>
                        <td><strong style={{ fontSize: 12.5 }}>{fmtNum(r.strategicScore)}</strong></td>
                        <td><span className={r.healthScore != null && r.healthScore < 60 ? 'h-crit' : ''} style={{ fontWeight: 700 }}>{fmtNum(r.healthScore)}</span></td>
                        <td><span style={{ fontWeight: 700 }}>{fmtNum(r.resilienceScore)}</span></td>
                        <td>
                          {r.criteria?.coverage != null ? (
                            <span title={r.criteria.rankable ? 'قابل رتبه‌بندی' : 'داده ناکافی — قابل مقایسه نیست'}>
                              <strong style={{ fontSize: 12.5 }}>{fmtNum(r.criteria.effectiveScore ?? r.criteria.rankingScore ?? 0)}</strong>
                              <span className="t-muted" style={{ display: 'block', fontSize: 10.5 }}>{fmtNum(r.criteria.coverage)}٪ اطلاعات{r.criteria.rankable ? ' · رتبه‌پذیر' : ' · ناقص'}</span>
                            </span>
                          ) : <span className="t-muted">—</span>}
                        </td>
                        <td>{r.covered
                          ? <Badge tone="success"><CheckCircle2 size={11} /> تحت پوشش</Badge>
                          : <Badge tone="warning"><AlertTriangle size={11} /> شکاف</Badge>}
                        </td>
                        <td><Link className="row-action" href={`/relationships/${r.id}`} aria-label={`مشاهدهٔ ${r.name}`}><ChevronLeft size={16} /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ۴) هوشمندی شبکه */}
          {net && (
            <div className="split-panels">
              <section className="panel">
                <div className="panel-title"><div><h2>مرکزیت شبکه</h2><p>{fmtNum(net.nodes.length)} سازمان و {fmtNum(net.edges)} رابطه</p></div><Network size={16} style={{ color: 'var(--text-muted)' }} /></div>
                {net.centrality.length === 0 ? <p className="empty-state">شبکه‌ای برای تحلیل نیست.</p> : (
                  <div className="list">
                    {net.centrality.map((x: any) => (
                      <div className="listRow" key={x.node.id}>
                        <span style={{ flex: 1 }}><strong style={{ fontSize: 12.5 }}>{x.node.name}</strong></span>
                        <span className="cell-count"><GitBranch size={12} /> {fmtNum(x.degree)} رابطه</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="panel">
                <div className="panel-title"><div><h2>افراد پل</h2><p>حضور در جلساتِ سازمان‌های دیگر</p></div><User size={16} style={{ color: 'var(--text-muted)' }} /></div>
                {net.bridgePeople.length === 0 ? <p className="empty-state">فرد پلی ثبت نشده است.</p> : (
                  <div className="list">
                    {net.bridgePeople.map((x: any) => (
                      <div className="listRow" key={x.person.id}>
                        <span style={{ flex: 1 }}>
                          <Link className="t-primary" href={`/people/${x.person.id}`} style={{ fontSize: 12.5 }}>{x.person.name}</Link>
                          <small>{x.person.organization ?? '—'}</small>
                        </span>
                        <span style={{ textAlign: 'end' }}>
                          <Badge>{fmtNum(x.bridgeScore)} پل</Badge>
                          <small style={{ display: 'block' }}>{x.orgs.map((o: any) => o.name).join('، ')}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
          {net && (
            <section className="panel">
              <div className="panel-title">
                <div><h2>گلوگاه‌ها و نقاط تک‌خطا</h2><p>گره‌هایی که حذفشان شبکه را قطعه‌قطعه می‌کند</p></div>
                <Badge>{fmtNum(net.bottlenecks.length)}</Badge>
              </div>
              {net.bottlenecks.length === 0 ? <p className="empty-state"><Network size={18} /> شبکه گلوگاه ساختاری ندارد.</p> : (
                <div className="list">
                  {net.bottlenecks.map((x: any) => (
                    <div className="listRow" key={x.node.id}>
                      <span className="health-dot" style={{ background: 'var(--srip-danger)' }} />
                      <span style={{ flex: 1 }}>
                        <strong style={{ fontSize: 12.5 }}>{x.node.name}</strong>
                        <small>{x.bottleneckScore >= 2
                          ? `نقطهٔ تک‌خطا: حذف این گره شبکه را ${fmtNum(x.bottleneckScore)} بخشِ جدا از هم می‌کند`
                          : `حذف این گره شبکه را ${fmtNum(x.bottleneckScore)} بخشِ جدا از هم می‌کند`}
                          {x.riskyConnections ? ` · ${fmtNum(x.riskyConnections)} اتصال پُرریسک` : ''}</small>
                      </span>
                      <span className="cell-count"><Zap size={12} /> گلوگاه</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="t-muted" style={{ fontSize: 10.5, marginTop: 8 }}>
                <ArrowUpRight size={11} style={{ verticalAlign: '-1px' }} /> تحلیل روی گراف روابطِ همین محدوده انجام می‌شود؛ «آریا فناوری» به‌عنوان گرهٔ مرکزی، هر بار حذفش بیشترین قطعه‌قطعه‌شدن را ایجاد می‌کند.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
