'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { EntityPicker } from '../_components/entity-picker';
import { Card, Badge } from '@srip/design-system';
import {
  Share2, Building2, Users, Search, Plus, Activity, ShieldAlert, Target, User,
  ChevronLeft, ArrowLeftRight, Clock, HeartPulse,
} from 'lucide-react';

type Owner = { id: string; name: string; email?: string };
type Rel = {
  id: string;
  relationshipType: string;
  status: string;
  lifecycleStage?: string;
  healthScore?: number;
  strategicScore?: number;
  riskScore?: number;
  trustScore?: number;
  influenceScore?: number;
  sensitivity?: string;
  lastInteractionAt?: string;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  sourceOrganization?: { id: string; name: string; type: string };
  targetOrganization?: { id: string; name: string; type: string };
  owner?: Owner;
  backupOwner?: Owner;
};
type RelType = { key: string; name?: string };

const REL_TYPE_COLOR: Record<string, string> = {
  STRATEGIC: 'info', COMMERCIAL: 'blue', PARTNER: 'success', SUPPLIER: 'warning', INVESTMENT: 'danger',
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'success', PROSPECTIVE: 'info', AT_RISK: 'danger', DORMANT: 'warning', ARCHIVED: 'neutral',
};

function healthTone(v: number): string { return v >= 75 ? 'hi' : v >= 50 ? 'mid' : 'lo'; }
function Gauge({ value, tone }: { value: number; tone: string }) {
  return (
    <span className={`gauge gauge-${tone}`} style={{ ['--g' as string]: `${Math.max(0, Math.min(100, value))}%` }}>
      <i style={{ height: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

export default function RelationshipsPage() {
  const { scopeId, can, me } = useWorkspace();
  const scopeLabel = me?.memberships.find(m => m.organizationId === scopeId)?.organizationName ?? 'محدوده انتخاب‌شده';
  const writable = can('relationship.write');

  const [items, setItems] = useState<Rel[]>([]);
  const [relTypes, setRelTypes] = useState<RelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'healthScore' | 'strategicScore' | 'riskScore' | 'lastInteractionAt'>('healthScore');

  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [kind, setKind] = useState('');
  const [saving, setSaving] = useState(false);

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
    api<{ data: RelType[] }>('/core-domain/relationship-types').then((t) => setRelTypes(Array.isArray(t) ? t as RelType[] : t.data ?? [])).catch(() => {});
  }, [writable]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writable) return;
    if (!source || !target || source === target) { setError('مبدأ و مقصد باید انتخاب شوند و نمی‌توانند یکسان باشند.'); return; }
    setSaving(true); setError('');
    try {
      await api('/relationships', { method: 'POST', body: JSON.stringify({ sourceOrganizationId: source, targetOrganizationId: target, relationshipType: kind }) });
      setSource(''); setTarget(''); setKind('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally { setSaving(false); }
  };

  const counts = useMemo(() => {
    const health = items.filter(r => (r.healthScore ?? 0) >= 75).length;
    const risk = items.filter(r => (r.riskScore ?? 0) >= 40).length;
    const strategic = items.filter(r => (r.strategicScore ?? 0) >= 75).length;
    const active = items.filter(r => r.status === 'ACTIVE').length;
    const avgHealth = items.length ? Math.round(items.reduce((a, r) => a + (r.healthScore ?? 0), 0) / items.length) : 0;
    const avgRisk = items.length ? Math.round(items.reduce((a, r) => a + (r.riskScore ?? 0), 0) / items.length) : 0;
    return { total: items.length, health, risk, strategic, active, avgHealth, avgRisk };
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
      if (sortBy === 'lastInteractionAt') return (y.lastInteractionAt ?? '').localeCompare(x.lastInteractionAt ?? '');
      return (y[sortBy] ?? 0) - (x[sortBy] ?? 0);
    });
  }, [items, q, typeFilter, statusFilter, sortBy]);

  return (
    <div className="relationships-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">SRIP Workspace · Relationship First</div>
          <h1>روابط سازمانی</h1>
          <p className="subtitle">روابط بین‌سازمانی با سلامت، ارزش راهبردی و ریسک — از Backend واقعی با مالکیت، حساسیت و محدودهٔ سازمانی.</p>
        </div>
        <div className="heading-tools">
          <span className="scope-chip"><Building2 size={13}/> {scopeId === 'all' ? 'همه محدوده' : scopeLabel}</span>
          {writable && <Link className="primary-action" href="#create-relationship"><Plus size={14}/> ایجاد رابطه</Link>}
        </div>
      </section>

      {error && <div className="error-card" role="alert">{error}</div>}

      <section className="stats-row" aria-label="Relationship metrics">
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-teal"><Share2 size={18}/></span><span className="st-name">کل روابط</span></div>
          <strong className="st-value">{counts.total}</strong>
          <div className="st-foot"><span className="st-delta up">{counts.active} فعال</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-blue"><HeartPulse size={18}/></span><span className="st-name">سلامت متوسط</span></div>
          <strong className="st-value">{counts.avgHealth}%</strong>
          <div className="st-foot"><span className="st-delta up">{counts.health} سالم (≥75)</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-red"><ShieldAlert size={18}/></span><span className="st-name">ریسک</span></div>
          <strong className="st-value">{counts.risk}</strong>
          <div className="st-foot"><span className="st-delta down">{counts.avgRisk}% میانگین</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-gold"><Target size={18}/></span><span className="st-name">راهبردی</span></div>
          <strong className="st-value">{counts.strategic}</strong>
          <div className="st-foot"><span className="st-delta up">strategic ≥ 75</span></div>
        </div>
      </section>

      <section className="split-panels">
        <Card className="rel-directory">
          <div className="panel-title">
            <div><h2>Directory</h2><p>qsort بر اساس {sortBy} کاهشی</p></div>
            <div className="table-toolbar">
              <div className="search-box">
                <Search size={15}/>
                <input placeholder="جستجوی سازمان یا مالک…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select aria-label="Type filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">همه انواع</option>
                {[...new Set(items.map(r => r.relationshipType))].sort().map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">همه وضعیت‌ها</option>
                {[...new Set(items.map(r => r.status))].sort().map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select aria-label="Sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="healthScore">مرتب: سلامت</option>
                <option value="strategicScore">مرتب: راهبردی</option>
                <option value="riskScore">مرتب: ریسک</option>
                <option value="lastInteractionAt">مرتب: آخرین تعامل</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-row"><span className="spinner" /> در حال بارگذاری…</div>
          ) : visible.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>رابطه</th>
                    <th>نوع / وضعیت</th>
                    <th className="th-gauges"><span>سلامت</span><span>راهبردی</span><span>ریسک</span></th>
                    <th>مالک</th>
                    <th>آخرین تعامل</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="rel-pair">
                          <div className="rel-org"><strong>{r.sourceOrganization?.name ?? '—'}</strong><small>{r.sourceOrganization?.type ?? ''}</small></div>
                          <span className="rel-swap"><ArrowLeftRight size={13}/></span>
                          <div className="rel-org"><strong>{r.targetOrganization?.name ?? '—'}</strong><small>{r.targetOrganization?.type ?? ''}</small></div>
                        </div>
                      </td>
                      <td>
                        <div className="rel-badges">
                          <Badge className={REL_TYPE_COLOR[r.relationshipType] ?? 'neutral'}>{r.relationshipType}</Badge>
                          <Badge className={STATUS_COLOR[r.status] ?? 'neutral'}>{r.status}</Badge>
                          {r.sensitivity && r.sensitivity !== 'INTERNAL' ? <Badge className="neutral">{r.sensitivity}</Badge> : null}
                        </div>
                      </td>
                      <td>
                        <div className="rel-gauges">
                          <span className="gauge-cell"><Gauge value={r.healthScore ?? 0} tone={healthTone(r.healthScore ?? 0)} /><b className={healthTone(r.healthScore ?? 0)}>{r.healthScore ?? 0}</b></span>
                          <span className="gauge-cell"><Gauge value={r.strategicScore ?? 0} tone={healthTone(r.strategicScore ?? 0)} /><b className={healthTone(r.strategicScore ?? 0)}>{r.strategicScore ?? 0}</b></span>
                          <span className="gauge-cell"><Gauge value={r.riskScore ?? 0} tone={(r.riskScore ?? 0) >= 40 ? 'lo' : (r.riskScore ?? 0) >= 20 ? 'mid' : 'hi'} /><b className={(r.riskScore ?? 0) >= 40 ? 'lo' : (r.riskScore ?? 0) >= 20 ? 'mid' : 'hi'}>{r.riskScore ?? 0}</b></span>
                        </div>
                      </td>
                      <td>
                        <div className="rel-owner">
                          {r.owner?.name ? <><User size={13}/>{r.owner.name}</> : <span className="muted">—</span>}
                        </div>
                      </td>
                      <td>
                        <div className="rel-last">
                          <span className={`rel-last-dot ${isRecent(r.lastInteractionAt) ? 'recent' : ''}`} />
                          <span>{r.lastInteractionAt ? fmtDate(r.lastInteractionAt) : '—'}</span>
                        </div>
                      </td>
                      <td>
                        <Link className="row-action" href={`/relationships/${r.id}`} aria-label={`Open ${r.sourceOrganization?.name} ↔ ${r.targetOrganization?.name}`}>
                          <ChevronLeft size={16}/>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-people">
              <Share2 size={28}/>
              <p>رابطه‌ای در محدودهٔ فعلی یافت نشد.</p>
            </div>
          )}
        </Card>

        {writable && (
          <Card className="rel-create" id="create-relationship">
            <div className="panel-title"><div><h2>ایجاد رابطه</h2><p>مبدأ، مقصد و نوع رابطه</p></div></div>
            <form onSubmit={create} className="form-grid">
              <EntityPicker label="مبدأ" endpoint="/organizations" value={source} onChange={setSource} scopeId={scopeId} required />
              <EntityPicker label="مقصد" endpoint="/organizations" value={target} onChange={setTarget} scopeId={scopeId} required />
              <label className="full">نوع رابطه
                <select value={kind} onChange={(e) => setKind(e.target.value)} required>
                  <option value="">انتخاب کنید</option>
                  {relTypes.map((t) => <option key={t.key} value={t.key}>{t.name || t.key}</option>)}
                </select>
              </label>
              <button className="srip-button primary full" type="submit" disabled={saving}>{saving ? 'در حال ذخیره…' : 'ایجاد رابطه'}</button>
            </form>
          </Card>
        )}
      </section>
    </div>
  );
}

function isRecent(d?: string): boolean {
  if (!d) return false;
  const days = (Date.now() - new Date(d).getTime()) / 86400000;
  return days <= 30;
}
function fmtDate(d: string): string {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'امروز';
  if (days === 1) return 'دیروز';
  if (days < 30) return `${days} روز پیش`;
  return date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
}
