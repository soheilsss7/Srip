'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, apiPost, apiDelete, unwrapList } from '../_lib/api';
import { fa } from '../_lib/fa';
import { Badge, ErrorCard, Loading, Modal, PageHeader, Segmented, StatCard } from '../_components/page-ui';
import {
  AlertTriangle, BadgeCheck, Building2, ClipboardList, FileDown, FileJson2, FileSpreadsheet, FileText,
  Fingerprint, Flag, Landmark, Lock, Pencil, Plus, RefreshCw, Scale, Search, ShieldCheck, ShieldX,
  SlidersHorizontal, Table2, Trash2, X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  حاکمیت سازمانی — پاریتی EnterpriseController                       */
/* ------------------------------------------------------------------ */

const CLASS_FA: Record<string, string> = {
  PUBLIC: 'عمومی', INTERNAL: 'داخلی', CONFIDENTIAL: 'محرمانه', RESTRICTED: 'محدود',
  PRIVATE: 'خصوصی', HIGHLY_CONFIDENTIAL: 'بسیار محرمانه',
};
const CLASS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  PUBLIC: 'success', INTERNAL: 'info', CONFIDENTIAL: 'warning', RESTRICTED: 'warning',
  PRIVATE: 'danger', HIGHLY_CONFIDENTIAL: 'danger',
};
const CLASSIFICATION_OPTIONS = ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'HIGHLY_CONFIDENTIAL'];
const SCOPE_FA: Record<string, string> = {
  ALL: 'همه', ORGANIZATION: 'سازمان', SUBSIDIARIES: 'زیرمجموعه‌ها', DEPARTMENT: 'دپارتمان',
  OWNED: 'تحت مالکیت', SHARED: 'اشتراکی', PRIVATE: 'خصوصی',
};
const SCOPE_OPTIONS = ['ORGANIZATION', 'SUBSIDIARIES', 'DEPARTMENT', 'OWNED', 'SHARED', 'PRIVATE'];
const ROLE_SUGGESTIONS = ['SUPER_ADMIN', 'HOLDING_ADMIN', 'HOLDING_EXECUTIVE', 'SUBSIDIARY_ADMIN', 'SUBSIDIARY_EXECUTIVE', 'RELATIONSHIP_MANAGER', 'PROJECT_MANAGER', 'ANALYST', 'STANDARD_USER', 'READ_ONLY'];
const GROUP_FA: Record<string, string> = {
  General: 'کلی', Admin: 'مدیریت', Security: 'امنیت', DataGovernance: 'حاکمیت داده', Account: 'حساب‌ها',
  Knowledge: 'دانش', Intelligence: 'هوشمندی', Reporting: 'گزارش‌ها', Core: 'هسته', Sales: 'فروش',
};
const EXPORT_TYPE_FA: Record<string, string> = {
  'relationship-health': 'سلامت روابط', company: 'فهرست شرکت‌ها', contact: 'اشخاص و تماس‌ها',
  meeting: 'جلسات', commitment: 'تعهدات', action: 'اقدامات', opportunity: 'فرصت‌ها',
  project: 'پروژه‌ها', network: 'شبکه', risk: 'ریسک‌ها', influence: 'نفوذ اشخاص',
  referral: 'معرفی‌ها', holding: 'هلدینگ', 'subsidiary-comparison': 'مقایسهٔ زیرمجموعه‌ها',
  'executive-summary': 'خلاصهٔ اجرایی', 'data-privacy': 'دادهٔ حریم خصوصی',
};
const EXPORT_FORMATS = ['CSV', 'XLSX', 'PDF', 'JSON'];

type Policy = { id: string; key: string; permissionKey: string; permissionName?: string; effect: string; role?: string | null; roleName?: string | null; organizationId?: string | null; organizationName?: string | null; department?: string | null; maxDataClassification?: string | null; ownerOnly?: boolean; subjectScope?: string | null; conditions?: Record<string, any> | null; enabled?: boolean; createdById?: string | null; createdByName?: string | null; createdAt?: string; updatedAt?: string };
type Flag = { id: string; key: string; enabled: boolean; rollout: number; organizationId?: string | null; description?: string | null; createdAt?: string };
type ExportRow = { id: string; userId?: string; userName?: string | null; userEmail?: string | null; organizationId?: string | null; organizationName?: string | null; exportType: string; entityType?: string | null; recordCount?: number; classification: string; requestId?: string | null; ipAddress?: string | null; createdAt?: string };
type SecEvent = { id: string; type: string; severity?: string; userName?: string | null; userEmail?: string | null; organizationName?: string | null; createdAt?: string };
type Overview = { governance?: { policies?: number; securityEvents?: number; featureFlags?: number; enabledFeatureFlags?: number; organizations?: number }; exports?: { total?: number }; classification?: { documents?: Record<string, number> }; ownership?: { organizations?: number } };
type Org = { id: string; name: string };
type Perm = { key: string; name: string; group: string };

const fmtNum = (v: unknown) => (v == null || v === '' ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v)));
const fmtDT = (iso?: string | null, withTime = true) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' }) + (withTime ? `، ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : '');
};
const SEV_TONE: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'neutral'> = {
  CRITICAL: 'danger', HIGH: 'danger', WARNING: 'warning', INFO: 'info', LOW: 'success',
};

type Tab = 'overview' | 'policies' | 'flags' | 'exports';
const POLICY_EMPTY = { key: '', permissionKey: '', effect: 'ALLOW', role: '', organizationId: '', department: '', maxDataClassification: '', ownerOnly: false, subjectScope: '', conditions: '', enabled: true };

export default function EnterprisePage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [events, setEvents] = useState<SecEvent[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [catalog, setCatalog] = useState<Perm[] | null>(null);
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [policyQ, setPolicyQ] = useState('');
  const [policyEffect, setPolicyEffect] = useState('');
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState(POLICY_EMPTY);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagForm, setFlagForm] = useState({ key: '', description: '', rollout: '100', enabled: true });

  const suffix = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : '';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError(''); setNotice('');
    try {
      const [ov, po, fl, ex, ev, orgsR, catR] = await Promise.all([
        api<Overview>(`/enterprise/overview${suffix}`).catch(() => null),
        api<any>(`/enterprise/policies${suffix}`).then(x => unwrapList<Policy>(x?.policies ?? x)).catch(() => [] as Policy[]),
        api<any>(`/enterprise/feature-flags${suffix}`).then(x => (Array.isArray(x) ? x : x?.flags ?? [])).catch(() => [] as Flag[]),
        api<any>(`/enterprise/exports${suffix}`).then(x => (Array.isArray(x) ? x : x?.exports ?? x?.rows ?? [])).catch(() => [] as ExportRow[]),
        api<any>('/enterprise/security-events').then(x => (Array.isArray(x) ? x : x?.events ?? [])).catch(() => [] as SecEvent[]),
        api<any>('/organizations').then(x => (Array.isArray(x) ? x : x?.items ?? x?.organizations ?? x?.rows ?? []).map((o: any) => ({ id: o.id, name: o.name ?? o.faName }))).catch(() => [] as Org[]),
        api<any>('/admin/permissions').then(x => (Array.isArray(x) ? x : x?.items ?? x?.permissions ?? []) as Perm[]).catch(() => null),
      ]);
      setOverview(ov); setPolicies(po); setFlags(fl); setExports(ex); setEvents(ev); setOrgs(orgsR); setCatalog(catR);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [suffix]);
  useEffect(() => { load(); }, [load]);

  const g = overview?.governance ?? {};
  const enabled = g.enabledFeatureFlags ?? 0;
  const totalFlags = g.featureFlags ?? 0;

  /* --------------------------- actions --------------------------- */
  async function toggleFlag(f: Flag) {
    setBusy('fl-' + f.key); setError(''); setNotice('');
    try {
      const out = await apiPost<Flag>('/enterprise/feature-flags', { key: f.key, enabled: !f.enabled, rollout: f.rollout, description: f.description ?? null });
      setNotice(`پرچم «${out.key}» ${out.enabled ? 'فعال' : 'غیرفعال'} شد (rollout ${fmtNum(out.rollout)}٪).`);
      await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function createFlag(e: FormEvent) {
    e.preventDefault(); setBusy('new-flag'); setError(''); setNotice('');
    try {
      const key = flagForm.key.trim();
      if (!/^[a-z][a-z0-9_]{1,63}$/.test(key)) throw new Error('کلید پرچم باید لاتین کوچک و ۲ تا ۶۴ کاراکتر باشد.');
      const rollout = Number(flagForm.rollout);
      if (!Number.isFinite(rollout) || rollout < 0 || rollout > 100) throw new Error('درصد rollout باید بین ۰ تا ۱۰۰ باشد.');
      const out = await apiPost<Flag>('/enterprise/feature-flags', { key, enabled: flagForm.enabled, rollout, description: flagForm.description.trim() || null });
      setNotice(`پرچم «${out.key}» ثبت شد.`); setFlagOpen(false); setFlagForm({ key: '', description: '', rollout: '100', enabled: true });
      await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  function openPolicyModal(p?: Policy) {
    setError(''); setNotice('');
    if (!p) { setEditKey(null); setPolicyForm(POLICY_EMPTY); setPolicyOpen(true); return; }
    setEditKey(p.key);
    setPolicyForm({
      key: p.key, permissionKey: p.permissionKey, effect: p.effect === 'DENY' ? 'DENY' : 'ALLOW',
      role: p.role ?? '', organizationId: p.organizationId ?? '', department: p.department ?? '',
      maxDataClassification: p.maxDataClassification ?? '', ownerOnly: !!p.ownerOnly, subjectScope: p.subjectScope ?? '',
      conditions: p.conditions && Object.keys(p.conditions).length ? JSON.stringify(p.conditions, null, 2) : '',
      enabled: p.enabled !== false,
    });
    setPolicyOpen(true);
  }
  async function savePolicy(e: FormEvent) {
    e.preventDefault(); setBusy('save-policy'); setError(''); setNotice('');
    try {
      if (!policyForm.key.trim() || !policyForm.permissionKey) throw new Error('کلید سیاست و مجوز (permission) الزامی است.');
      let conditions: Record<string, any> | null = null;
      if (policyForm.conditions.trim()) {
        try { conditions = JSON.parse(policyForm.conditions); }
        catch { throw new Error('شرط (conditions) باید JSON معتبر باشد.'); }
      }
      const body = {
        key: policyForm.key.trim(), permissionKey: policyForm.permissionKey,
        effect: policyForm.effect, role: policyForm.role.trim() || null,
        organizationId: policyForm.organizationId || null, department: policyForm.department.trim() || null,
        maxDataClassification: policyForm.maxDataClassification || null, ownerOnly: policyForm.ownerOnly,
        subjectScope: policyForm.subjectScope || null, conditions, enabled: policyForm.enabled,
      };
      const out = await apiPost<Policy>('/enterprise/policies', body);
      setNotice(`سیاست «${out.key}» ${editKey ? 'به‌روزرسانی' : 'ثبت'} شد (اثر: ${out.effect === 'DENY' ? 'رد' : 'اجازه'}).`);
      setPolicyOpen(false); await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function disablePolicy(p: Policy) {
    if (!window.confirm(`سیاست «${p.key}» غیرفعال می‌شود (حذف منطقی ABAC). ادامه می‌دهید؟`)) return;
    setBusy('del-' + p.id); setError(''); setNotice('');
    try {
      const out = await apiDelete<Policy>(`/enterprise/policies/${p.id}`);
      setNotice(`سیاست «${out.key}» غیرفعال شد.`); await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function togglePolicyEnabled(p: Policy) {
    setBusy('pe-' + p.id); setError(''); setNotice('');
    try {
      const body = {
        key: p.key, permissionKey: p.permissionKey, effect: p.effect,
        role: p.role ?? null, organizationId: p.organizationId ?? null, department: p.department ?? null,
        maxDataClassification: p.maxDataClassification ?? null, ownerOnly: !!p.ownerOnly,
        subjectScope: p.subjectScope ?? null, conditions: p.conditions ?? null, enabled: p.enabled === false,
      };
      const out = await apiPost<Policy>('/enterprise/policies', body);
      setNotice(`سیاست «${out.key}» ${out.enabled ? 'فعال' : 'غیرفعال'} شد.`); await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }

  const filteredPolicies = useMemo(() => {
    const term = policyQ.trim().toLowerCase();
    return policies.filter(p => {
      if (policyEffect && p.effect !== policyEffect) return false;
      if (!term) return true;
      const hay = `${p.key} ${p.permissionKey} ${p.permissionName ?? ''} ${p.role ?? ''} ${p.organizationName ?? ''} ${p.department ?? ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [policies, policyQ, policyEffect]);

  const busyOn = (k: string) => busy === k;
  const orgsById = useMemo(() => new Map(orgs.map(o => [o.id, o.name])), [orgs]);
  const groups = useMemo(() => {
    if (!catalog) return [];
    const out: Array<{ group: string; items: Perm[] }> = [];
    for (const p of catalog) {
      const g = out.find(x => x.group === p.group);
      if (g) g.items.push(p); else out.push({ group: p.group, items: [p] });
    }
    return out;
  }, [catalog]);

  const tabCounts = { overview: undefined, policies: policies.length, flags: flags.length, exports: exports.length } as const;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="حاکمیت سازمانی"
        title="کنترل سازمانی (ABAC)"
        description="نظارت یکپارچه بر سیاست‌های دسترسی، پرچم‌های ویژگی، خروجی‌های داده و رویدادهای امنیتی در محدودهٔ سازمانی شما — پاریتی کامل EnterpriseController."
        actions={
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            {orgs.length > 1 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Building2 size={14} className="t-muted" />
                <select value={orgId} onChange={e => setOrgId(e.target.value)} style={{ maxWidth: 190 }}>
                  <option value="">همهٔ سازمان‌ها</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </span>
            )}
            <Link className="btn btn-ghost" href="/governance"><Landmark size={15} /> وضعیت حاکمیت</Link>
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
            </button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {notice && <div className="notice" role="status">{notice}</div>}

      {loading && !overview ? <Loading label="در حال بارگذاری حاکمیت سازمانی…" /> : (
        <>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            counts={tabCounts}
            options={[
              { value: 'overview', label: 'نمای کلی' },
              { value: 'policies', label: 'خط‌مشی‌های دسترسی' },
              { value: 'flags', label: 'پرچم‌های ویژگی' },
              { value: 'exports', label: 'خروجی داده و رویدادها' },
            ]}
          />

          {tab === 'overview' && (
            <>
              <div className="stat-grid">
                <StatCard icon={<Scale size={18} />} label="سیاست‌های ABAC" value={fmtNum(g.policies ?? 0)} iconClass="ic-purple" sub="فعال و غیرفعال" />
                <StatCard icon={<ShieldCheck size={18} />} label="رویدادهای امنیتی" value={fmtNum(g.securityEvents ?? 0)} iconClass="ic-red" sub="در محدودهٔ انتخابی" />
                <StatCard icon={<Flag size={18} />} label="پرچم‌های ویژگی" value={`${fmtNum(enabled)} / ${fmtNum(totalFlags)}`} iconClass="ic-blue" sub="فعال از کل" />
                <StatCard icon={<Building2 size={18} />} label="سازمان‌های در دسترس" value={fmtNum(overview?.ownership?.organizations ?? g.organizations ?? 0)} iconClass="ic-gold" sub={orgId ? (orgsById.get(orgId) ?? '') : 'کل سامانه'} />
              </div>
              <div className="stat-grid" style={{ marginTop: 0 }}>
                <StatCard icon={<FileDown size={18} />} label="کل خروجی‌های ثبت‌شده" value={fmtNum(overview?.exports?.total ?? 0)} iconClass="ic-blue" sub="لاگ DataExportLog" />
                <StatCard icon={<Lock size={18} />} label="طبقه‌بندی اسناد" value="—" iconClass="ic-gold" sub="سامانهٔ اسناد در این دمو خالی است" />
              </div>

              <div className="grid2">
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ClipboardList size={16} /> خط‌مشی‌های اخیر</h2>
                      <p>جدیدترین سیاست‌های دسترسی بر پایهٔ زمان به‌روزرسانی.</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setTab('policies'); }}>مدیریت سیاست‌ها</button>
                  </div>
                  {policies.length === 0 ? <div className="empty-state">سیاستی ثبت نشده است.</div> : (
                    <div className="list">
                      {policies.slice(0, 4).map(p => (
                        <article className="listRow" key={p.id} style={{ alignItems: 'center' }}>
                          <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: `color-mix(in srgb, ${p.enabled === false ? '#64748b' : p.effect === 'DENY' ? '#dc2626' : '#16a34a'} 12%, transparent)`, color: p.enabled === false ? '#64748b' : p.effect === 'DENY' ? '#dc2626' : '#16a34a' }}>
                            {p.effect === 'DENY' ? <ShieldX size={14} /> : <ShieldCheck size={14} />}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <code dir="ltr" style={{ fontSize: 11 }}>{p.key}</code>
                              <Badge tone={p.enabled === false ? 'neutral' : p.effect === 'DENY' ? 'danger' : 'success'}>{p.enabled === false ? 'غیرفعال' : p.effect === 'DENY' ? 'رد (DENY)' : 'اجازه (ALLOW)'}</Badge>
                            </span>
                            <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 1 }}>
                              {p.permissionName ?? p.permissionKey}{p.organizationName ? ` · ${p.organizationName}` : ''}{p.roleName ? ` · ${p.roleName}` : ''}
                            </span>
                          </span>
                          <span className="t-muted" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{fmtDT(p.updatedAt ?? p.createdAt, false)}</span>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Fingerprint size={16} /> آخرین رویدادهای امنیتی</h2>
                      <p>نزدیک‌ترین رخدادها در محدودهٔ سازمانی.</p>
                    </div>
                    <Badge tone="info">{fmtNum(events.length)} رویداد</Badge>
                  </div>
                  {events.length === 0 ? <div className="empty-state">رویدادی در دسترس نیست (نیازمند enterprise.security).</div> : (
                    <div className="list">
                      {events.slice(0, 6).map(ev => (
                        <article className="listRow" key={ev.id} style={{ alignItems: 'center' }}>
                          <span style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: `color-mix(in srgb, ${ev.severity === 'CRITICAL' || ev.severity === 'HIGH' ? '#dc2626' : ev.severity === 'WARNING' ? '#d97706' : '#16a34a'} 12%, transparent)`, color: ev.severity === 'CRITICAL' || ev.severity === 'HIGH' ? '#dc2626' : ev.severity === 'WARNING' ? '#d97706' : '#16a34a' }}>
                            <AlertTriangle size={12} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <b style={{ fontSize: 11.5 }}>{fa(ev.type)}</b>
                              <Badge tone={SEV_TONE[ev.severity ?? ''] ?? 'neutral'}>{ev.severity ?? '—'}</Badge>
                            </span>
                            <span className="t-muted" style={{ display: 'block', fontSize: 10 }}>{ev.organizationName ?? ''}{ev.userName ? ` · ${ev.userName}` : ''}</span>
                          </span>
                          <span className="t-muted" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{fmtDT(ev.createdAt)}</span>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}

          {tab === 'policies' && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Scale size={16} /> سیاست‌های دسترسی (AuthorizationPolicy)</h2>
                  <p>قواعد ABAC سراسری/سازمانی: اثر، مجوز، نقش، طبقه‌بندی داده، محدودهٔ موضوع و شرایط.</p>
                </div>
                <button className="btn btn-primary" onClick={() => openPolicyModal()} disabled={busyOn('save-policy')}><Plus size={14} /> سیاست جدید</button>
              </div>
              <div className="toolbar" style={{ marginBottom: 10 }}>
                <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 330 }}>
                  <Search size={14} style={{ position: 'absolute', insetInlineStart: 9, top: 10, color: 'var(--text-muted)' }} />
                  <input placeholder="جستجو در کلید، مجوز، نقش، سازمان…" value={policyQ} onChange={e => setPolicyQ(e.target.value)} style={{ paddingInlineStart: 30, width: '100%' }} />
                </div>
                <select value={policyEffect} onChange={e => setPolicyEffect(e.target.value)} style={{ maxWidth: 150 }}>
                  <option value="">همهٔ آثار</option>
                  <option value="ALLOW">اجازه</option>
                  <option value="DENY">رد</option>
                </select>
                <Badge tone="info">{fmtNum(filteredPolicies.length)} سیاست</Badge>
              </div>
              {filteredPolicies.length === 0 ? <div className="empty-state">سیاستی برای این فیلترها ثبت نشده است.</div> : (
                <div className="list">
                  {filteredPolicies.map(p => (
                    <article className="listRow" key={p.id} style={{ alignItems: 'flex-start', opacity: p.enabled === false ? .62 : 1 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: p.effect === 'DENY' ? 'color-mix(in srgb, var(--red,#dc2626) 12%, transparent)' : 'color-mix(in srgb, var(--green,#16a34a) 12%, transparent)', color: p.effect === 'DENY' ? 'var(--red,#dc2626)' : 'var(--green,#16a34a)' }}>
                        {p.effect === 'DENY' ? <ShieldX size={15} /> : <BadgeCheck size={15} />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <code dir="ltr" style={{ fontSize: 11.5 }}>{p.key}</code>
                          <Badge tone={p.effect === 'DENY' ? 'danger' : 'success'}>{p.effect === 'DENY' ? 'DENY — رد' : 'ALLOW — اجازه'}</Badge>
                          {p.enabled === false && <Badge tone="neutral">غیرفعال</Badge>}
                        </span>
                        <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 2 }}>
                          مجوز: <b>{p.permissionName ?? p.permissionKey}</b> <code dir="ltr" style={{ fontSize: 9.5 }}>({p.permissionKey})</code>
                          {p.roleName ? ` · نقش: ${p.roleName}` : ''}
                          {p.organizationName ? ` · سازمان: ${p.organizationName}` : ' · سراسری'}
                          {p.department ? ` · دپارتمان: ${p.department}` : ''}
                        </span>
                        <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                          {p.maxDataClassification && <Badge tone={CLASS_TONE[p.maxDataClassification] ?? 'neutral'}>{CLASS_FA[p.maxDataClassification] ?? p.maxDataClassification}</Badge>}
                          {p.ownerOnly && <Badge tone="warning">فقط مالک</Badge>}
                          {p.subjectScope && <Badge tone="info">محدودهٔ {SCOPE_FA[p.subjectScope] ?? p.subjectScope}</Badge>}
                          {p.conditions && Object.keys(p.conditions).length > 0 && <Badge tone="neutral">شرط‌دار</Badge>}
                          <span className="t-muted" style={{ fontSize: 9.5 }}>به‌روزرسانی: {fmtDT(p.updatedAt ?? p.createdAt, false)}</span>
                        </span>
                      </span>
                      <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button className="secondary-action" style={{ padding: '6px 10px', minHeight: 0 }} onClick={() => openPolicyModal(p)} disabled={busyOn('pe-' + p.id)}><Pencil size={12} /> ویرایش</button>
                        <button className="secondary-action" style={{ padding: '6px 10px', minHeight: 0 }} onClick={() => togglePolicyEnabled(p)} disabled={busyOn('pe-' + p.id)}>
                          {p.enabled === false ? 'فعال‌سازی' : 'غیرفعال‌سازی'}
                        </button>
                        <button className="danger-action" style={{ padding: '6px 10px', minHeight: 0 }} onClick={() => disablePolicy(p)} disabled={busyOn('del-' + p.id)}><Trash2 size={12} /></button>
                      </span>
                    </article>
                  ))}
                </div>
              )}
              <p className="t-muted" style={{ margin: '10px 0 0', fontSize: 10.5 }}>
                <Lock size={10} style={{ verticalAlign: -2 }} /> حذف سیاست در بک‌اند واقعی «غیرفعال‌سازی» است (enabled=false) تا ردپای ممیزی حفظ شود؛ هر تغییر در ممیزی با PERMISSION_CHANGE ثبت می‌شود.
              </p>
            </section>
          )}

          {tab === 'flags' && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Flag size={16} /> پرچم‌های ویژگی</h2>
                  <p>فعال‌سازی تدریجی قابلیت‌ها با rollout درصدی؛ کلیدها سراسری یا سازمانی هستند.</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setFlagOpen(true); setError(''); }} disabled={busyOn('new-flag')}><Plus size={14} /> پرچم جدید</button>
              </div>
              {flags.length === 0 ? <div className="empty-state">پرچمی ثبت نشده است.</div> : (
                <div className="list">
                  {flags.map(f => (
                    <article className="listRow" key={f.key} style={{ alignItems: 'center' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: f.enabled ? 'color-mix(in srgb, var(--blue,#2563eb) 12%, transparent)' : 'color-mix(in srgb, #64748b 12%, transparent)', color: f.enabled ? 'var(--blue,#2563eb)' : '#64748b' }}>
                        <Flag size={15} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <code dir="ltr" style={{ fontSize: 11.5 }}>{f.key}</code>
                          <Badge tone={f.enabled ? 'success' : 'neutral'}>{f.enabled ? 'فعال' : 'غیرفعال'}</Badge>
                          <Badge tone="info">rollout {fmtNum(f.rollout)}٪</Badge>
                        </span>
                        <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 2 }}>
                          {f.description ?? '—'}
                          {f.organizationId ? ` · سازمان: ${orgsById.get(f.organizationId) ?? f.organizationId}` : ' · سراسری'}
                          {f.createdAt ? ` · ایجاد: ${fmtDT(f.createdAt, false)}` : ''}
                        </span>
                        <span style={{ display: 'block', marginTop: 5, maxWidth: 260 }}>
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10 }}>
                            <SlidersHorizontal size={11} className="t-muted" />
                            <span style={{ flex: 1, background: 'var(--card-bg-soft,#f1f5f9)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                              <span style={{ display: 'block', height: '100%', width: `${f.rollout}%`, background: f.enabled ? 'var(--blue,#2563eb)' : '#94a3b8', borderRadius: 99 }} />
                            </span>
                            <b className="t-muted" style={{ fontSize: 10 }}>{fmtNum(f.rollout)}٪</b>
                          </span>
                        </span>
                      </span>
                      <button className={f.enabled ? 'btn btn-secondary' : 'btn btn-primary'} style={{ padding: '6px 12px', minHeight: 0 }} onClick={() => toggleFlag(f)} disabled={busyOn('fl-' + f.key)}>
                        {busyOn('fl-' + f.key) ? '…' : f.enabled ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'exports' && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><FileDown size={16} /> خروجی‌های دادهٔ ثبت‌شده</h2>
                  <p>صد خروجی اخیر از لاگ DataExportLog به‌همراه طبقه‌بندی و کاربر صادرکننده.</p>
                </div>
                <Badge tone="info">{fmtNum(exports.length)} خروجی</Badge>
              </div>
              {exports.length === 0 ? <div className="empty-state">خروجی‌ای ثبت نشده است.</div> : (
                <div className="list">
                  {exports.map(r => {
                    const fmt = String(r.exportType ?? '').toUpperCase();
                    const isFmt = EXPORT_FORMATS.includes(fmt);
                    const main = isFmt ? (EXPORT_TYPE_FA[r.entityType ?? ''] ?? r.entityType ?? r.exportType) : (EXPORT_TYPE_FA[r.exportType] ?? r.exportType);
                    const sub = isFmt ? fmt : (r.entityType ? `${r.exportType} · ${r.entityType}` : r.exportType);
                    const Icon = isFmt ? (fmt === 'CSV' ? FileSpreadsheet : fmt === 'XLSX' ? Table2 : fmt === 'PDF' ? FileText : FileJson2) : FileSpreadsheet;
                    return (
                      <article className="listRow" key={r.id} style={{ alignItems: 'center' }}>
                        <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: 'color-mix(in srgb, var(--purple,#7c3aed) 12%, transparent)', color: 'var(--purple,#7c3aed)' }}>
                          <Icon size={15} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <b>{main}</b>
                            {isFmt && <code dir="ltr" style={{ fontSize: 9.5, opacity: .7 }}>{fmt}</code>}
                            <Badge tone={CLASS_TONE[r.classification] ?? 'neutral'}>{CLASS_FA[r.classification] ?? r.classification}</Badge>
                          </span>
                          <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 1 }}>
                            {sub} · {fmtNum(r.recordCount)} رکورد
                            {r.organizationName ? ` · ${r.organizationName}` : ''}
                            {r.userName ? ` · ${r.userName}` : ''}
                          </span>
                        </span>
                        <span className="t-muted" style={{ fontSize: 10, whiteSpace: 'nowrap', textAlign: 'left' }}>
                          {fmtDT(r.createdAt)}
                          {r.ipAddress && <code dir="ltr" style={{ display: 'block', fontSize: 9, textAlign: 'left' }}>{r.ipAddress}</code>}
                        </span>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* ------------------------- policy modal ------------------------- */}
      <Modal
        open={policyOpen}
        title={editKey ? `ویرایش سیاست «${editKey}»` : 'سیاست دسترسی جدید (ABAC)'}
        description="اثر (اجازه/رد)، مجوز هدف، نقش/سازمان/دپارتمان، سقف طبقه‌بندی داده و محدودهٔ موضوع را تعیین کنید؛ ذخیره به‌صورت upsert بر پایهٔ کلید است."
        onClose={() => setPolicyOpen(false)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setPolicyOpen(false)}><X size={14} /> انصراف</button>
          <button type="submit" form="policy-form" className="btn btn-primary" disabled={busyOn('save-policy')}>{busyOn('save-policy') ? 'در حال ذخیره…' : editKey ? 'به‌روزرسانی سیاست' : 'ثبت سیاست'}</button>
        </>}
      >
        <form id="policy-form" className="entity-form" onSubmit={savePolicy}>
          <div className="field full">
            <label className="field-label" htmlFor="pol-key">کلید سیاست <span className="req">*</span></label>
            <input id="pol-key" dir="ltr" value={policyForm.key} onChange={e => setPolicyForm({ ...policyForm, key: e.target.value })} required disabled={!!editKey} placeholder="مثلاً deny-restricted-export" style={{ textAlign: 'left' }} />
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="pol-perm">مجوز هدف (permission) <span className="req">*</span></label>
            {catalog ? (
              <select id="pol-perm" value={policyForm.permissionKey} onChange={e => setPolicyForm({ ...policyForm, permissionKey: e.target.value })} required>
                <option value="">انتخاب مجوز…</option>
                {groups.map(grp => (
                  <optgroup key={grp.group} label={GROUP_FA[grp.group] ?? grp.group}>
                    {grp.items.map(p => <option key={p.key} value={p.key}>{p.name} ({p.key})</option>)}
                  </optgroup>
                ))}
              </select>
            ) : (
              <input id="pol-perm" dir="ltr" value={policyForm.permissionKey} onChange={e => setPolicyForm({ ...policyForm, permissionKey: e.target.value })} required placeholder="کاتالوگ مجوزها در دسترس نیست — کلید را وارد کنید" style={{ textAlign: 'left' }} />
            )}
          </div>
          <div className="field">
            <label className="field-label">اثر (Effect) <span className="req">*</span></label>
            <select value={policyForm.effect} onChange={e => setPolicyForm({ ...policyForm, effect: e.target.value })}>
              <option value="ALLOW">اجازه (ALLOW)</option>
              <option value="DENY">رد (DENY)</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">وضعیت</label>
            <select value={policyForm.enabled ? '1' : '0'} onChange={e => setPolicyForm({ ...policyForm, enabled: e.target.value === '1' })}>
              <option value="1">فعال</option>
              <option value="0">غیرفعال</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="pol-org">سازمان</label>
            <select id="pol-org" value={policyForm.organizationId} onChange={e => setPolicyForm({ ...policyForm, organizationId: e.target.value })}>
              <option value="">سراسری (همهٔ سازمان‌ها)</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">سقف طبقه‌بندی داده</label>
            <select value={policyForm.maxDataClassification} onChange={e => setPolicyForm({ ...policyForm, maxDataClassification: e.target.value })}>
              <option value="">بدون سقف</option>
              {CLASSIFICATION_OPTIONS.map(c => <option key={c} value={c}>{CLASS_FA[c]}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">محدودهٔ موضوع (Subject Scope)</label>
            <select value={policyForm.subjectScope} onChange={e => setPolicyForm({ ...policyForm, subjectScope: e.target.value })}>
              <option value="">محدودیت ندارد</option>
              {SCOPE_OPTIONS.map(s => <option key={s} value={s}>{SCOPE_FA[s]}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="pol-role">نقش (Role)</label>
            <input id="pol-role" dir="ltr" list="role-suggestions" value={policyForm.role} onChange={e => setPolicyForm({ ...policyForm, role: e.target.value })} placeholder="مثلاً RELATIONSHIP_MANAGER" style={{ textAlign: 'left' }} />
            <datalist id="role-suggestions">{ROLE_SUGGESTIONS.map(r => <option key={r} value={r} />)}</datalist>
          </div>
          <div className="field">
            <label className="field-label">دپارتمان</label>
            <input value={policyForm.department} onChange={e => setPolicyForm({ ...policyForm, department: e.target.value })} placeholder="مثلاً فروش" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={policyForm.ownerOnly} onChange={e => setPolicyForm({ ...policyForm, ownerOnly: e.target.checked })} />
            فقط مالک (Owner Only) — اعمال فقط برای مالک سامانه
          </label>
          <div className="field full">
            <label className="field-label" htmlFor="pol-cond">شرایط (Conditions — JSON اختیاری)</label>
            <textarea id="pol-cond" dir="ltr" rows={3} value={policyForm.conditions} onChange={e => setPolicyForm({ ...policyForm, conditions: e.target.value })} placeholder='{"ipRange": "10.0.0.0/8"}' style={{ textAlign: 'left', fontFamily: 'ui-monospace,monospace', fontSize: 11 }} />
          </div>
        </form>
      </Modal>

      {/* ------------------------- flag modal ------------------------- */}
      <Modal
        open={flagOpen}
        title="پرچم ویژگی جدید"
        description="با یک کلید یکتا، فعال‌سازی تدریجی (rollout درصدی) و شرح فارسی ثبت کنید."
        onClose={() => setFlagOpen(false)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setFlagOpen(false)}><X size={14} /> انصراف</button>
          <button type="submit" form="flag-form" className="btn btn-primary" disabled={busyOn('new-flag')}>{busyOn('new-flag') ? 'در حال ثبت…' : 'ثبت پرچم'}</button>
        </>}
      >
        <form id="flag-form" className="entity-form" onSubmit={createFlag}>
          <div className="field full">
            <label className="field-label" htmlFor="flag-key">کلید <span className="req">*</span></label>
            <input id="flag-key" dir="ltr" value={flagForm.key} onChange={e => setFlagForm({ ...flagForm, key: e.target.value })} required placeholder="مثلاً beta_reporting" style={{ textAlign: 'left' }} />
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="flag-desc">شرح</label>
            <input id="flag-desc" value={flagForm.description} onChange={e => setFlagForm({ ...flagForm, description: e.target.value })} placeholder="شرح کوتاه قابلیت به فارسی" />
          </div>
          <div className="field full">
            <label className="field-label" htmlFor="flag-rollout">درصد rollout (۰ تا ۱۰۰)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input id="flag-rollout" type="number" min={0} max={100} value={flagForm.rollout} onChange={e => setFlagForm({ ...flagForm, rollout: e.target.value })} style={{ maxWidth: 120 }} />
              <input type="range" min={0} max={100} value={flagForm.rollout} onChange={e => setFlagForm({ ...flagForm, rollout: e.target.value })} style={{ flex: 1 }} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={flagForm.enabled} onChange={e => setFlagForm({ ...flagForm, enabled: e.target.checked })} />
            فعال از همان ابتدا
          </label>
        </form>
      </Modal>
    </main>
  );
}

