'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiPost } from '../_lib/api';
import { Badge, ErrorCard, Loading, PageHeader, StatCard } from '../_components/page-ui';
import {
  Activity, BarChart3, Bell, BellRing, Building2, CalendarDays, Compass, FileText,
  FlaskConical, FolderKanban, GitBranch, Handshake ,  Network, RefreshCw,
  Send, Sparkles, Target, ThumbsUp, Users, Zap,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  تحلیل محصول — مصرف محدوده‌بندی‌شده، شبکهٔ راهبردی، گردش کار و قیف  */
/* ------------------------------------------------------------------ */

const fmt = new Intl.NumberFormat('fa-IR');
const fmt1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const faDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fa-IR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};

const FEATURE_FA: Record<string, string> = {
  network_explorer: 'کاوشگر شبکه', smart_search: 'جستجوی هوشمند', meeting_briefs: 'خلاصهٔ هوشمند جلسات',
  executive_brief: 'گزارش راهبردی', recommendations: 'پیشنهادهای هوشمند', workflow_executions: 'اجرای گردش کار',
};
const STAGE_FA: Record<string, string> = {
  viewed: 'دیده‌شده', accepted: 'پذیرفته‌شده', actionCreated: 'اقدام ساخته‌شده', actionCompleted: 'اقدام انجام‌شده', outcome: 'ثبت نتیجه',
};
const CONV_FA: Record<string, { from: string; to: string }> = {
  viewedToAcceptedPct: { from: 'دیده‌شده', to: 'پذیرفته‌شده' },
  acceptedToActionCreatedPct: { from: 'پذیرفته‌شده', to: 'اقدام ساخته‌شده' },
  actionCreatedToCompletedPct: { from: 'اقدام ساخته‌شده', to: 'انجام‌شده' },
  completedToOutcomePct: { from: 'انجام‌شده', to: 'نتیجه' },
};
const WF_META: Record<string, { fa: string; color: string }> = {
  RUNNING: { fa: 'در حال اجرا', color: '#2563eb' }, WAITING: { fa: 'در انتظار', color: '#d97706' },
  COMPLETED: { fa: 'تکمیل‌شده', color: '#16a34a' }, FAILED: { fa: 'ناموفق', color: '#dc2626' },
  REJECTED: { fa: 'ردشده', color: '#64748b' },
};
const COMP_ORDER = {
  relationshipQuality: 'کیفیت رابطه', influence: 'نفوذ', strategicValue: 'ارزش راهبردی',
  opportunityPotential: 'پتانسیل فرصت', resilience: 'تاب‌آوری', coverage: 'پوشش شبکه',
  diversity: 'تنوع', engagement: 'درگیری', riskAdjusted: 'تعدیل‌شده با ریسک',
} as const;
const RING_COLOR = (v: number) => (v >= 70 ? '#16a34a' : v >= 45 ? '#d97706' : '#dc2626');

type Summary = { generatedAt: string; windowDays: number; counts: Record<string, number>; engagement: { activeUsers30d: number; featureUsage: { feature: string; count: number }[]; recommendationAcceptance: number; recommendationAcceptanceRate: number; successfulConnections: number; relationshipUpdates: number } };
type Network = { generatedAt: string; organizationId: string | null; relationshipCount: number; peopleCount: number; opportunityCount: number; networkCapital: { score: number; components: Record<string, number> }; strategicRelationshipIndex: { score: number; breakdown: Record<string, number> }; relationshipResilienceScore: number; weightedOpportunityValue: number; referralSuccessRate: { total: number; successful: number; rate: number }; bounded: boolean };
type Funnel = { generatedAt: string; from: string; to: string; stages: Record<string, number>; conversion: Record<string, number>; overall: Record<string, number> };
type Me = { permissions?: string[]; memberships?: { organizationName?: string; role?: string; isPrimary?: boolean }[] };

function Ring({ value, size = 104, stroke = 10, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const v = Math.min(100, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="ring" style={{ position: 'relative', display: 'inline-grid', placeItems: 'center', width: size, height: size }} role="img" aria-label={`${label ?? 'امتیاز'} ${fmt.format(Math.round(v))} از ۱۰۰`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING_COLOR(v)} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} strokeLinecap="round" />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <b style={{ fontSize: 21, lineHeight: 1 }}>{fmt.format(Math.round(v))}</b>
        <small style={{ fontSize: 8.5, color: 'var(--muted, #64748b)', display: 'block' }}>از ۱۰۰</small>
      </span>
    </span>
  );
}
function MiniBars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5 }}>
          <span style={{ width: 92, flex: '0 0 auto', color: 'var(--muted,#64748b)', textAlign: 'left' }}>{k}</span>
          <span style={{ flex: 1, background: 'color-mix(in srgb, var(--border,#e2e8f0) 55%, transparent)', borderRadius: 99, height: 6 }}>
            <span style={{ display: 'block', width: `${Math.round((v / max) * 100)}%`, height: 6, borderRadius: 99, background: `linear-gradient(90deg, ${RING_COLOR(v)}55, ${RING_COLOR(v)})` }} />
          </span>
          <b style={{ width: 28, textAlign: 'left', fontSize: 10.5 }}>{fmt.format(Math.round(v))}</b>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState<Summary | null>(null);
  const [net, setNet] = useState<Network | null>(null);
  const [wf, setWf] = useState<{ generatedAt?: string; executions: { status: string; count: number }[] } | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState<{ ok: boolean; text: string } | null>(null);
  const [customType, setCustomType] = useState('');
  const [customFeature, setCustomFeature] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError('');
    try {
      const [s, n, w, f, m] = await Promise.all([
        api<Summary>('/analytics/summary'), api<Network>('/analytics/network'), api<{ generatedAt?: string; executions: { status: string; count: number }[] }>('/analytics/workflows'),
        api<Funnel>('/analytics/recommendations/funnel'), api<Me>('/auth/me').catch(() => null),
      ]);
      setData(s); setNet(n); setWf(w); setFunnel(f); setMe(m);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const canWrite = useMemo(() => {
    const perms = me?.permissions ?? [];
    return perms.includes('*') || perms.includes('analytics.write');
  }, [me]);
  const scopeLabel = useMemo(() => {
    if (me == null) return null;
    if ((me.permissions ?? []).includes('*')) return 'همهٔ سازمان‌ها (مالک)';
    const primary = (me.memberships ?? []).find(m => m.isPrimary) ?? (me.memberships ?? [])[0];
    return primary ? primary.organizationName ?? null : null;
  }, [me]);

  async function sendEvent(type: string, feature: string, e?: { preventDefault: () => void }) {
    if (e) e.preventDefault();
    if (!type.trim() || !feature.trim()) { setSent({ ok: false, text: 'نوع و نام قابلیت هر دو لازم هستند.' }); return; }
    setSaving(true); setSent(null);
    try {
      const out = await apiPost<{ id: string; type: string; feature: string }>('/analytics/events', { type: type.trim(), feature: feature.trim() });
      setSent({ ok: true, text: `رویداد ${out.type} برای «${out.feature}» ثبت شد (${out.id.slice(0, 10)}…). در مصرف ۳۰روزه بازتاب یافت.` });
      if (out.feature === 'network_explorer' || out.feature === 'smart_search' || out.feature === 'meeting_briefs' || out.feature === 'executive_brief' || out.feature === 'recommendations') setCustomFeature('');
      setCustomType('');
      await load(true);
    } catch (x) { setSent({ ok: false, text: (x as Error).message }); }
    finally { setSaving(false); }
  }
  const presets = [
    { type: 'FEATURE_VIEWED', feature: 'network_explorer', label: 'کاوشگر شبکه' },
    { type: 'FEATURE_VIEWED', feature: 'smart_search', label: 'جستجوی هوشمند' },
    { type: 'FEATURE_VIEWED', feature: 'meeting_briefs', label: 'خلاصهٔ جلسه' },
    { type: 'FEATURE_VIEWED', feature: 'executive_brief', label: 'گزارش راهبردی' },
  ];

  const counts = data?.counts ?? {};
  const eng = data?.engagement ?? { activeUsers30d: 0, featureUsage: [], recommendationAcceptance: 0, recommendationAcceptanceRate: 0, successfulConnections: 0, relationshipUpdates: 0 };
  const usage = (eng.featureUsage ?? []).slice(0, 6);
  const usageMax = Math.max(1, ...usage.map(u => u.count));
  const stages = funnel?.stages ?? {};
  const stageRows: [string, number][] = ['viewed', 'accepted', 'actionCreated', 'actionCompleted', 'outcome'].map(k => [k, stages[k] ?? 0]);
  const stageMax = Math.max(1, ...stageRows.map(([, v]) => v));
  const wfExecs = (wf?.executions ?? []).sort((a, b) => b.count - a.count);
  const netComp = net?.networkCapital?.components ?? {};
  const breakdown = net?.strategicRelationshipIndex?.breakdown ?? {};

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="هوش تحلیلی محصول"
        title="تحلیل محصول"
        description="مصرف محدوده‌بندی‌شده، درگیری کاربران، سنجه‌های شبکهٔ راهبردی، اجرای گردش‌کارها و قیف پذیرش پیشنهادها — همگی از رویدادهای واقعی سنجش سامانه."
        actions={
          <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
          </button>
        }
      />
      <ErrorCard message={error} />
      {notice && <div className="notice" role="status">{notice}</div>}
      {sent && (
        <div className="notice" role="status" style={sent.ok ? { borderColor: 'var(--green,#16a34a)', color: 'var(--green,#16a34a)' } : { borderColor: 'var(--red,#dc2626)', color: 'var(--red,#dc2626)' }}>
          {sent.ok ? <ThumbsUp size={13} style={{ verticalAlign: -2 }} /> : <BellRing size={13} style={{ verticalAlign: -2 }} />} {sent.text}
        </div>
      )}
      {loading && !data ? <Loading label="در حال محاسبهٔ تحلیل محصول…" /> : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '2px 0 14px' }}>
            {scopeLabel && <Badge tone="info"><Building2 size={11} style={{ verticalAlign: -2 }} /> {scopeLabel}</Badge>}
            <Badge tone="neutral"><BarChart3 size={11} style={{ verticalAlign: -2 }} /> پنجرهٔ {data?.windowDays ?? 30}-روزه</Badge>
            <Badge tone="neutral"><Activity size={11} style={{ verticalAlign: -2 }} /> برآمده در {faDT(data?.generatedAt)}</Badge>
            {net?.bounded && <Badge tone="neutral">محدوده‌بندی سازمانی اعمال شده است</Badge>}
            {canWrite && <Badge tone="warning">مجوز analytics.write فعال</Badge>}
          </div>

          <div className="stat-grid">
            <StatCard icon={<Network size={18} />} label="روابط در محدوده" value={fmt.format(counts.relationships ?? 0)} iconClass="ic-blue" sub="روابط فعالِ داریِ دسترسی" />
            <StatCard icon={<Users size={18} />} label="اشخاص" value={fmt.format(counts.people ?? 0)} iconClass="ic-green" sub="شامل تأمین‌کننده‌ها و مشتریان" />
            <StatCard icon={<Building2 size={18} />} label="سازمان‌ها" value={fmt.format(counts.organizations ?? 0)} iconClass="ic-purple" sub="سازمان‌های داخل محدوده" />
            <StatCard icon={<Target size={18} />} label="فرصت‌های ثبت‌شده" value={fmt.format(counts.opportunities ?? 0)} iconClass="ic-gold" sub="همهٔ وضعیت‌ها در سبد" />
          </div>

          <div className="grid2" style={{ alignItems: 'stretch' }}>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><BarChart3 size={16} /> جریان عملیات</h2>
                  <p>حجم دادهٔ عاملِ تحلیل در محدودهٔ سازمانی شما.</p>
                </div>
                <Badge tone="info">{fmt.format((counts.organizations ?? 0) + (counts.people ?? 0) + (counts.relationships ?? 0))} موجودیت</Badge>
              </div>
              <div className="metric-list">
                <div><span><CalendarDays size={13} style={{ verticalAlign: -2 }} /> جلسات</span><strong>{fmt.format(counts.meetings ?? 0)}</strong></div>
                <div><span><Zap size={13} style={{ verticalAlign: -2 }} /> اقدامات</span><strong>{fmt.format(counts.actions ?? 0)}</strong></div>
                <div><span><Handshake size={13} style={{ verticalAlign: -2 }} /> تعهدات</span><strong>{fmt.format(counts.commitments ?? 0)}</strong></div>
                <div><span><FolderKanban size={13} style={{ verticalAlign: -2 }} /> پروژه‌ها</span><strong>{fmt.format(counts.projects ?? 0)}</strong></div>
                <div><span><GitBranch size={13} style={{ verticalAlign: -2 }} /> اجراهای گردش کار</span><strong>{fmt.format(counts.workflowExecutions ?? 0)}</strong></div>
                <div><span><Bell size={13} style={{ verticalAlign: -2 }} /> اعلان‌ها</span><strong>{fmt.format(counts.notifications ?? 0)}</strong></div>
                <div>
                  <span><BellRing size={13} style={{ verticalAlign: -2 }} /> اعلان‌های خوانده‌نشده</span>
                  <strong>{(counts.unreadNotifications ?? 0) > 0 ? <Badge tone="danger">{fmt.format(counts.unreadNotifications ?? 0)}</Badge> : fmt.format(0)}</strong>
                </div>
              </div>
            </section>

            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Activity size={16} /> درگیری کاربران (۳۰ روز)</h2>
                  <p>از رویدادهای سنجش: کاربر فعال، پذیرش پیشنهاد، اتصال موفق و به‌روزرسانی رابطه.</p>
                </div>
                <Badge tone="info">{fmt.format(eng.activeUsers30d ?? 0)} کاربر فعال</Badge>
              </div>
              <div className="kpi-grid">
                <div className="kpi-card"><small>پذیرش پیشنهاد</small><strong>{fmt.format(eng.recommendationAcceptance ?? 0)}</strong></div>
                <div className="kpi-card"><small>اتصال موفق</small><strong>{fmt.format(eng.successfulConnections ?? 0)}</strong></div>
                <div className="kpi-card"><small>به‌روزرسانی رابطه</small><strong>{fmt.format(eng.relationshipUpdates ?? 0)}</strong></div>
              </div>
              <h3 className="t-muted" style={{ fontSize: 11.5, fontWeight: 600, margin: '14px 0 8px' }}>مصرف قابلیت‌ها</h3>
              {usage.length === 0 ? <p className="t-muted" style={{ fontSize: 11 }}>رویداد مصرفی در این پنجره ثبت نشده است.</p> : (
                <div style={{ display: 'grid', gap: 7 }}>
                  {usage.map(u => (
                    <div key={u.feature} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5 }}>
                      <span style={{ width: 110, flex: '0 0 auto', color: 'var(--muted,#64748b)' }}>{FEATURE_FA[u.feature] ?? u.feature}</span>
                      <span style={{ flex: 1, background: 'color-mix(in srgb, var(--border,#e2e8f0) 55%, transparent)', borderRadius: 99, height: 7 }}>
                        <span style={{ display: 'block', width: `${Math.round((u.count / usageMax) * 100)}%`, height: 7, borderRadius: 99, background: 'linear-gradient(90deg,#3b82f655,#3b82f6)' }} />
                      </span>
                      <b style={{ width: 30, textAlign: 'left', fontSize: 10.5 }}>{fmt.format(u.count)}</b>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {net && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Network size={16} /> شبکهٔ راهبردی</h2>
                  <p>نمرهٔ سرمایهٔ شبکه، شاخص راهبردی رابطه و مؤلفه‌ها — محاسبه از میانگین امتیاز روابط در محدوده ({fmt.format(net.relationshipCount)} رابطه · {fmt.format(net.peopleCount)} شخص · {fmt.format(net.opportunityCount)} فرصت).</p>
                </div>
                <Badge tone="info">سرمایهٔ شبکه: {fmt.format(net.networkCapital?.score ?? 0)}</Badge>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 26, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: '1 1 250px', minWidth: 250 }}>
                  <Ring value={net.networkCapital?.score ?? 0} label="سرمایهٔ شبکه" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 12 }}>مؤلفه‌های سرمایهٔ شبکه</b>
                    <div style={{ marginTop: 7 }}><MiniBars rows={(Object.keys(COMP_ORDER) as (keyof typeof COMP_ORDER)[]).map(k => [COMP_ORDER[k], netComp[k] ?? 0] as [string, number])} /></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: '1 1 230px', minWidth: 230 }}>
                  <Ring value={net.strategicRelationshipIndex?.score ?? 0} size={84} stroke={8} label="شاخص راهبردی رابطه" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 12 }}>شاخص راهبردی رابطه (SRI)</b>
                    <div style={{ marginTop: 7 }}><MiniBars rows={[['پوشش', breakdown.coverage ?? 0], ['قدرت', breakdown.strength ?? 0], ['نفوذ', breakdown.influence ?? 0], ['فرصت', breakdown.opportunity ?? 0], ['تاب‌آوری', breakdown.resilience ?? 0]]} /></div>
                  </div>
                </div>
                <div style={{ flex: '1 1 210px', minWidth: 210, display: 'grid', gap: 10, alignContent: 'start' }}>
                  <div className="kpi-card" style={{ margin: 0 }}>
                    <small>موفقیت معرفی‌ها</small>
                    <strong>{fmt1.format(net.referralSuccessRate?.rate ?? 0)}٪</strong>
                    <span className="t-muted" style={{ fontSize: 10 }}>{fmt.format(net.referralSuccessRate?.successful ?? 0)} موفق از {fmt.format(net.referralSuccessRate?.total ?? 0)} معرفی</span>
                  </div>
                  <div className="kpi-card" style={{ margin: 0 }}>
                    <small>ارزش وزنی فرصت‌ها</small>
                    <strong>{fmt1.format((net.weightedOpportunityValue ?? 0) / 1e9)}</strong>
                    <span className="t-muted" style={{ fontSize: 10 }}>میلیارد تومان (احتمال‌وزنی)</span>
                  </div>
                  <div className="kpi-card" style={{ margin: 0 }}>
                    <small>تاب‌آوری رابطه</small>
                    <strong>{fmt.format(net.relationshipResilienceScore ?? 0)}</strong>
                    <span className="t-muted" style={{ fontSize: 10 }}>نمرهٔ مقاومت شبکه در برابر شوک</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {wfExecs.length > 0 && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><GitBranch size={16} /> اجراهای گردش کار</h2>
                  <p>توزیع وضعیت اجراهای ثبت‌شده (پایان‌ناپذیر نیست؛ آخرین بازخوانی {faDT(wf?.generatedAt)}).</p>
                </div>
                <Badge tone="info">{fmt.format(wfExecs.reduce((s, x) => s + x.count, 0))} اجرا</Badge>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {wfExecs.map(x => {
                  const meta = WF_META[x.status] ?? { fa: x.status, color: '#64748b' };
                  return (
                    <span key={x.status} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--border,#e2e8f0)', borderRadius: 12, padding: '7px 12px', background: 'color-mix(in srgb, var(--border,#e2e8f0) 25%, transparent)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: meta.color }} />
                      <b style={{ fontSize: 11.5 }}>{meta.fa}</b>
                      <span className="t-muted" style={{ fontSize: 11 }}>{fmt.format(x.count)}</span>
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          {funnel && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Sparkles size={16} /> قیف پذیرش پیشنهادهای هوشمند</h2>
                  <p>از پیشنهادِ دیده‌شده تا ثبت نتیجه، در بازهٔ {faDT(funnel.from)} تا {faDT(funnel.to)} — شمارش با شناسهٔ پیشنهاد (تک‌شمار).</p>
                </div>
                <Badge tone="info">نرخ پذیرش: {fmt1.format(funnel.overall?.acceptedPct ?? 0)}٪</Badge>
              </div>
              <div style={{ display: 'grid', gap: 7, marginBottom: 12 }}>
                {stageRows.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
                    <span style={{ width: 96, flex: '0 0 auto', color: 'var(--muted,#64748b)' }}>{STAGE_FA[k]}</span>
                    <span style={{ flex: 1, background: 'color-mix(in srgb, var(--border,#e2e8f0) 55%, transparent)', borderRadius: 8, height: 22, overflow: 'hidden', display: 'block' }}>
                      <span style={{ display: 'flex', alignItems: 'center', height: 22, width: `${stageMax ? Math.round((v / stageMax) * 100) : 0}%`, borderRadius: 8, background: `linear-gradient(90deg, ${RING_COLOR(Math.round((v / stageMax) * 100))}44, ${RING_COLOR(v > 0 ? 90 : 0)}dd)` }} />
                    </span>
                    <b style={{ width: 22, textAlign: 'left' }}>{fmt.format(v)}</b>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {Object.entries(funnel.conversion ?? {}).map(([k, v]) => {
                  const c = CONV_FA[k];
                  return <Badge key={k} tone="neutral">{c?.from ?? k} ← {c?.to ?? ''}: <b>{fmt1.format(v)}٪</b></Badge>;
                })}
              </div>
              <p className="t-muted" style={{ fontSize: 10.5, margin: 0 }}>
                از کل دیده‌شده‌ها: پذیرش {fmt1.format(funnel.overall?.acceptedPct ?? 0)}٪ · ساخت اقدام {fmt1.format(funnel.overall?.actionCreatedPct ?? 0)}٪ · انجام {fmt1.format(funnel.overall?.actionCompletedPct ?? 0)}٪ · نتیجه {fmt1.format(funnel.overall?.outcomePct ?? 0)}٪
              </p>
            </section>
          )}

          {canWrite && (
            <section className="panel" style={{ borderColor: 'color-mix(in srgb, var(--green,#16a34a) 30%, transparent)' }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><FlaskConical size={16} /> ثبت رویداد سنجش (analytics.write)</h2>
                  <p>رویداد با مجوز analytics.write در ممیزیِ رویدادها ذخیره و در مصرف قابلیت‌ها و شمارش‌های ۳۰روزه بازتاب می‌یابد (پاریتی POST /analytics/events).</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {presets.map(p => (
                  <button key={p.feature} className="btn btn-ghost" style={{ minHeight: 0, padding: '6px 10px', fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    disabled={saving} onClick={() => sendEvent(p.type, p.feature)}>
                    {p.feature === 'network_explorer' ? <Compass size={12} /> : p.feature === 'smart_search' ? <Sparkles size={12} /> : p.feature === 'meeting_briefs' ? <FileText size={12} /> : <BarChart3 size={12} />}
                    {p.label}
                  </button>
                ))}
              </div>
              <form className="entity-form" onSubmit={e => sendEvent(customType, customFeature, e)} style={{ gap: 8 }}>
                <div className="field">
                  <label className="field-label" htmlFor="an-type">نوع رویداد (type)</label>
                  <input id="an-type" dir="ltr" value={customType} onChange={e => setCustomType(e.target.value)} placeholder="FEATURE_VIEWED" style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10.5 }} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="an-feat">قابلیت (feature)</label>
                  <input id="an-feat" dir="ltr" value={customFeature} onChange={e => setCustomFeature(e.target.value)} placeholder="network_explorer" style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10.5 }} />
                </div>
                <button className="btn btn-primary" style={{ alignSelf: 'flex-end', padding: '9px 16px', minHeight: 0 }} disabled={saving}>
                  {saving ? 'در حال ثبت…' : <><Send size={14} /> ثبت رویداد</>}
                </button>
              </form>
            </section>
          )}

          {!canWrite && me != null && (
            <div className="notice">حساب شما مجوز «ثبت رویداد سنجش» (analytics.write) را ندارد؛ مشاهدهٔ تحلیل‌ها با مجوز analytics.read فعال است.</div>
          )}
        </>
      )}
    </main>
  );
}
