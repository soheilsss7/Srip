'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar } from '../_components/page-ui';
import { CheckCircle2, ChevronLeft, Coins, Handshake, Plus, RefreshCw, Search, TrendingUp, ArrowDownWideNarrow, CalendarClock } from 'lucide-react';;
import { JalaliDateField } from '../_components/jalali-date-field';

type Opportunity = {
  id: string; name: string; status: string; description?: string | null;
  value?: number | null; probability?: number | null; expectedValue?: number | null;
  expectedDate?: string | null; createdAt?: string | null; wonAt?: string | null;
  organizationId?: string | null;
  organization?: { id: string; name: string } | null;
  owner?: { id: string; name: string } | null;
  ownerId?: string | null;
  relationship?: { id: string; sourceOrganization?: { name?: string } | null; targetOrganization?: { name?: string } | null } | null;
  project?: { id: string; name: string } | null;
};
type Person = { id: string; firstName: string; lastName: string; organization?: { id?: string; name?: string } | null };
type Org = { id: string; name: string };
type Rel = { id: string; sourceOrganization?: { id: string; name: string } | null; targetOrganization?: { id: string; name: string } | null; relationshipType?: string };
type Project = { id: string; name: string };

const STATUS_OPTIONS = ['IDENTIFIED', 'QUALIFYING', 'ACTIVE', 'WON', 'LOST'];
const CLOSED = ['WON', 'LOST'];
const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  IDENTIFIED: 'neutral', QUALIFYING: 'info', ACTIVE: 'warning', WON: 'success', LOST: 'danger',
};
const SORTS = [
  { value: 'expected', label: 'بیشترین ارزش موزون' },
  { value: 'prob', label: 'بیشترین احتمال' },
  { value: 'due', label: 'نزدیک‌ترین موعد بستن' },
  { value: 'created', label: 'جدیدترین' },
] as const;
type SortKey = typeof SORTS[number]['value'];

const fmtNum = (v: number | undefined | null): string =>
  v == null || Number.isNaN(v) ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }) : '—';
const fmtMoney = (v: number | undefined | null): string => {
  if (v == null || Number.isNaN(v)) return '—';
  const b = v / 1e9;
  if (b >= 1) return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(b)} میلیارد تومان`;
  const m = v / 1e6;
  if (m >= 1) return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(m)} میلیون تومان`;
  return `${fmtNum(v)} تومان`;
};

export default function OpportunitiesPage() {
  const { can } = useWorkspace();
  const writable = can('opportunity.write');
  const [items, setItems] = useState<Opportunity[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [rels, setRels] = useState<Rel[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('expected');
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [patchId, setPatchId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', organizationId: '', relationshipId: '', projectId: '', ownerId: '',
    status: 'IDENTIFIED', valueB: '', probability: '50', expectedDate: '',
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [os, pps, ors, rs, pjs] = await Promise.all([
        api<any>('/opportunities'),
        can('person.read') ? api<any>('/people').catch(() => []) : Promise.resolve([]),
        can('organization.read') ? api<any>('/organizations').catch(() => []) : Promise.resolve([]),
        api<any>('/relationships'),
        can('project.read') ? api<any>('/projects').catch(() => []) : Promise.resolve([]),
      ]);
      const arr = (x: any): any[] => (Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : x?.data ?? []);
      setItems(arr(os)); setPeople(arr(pps)); setOrgs(arr(ors)); setRels(arr(rs)); setProjects(arr(pjs));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [can]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const open = items.filter(o => !CLOSED.includes(o.status));
    const openExpected = open.reduce((s, o) => s + (o.expectedValue ?? 0), 0);
    const openValue = open.reduce((s, o) => s + (o.value ?? 0), 0);
    const won = items.filter(o => o.status === 'WON');
    const wonValue = won.reduce((s, o) => s + (o.value ?? 0), 0);
    return { total: items.length, open: open.length, openExpected, openValue, won: won.length, wonValue };
  }, [items]);

  const orgOptions = useMemo(() => {
    const map = new Map<string, Org>();
    orgs.forEach(o => map.set(o.id, o));
    rels.forEach(r => { if (r.sourceOrganization) map.set(r.sourceOrganization.id, { id: r.sourceOrganization!.id, name: r.sourceOrganization!.name! }); if (r.targetOrganization) map.set(r.targetOrganization.id, { id: r.targetOrganization!.id, name: r.targetOrganization!.name! }); });
    return [...map.values()];
  }, [orgs, rels]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = items.filter(o => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (orgFilter && o.organizationId !== orgFilter) return false;
      if (term && !`${o.name} ${o.description ?? ''} ${o.organization?.name ?? ''} ${o.owner?.name ?? ''} ${o.relationship?.sourceOrganization?.name ?? ''} ${o.relationship?.targetOrganization?.name ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
    switch (sortBy) {
      case 'prob':
        return [...out].sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0) || (b.expectedValue ?? 0) - (a.expectedValue ?? 0));
      case 'due':
        return [...out].sort((a, b) => {
          const ao = CLOSED.includes(a.status) ? 1 : 0, bo = CLOSED.includes(b.status) ? 1 : 0;
          if (ao !== bo) return ao - bo;
          return (a.expectedDate ?? '9999').localeCompare(b.expectedDate ?? '9999');
        });
      case 'created':
        return [...out].sort((a, b) => (b.createdAt ?? b.id).localeCompare(a.createdAt ?? a.id));
      default:
        return [...out].sort((a, b) => (b.expectedValue ?? 0) - (a.expectedValue ?? 0) || (b.value ?? 0) - (a.value ?? 0));
    }
  }, [items, q, statusFilter, orgFilter, sortBy]);

  const setF = (k: keyof typeof form) => (v: string | React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }));

  function onRelPick(id: string) {
    setForm(f => {
      const rel = rels.find(r => r.id === id);
      const orgId = rel?.targetOrganization?.id ?? '';
      return { ...f, relationshipId: id, organizationId: orgId || f.organizationId };
    });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!writable) return;
    setSaving(true); setError(''); setFormError('');
    if (!form.name.trim()) { setFormError('نام فرصت لازم است.'); setSaving(false); return; }
    if (!form.organizationId) { setFormError('سازمانِ فرصت را انتخاب کنید.'); setSaving(false); return; }
    try {
      const valueB = Number(form.valueB);
      await api('/opportunities', { method: 'POST', body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        organizationId: form.organizationId,
        relationshipId: form.relationshipId || undefined,
        projectId: form.projectId || undefined,
        ownerId: form.ownerId || undefined,
        status: form.status,
        probability: Number(form.probability) || 0,
        value: Number.isFinite(valueB) && valueB > 0 ? Math.round(valueB * 1e9) : undefined,
        expectedDate: form.expectedDate ? new Date(form.expectedDate).toISOString() : undefined,
      }) });
      setForm({ name: '', description: '', organizationId: '', relationshipId: '', projectId: '', ownerId: '', status: 'IDENTIFIED', valueB: '', probability: '50', expectedDate: '' });
      setCreateOpen(false); await load();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  async function quickStatus(o: Opportunity, status: string) {
    setPatchId(o.id); setError('');
    try {
      await api(`/opportunities/${o.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (err) { setError((err as Error).message); }
    finally { setPatchId(null); }
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری · عملیات"
        title="فرصت‌ها"
        description="فرصت‌های تجاری باز و بسته با ارزش، احتمال و ارزش موزون — از شناسایی تا برد."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} aria-label="بازخوانی"><RefreshCw size={15} /> بازخوانی</button>
            {writable && <button className="btn btn-primary" onClick={() => { setError(''); setFormError(''); setCreateOpen(true); }}><Plus size={16} /> فرصت جدید</button>}
          </>
        }
      />
      <ErrorCard message={error} />

      {loading ? (
        <div className="stat-grid">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 110 }} />)}</div>
      ) : (
        <div className="stat-grid">
          <StatCard icon={<TrendingUp size={18} />} label="کل فرصت‌ها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در محدودهٔ مجاز" />
          <StatCard icon={<Handshake size={18} />} label="باز" value={fmtNum(stats.open)} iconClass="ic-teal" sub="شناسایی تا مذاکره" />
          <StatCard icon={<Coins size={18} />} label="ارزش موزون باز" value={fmtMoney(stats.openExpected)} iconClass="ic-gold" sub={`از ${fmtMoney(stats.openValue)} ارزش خام`} />
          <StatCard icon={<CheckCircle2 size={18} />} label="برنده‌شده" value={fmtNum(stats.won)} iconClass="ic-blue" sub={stats.wonValue ? `به ارزش ${fmtMoney(stats.wonValue)}` : ''} />
        </div>
      )}

      <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی نام، سازمان یا مالک…">
        <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
          <option value="">همهٔ مراحل</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
        </select>
        <select aria-label="فیلتر سازمان" value={orgFilter} onChange={e => setOrgFilter(e.target.value)} className="toolbar-select">
          <option value="">همهٔ سازمان‌ها</option>
          {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <label className="toolbar-sort" aria-label="مرتب‌سازی">
          <ArrowDownWideNarrow size={14} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}>
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <span className="chip info">{fmtNum(filtered.length)} فرصت</span>
      </Toolbar>

      {loading ? (
        <div className="skeleton skeleton-table" />
      ) : filtered.length === 0 ? (
        <div className="empty-state-v4">
          <div className="empty-ico"><Search size={24} /></div>
          <strong>{items.length === 0 ? 'فرصتی ثبت نشده است' : 'نتیجه‌ای یافت نشد'}</strong>
          <p>{items.length === 0 ? 'از دکمهٔ «فرصت جدید» برای ثبت نخستین فرصت استفاده کنید.' : 'فیلترها یا عبارت جستجو را تغییر دهید.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>فرصت</th>
                <th>سازمان</th>
                <th>مالک</th>
                <th>ارزش</th>
                <th>احتمال</th>
                <th>موعد بستن</th>
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td>
                    <Link className="t-primary" href={`/opportunities/${o.id}`}>{o.name}</Link>
                    {o.description && <div className="t-muted" style={{ maxWidth: 280 }}>{o.description.length > 80 ? o.description.slice(0, 80) + '…' : o.description}</div>}
                  </td>
                  <td>
                    {o.organization ? (
                      <Link className="t-primary" href={`/organizations/${o.organizationId}`} style={{ fontSize: 11.5 }}>{o.organization.name}</Link>
                    ) : <span className="t-muted">—</span>}
                  </td>
                  <td>
                    {o.owner ? (
                      <Link className="t-primary" href={`/people/${o.ownerId}`} style={{ fontSize: 11.5 }}>{o.owner.name}</Link>
                    ) : <span className="t-muted">—</span>}
                  </td>
                  <td>
                    <strong style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtMoney(o.value)}</strong>
                    {o.expectedValue != null && <div className="t-muted" style={{ fontSize: 10.5 }}>موزون: {fmtMoney(o.expectedValue)}</div>}
                  </td>
                  <td>
                    <div className="prog-line" style={{ minWidth: 90 }}>
                      <div className="prog-bar"><div className={`prog-fill ${(o.probability ?? 0) >= 70 ? '' : 'warn'}`} style={{ width: `${o.probability ?? 0}%` }} /></div>
                      <span className="prog-num">{fmtNum(o.probability)}٪</span>
                    </div>
                  </td>
                  <td>
                    {o.expectedDate ? <span className="cell-count"><CalendarClock size={12} /> {fmtDate(o.expectedDate)}</span> : <span className="t-muted">—</span>}
                  </td>
                  <td>
                    {writable ? (
                      <select aria-label={`تغییر وضعیت ${o.name}`} className="toolbar-select" style={{ minHeight: 30, padding: '2px 6px', fontSize: 11.5 }}
                        value={o.status} disabled={patchId === o.id}
                        onChange={e => quickStatus(o, e.target.value)}>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                      </select>
                    ) : <Badge tone={STATUS_TONE[o.status] ?? 'neutral'}>{fa(o.status)}</Badge>}
                  </td>
                  <td>
                    <Link className="row-action" href={`/opportunities/${o.id}`} aria-label={`مشاهدهٔ ${o.name}`}><ChevronLeft size={16} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={createOpen}
        title="ثبت فرصت جدید"
        description="فرصت تجاری با ارزش، احتمال و بسترِ رابطه ثبت می‌شود."
        onClose={() => setCreateOpen(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>انصراف</button>
          <button className="btn btn-primary" form="opp-create-form" type="submit" disabled={saving}>{saving ? 'در حال ثبت…' : 'ثبت فرصت'}</button>
        </>}
      >
        {formError && <div className="error-card" role="alert">{formError}</div>}
        <form id="opp-create-form" className="entity-form org-form" onSubmit={create}>
          <div className="form-section-head"><h3>فرصت</h3></div>
          <div className="form-grid">
            <div className="field full">
              <label className="field-label" htmlFor="op-name">نام فرصت <span className="req">*</span></label>
              <input id="op-name" required value={form.name} onChange={setF('name')} placeholder="مثلاً: قرارداد نگهداری سالانهٔ سدنا" />
            </div>
            <div className="field full">
              <label className="field-label" htmlFor="op-desc">توضیحات (اختیاری)</label>
              <textarea id="op-desc" value={form.description} onChange={setF('description')} placeholder="دامنهٔ فرصت و ارزش پیشنهادی…" />
            </div>
          </div>
          <div className="form-section-head"><h3>سازمان و بستر</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="op-org">سازمانِ طرف <span className="req">*</span></label>
              <select id="op-org" value={form.organizationId} onChange={setF('organizationId')}>
                <option value="">انتخاب سازمان…</option>
                {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="op-rel">رابطهٔ مرتبط</label>
              <select id="op-rel" value={form.relationshipId} onChange={e => onRelPick(e.target.value)}>
                <option value="">بدون رابطه</option>
                {rels.map(r => (
                  <option key={r.id} value={r.id}>{r.sourceOrganization?.name ?? '—'} ↔ {r.targetOrganization?.name ?? '—'}{r.relationshipType ? ` (${fa(r.relationshipType)})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="op-project">پروژهٔ مرتبط</label>
              <select id="op-project" value={form.projectId} onChange={setF('projectId')}>
                <option value="">بدون پروژه</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="op-owner">مالک پیگیری</label>
              <select id="op-owner" value={form.ownerId} onChange={setF('ownerId')}>
                <option value="">بدون مالک</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.organization?.name ? ` — ${p.organization.name}` : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="form-section-head"><h3>ارزش‌گذاری</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="op-value">ارزش (میلیارد تومان)</label>
              <input id="op-value" type="number" min={0} step="0.1" value={form.valueB} onChange={setF('valueB')} placeholder="مثلاً: ۲۰۰" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="op-prob">احتمال (درصد)</label>
              <input id="op-prob" type="number" min={0} max={100} value={form.probability} onChange={setF('probability')} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="op-status">مرحله</label>
              <select id="op-status" value={form.status} onChange={setF('status')}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="op-date">موعد بستن</label>
              <JalaliDateField id="op-date" value={form.expectedDate} onChange={setF('expectedDate')} />
            </div>
          </div>
        </form>
      </Modal>
    </main>
  );
}
