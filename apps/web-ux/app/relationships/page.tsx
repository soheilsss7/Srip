'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CriteriaBadge, CriteriaIntake, intakePayload, verdictTone, type AnswerMap, type Summary as CriteriaSummary } from '../_components/criteria';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Card } from '@srip/design-system';
import { Badge } from '../_components/page-ui';
import { Modal } from '../_components/page-ui';
import {
  Share2, Building2, Search, Plus, ShieldAlert, Target, ChevronLeft,
  ArrowDownWideNarrow, AlertTriangle, CalendarClock, TrendingUp, Gauge, Store, Globe, Landmark, DoorOpen, Siren, Filter, Briefcase, Layers,
} from 'lucide-react';
import { localeTag, lt, t } from '../_lib/i18n';

type Org = { id: string; name: string; type: string };
type Rel = {
  criteria?: CriteriaSummary | null;
  id: string;
  relationshipType: string;
  status: string;
  healthScore?: number;
  strategicScore?: number;
  riskScore?: number;
  lastInteractionAt?: string;
  nextActionAt?: string;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  sourceOrganization?: { id: string; name: string; type: string };
  targetOrganization?: { id: string; name: string; type: string };
  owner?: { id: string; name: string };
  backupOwner?: { id: string; name: string };
  cadence?: { cadenceDays: number; daysSinceLastInteraction: number; status: 'FRESH' | 'WARN' | 'CRITICAL'; overdueDays: number; dueAt?: string };
  // market
  marketKind?: 'MARKET' | 'NON_MARKET' | 'HYBRID';
  isMarketEntry?: boolean;
  marketSegment?: string | null;
  // P1
  capital?: { strength: number; influence: number; potential: number; capital: number; valueAtRisk: number; openValue: number; openCount: number };
  currentScore?: number;
  delta90d?: number;
  trend?: 'UP' | 'DOWN' | 'FLAT';
  confidence?: number;
  classLabel?: string;
  plan?: { exists: boolean; status?: string; openCount?: number; overdue?: number };
};
type RelType = { key: string; name?: string };
type AlertItem = { id: string; relationshipId?: string; tone: 'danger'|'warning'|'info'; kind: string; title: string; body: string; marketKind?: string; isMarketEntry?: boolean; segment?: string|null };

const REL_TYPE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  STRATEGIC_PARTNERSHIP: 'success', BANKING: 'info', CUSTOMER: 'success',
  SUPPLY: 'warning', SUPPLIER: 'warning', INVESTMENT: 'warning',
  PARTNER: 'info', GOVERNMENT: 'neutral', INVESTOR: 'warning',
};
const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success', PROSPECTIVE: 'info', WATCH: 'warning', AT_RISK: 'danger',
  DORMANT: 'neutral', ARCHIVED: 'neutral',
};
const MARKET_TONE: Record<string, 'success'|'info'|'warning'|'neutral'> = {
  MARKET: 'success', NON_MARKET: 'info', HYBRID: 'warning',
};
const MARKET_LABEL: Record<string, string> = lt( { MARKET:t('بازاری'), NON_MARKET:t('غیربازاری'), HYBRID:t('دوگانه') });
const MARKET_ICON: Record<string, React.ReactNode> = {
  MARKET: <Store size={11} />, NON_MARKET: <Landmark size={11} />, HYBRID: <Layers size={11} />,
};
const SORTS = lt([
  { value: 'healthScore', label: t('ضعیف‌ترین سلامت اول') },
  { value: 'riskScore', label: t('بیشترین ریسک اول') },
  { value: 'strategicScore', label: t('بیشترین ارزش راهبردی') },
  { value: 'lastInteractionAt', label: t('قدیمی‌ترین تعامل') },
  { value: 'nextActionAt', label: t('نزدیک‌ترین اقدام بعدی') },
  { value: 'coverage', label: t('ارزیابی ناقص‌تر اول') },
] as const);
type SortKey = typeof SORTS[number]['value'];

const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat(localeTag()).format(v);

function healthBand(h: number | null): { label: string; cls: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' } {
  if (h == null) return { label: t('ثبت نشده'), cls: 'h-null', tone: 'neutral' };
  if (h >= 75) return { label: t('سالم'), cls: 'h-hi', tone: 'success' };
  if (h >= 55) return { label: t('پایدار'), cls: 'h-mid', tone: 'info' };
  if (h >= 40) return { label: t('در معرض ریسک'), cls: 'h-low', tone: 'warning' };
  return { label: t('بحرانی'), cls: 'h-crit', tone: 'danger' };
}
function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 0) return '—';
  if (d === 0) return t('امروز');
  if (d === 1) return t('دیروز');
  if (d < 30) return fmtNum(d) + t('روز پیش');
  if (d < 365) return fmtNum(Math.floor(d / 30)) + t('ماه پیش');
  return fmtNum(Math.floor(d / 365)) + t('سال پیش');
}
function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(localeTag(), { month: 'short', day: 'numeric' });
}

export default function RelationshipsPage() {
  const { scopeId, can } = useWorkspace();
  const writable = can('relationship.write');

  const [items, setItems] = useState<Rel[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [relTypes, setRelTypes] = useState<RelType[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertSummary, setAlertSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [marketFilter, setMarketFilter] = useState<'all'|'MARKET'|'NON_MARKET'|'HYBRID'>('all');
  const [entryOnly, setEntryOnly] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('healthScore');

  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [kind, setKind] = useState('');
  const [marketKind, setMarketKind] = useState<'MARKET'|'NON_MARKET'|'HYBRID'>('MARKET');
  const [isEntry, setIsEntry] = useState(false);
  const [segment, setSegment] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [intake, setIntake] = useState<AnswerMap>({});

  const load = useCallback(async () => {
    try {
      setError('');
      if (!items.length) setLoading(true);
      const params = new URLSearchParams();
      if (scopeId !== 'all') params.set('organizationId', scopeId);
      // فیلترهای سرور
      if (marketFilter !== 'all') params.set('marketKind', marketFilter);
      if (entryOnly) params.set('isMarketEntry', 'true');
      if (segmentFilter) params.set('marketSegment', segmentFilter);
      const qs = params.toString();
      const [data, cap, al] = await Promise.all([
        api<{ data: Rel[] }>(`/relationships${qs ? `?${qs}` : ''}`),
        api<{ items: any[] }>(`/relationships/capital`).catch(() => null),
        api<{ items: AlertItem[]; summary:any }>(`/relationships/alerts`).catch(()=>null),
      ]);
      const rows = Array.isArray(data) ? data as Rel[] : data.data ?? [];
      if (cap?.items?.length) {
        const byId = new Map(cap.items.map((c: any) => [c.relationshipId, c]));
        rows.forEach((r) => {
          const c = byId.get(r.id);
          if (c) { r.capital = c; r.currentScore = c.currentScore; r.delta90d = c.delta90d; r.trend = c.trend; r.confidence = c.confidence; r.classLabel = c.classLabel; r.plan = c.plan; }
        });
      }
      setItems(rows);
      if (al) { setAlerts(al.items ?? []); setAlertSummary(al.summary ?? null); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [scopeId, marketFilter, entryOnly, segmentFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!writable) return;
    Promise.all([
      api<{ data: Org[] }>('/organizations'),
      api<{ data: RelType[] }>('/core-domain/relationship-types'),
    ]).then(([o, t]) => {
      setOrgs(Array.isArray(o) ? o as Org[] : o.data ?? []);
      setRelTypes(Array.isArray(t) ? t as RelType[] : t.data ?? []);
    }).catch(() => {});
  }, [writable]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writable) return;
    setFormError('');
    if (source === target) { setFormError(t('سازمان مبدأ و مقصد نمی‌توانند یکسان باشند.')); return; }
    setSaving(true); setError('');
    try {
      await api('/relationships', { method: 'POST', body: JSON.stringify({ sourceOrganizationId: source, targetOrganizationId: target, relationshipType: kind, marketKind, isMarketEntry: isEntry, marketSegment: segment || null, criteriaAnswers: intakePayload(intake) }) });
      setSource(''); setTarget(''); setKind(''); setMarketKind('MARKET'); setIsEntry(false); setSegment(''); setIntake({}); setCreateOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally { setSaving(false); }
  };

  const counts = useMemo(() => {
    const healthHi = items.filter(r => (r.healthScore ?? 0) >= 75).length;
    const atRisk = items.filter(r => (r.riskScore ?? 0) >= 40 || (r.healthScore ?? 100) < 55).length;
    const strategic = items.filter(r => (r.strategicScore ?? 0) >= 75).length;
    const active = items.filter(r => r.status === 'ACTIVE').length;
    const avgHealth = items.length ? Math.round(items.reduce((a, r) => a + (r.healthScore ?? 0), 0) / items.length) : null;
    const overdueNext = items.filter(r => r.nextActionAt && new Date(r.nextActionAt).getTime() < Date.now()).length;
    const market = items.filter(r => r.marketKind === 'MARKET' || !r.marketKind).length;
    const nonMarket = items.filter(r => r.marketKind === 'NON_MARKET').length;
    const hybrid = items.filter(r => r.marketKind === 'HYBRID').length;
    const entries = items.filter(r => r.isMarketEntry).length;
    return { total: items.length, healthHi, atRisk, strategic, active, avgHealth, overdueNext, market, nonMarket, hybrid, entries };
  }, [items]);

  const capTotals = useMemo(() => {
    const n = items.filter(r => r.capital || r.currentScore != null).length || 1;
    const total = items.reduce((s, r) => s + (r.capital?.capital ?? 0), 0);
    return {
      count: items.length,
      capital: total,
      avgCapital: Math.round(total / n || 0),
      up: items.filter(r => r.trend === 'UP').length,
      down: items.filter(r => r.trend === 'DOWN').length,
      flat: items.filter(r => r.trend === 'FLAT').length,
      avgDelta: Math.round(items.reduce((s, r) => s + (r.delta90d ?? 0), 0) / n),
      withPlan: items.filter(r => r.plan?.exists).length,
      needsAttention: items.filter(r => r.plan?.exists && r.plan.status !== 'ON_TRACK').length,
      avgConfidence: Math.round(items.reduce((s, r) => s + (r.confidence ?? 0), 0) / n),
    };
  }, [items]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = items.filter((r) => {
      const a = r.sourceOrganization?.name ?? '';
      const b = r.targetOrganization?.name ?? '';
      if (typeFilter && r.relationshipType !== typeFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (marketFilter !== 'all' && (r.marketKind ?? 'MARKET') !== marketFilter) return false;
      if (entryOnly && !r.isMarketEntry) return false;
      if (segmentFilter && !(r.marketSegment ?? '').includes(segmentFilter)) return false;
      if (term && !`${a} ${b} ${r.owner?.name ?? ''} ${r.marketSegment??''}`.toLowerCase().includes(term)) return false;
      return true;
    });
    return [...filtered].sort((x, y) => {
      switch (sortBy) {
        case 'riskScore': return (y.riskScore ?? -1) - (x.riskScore ?? -1);
        case 'strategicScore': return (y.strategicScore ?? -1) - (x.strategicScore ?? -1);
        case 'lastInteractionAt': return (x.lastInteractionAt ?? '9999').localeCompare(y.lastInteractionAt ?? '9999');
        case 'coverage': return (x.criteria?.coverage ?? -1) - (y.criteria?.coverage ?? -1);
        case 'nextActionAt': return (x.nextActionAt ?? '9999').localeCompare(y.nextActionAt ?? '9999');
        default: return (x.healthScore ?? 101) - (y.healthScore ?? 101);
      }
    });
  }, [items, q, typeFilter, statusFilter, marketFilter, entryOnly, segmentFilter, sortBy]);

  const setSel = (k: 'source' | 'target' | 'kind') => (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (k === 'source') setSource(e.target.value);
    else if (k === 'target') setTarget(e.target.value);
    else setKind(e.target.value);
  };
  const orgName = (id: string) => orgs.find(o => o.id === id)?.name ?? '—';
  const uniqueSegments = useMemo(()=> [...new Set(items.map(r=>r.marketSegment).filter(Boolean) as string[])], [items]);

  return (
    <>
      <div className="people-page">
        <section className="page-heading">
          <div>
            <div className="eyebrow">{t('فضای کاری · رابطه‌محور')}</div>
            <h1>{t('روابط سازمانی')}</h1>
            <p className="subtitle">{t('وضعیت واقعی هر رابطه: سلامت، ریسک، آخرین تعامل و اقدام بعدی — حالا با تفکیک')} <b>{t('بازاری / غیربازاری')}</b> {t('و نشان')} <b>{t('نقطهٔ ورود به بازار')}</b>{t('، همراه با هشدارهای هوشمند.')}</p>
          </div>
          <div className="heading-tools">
            <span className="scope-chip"><Building2 size={13} /> {scopeId === 'all' ? t('همهٔ محدوده') : scopeId.slice(0, 12)}</span>
            {writable && <button type="button" className="primary-action" onClick={() => { setError(''); setFormError(''); setCreateOpen(true); }}><Plus size={14} /> {t('ایجاد رابطه')}</button>}
          </div>
        </section>

        {error && <div className="error-card" role="alert">{error}</div>}

        {/* هشدارهای هوشمند بازاری / غیربازاری */}
        {alerts.length > 0 && (
          <section className="alert-strip" aria-label={t('هشدارهای روابط')} style={{borderColor: alertSummary?.danger ? 'var(--danger)' : undefined}}>
            <div className="alert-strip-head">
              <span className="alert-ico"><Siren size={14} /></span>
              <strong>{t('هشدارهای هوشمند — بازاری / غیربازاری و نقاط ورود')}</strong>
              <span className="chip danger">{fmtNum(alertSummary?.danger)} بحرانی</span>
              <span className="chip warning">{fmtNum(alertSummary?.warning)} هشدار</span>
              <span className="chip info">{fmtNum(counts.entries)} نقطهٔ ورود</span>
            </div>
            <div className="alert-strip-list">
              {alerts.slice(0,4).map(a=>(
                <Link key={a.id} className={`alert-pill ${a.tone==='danger'?'ap-danger':a.tone==='warning'?'ap-warning':'ap-info'}`} href={a.relationshipId ? `/relationships/${a.relationshipId}` : '/relationships'}>
                  <span className="alert-pill-name">{a.title}</span>
                  <span className="alert-pill-meta">{a.marketKind ? MARKET_LABEL[a.marketKind] : ''}{a.isMarketEntry ? t('· نقطهٔ ورود') : ''}{a.segment ? ` · ${a.segment}` : ''}</span>
                  <span className="alert-pill-why">{a.body}</span>
                </Link>
              ))}
            </div>
            {alerts.length>4 && <div className="t-muted" style={{marginTop:6, fontSize:12}}>و {fmtNum(alerts.length-4)} هشدار دیگر — همه در جدول زیر با فیلتر «نقطهٔ ورود» قابل بررسی‌اند.</div>}
          </section>
        )}

        {/* آمارکارت‌های تفکیکی */}
        <section className="stats-row" aria-label={t('شاخص‌های روابط')}>
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-teal"><Share2 size={18} /></span><span className="st-name">{t('کل روابط')}</span></div>
            <strong className="st-value">{fmtNum(counts.total)}</strong>
            <div className="st-foot"><span className="st-delta up">{fmtNum(counts.active)} فعال · {fmtNum(counts.entries)} نقطهٔ ورود</span></div>
          </div>
          <div className="stat-card" style={{borderColor: counts.market ? undefined : 'var(--border)'}}>
            <div className="st-top"><span className="st-ico ic-blue"><Store size={18} /></span><span className="st-name">{t('بازاری')}</span></div>
            <strong className="st-value">{fmtNum(counts.market)}</strong>
            <div className="st-foot"><span className="st-delta">{t('مستقیم در زنجیرهٔ ارزش/مبادله')}</span></div>
          </div>
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-purple"><Landmark size={18} /></span><span className="st-name">{t('غیربازاری')}</span></div>
            <strong className="st-value">{fmtNum(counts.nonMarket)}</strong>
            <div className="st-foot"><span className="st-delta">{t('نهاد/تنظیم‌گر/رسانه — شکل‌دهندهٔ بازار')}</span></div>
          </div>
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-gold"><DoorOpen size={18} /></span><span className="st-name">{t('نقطهٔ ورود به بازار')}</span></div>
            <strong className="st-value">{fmtNum(counts.entries)}</strong>
            <div className="st-foot"><span className="st-delta down">{fmtNum(counts.hybrid)} هیبرید · {fmtNum(counts.atRisk)} در معرض ریسک</span></div>
          </div>
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-red"><ShieldAlert size={18} /></span><span className="st-name">{t('در معرض ریسک')}</span></div>
            <strong className="st-value">{fmtNum(counts.atRisk)}</strong>
            <div className="st-foot"><span className="st-delta down">{t('ریسک ۴۰+ یا سلامت زیر ۵۵')}</span></div>
          </div>
        </section>

        <section className="panel" aria-label={t('نقشهٔ بازار')}>
          <div className="panel-title">
            <div><h2><Globe size={16} style={{display:'inline', verticalAlign:'middle', marginLeft:6}}/> {t('نقشهٔ بازار — کجا ورود ما به بازار است؟')}</h2><p>{t('هر سگمنت بازار یک «نقطهٔ ورود» می‌خواهد. روابط')} <b>{t('بازاری')}</b> {t('ارزش می‌سازند، روابط')} <b>{t('غیربازاری')}</b> {t('مسیر را باز یا مسدود می‌کنند. هیبرید هر دو نقش را دارد.')}</p></div>
            <Link className="head-link" href="/network">{t('دیدن در شبکه ←')}</Link>
          </div>
          <div className="stats-row" style={{ margin: 0 }}>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-teal"><Briefcase size={16} /></span><span className="st-name">{t('سگمنت‌های پوشش‌داده‌شده')}</span></div>
              <strong className="st-value">{fmtNum(uniqueSegments.length)}</strong>
              <div className="st-foot" style={{flexWrap:'wrap', gap:4, display:'flex'}}>{uniqueSegments.slice(0,6).map(s=> <span key={s} className="chip info" style={{fontSize:11}}>{s}</span>)} {uniqueSegments.length===0 && <span className="t-muted">{t('هنوز سگمنتی ثبت نشده')}</span>}</div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-blue"><DoorOpen size={16} /></span><span className="st-name">{t('ورودی‌های بازاری')}</span></div>
              <strong className="st-value">{fmtNum(items.filter(r=>r.isMarketEntry && r.marketKind==='MARKET').length)}</strong>
              <div className="st-foot"><span className="t-muted">{t('مستقیماً معامله/پروژه/تأمین')}</span></div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-purple"><Landmark size={16} /></span><span className="st-name">{t('ورودی‌های غیربازاری')}</span></div>
              <strong className="st-value">{fmtNum(items.filter(r=>r.isMarketEntry && r.marketKind==='NON_MARKET').length)}</strong>
              <div className="st-foot"><span className="t-muted">{t('مجوز/تنظیم‌گری/اعتبار')}</span></div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-gold"><Siren size={16} /></span><span className="st-name">{t('هشدار ورودی‌ها')}</span></div>
              <strong className="st-value">{fmtNum(alerts.filter(a=>a.isMarketEntry && (a.tone==='danger'||a.tone==='warning')).length)}</strong>
              <div className="st-foot"><span className="st-delta down">{fmtNum(alerts.filter(a=>a.kind==='MISSING_ENTRY').length)} سگمنت بدون ورودی</span></div>
            </div>
          </div>
          <div className="t-muted" style={{marginTop:10, fontSize:12, lineHeight:1.8}}>
            <b>{t('راهنما:')}</b> <span className="chip success">{t('بازاری')}</span> = مشتری/تأمین‌کننده/شریک تجاری/سرمایه‌گذار/بانک — پول/کالا/خدمت جابه‌جا می‌شود. <span className="chip info">{t('غیربازاری')}</span> = دولت/نهاد ناظر/رسانه/NGO/انجمن — مجوز، اعتبار یا مانع می‌سازد. <span className="chip warning">{t('هیبرید')}</span> = هر دو (مثل بانک توسعه‌ای). ستارهٔ <DoorOpen size={11} style={{display:'inline'}}/> یعنی «اینجا دروازهٔ ما به آن سگمنت است».
          </div>
        </section>

        <section className="panel" aria-label={t('پورتفوی روابط (P1)')}>
          <div className="panel-title">
            <div><h2>{t('پورتفوی رابطه — سرمایه، روند و برنامهٔ ۹۰ روزه')}</h2><p>سرمایهٔ رابطه = قدرت × نفوذ × پتانسیل؛ روند Δ۹۰ روزه با اعتماد؛ برنامهٔ ۹۰ روزه کِی‌اِی‌اِم</p></div>
          </div>
          <div className="stats-row" style={{ margin: 0 }}>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-teal"><Target size={17} /></span><span className="st-name">{t('سرمایهٔ رابطهٔ پرتفوی')}</span></div>
              <strong className="st-value">{fmtNum(capTotals.capital)}</strong>
              <div className="st-foot"><span className="st-delta up">میانگین {fmtNum(capTotals.avgCapital)} از ۱۰۰</span></div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-blue"><TrendingUp size={17} /></span><span className="st-name">{t('روند ۹۰ روزه')}</span></div>
              <strong className="st-value">{fmtNum(capTotals.up)} ↑ · {fmtNum(capTotals.down)} ↓</strong>
              <div className="st-foot"><span className="st-delta">{fmtNum(capTotals.flat)} پایدار · میانگین تغییر {capTotals.avgDelta > 0 ? `+${fmtNum(capTotals.avgDelta)}` : fmtNum(capTotals.avgDelta)}</span></div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-gold"><CalendarClock size={17} /></span><span className="st-name">{t('برنامهٔ ۹۰ روزه')}</span></div>
              <strong className="st-value">{fmtNum(capTotals.withPlan)} از {fmtNum(capTotals.count)}</strong>
              <div className="st-foot"><span className={`st-delta ${capTotals.needsAttention ? 'down' : 'up'}`}>{fmtNum(capTotals.needsAttention)} نیازمند توجه</span></div>
            </div>
            <div className="stat-card">
              <div className="st-top"><span className="st-ico ic-purple"><Gauge size={17} /></span><span className="st-name">{t('اعتماد امتیازها')}</span></div>
              <strong className="st-value">{fmtNum(capTotals.avgConfidence)}٪</strong>
              <div className="st-foot"><span className="st-delta">{t('ترکیب منابع و تازگی شواهد')}</span></div>
            </div>
          </div>
        </section>

        <Card className="rel-directory">
          <div className="panel-title">
            <div><h2>{t('فهرست روابط')}</h2><p>{t('تفکیک بازاری/غیربازاری و نقطهٔ ورود — روی هر ردیف بزنید تا جزئیات، تاریخچه و برنامه ۹۰ روزه را ببینید')}</p></div>
            <div className="table-toolbar" style={{flexWrap:'wrap', gap:8}}>
              <div className="search-box">
                <Search size={15} />
                <input placeholder={t('جستجوی سازمان، مالک یا سگمنت…')} value={q} onChange={e => setQ(e.target.value)} aria-label={t('جستجو')} />
              </div>
              <select aria-label={t('فیلتر نوع رابطه')} value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="toolbar-select">
                <option value="">{t('همهٔ انواع')}</option>
                {[...new Set(items.map(r => r.relationshipType))].sort().map(t => <option key={t} value={t}>{fa(t)}</option>)}
              </select>
              <select aria-label={t('فیلتر وضعیت')} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
                <option value="">{t('همهٔ وضعیت‌ها')}</option>
                {[...new Set(items.map(r => r.status))].sort().map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select>
              <select aria-label={t('فیلتر بازاری/غیربازاری')} value={marketFilter} onChange={e => setMarketFilter(e.target.value as any)} className="toolbar-select" style={{minWidth:140}}>
                <option value="all">{t('همهٔ بازارها')}</option>
                <option value="MARKET">{t('بازاری')}</option>
                <option value="NON_MARKET">{t('غیربازاری')}</option>
                <option value="HYBRID">{t('دوگانه')}</option>
              </select>
              <label className="chip" style={{cursor:'pointer', userSelect:'none', display:'inline-flex', alignItems:'center', gap:6, border: entryOnly?'1px solid var(--primary)':'1px solid var(--border)'}}>
                <input type="checkbox" checked={entryOnly} onChange={e=>setEntryOnly(e.target.checked)} style={{accentColor:'var(--primary)'}}/>
                <DoorOpen size={12}/> فقط نقاط ورود
              </label>
              {uniqueSegments.length>0 && (
                <select aria-label={t('فیلتر سگمنت')} value={segmentFilter} onChange={e=>setSegmentFilter(e.target.value)} className="toolbar-select">
                  <option value="">{t('همهٔ سگمنت‌ها')}</option>
                  {uniqueSegments.map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <label className="toolbar-sort" aria-label={t('مرتب‌سازی')}>
                <ArrowDownWideNarrow size={14} />
                <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}>
                  {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <span className="chip info">{fmtNum(visible.length)} نتیجه</span>
            </div>
          </div>

          {loading ? (
            <div className="loading-row"><span className="spinner" /> {t('در حال بارگذاری…')}</div>
          ) : visible.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('رابطه (مبدأ ↔ مقصد) · سگمنت بازار')}</th>
                    <th>{t('جنسیت بازار')}</th>
                    <th>{t('نوع / وضعیت')}</th>
                    <th>{t('سلامت')}</th>
                    <th>{t('ریسک')}</th>
                    <th>{t('اقدام بعدی')}</th>
                    <th>{t('آخرین تعامل')}</th>
                    <th>{t('سرمایه · روند')}</th>
                    <th>{t('برنامهٔ ۹۰ روزه')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => {
                    const band = healthBand(r.healthScore ?? null);
                    const risk = r.riskScore ?? null;
                    const nextDue = r.nextActionAt ? new Date(r.nextActionAt).getTime() : null;
                    const overdue = nextDue != null && nextDue < Date.now();
                    const mk = (r.marketKind ?? 'MARKET') as string;
                    return (
                      <tr key={r.id} className={risk != null && risk >= 60 ? 'row-alert' : r.isMarketEntry ? 'row-entry' : ''} style={r.isMarketEntry ? {background:'var(--bg-subtle)'}: undefined}>
                        <td>
                          <Link className="t-primary" href={`/relationships/${r.id}`} style={{display:'inline-flex', alignItems:'center', gap:6}}>
                            {r.isMarketEntry && <span title={t('نقطهٔ ورود به بازار')} style={{color:'var(--gold)', display:'inline-flex'}}><DoorOpen size={14}/></span>}
                            {r.sourceOrganization?.name ?? '—'} <span className="t-muted">↔</span> {r.targetOrganization?.name ?? '—'}
                          </Link>
                          <div className="t-muted" style={{fontSize:12, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap'}}>
                            {r.marketSegment ? <span className="chip" style={{fontSize:11}}><Briefcase size={11}/> {r.marketSegment}</span> : <span className="t-muted">{t('بدون سگمنت')}</span>}
                            {r.isMarketEntry && <span className="chip warning" style={{fontSize:11}}><DoorOpen size={11}/> {t('ورودی بازار')}</span>}
                          </div>
                          <div className="t-muted" style={{fontSize:12}}>{r.owner?.name ? `${t('مالک:')} ${r.owner.name}` : t('بدون مالک')}</div>
                          <div className="rel-criteria-row">
                            <CriteriaBadge criteria={r.criteria} />
                            {r.criteria?.verdictLabel && (
                              <span className={`chip ${verdictTone(r.criteria.verdict)}`}>{r.criteria.verdictLabel}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`chip ${MARKET_TONE[mk] ?? 'neutral'}`} style={{display:'inline-flex', alignItems:'center', gap:4}}>
                            {MARKET_ICON[mk]} {MARKET_LABEL[mk] ?? fa(mk)}
                          </span>
                        </td>
                        <td>
                          <div className="rel-badges" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            <Badge tone={REL_TYPE_TONE[r.relationshipType] ?? 'neutral'}>{fa(r.relationshipType)}</Badge>
                            <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{fa(r.status)}</Badge>
                          </div>
                        </td>
                        <td>
                          {r.healthScore == null ? <span className="t-muted">—</span> : (
                            <span className="health-cell" title={`${t('ارزش راهبردی')} ${fmtNum(r.strategicScore)}`}>
                              <span className={`health-dot ${band.cls}`} />
                              <span className="health-bar"><span className={`health-fill ${band.cls}`} style={{ width: `${r.healthScore}%` }} /></span>
                              <b className={`health-num ${band.cls}`}>{fmtNum(r.healthScore)}</b>
                              <small className={`health-band ${band.cls}`}>{band.label}</small>
                            </span>
                          )}
                        </td>
                        <td>
                          {risk == null ? <span className="t-muted">—</span> : (
                            <span className={`risk-cell ${risk >= 60 ? 'risk-hi' : risk >= 40 ? 'risk-mid' : 'risk-lo'}`}>
                              {risk >= 40 && <AlertTriangle size={12} />}{fmtNum(risk)}
                            </span>
                          )}
                        </td>
                        <td>
                          {r.nextActionAt ? (
                            <span className={`cell-count ${overdue ? 'danger' : 'info'}`}>
                              <CalendarClock size={12} /> {fmtDate(r.nextActionAt)}{overdue ? t('· عقب‌افتاده') : ''}
                            </span>
                          ) : <span className="t-muted">—</span>}
                        </td>
                        <td>
                          <div className="t-muted">{timeAgo(r.lastInteractionAt)}</div>
                          {r.cadence && (
                            <span className={`cell-count ${r.cadence.status === 'CRITICAL' ? 'danger' : r.cadence.status === 'WARN' ? 'warning' : 'info'}`} title={`${t('هدف کیدنس: هر')} ${fmtNum(r.cadence.cadenceDays)} ${t('روز')}`}>
                              <CalendarClock size={11} /> {r.cadence.status === 'FRESH' ? `${t('در کیدنس')}` : r.cadence.status === 'WARN' ? `${fmtNum(r.cadence.overdueDays)} ${t('روز عقب')}` : `${t('شکسته')}`}
                            </span>
                          )}
                        </td>
                        <td>
                          {r.currentScore != null ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className={`cell-count ${r.trend === 'DOWN' ? 'danger' : r.trend === 'UP' ? 'success' : 'info'}`} title={`${t('امتیاز')} ${fmtNum(r.currentScore)} · Δ ${r.delta90d}`}>
                                {r.trend === 'UP' ? <TrendingUp size={13} /> : r.trend === 'DOWN' ? <AlertTriangle size={12} /> : <Gauge size={12} />}
                                {fmtNum(r.delta90d)}{r.trend === 'UP' ? ' ↗' : r.trend === 'DOWN' ? ' ↘' : ''} · {fmtNum(r.capital?.capital ?? 0)}
                              </span>
                            </div>
                          ) : <span className="t-muted">—</span>}
                          {r.classLabel && <div className="t-muted" style={{ fontSize: 11 }}>{r.classLabel} · {fmtNum(r.confidence)}٪</div>}
                        </td>
                        <td>
                          {r.plan?.exists ? (
                            <span className={`cell-count ${r.plan.status === 'ON_TRACK' ? 'success' : 'warning'}`}>
                              <CalendarClock size={12} /> {fa(r.plan.status)}{r.plan.overdue ? ` · ${fmtNum(r.plan.overdue)} ${t('عقب')}` : ''}
                            </span>
                          ) : <span className="t-muted">—</span>}
                        </td>
                        <td>
                          <Link className="row-action" href={`/relationships/${r.id}`} aria-label={`${t('مشاهدهٔ')} ${r.sourceOrganization?.name ?? ''} ${t('و')} ${r.targetOrganization?.name ?? ''}`}>
                            <ChevronLeft size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-people">
              <Share2 size={28} />
              <p>{items.length === 0 ? t('رابطه‌ای در محدودهٔ فعلی ثبت نشده است.') : t('نتیجه‌ای با این فیلترها یافت نشد.')}</p>
              {writable && items.length > 0 && (
                <button type="button" className="srip-button primary" onClick={() => { setError(''); setFormError(''); setCreateOpen(true); }}><Plus size={14} /> {t('ایجاد رابطه')}</button>
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal open={createOpen} title={t('ایجاد رابطه')} description={t('دو سازمان و نوع رابطه را مشخص کنید — جنسیت بازار و نقطهٔ ورود را هم در همین گام تعیین کنید.')} onClose={() => setCreateOpen(false)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>{t('انصراف')}</button>
          <button type="submit" form="relationship-create-form" className="srip-button primary" disabled={saving || !source || !target || !kind}>{saving ? t('در حال ذخیره…') : t('ایجاد رابطه')}</button>
        </>}>
        <form id="relationship-create-form" className="entity-form org-form" onSubmit={create}>
          {formError && <div className="error-card" role="alert">{formError}</div>}
          <div className="form-section-head"><h3>{t('طرفین رابطه')}</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="rel-source">{t('سازمان مبدأ')} <span className="req">*</span></label>
              <select id="rel-source" value={source} onChange={setSel('source')} required>
                <option value="">{t('انتخاب کنید…')}</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}{o.type ? ` — ${fa(o.type)}` : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="rel-target">{t('سازمان مقصد')} <span className="req">*</span></label>
              <select id="rel-target" value={target} onChange={setSel('target')} required>
                <option value="">{t('انتخاب کنید…')}</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}{o.type ? ` — ${fa(o.type)}` : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="form-section-head"><h3>{t('نوع و جنسیت بازار')}</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label">{t('نوع رابطه *')}</label>
              <select value={kind} onChange={setSel('kind')} required>
                <option value="">{t('انتخاب کنید…')}</option>
                {relTypes.map(t => <option key={t.key} value={t.key}>{t.name || fa(t.key)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="rel-marketKind">{t('جنسیت بازار *')}</label>
              <select id="rel-marketKind" value={marketKind} onChange={e=>setMarketKind(e.target.value as any)} required>
                <option value="MARKET">{t('بازاری — در زنجیرهٔ ارزش/مبادله (مشتری/تأمین‌کننده/شریک/بانک)')}</option>
                <option value="NON_MARKET">{t('غیربازاری — نهاد قدرت/تنظیم‌گر/رسانه (شکل‌دهندهٔ بازار)')}</option>
                <option value="HYBRID">{t('دوگانه (هیبرید) — هم مبادله، هم نهاد')}</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="rel-segment">{t('سگمنت / بازار هدف')}</label>
              <input id="rel-segment" value={segment} onChange={e=>setSegment(e.target.value)} placeholder={t('مثلاً: پتروشیمی جنوب، بانکداری شرکتی، مجوز دولتی…')} maxLength={120}/>
              <span className="field-hint">{t('برای گزارش «کجا ورود ما به بازار است» — سگمنت را دقیق بنویسید.')}</span>
            </div>
            <div className="field" style={{display:'flex', alignItems:'end'}}>
              <label className="checkbox-field" style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
                <input type="checkbox" checked={isEntry} onChange={e=>setIsEntry(e.target.checked)} />
                <span><DoorOpen size={13} style={{display:'inline', verticalAlign:'middle'}}/> {t('این رابطه «نقطهٔ ورود ما به بازار» است')}</span>
              </label>
            </div>
          </div>
          <div className="t-muted" style={{fontSize:12, lineHeight:1.7, background:'var(--bg-subtle)', padding:10, borderRadius:8, marginTop:8}}>
            <b>{t('راهنما:')}</b> <span className="chip success">{t('بازاری')}</span> {t('را وقتی بزنید که پول/کالا/خدمت مستقیم ردوبدل می‌شود.')} <span className="chip info">{t('غیربازاری')}</span> وقتی که طرف مقابل مجوز/اعتبار/مانع می‌سازد بدون خریدوفروش (دولت، ناظر، رسانه). تیک «ورودی بازار» فقط برای دروازه‌های اصلی بزنید — هشدارهای ویژه برای همین‌ها فعال می‌شود.
          </div>
          <div className="form-section-head" style={{marginTop:16}}><h3>{t('معیارهای ارزیابی')}</h3></div>
          <CriteriaIntake subjectType="RELATIONSHIP" answers={intake} onChange={setIntake} heading={t('آنچه همین حالا از این رابطه می‌دانید (اختیاری)')} />
        </form>
      </Modal>
    </>
  );
}
