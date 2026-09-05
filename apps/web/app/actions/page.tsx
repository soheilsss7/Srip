'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Card } from '@srip/design-system';
import { Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar } from '../_components/page-ui';
import { Zap, AlertTriangle, CalendarClock, User, ChevronLeft, Plus, RefreshCw, Search, ArrowDownWideNarrow, CheckCircle2 } from 'lucide-react';;
import { JalaliDateField } from '../_components/jalali-date-field';

type Action = {
  id: string; title: string; status: string; priority?: string | null; dueAt?: string | null;
  description?: string | null; reminderAt?: string | null; outcome?: string | null;
  ownerId?: string | null;
  owner?: { id: string; name: string } | null;
  relationshipId?: string | null;
  relationship?: { id: string; relationshipType?: string; sourceOrganization?: { name?: string } | null; targetOrganization?: { name?: string } | null } | null;
  dependencies?: any[]; blockedBy?: any[];
};
type Person = { id: string; firstName: string; lastName: string; title?: string | null };

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  OPEN: 'warning', IN_PROGRESS: 'info', BLOCKED: 'danger', DONE: 'success', COMPLETED: 'success', CANCELLED: 'neutral',
};
const PRIO_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};
const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
const PRIO_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const DONE_STATUSES = ['DONE', 'COMPLETED', 'CANCELLED'];
const SORTS = [
  { value: 'due', label: 'نزدیک‌ترین موعد' },
  { value: 'overdue', label: 'عقب‌افتاده‌ترین اول' },
  { value: 'priority', label: 'بحرانی‌ترین اول' },
  { value: 'created', label: 'جدیدترین' },
] as const;
type SortKey = typeof SORTS[number]['value'];

const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }) : '—';
const prioLevel = (p?: string | null) => (p === 'CRITICAL' ? 3 : p === 'HIGH' ? 2 : p === 'MEDIUM' ? 1 : 0);
const isOverdue = (a: Action) => !!a.dueAt && !DONE_STATUSES.includes(a.status) && new Date(a.dueAt).getTime() < Date.now();
const relLabel = (r: Action['relationship']) =>
  r ? `${r.sourceOrganization?.name ?? '—'} ↔ ${r.targetOrganization?.name ?? '—'}` : null;

export default function ActionsPage() {
  const { can } = useWorkspace();
  const writable = can('action.write');
  const [items, setItems] = useState<Action[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [prioFilter, setPrioFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('due');
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [patchId, setPatchId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', ownerId: '', relationshipId: '', priority: 'MEDIUM', status: 'OPEN', dueAt: '', reminderAt: '' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [acts, ps, rs] = await Promise.all([
        api<Action[]>('/actions'),
        can('person.read') ? api<any>('/people') : Promise.resolve([]),
        api<any>('/relationships'),
      ]);
      setItems(Array.isArray(acts) ? acts : (acts as any)?.data ?? []);
      const arr = (x: any) => (Array.isArray(x) ? x : x?.data ?? x?.items ?? []);
      setPeople(arr(ps)); setRels(arr(rs));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [can]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const now = Date.now();
    const open = items.filter(a => !DONE_STATUSES.includes(a.status));
    const overdue = items.filter(isOverdue);
    const critical = items.filter(a => !DONE_STATUSES.includes(a.status) && a.priority === 'CRITICAL');
    const done = items.filter(a => DONE_STATUSES.includes(a.status) && a.status !== 'CANCELLED');
    return {
      total: items.length, open: open.length, overdue: overdue.length,
      critical: critical.length, done: done.length,
      completion: items.length ? Math.round((done.length / items.length) * 100) : null,
      nextDue: [...open].sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'))[0]?.dueAt ?? null,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = items.filter(a => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (prioFilter && a.priority !== prioFilter) return false;
      if (term && !`${a.title} ${a.owner?.name ?? ''} ${relLabel(a.relationship) ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
    switch (sortBy) {
      case 'overdue':
        return [...out].sort((a, b) => {
          const ao = isOverdue(a) ? 1 : 0, bo = isOverdue(b) ? 1 : 0;
          if (ao !== bo) return bo - ao;
          return (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999');
        });
      case 'priority':
        return [...out].sort((a, b) => prioLevel(b.priority) - prioLevel(a.priority) || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));
      case 'created':
        return [...out].sort((a, b) => b.id.localeCompare(a.id));
      default:
        return [...out].sort((a, b) => {
          const ao = isOverdue(a), bo = isOverdue(b);
          if (ao !== bo) return ao ? -1 : 1;
          return (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999');
        });
    }
  }, [items, q, statusFilter, prioFilter, sortBy]);

  const setF = (k: keyof typeof form) => (v: string | React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: typeof v === 'string' ? v : v.target.value }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!writable) return;
    setSaving(true); setError(''); setFormError('');
    if (!form.title.trim()) { setFormError('عنوان اقدام لازم است.'); setSaving(false); return; }
    try {
      await api('/actions', { method: 'POST', body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        ownerId: form.ownerId || undefined,
        relationshipId: form.relationshipId || undefined,
        priority: form.priority,
        status: form.status,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : undefined,
      }) });
      setForm({ title: '', description: '', ownerId: '', relationshipId: '', priority: 'MEDIUM', status: 'OPEN', dueAt: '', reminderAt: '' });
      setCreateOpen(false); await load();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  async function quickStatus(a: Action, status: string) {
    setPatchId(a.id); setError('');
    try {
      await api(`/actions/${a.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (err) { setError((err as Error).message); }
    finally { setPatchId(null); }
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری · عملیات"
        title="اقدامات"
        description="هر اقدام با مالک، اولویت، موعد و زمینهٔ رابطه — عقب‌افتاده‌ها و بحرانی‌ها در یک نگاه."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} aria-label="بازخوانی"><RefreshCw size={15} /> بازخوانی</button>
            {writable && <button className="btn btn-primary" onClick={() => { setError(''); setFormError(''); setCreateOpen(true); }}><Plus size={16} /> اقدام جدید</button>}
          </>
        }
      />
      <ErrorCard message={error} />

      {loading ? (
        <div className="stat-grid">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 110 }} />)}</div>
      ) : (
        <div className="stat-grid">
          <StatCard icon={<Zap size={18} />} label="کل اقدامات" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در محدودهٔ مجاز" />
          <StatCard icon={<CheckCircle2 size={18} />} label="باز" value={fmtNum(stats.open)} iconClass="ic-teal" sub={stats.completion != null ? `${fmtNum(stats.completion)}٪ تکمیل‌شده` : ''} />
          <StatCard icon={<AlertTriangle size={18} />} label="عقب‌افتاده" value={fmtNum(stats.overdue)} iconClass="ic-red" sub="موعد گذشته و باز" />
          <StatCard icon={<AlertTriangle size={18} />} label="بحرانی" value={fmtNum(stats.critical)} iconClass="ic-gold" sub="اولویت بحرانی و باز" />
        </div>
      )}

      <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی عنوان، مالک یا سازمان…">
        <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
          <option value="">همهٔ وضعیت‌ها</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
        </select>
        <select aria-label="فیلتر اولویت" value={prioFilter} onChange={e => setPrioFilter(e.target.value)} className="toolbar-select">
          <option value="">همهٔ اولویت‌ها</option>
          {PRIO_OPTIONS.map(p => <option key={p} value={p}>{fa(p)}</option>)}
        </select>
        <label className="toolbar-sort" aria-label="مرتب‌سازی">
          <ArrowDownWideNarrow size={14} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}>
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <span className="chip info">{fmtNum(filtered.length)} اقدام</span>
      </Toolbar>

      {loading ? (
        <div className="skeleton skeleton-table" />
      ) : filtered.length === 0 ? (
        <div className="empty-state-v4">
          <div className="empty-ico"><Search size={24} /></div>
          <strong>{items.length === 0 ? 'اقدامی ثبت نشده است' : 'نتیجه‌ای یافت نشد'}</strong>
          <p>{items.length === 0 ? 'از دکمهٔ «اقدام جدید» برای ثبت نخستین اقدام استفاده کنید.' : 'فیلترها یا عبارت جستجو را تغییر دهید.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>اقدام</th>
                <th>زمینه (رابطه)</th>
                <th>مالک</th>
                <th>اولویت</th>
                <th>موعد</th>
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const overdue = isOverdue(a);
                const label = relLabel(a.relationship);
                return (
                  <tr key={a.id} className={overdue ? 'row-alert' : ''}>
                    <td>
                      <Link className="t-primary" href={`/actions/${a.id}`}>{a.title}</Link>
                      {a.description && <div className="t-muted" style={{ maxWidth: 280 }}>{a.description.length > 80 ? a.description.slice(0, 80) + '…' : a.description}</div>}
                    </td>
                    <td>
                      {label ? (
                        <Link className="t-primary" href={`/relationships/${a.relationship?.id}`} style={{ fontSize: 11.5 }}>{label}</Link>
                      ) : <span className="t-muted">—</span>}
                    </td>
                    <td>
                      {a.owner ? (
                        <Link className="t-primary" href={`/people/${a.ownerId}`} style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <User size={12} /> {a.owner.name}
                        </Link>
                      ) : <span className="t-muted">—</span>}
                    </td>
                    <td><Badge tone={PRIO_TONE[a.priority ?? ''] ?? 'neutral'}>{fa(a.priority ?? '—')}</Badge></td>
                    <td>
                      {a.dueAt ? (
                        <span className={`cell-count ${overdue ? 'danger' : ''}`}>
                          <CalendarClock size={12} /> {fmtDate(a.dueAt)}{overdue ? ' · عقب‌افتاده' : ''}
                        </span>
                      ) : <span className="t-muted">—</span>}
                    </td>
                    <td>
                      {writable ? (
                        <select aria-label={`تغییر وضعیت ${a.title}`} className="toolbar-select" style={{ minHeight: 30, padding: '2px 6px', fontSize: 11.5 }}
                          value={a.status} disabled={patchId === a.id}
                          onChange={e => quickStatus(a, e.target.value)}>
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                        </select>
                      ) : <Badge tone={STATUS_TONE[a.status] ?? 'neutral'}>{fa(a.status)}</Badge>}
                    </td>
                    <td>
                      <Link className="row-action" href={`/actions/${a.id}`} aria-label={`مشاهدهٔ ${a.title}`}><ChevronLeft size={16} /></Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={createOpen}
        title="ثبت اقدام جدید"
        description="اقدام با مالک و زمینهٔ رابطه ثبت می‌شود و در داشبورد و فهرست اقدامات ظاهر می‌شود."
        onClose={() => setCreateOpen(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>انصراف</button>
          <button className="btn btn-primary" form="action-create-form" type="submit" disabled={saving}>{saving ? 'در حال ثبت…' : 'ثبت اقدام'}</button>
        </>}
      >
        {formError && <div className="error-card" role="alert">{formError}</div>}
        <form id="action-create-form" className="entity-form org-form" onSubmit={create}>
          <div className="form-section-head"><h3>اقدام</h3></div>
          <div className="form-grid">
            <div className="field full">
              <label className="field-label" htmlFor="a-title">عنوان اقدام <span className="req">*</span></label>
              <input id="a-title" required value={form.title} onChange={setF('title')} placeholder="مثلاً: پیگیری امضای قرارداد پترو صنعت" />
            </div>
            <div className="field full">
              <label className="field-label" htmlFor="a-desc">توضیح (اختیاری)</label>
              <textarea id="a-desc" value={form.description} onChange={setF('description')} placeholder="شرحی کوتاه از اقدام…" />
            </div>
          </div>
          <div className="form-section-head"><h3>مالک و زمینه</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="a-owner">مالک (شخص مسئول)</label>
              <select id="a-owner" value={form.ownerId} onChange={setF('ownerId')}>
                <option value="">بدون مالک</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.title ? ` — ${p.title}` : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="a-rel">رابطهٔ مرتبط</label>
              <select id="a-rel" value={form.relationshipId} onChange={setF('relationshipId')}>
                <option value="">بدون رابطه</option>
                {rels.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.sourceOrganization?.name ?? '—'} ↔ {r.targetOrganization?.name ?? '—'}{r.relationshipType ? ` (${fa(r.relationshipType)})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-section-head"><h3>اولویت و زمان‌بندی</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="a-prio">اولویت</label>
              <select id="a-prio" value={form.priority} onChange={setF('priority')}>
                {PRIO_OPTIONS.map(p => <option key={p} value={p}>{fa(p)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="a-status">وضعیت شروع</label>
              <select id="a-status" value={form.status} onChange={setF('status')}>
                {STATUS_OPTIONS.filter(s => s !== 'DONE' && s !== 'CANCELLED').map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="a-due">موعد</label>
              <JalaliDateField id="a-due" withTime value={form.dueAt} onChange={setF('dueAt')} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="a-rem">یادآور</label>
              <JalaliDateField id="a-rem" withTime value={form.reminderAt} onChange={setF('reminderAt')} />
            </div>
          </div>
        </form>
      </Modal>
    </main>
  );
}
