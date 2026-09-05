'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar } from '../_components/page-ui';
import { CheckCircle2, ChevronLeft, FolderKanban, Plus, RefreshCw, Rocket, Search, PauseCircle, ArrowDownWideNarrow, CalendarRange } from 'lucide-react';;
import { JalaliDateField } from '../_components/jalali-date-field';

type Project = {
  id: string; name: string; status: string; priority?: string | null; organizationId?: string | null;
  description?: string | null; objective?: string | null;
  startAt?: string | null; targetAt?: string | null; endAt?: string | null; createdAt?: string | null;
  progress?: number | null; doneMilestones?: number; totalMilestones?: number;
  organization?: { id: string; name: string } | null;
  owner?: { id: string; name: string } | null;
  ownerId?: string | null;
};
type Person = { id: string; firstName: string; lastName: string; title?: string | null; organization?: { id?: string; name?: string } | null };
type Org = { id: string; name: string };

const STATUS_OPTIONS = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const PRIO_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const DONE_STATUSES = ['COMPLETED', 'CANCELLED'];
const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  PLANNED: 'neutral', ACTIVE: 'info', ON_HOLD: 'warning', COMPLETED: 'success', CANCELLED: 'danger',
};
const PRIO_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};
const SORTS = [
  { value: 'progress', label: 'پیشرفت بیشتر اول' },
  { value: 'target', label: 'نزدیک‌ترین پایانِ هدف' },
  { value: 'priority', label: 'اولویت بالاتر اول' },
  { value: 'created', label: 'جدیدترین' },
] as const;
type SortKey = typeof SORTS[number]['value'];

const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }) : '—';
const prioLevel = (p?: string | null) => (p === 'CRITICAL' ? 3 : p === 'HIGH' ? 2 : p === 'MEDIUM' ? 1 : 0);

export default function ProjectsPage() {
  const { can } = useWorkspace();
  const writable = can('project.write');
  const [items, setItems] = useState<Project[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [prioFilter, setPrioFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('target');
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [patchId, setPatchId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', objective: '', description: '', organizationId: '', ownerId: '',
    status: 'PLANNED', priority: 'MEDIUM', startAt: '', targetAt: '',
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [ps, pps, ors] = await Promise.all([
        api<any>('/projects'),
        can('person.read') ? api<any>('/people').catch(() => []) : Promise.resolve([]),
        can('organization.read') ? api<any>('/organizations').catch(() => []) : Promise.resolve([]),
      ]);
      const arr = (x: any): any[] => (Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : x?.data ?? []);
      setItems(arr(ps)); setPeople(arr(pps)); setOrgs(arr(ors));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [can]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const active = items.filter(p => p.status === 'ACTIVE');
    const planned = items.filter(p => p.status === 'PLANNED' || p.status === 'ON_HOLD');
    const done = items.filter(p => p.status === 'COMPLETED');
    const withProg = items.filter(p => p.progress != null);
    const avg = withProg.length ? Math.round(withProg.reduce((s, p) => s + (p.progress ?? 0), 0) / withProg.length) : null;
    return { total: items.length, active: active.length, planned: planned.length, done: done.length, avg };
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = items.filter(p => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (prioFilter && (p.priority ?? 'MEDIUM') !== prioFilter) return false;
      if (orgFilter && p.organizationId !== orgFilter) return false;
      if (term && !`${p.name} ${p.objective ?? ''} ${p.description ?? ''} ${p.organization?.name ?? ''} ${p.owner?.name ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
    switch (sortBy) {
      case 'progress':
        return [...out].sort((a, b) => (b.progress ?? -1) - (a.progress ?? -1) || (a.targetAt ?? '9999').localeCompare(b.targetAt ?? '9999'));
      case 'priority':
        return [...out].sort((a, b) => prioLevel(b.priority) - prioLevel(a.priority) || (b.progress ?? 0) - (a.progress ?? 0));
      case 'created':
        return [...out].sort((a, b) => (b.createdAt ?? b.id).localeCompare(a.createdAt ?? a.id));
      default:
        return [...out].sort((a, b) => {
          const ao = a.status === 'COMPLETED' ? 1 : 0, bo = b.status === 'COMPLETED' ? 1 : 0;
          if (ao !== bo) return ao - bo;
          return (a.targetAt ?? '9999').localeCompare(b.targetAt ?? '9999');
        });
    }
  }, [items, q, statusFilter, prioFilter, orgFilter, sortBy]);

  const setF = (k: keyof typeof form) => (v: string | React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!writable) return;
    setSaving(true); setError(''); setFormError('');
    if (!form.name.trim()) { setFormError('نام پروژه لازم است.'); setSaving(false); return; }
    if (!form.organizationId) { setFormError('سازمانِ پروژه را انتخاب کنید.'); setSaving(false); return; }
    try {
      await api('/projects', { method: 'POST', body: JSON.stringify({
        name: form.name.trim(),
        objective: form.objective.trim() || undefined,
        description: form.description.trim() || undefined,
        organizationId: form.organizationId,
        ownerId: form.ownerId || undefined,
        status: form.status,
        priority: form.priority,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
        targetAt: form.targetAt ? new Date(form.targetAt).toISOString() : undefined,
      }) });
      setForm({ name: '', objective: '', description: '', organizationId: '', ownerId: '', status: 'PLANNED', priority: 'MEDIUM', startAt: '', targetAt: '' });
      setCreateOpen(false); await load();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  async function quickStatus(p: Project, status: string) {
    setPatchId(p.id); setError('');
    try {
      await api(`/projects/${p.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (err) { setError((err as Error).message); }
    finally { setPatchId(null); }
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری · عملیات"
        title="پروژه‌ها"
        description="پروژه‌های مشتری با هدف، مالک، اولویت و زمان‌بندی — پیشرفت از دل مراحل کلیدی محاسبه می‌شود."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} aria-label="بازخوانی"><RefreshCw size={15} /> بازخوانی</button>
            {writable && <button className="btn btn-primary" onClick={() => { setError(''); setFormError(''); setCreateOpen(true); }}><Plus size={16} /> پروژه جدید</button>}
          </>
        }
      />
      <ErrorCard message={error} />

      {loading ? (
        <div className="stat-grid">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 110 }} />)}</div>
      ) : (
        <div className="stat-grid">
          <StatCard icon={<FolderKanban size={18} />} label="کل پروژه‌ها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub={stats.avg != null ? `میانگین پیشرفت ${fmtNum(stats.avg)}٪` : 'بدون مرحلهٔ ثبت‌شده'} />
          <StatCard icon={<Rocket size={18} />} label="در جریان" value={fmtNum(stats.active)} iconClass="ic-teal" sub="پروژه‌های فعال" />
          <StatCard icon={<PauseCircle size={18} />} label="برنامه‌ریزی/متوقف" value={fmtNum(stats.planned)} iconClass="ic-gold" sub="در انتظار شروع" />
          <StatCard icon={<CheckCircle2 size={18} />} label="تکمیل‌شده" value={fmtNum(stats.done)} iconClass="ic-blue" sub="تحویل‌شده" />
        </div>
      )}

      <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی نام، سازمان یا مالک…">
        <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
          <option value="">همهٔ وضعیت‌ها</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
        </select>
        <select aria-label="فیلتر اولویت" value={prioFilter} onChange={e => setPrioFilter(e.target.value)} className="toolbar-select">
          <option value="">همهٔ اولویت‌ها</option>
          {PRIO_OPTIONS.map(p => <option key={p} value={p}>{fa(p)}</option>)}
        </select>
        <select aria-label="فیلتر سازمان" value={orgFilter} onChange={e => setOrgFilter(e.target.value)} className="toolbar-select">
          <option value="">همهٔ سازمان‌ها</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <label className="toolbar-sort" aria-label="مرتب‌سازی">
          <ArrowDownWideNarrow size={14} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}>
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <span className="chip info">{fmtNum(filtered.length)} پروژه</span>
      </Toolbar>

      {loading ? (
        <div className="skeleton skeleton-table" />
      ) : filtered.length === 0 ? (
        <div className="empty-state-v4">
          <div className="empty-ico"><Search size={24} /></div>
          <strong>{items.length === 0 ? 'پروژه‌ای ثبت نشده است' : 'نتیجه‌ای یافت نشد'}</strong>
          <p>{items.length === 0 ? 'از دکمهٔ «پروژه جدید» برای ثبت نخستین پروژه استفاده کنید.' : 'فیلترها یا عبارت جستجو را تغییر دهید.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>پروژه</th>
                <th>سازمان</th>
                <th>مالک</th>
                <th>اولویت</th>
                <th>پیشرفت</th>
                <th>پایانِ هدف</th>
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <Link className="t-primary" href={`/projects/${p.id}`}>{p.name}</Link>
                    {p.objective && <div className="t-muted" style={{ maxWidth: 300 }}>{p.objective.length > 80 ? p.objective.slice(0, 80) + '…' : p.objective}</div>}
                  </td>
                  <td>
                    {p.organization ? (
                      <Link className="t-primary" href={`/organizations/${p.organizationId}`} style={{ fontSize: 11.5 }}>{p.organization.name}</Link>
                    ) : <span className="t-muted">—</span>}
                  </td>
                  <td>
                    {p.owner ? (
                      <Link className="t-primary" href={`/people/${p.ownerId}`} style={{ fontSize: 11.5 }}>{p.owner.name}</Link>
                    ) : <span className="t-muted">—</span>}
                  </td>
                  <td><Badge tone={PRIO_TONE[p.priority ?? ''] ?? 'neutral'}>{fa(p.priority ?? '—')}</Badge></td>
                  <td>
                    {p.progress != null ? (
                      <div className="prog-line" style={{ minWidth: 120 }}>
                        <div className="prog-bar"><div className={`prog-fill ${p.progress >= 100 ? 'ok' : p.progress >= 60 ? '' : 'warn'}`} style={{ width: `${p.progress}%` }} /></div>
                        <span className="prog-num">{fmtNum(p.progress)}٪</span>
                      </div>
                    ) : <span className="t-muted">—</span>}
                  </td>
                  <td>
                    {p.targetAt ? (
                      <span className="cell-count"><CalendarRange size={12} /> {fmtDate(p.targetAt)}</span>
                    ) : <span className="t-muted">—</span>}
                  </td>
                  <td>
                    {writable ? (
                      <select aria-label={`تغییر وضعیت ${p.name}`} className="toolbar-select" style={{ minHeight: 30, padding: '2px 6px', fontSize: 11.5 }}
                        value={p.status} disabled={patchId === p.id}
                        onChange={e => quickStatus(p, e.target.value)}>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                      </select>
                    ) : <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{fa(p.status)}</Badge>}
                  </td>
                  <td>
                    <Link className="row-action" href={`/projects/${p.id}`} aria-label={`مشاهدهٔ ${p.name}`}><ChevronLeft size={16} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={createOpen}
        title="ثبت پروژه جدید"
        description="پروژه با سازمانِ کارفرما، مالک و زمان‌بندی ثبت می‌شود و در فهرست پروژه‌ها ظاهر می‌شود."
        onClose={() => setCreateOpen(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>انصراف</button>
          <button className="btn btn-primary" form="proj-create-form" type="submit" disabled={saving}>{saving ? 'در حال ثبت…' : 'ثبت پروژه'}</button>
        </>}
      >
        {formError && <div className="error-card" role="alert">{formError}</div>}
        <form id="proj-create-form" className="entity-form org-form" onSubmit={create}>
          <div className="form-section-head"><h3>پروژه</h3></div>
          <div className="form-grid">
            <div className="field full">
              <label className="field-label" htmlFor="pj-name">نام پروژه <span className="req">*</span></label>
              <input id="pj-name" required value={form.name} onChange={setF('name')} placeholder="مثلاً: پلتفرم بانکداری شرکتی" />
            </div>
            <div className="field full">
              <label className="field-label" htmlFor="pj-objective">هدف (اختیاری)</label>
              <textarea id="pj-objective" value={form.objective} onChange={setF('objective')} placeholder="نتیجهٔ نهایی که پروژه دنبال می‌کند…" />
            </div>
            <div className="field full">
              <label className="field-label" htmlFor="pj-desc">توضیحات (اختیاری)</label>
              <textarea id="pj-desc" value={form.description} onChange={setF('description')} placeholder="شرح کوتاه پروژه…" />
            </div>
          </div>
          <div className="form-section-head"><h3>سازمان و مالکیت</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="pj-org">سازمانِ کارفرما <span className="req">*</span></label>
              <select id="pj-org" value={form.organizationId} onChange={setF('organizationId')}>
                <option value="">انتخاب سازمان…</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="pj-owner">مالک پروژه</label>
              <select id="pj-owner" value={form.ownerId} onChange={setF('ownerId')}>
                <option value="">بدون مالک</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.organization?.name ? ` — ${p.organization.name}` : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="pj-status">وضعیت شروع</label>
              <select id="pj-status" value={form.status} onChange={setF('status')}>
                {STATUS_OPTIONS.filter(s => s !== 'COMPLETED' && s !== 'CANCELLED').map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="pj-prio">اولویت</label>
              <select id="pj-prio" value={form.priority} onChange={setF('priority')}>
                {PRIO_OPTIONS.map(p => <option key={p} value={p}>{fa(p)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="pj-start">شروع</label>
              <JalaliDateField id="pj-start" value={form.startAt} onChange={setF('startAt')} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="pj-target">پایانِ هدف</label>
              <JalaliDateField id="pj-target" value={form.targetAt} onChange={setF('targetAt')} />
            </div>
          </div>
        </form>
      </Modal>
    </main>
  );
}
