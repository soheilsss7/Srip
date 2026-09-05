'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Card } from '@srip/design-system';
import { Badge } from '../_components/page-ui';
import { Modal } from '../_components/page-ui';
import {
  Share2, Building2, Search, Plus, ShieldAlert, Target, ChevronLeft,
  ArrowDownWideNarrow, AlertTriangle, CalendarClock,
} from 'lucide-react';

type Org = { id: string; name: string; type: string };
type Rel = {
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
};
type RelType = { key: string; name?: string };

const REL_TYPE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  STRATEGIC_PARTNERSHIP: 'success', BANKING: 'info', CUSTOMER: 'success',
  SUPPLY: 'warning', SUPPLIER: 'warning', INVESTMENT: 'warning',
  PARTNER: 'info', GOVERNMENT: 'neutral', INVESTOR: 'warning',
};
const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success', PROSPECTIVE: 'info', WATCH: 'warning', AT_RISK: 'danger',
  DORMANT: 'neutral', ARCHIVED: 'neutral',
};
const SORTS = [
  { value: 'healthScore', label: 'ضعیف‌ترین سلامت اول' },
  { value: 'riskScore', label: 'بیشترین ریسک اول' },
  { value: 'strategicScore', label: 'بیشترین ارزش راهبردی' },
  { value: 'lastInteractionAt', label: 'قدیمی‌ترین تعامل' },
  { value: 'nextActionAt', label: 'نزدیک‌ترین اقدام بعدی' },
] as const;
type SortKey = typeof SORTS[number]['value'];

const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);

function healthBand(h: number | null): { label: string; cls: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' } {
  if (h == null) return { label: 'ثبت نشده', cls: 'h-null', tone: 'neutral' };
  if (h >= 75) return { label: 'سالم', cls: 'h-hi', tone: 'success' };
  if (h >= 55) return { label: 'پایدار', cls: 'h-mid', tone: 'info' };
  if (h >= 40) return { label: 'در معرض ریسک', cls: 'h-low', tone: 'warning' };
  return { label: 'بحرانی', cls: 'h-crit', tone: 'danger' };
}
function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 0) return '—';
  if (d === 0) return 'امروز';
  if (d === 1) return 'دیروز';
  if (d < 30) return fmtNum(d) + ' روز پیش';
  if (d < 365) return fmtNum(Math.floor(d / 30)) + ' ماه پیش';
  return fmtNum(Math.floor(d / 365)) + ' سال پیش';
}
function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

export default function RelationshipsPage() {
  const { scopeId, can } = useWorkspace();
  const writable = can('relationship.write');

  const [items, setItems] = useState<Rel[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [relTypes, setRelTypes] = useState<RelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('healthScore');

  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [kind, setKind] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      if (!items.length) setLoading(true);
      const params = new URLSearchParams();
      if (scopeId !== 'all') params.set('organizationId', scopeId);
      const qs = params.toString();
      const data = await api<{ data: Rel[] }>(`/relationships${qs ? `?${qs}` : ''}`);
      setItems(Array.isArray(data) ? data as Rel[] : data.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (source === target) { setFormError('سازمان مبدأ و مقصد نمی‌توانند یکسان باشند.'); return; }
    setSaving(true); setError('');
    try {
      await api('/relationships', { method: 'POST', body: JSON.stringify({ sourceOrganizationId: source, targetOrganizationId: target, relationshipType: kind }) });
      setSource(''); setTarget(''); setKind(''); setCreateOpen(false);
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
    return { total: items.length, healthHi, atRisk, strategic, active, avgHealth, overdueNext };
  }, [items]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = items.filter((r) => {
      const a = r.sourceOrganization?.name ?? '';
      const b = r.targetOrganization?.name ?? '';
      if (typeFilter && r.relationshipType !== typeFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (term && !`${a} ${b} ${r.owner?.name ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
    return [...filtered].sort((x, y) => {
      switch (sortBy) {
        case 'riskScore': return (y.riskScore ?? -1) - (x.riskScore ?? -1);
        case 'strategicScore': return (y.strategicScore ?? -1) - (x.strategicScore ?? -1);
        case 'lastInteractionAt': return (x.lastInteractionAt ?? '9999').localeCompare(y.lastInteractionAt ?? '9999');
        case 'nextActionAt': return (x.nextActionAt ?? '9999').localeCompare(y.nextActionAt ?? '9999');
        default: return (x.healthScore ?? 101) - (y.healthScore ?? 101);
      }
    });
  }, [items, q, typeFilter, statusFilter, sortBy]);

  const set = (k: 'source' | 'target' | 'kind') => (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (k === 'source') setSource(e.target.value);
    else if (k === 'target') setTarget(e.target.value);
    else setKind(e.target.value);
  };
  const orgName = (id: string) => orgs.find(o => o.id === id)?.name ?? '—';

  return (
    <>
      <div className="people-page">
        <section className="page-heading">
          <div>
            <div className="eyebrow">فضای کاری · رابطه‌محور</div>
            <h1>روابط سازمانی</h1>
            <p className="subtitle">وضعیت واقعی هر رابطه: سلامت، ریسک، آخرین تعامل و اقدام بعدی — با مالکیت و محدودهٔ سازمانی شما.</p>
          </div>
          <div className="heading-tools">
            <span className="scope-chip"><Building2 size={13} /> {scopeId === 'all' ? 'همهٔ محدوده' : scopeId.slice(0, 12)}</span>
            {writable && <button type="button" className="primary-action" onClick={() => { setError(''); setFormError(''); setCreateOpen(true); }}><Plus size={14} /> ایجاد رابطه</button>}
          </div>
        </section>

        {error && <div className="error-card" role="alert">{error}</div>}

        <section className="stats-row" aria-label="شاخص‌های روابط">
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-teal"><Share2 size={18} /></span><span className="st-name">کل روابط</span></div>
            <strong className="st-value">{fmtNum(counts.total)}</strong>
            <div className="st-foot"><span className="st-delta up">{fmtNum(counts.active)} فعال</span></div>
          </div>
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-blue"><Share2 size={18} /></span><span className="st-name">میانگین سلامت</span></div>
            <strong className="st-value">{fmtNum(counts.avgHealth)}</strong>
            <div className="st-foot"><span className="st-delta up">{fmtNum(counts.healthHi)} سالم</span></div>
          </div>
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-red"><ShieldAlert size={18} /></span><span className="st-name">در معرض ریسک</span></div>
            <strong className="st-value">{fmtNum(counts.atRisk)}</strong>
            <div className="st-foot"><span className="st-delta down">ریسک ۴۰+ یا سلامت زیر ۵۵</span></div>
          </div>
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-gold"><Target size={18} /></span><span className="st-name">راهبردی و معوق</span></div>
            <strong className="st-value">{fmtNum(counts.strategic)}</strong>
            <div className="st-foot"><span className="st-delta">{fmtNum(counts.overdueNext)} اقدام بعدی عقب‌افتاده</span></div>
          </div>
        </section>

        <Card className="rel-directory">
          <div className="panel-title">
            <div><h2>فهرست روابط</h2><p>برای دیدن جزئیات و مدیریت، روی هر ردیف کلیک کنید</p></div>
            <div className="table-toolbar">
              <div className="search-box">
                <Search size={15} />
                <input placeholder="جستجوی نام سازمان یا مالک…" value={q} onChange={e => setQ(e.target.value)} aria-label="جستجوی نام سازمان یا مالک" />
              </div>
              <select aria-label="فیلتر نوع رابطه" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="toolbar-select">
                <option value="">همهٔ انواع</option>
                {[...new Set(items.map(r => r.relationshipType))].sort().map(t => <option key={t} value={t}>{fa(t)}</option>)}
              </select>
              <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
                <option value="">همهٔ وضعیت‌ها</option>
                {[...new Set(items.map(r => r.status))].sort().map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select>
              <label className="toolbar-sort" aria-label="مرتب‌سازی">
                <ArrowDownWideNarrow size={14} />
                <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}>
                  {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <span className="chip info">{fmtNum(visible.length)} نتیجه</span>
            </div>
          </div>

          {loading ? (
            <div className="loading-row"><span className="spinner" /> در حال بارگذاری…</div>
          ) : visible.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>رابطه (مبدأ ← مقصد)</th>
                    <th>نوع / وضعیت</th>
                    <th>سلامت رابطه</th>
                    <th>ریسک</th>
                    <th>اقدام بعدی</th>
                    <th>آخرین تعامل</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => {
                    const band = healthBand(r.healthScore ?? null);
                    const risk = r.riskScore ?? null;
                    const nextDue = r.nextActionAt ? new Date(r.nextActionAt).getTime() : null;
                    const overdue = nextDue != null && nextDue < Date.now();
                    return (
                      <tr key={r.id} className={risk != null && risk >= 60 ? 'row-alert' : ''}>
                        <td>
                          <Link className="t-primary" href={`/relationships/${r.id}`}>
                            {r.sourceOrganization?.name ?? '—'} <span className="t-muted">↔</span> {r.targetOrganization?.name ?? '—'}
                          </Link>
                          <div className="t-muted">{r.owner?.name ? `مالک: ${r.owner.name}` : 'بدون مالک'}</div>
                        </td>
                        <td>
                          <div className="rel-badges" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            <Badge tone={REL_TYPE_TONE[r.relationshipType] ?? 'neutral'}>{fa(r.relationshipType)}</Badge>
                            <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{fa(r.status)}</Badge>
                          </div>
                        </td>
                        <td>
                          {r.healthScore == null ? <span className="t-muted">—</span> : (
                            <span className="health-cell" title={`ارزش راهبردی ${fmtNum(r.strategicScore)}`}>
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
                              <CalendarClock size={12} /> {fmtDate(r.nextActionAt)}{overdue ? ' · عقب‌افتاده' : ''}
                            </span>
                          ) : <span className="t-muted">—</span>}
                        </td>
                        <td className="t-muted">{timeAgo(r.lastInteractionAt)}</td>
                        <td>
                          <Link className="row-action" href={`/relationships/${r.id}`} aria-label={`مشاهدهٔ رابطهٔ ${r.sourceOrganization?.name ?? ''} و ${r.targetOrganization?.name ?? ''}`}>
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
              <p>{items.length === 0 ? 'رابطه‌ای در محدودهٔ فعلی ثبت نشده است.' : 'نتیجه‌ای با این فیلترها یافت نشد.'}</p>
              {writable && items.length > 0 && (
                <button type="button" className="srip-button primary" onClick={() => { setError(''); setFormError(''); setCreateOpen(true); }}><Plus size={14} /> ایجاد رابطه</button>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Create modal */}
      <Modal open={createOpen} title="ایجاد رابطه" description="دو سازمان و نوع رابطه را مشخص کنید — رابطه بلافاصله با وضعیت «فعال» و امتیازهای پیش‌فرض ثبت می‌شود." onClose={() => setCreateOpen(false)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>انصراف</button>
          <button type="submit" form="relationship-create-form" className="srip-button primary" disabled={saving || !source || !target || !kind}>{saving ? 'در حال ذخیره…' : 'ایجاد رابطه'}</button>
        </>}>
        <form id="relationship-create-form" className="entity-form org-form" onSubmit={create}>
          {formError && <div className="error-card" role="alert">{formError}</div>}
          <div className="form-section-head"><h3>طرفین رابطه</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="rel-source">سازمان مبدأ <span className="req">*</span></label>
              <select id="rel-source" value={source} onChange={set('source')} required>
                <option value="">انتخاب کنید…</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}{o.type ? ` — ${fa(o.type)}` : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="rel-target">سازمان مقصد <span className="req">*</span></label>
              <select id="rel-target" value={target} onChange={set('target')} required>
                <option value="">انتخاب کنید…</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}{o.type ? ` — ${fa(o.type)}` : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="form-section-head"><h3>نوع رابطه</h3></div>
          <div className="form-grid">
            <div className="field full">
              <select id="rel-kind" value={kind} onChange={set('kind')} required>
                <option value="">انتخاب کنید…</option>
                {relTypes.map(t => <option key={t.key} value={t.key}>{t.name || fa(t.key)}</option>)}
              </select>
              <span className="field-hint">نوع رابطه تعیین می‌کند که امتیازهای سلامت، ریسک و راهبردی چگونه تفسیر شوند. رابطهٔ «{orgName(source)} ← {orgName(target)}» ثبت خواهد شد.</span>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
