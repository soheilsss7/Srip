'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar } from '../_components/page-ui';
import { CheckCircle2, ChevronLeft, Clock3, Plus, RefreshCw, Search, ShieldAlert, Handshake, ArrowDownWideNarrow, CalendarClock } from 'lucide-react';;
import { JalaliDateField } from '../_components/jalali-date-field';

type Commitment = {
  id: string; description: string; status: string; dueAt?: string | null; risk?: string | null;
  direction?: 'OURS' | 'THEIRS' | string | null; notes?: string | null; late?: boolean;
  ownerId?: string | null; personId?: string | null;
  organizationId?: string | null;
  organization?: { id: string; name: string } | null;
  owner?: { id: string; name: string } | null;
  person?: { id: string; name: string } | null;
  relationship?: { id: string; sourceOrganization?: { name?: string } | null; targetOrganization?: { name?: string } | null } | null;
  meeting?: { id: string; title: string } | null;
  project?: { id: string; name: string } | null;
  createdAt?: string | null; fulfilledAt?: string | null;
};
type Person = { id: string; firstName: string; lastName: string; title?: string | null; organization?: { id?: string; name?: string } | null };
type Org = { id: string; name: string };
type Rel = { id: string; sourceOrganization?: { id: string; name: string } | null; targetOrganization?: { id: string; name: string } | null; relationshipType?: string };
type Meeting = { id: string; title: string };
type Project = { id: string; name: string };

const STATUS_OPTIONS = ['OPEN', 'OVERDUE', 'FULFILLED', 'CANCELLED'];
const RISK_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'];
const OPEN_STATUSES = ['OPEN', 'OVERDUE'];
const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  OPEN: 'warning', OVERDUE: 'danger', FULFILLED: 'success', CANCELLED: 'neutral',
};
const RISK_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  LOW: 'neutral', MEDIUM: 'warning', HIGH: 'danger',
};
const SORTS = [
  { value: 'due', label: 'نزدیک‌ترین موعد' },
  { value: 'overdue', label: 'عقب‌افتاده‌ترین اول' },
  { value: 'risk', label: 'پُرریسک‌ترین اول' },
  { value: 'created', label: 'جدیدترین' },
] as const;
type SortKey = typeof SORTS[number]['value'];

const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }) : '—';
const riskLevel = (r?: string | null) => (r === 'HIGH' ? 2 : r === 'MEDIUM' ? 1 : 0);
const isLate = (c: Commitment) => !!c.dueAt && c.status === 'OPEN' && new Date(c.dueAt).getTime() < Date.now();
const dirLabel = (c: Commitment) => {
  const org = c.organization?.name ?? 'طرف مقابل';
  return c.direction === 'THEIRS' ? `${org} به ما` : `ما به ${org}`;
};

export default function CommitmentsPage() {
  const { can } = useWorkspace();
  const writable = can('commitment.write');
  const [items, setItems] = useState<Commitment[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [rels, setRels] = useState<Rel[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [dirFilter, setDirFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('due');
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [patchId, setPatchId] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: '', notes: '', direction: 'OURS', organizationId: '', ownerId: '', personId: '',
    relationshipId: '', meetingId: '', projectId: '', risk: 'MEDIUM', status: 'OPEN', dueAt: '', reminderAt: '',
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [cs, ps, os, rs, ms, pjs] = await Promise.all([
        api<Commitment[]>('/commitments'),
        can('person.read') ? api<any>('/people').catch(() => []) : Promise.resolve([]),
        can('organization.read') ? api<any>('/organizations').catch(() => []) : Promise.resolve([]),
        api<any>('/relationships'),
        can('meeting.read') ? api<any>('/meetings').catch(() => []) : Promise.resolve([]),
        can('project.read') ? api<any>('/projects').catch(() => []) : Promise.resolve([]),
      ]);
      const arr = (x: any): any[] => (Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : x?.data ?? []);
      setItems(arr(cs));
      setPeople(arr(ps)); setOrgs(arr(os)); setRels(arr(rs)); setMeetings(arr(ms)); setProjects(arr(pjs));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [can]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const open = items.filter(c => OPEN_STATUSES.includes(c.status));
    const late = items.filter(c => isLate(c) || c.status === 'OVERDUE');
    const fulfilled = items.filter(c => c.status === 'FULFILLED');
    const theirsOpen = items.filter(c => c.direction === 'THEIRS' && OPEN_STATUSES.includes(c.status));
    return {
      total: items.length, open: open.length, late: late.length, fulfilled: fulfilled.length, theirsOpen: theirsOpen.length,
    };
  }, [items]);

  const orgOptions = useMemo(() => {
    const map = new Map<string, Org>();
    orgs.forEach(o => map.set(o.id, o));
    rels.forEach(r => { if (r.sourceOrganization) map.set(r.sourceOrganization.id, { id: r.sourceOrganization!.id, name: r.sourceOrganization!.name! }); if (r.targetOrganization) map.set(r.targetOrganization.id, { id: r.targetOrganization!.id, name: r.targetOrganization!.name! }); });
    return [...map.values()];
  }, [orgs, rels]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = items.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (riskFilter && (c.risk ?? 'MEDIUM') !== riskFilter) return false;
      if (dirFilter && (c.direction ?? 'OURS') !== dirFilter) return false;
      if (term && !`${c.description} ${c.notes ?? ''} ${c.organization?.name ?? ''} ${c.owner?.name ?? ''} ${c.person?.name ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
    switch (sortBy) {
      case 'overdue':
        return [...out].sort((a, b) => {
          const ao = isLate(a) ? 1 : 0, bo = isLate(b) ? 1 : 0;
          if (ao !== bo) return bo - ao;
          return (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999');
        });
      case 'risk':
        return [...out].sort((a, b) => riskLevel(b.risk) - riskLevel(a.risk) || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));
      case 'created':
        return [...out].sort((a, b) => (b.createdAt ?? b.id).localeCompare(a.createdAt ?? a.id));
      default:
        return [...out].sort((a, b) => {
          const ao = isLate(a), bo = isLate(b);
          if (ao !== bo) return ao ? -1 : 1;
          return (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999');
        });
    }
  }, [items, q, statusFilter, riskFilter, dirFilter, sortBy]);

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
    if (!form.description.trim()) { setFormError('شرح تعهد لازم است.'); setSaving(false); return; }
    if (!form.organizationId) { setFormError('سازمان طرفِ تعهد را انتخاب کنید.'); setSaving(false); return; }
    try {
      await api('/commitments', { method: 'POST', body: JSON.stringify({
        description: form.description.trim(),
        notes: form.notes.trim() || undefined,
        direction: form.direction,
        organizationId: form.organizationId,
        ownerId: form.ownerId || undefined,
        personId: form.personId || undefined,
        relationshipId: form.relationshipId || undefined,
        meetingId: form.meetingId || undefined,
        projectId: form.projectId || undefined,
        risk: form.risk,
        status: form.status,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        reminderAt: form.reminderAt ? new Date(form.reminderAt).toISOString() : undefined,
      }) });
      setForm({ description: '', notes: '', direction: 'OURS', organizationId: '', ownerId: '', personId: '', relationshipId: '', meetingId: '', projectId: '', risk: 'MEDIUM', status: 'OPEN', dueAt: '', reminderAt: '' });
      setCreateOpen(false); await load();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  async function quickStatus(c: Commitment, status: string) {
    setPatchId(c.id); setError('');
    try {
      await api(`/commitments/${c.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (err) { setError((err as Error).message); }
    finally { setPatchId(null); }
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="فضای کاری · عملیات"
        title="تعهدات"
        description="قول‌هایی که به طرف‌ها داده‌ایم یا از آن‌ها گرفته‌ایم — با مسئول، موعد، ریسک و زمینهٔ رابطه."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} aria-label="بازخوانی"><RefreshCw size={15} /> بازخوانی</button>
            {writable && <button className="btn btn-primary" onClick={() => { setError(''); setFormError(''); setCreateOpen(true); }}><Plus size={16} /> تعهد جدید</button>}
          </>
        }
      />
      <ErrorCard message={error} />

      {loading ? (
        <div className="stat-grid">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 110 }} />)}</div>
      ) : (
        <div className="stat-grid">
          <StatCard icon={<Handshake size={18} />} label="کل تعهدات" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در محدودهٔ مجاز" />
          <StatCard icon={<Clock3 size={18} />} label="باز" value={fmtNum(stats.open)} iconClass="ic-teal" sub="در جریانِ انجام" />
          <StatCard icon={<ShieldAlert size={18} />} label="عقب‌افتاده" value={fmtNum(stats.late)} iconClass="ic-red" sub="موعد گذشته یا اعلام‌شده" />
          <StatCard icon={<CheckCircle2 size={18} />} label="انجام‌شده" value={fmtNum(stats.fulfilled)} iconClass="ic-gold" sub={stats.theirsOpen ? `${fmtNum(stats.theirsOpen)} تعهدِ بازِ طرف مقابل` : ''} />
        </div>
      )}

      <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی شرح، سازمان یا مسئول…">
        <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
          <option value="">همهٔ وضعیت‌ها</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
        </select>
        <select aria-label="فیلتر ریسک" value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="toolbar-select">
          <option value="">همهٔ ریسک‌ها</option>
          {RISK_OPTIONS.map(r => <option key={r} value={r}>{fa(r)}</option>)}
        </select>
        <select aria-label="فیلتر جهت تعهد" value={dirFilter} onChange={e => setDirFilter(e.target.value)} className="toolbar-select">
          <option value="">همهٔ جهت‌ها</option>
          <option value="OURS">ما به طرف</option>
          <option value="THEIRS">طرف به ما</option>
        </select>
        <label className="toolbar-sort" aria-label="مرتب‌سازی">
          <ArrowDownWideNarrow size={14} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}>
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <span className="chip info">{fmtNum(filtered.length)} تعهد</span>
      </Toolbar>

      {loading ? (
        <div className="skeleton skeleton-table" />
      ) : filtered.length === 0 ? (
        <div className="empty-state-v4">
          <div className="empty-ico"><Search size={24} /></div>
          <strong>{items.length === 0 ? 'تعهدی ثبت نشده است' : 'نتیجه‌ای یافت نشد'}</strong>
          <p>{items.length === 0 ? 'از دکمهٔ «تعهد جدید» برای ثبت نخستین تعهد استفاده کنید.' : 'فیلترها یا عبارت جستجو را تغییر دهید.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>شرح تعهد</th>
                <th>جهت و طرف</th>
                <th>مسئول اجرا</th>
                <th>ریسک</th>
                <th>موعد</th>
                <th>وضعیت</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const late = isLate(c) || c.status === 'OVERDUE';
                const dir = c.direction === 'THEIRS';
                return (
                  <tr key={c.id} className={late ? 'row-alert' : ''}>
                    <td>
                      <Link className="t-primary" href={`/commitments/${c.id}`}>{c.description}</Link>
                      {c.notes && <div className="t-muted" style={{ maxWidth: 300 }}>{c.notes.length > 90 ? c.notes.slice(0, 90) + '…' : c.notes}</div>}
                    </td>
                    <td>
                      <span className="dir-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Badge tone={dir ? 'warning' : 'info'}>{dir ? 'طرف به ما' : 'ما به طرف'}</Badge>
                      </span>
                      {c.organization ? (
                        <Link className="t-primary" href={`/organizations/${c.organizationId}`} style={{ fontSize: 11.5, display: 'block', marginTop: 3 }}>{c.organization.name}</Link>
                      ) : <span className="t-muted" style={{ display: 'block' }}>—</span>}
                      {c.relationship && c.relationship.sourceOrganization && c.relationship.targetOrganization && (
                        <span className="t-muted" style={{ fontSize: 10.5, display: 'block', marginTop: 1 }}>{c.relationship.sourceOrganization.name} ↔ {c.relationship.targetOrganization.name}</span>
                      )}
                    </td>
                    <td>
                      {c.owner ? (
                        <Link className="t-primary" href={`/people/${c.ownerId}`} style={{ fontSize: 11.5 }}>{c.owner.name}</Link>
                      ) : <span className="t-muted">—</span>}
                    </td>
                    <td><Badge tone={RISK_TONE[c.risk ?? ''] ?? 'neutral'}>{fa(c.risk ?? '—')}</Badge></td>
                    <td>
                      {c.dueAt ? (
                        <span className={`cell-count ${late ? 'danger' : ''}`}>
                          <CalendarClock size={12} /> {fmtDate(c.dueAt)}{late ? ' · عقب‌افتاده' : ''}
                        </span>
                      ) : <span className="t-muted">—</span>}
                    </td>
                    <td>
                      {writable ? (
                        <select aria-label={`تغییر وضعیت ${c.description}`} className="toolbar-select" style={{ minHeight: 30, padding: '2px 6px', fontSize: 11.5 }}
                          value={c.status} disabled={patchId === c.id}
                          onChange={e => quickStatus(c, e.target.value)}>
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{fa(s)}</option>)}
                        </select>
                      ) : <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{fa(c.status)}</Badge>}
                    </td>
                    <td>
                      <Link className="row-action" href={`/commitments/${c.id}`} aria-label={`مشاهدهٔ ${c.description}`}><ChevronLeft size={16} /></Link>
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
        title="ثبت تعهد جدید"
        description="قول ثبت می‌شود؛ جهتِ آن مشخص می‌کند که چه کسی متعهد است — ما یا طرف."
        onClose={() => setCreateOpen(false)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>انصراف</button>
          <button className="btn btn-primary" form="commit-create-form" type="submit" disabled={saving}>{saving ? 'در حال ثبت…' : 'ثبت تعهد'}</button>
        </>}
      >
        {formError && <div className="error-card" role="alert">{formError}</div>}
        <form id="commit-create-form" className="entity-form org-form" onSubmit={create}>
          <div className="form-section-head"><h3>شرح تعهد</h3></div>
          <div className="form-grid">
            <div className="field full">
              <label className="field-label" htmlFor="cc-desc">شرح تعهد <span className="req">*</span></label>
              <input id="cc-desc" required value={form.description} onChange={setF('description')} placeholder="مثلاً: تحویل پیش‌فاکتور نهایی تا پایان هفته" />
            </div>
            <div className="field full">
              <label className="field-label" htmlFor="cc-notes">توضیح تکمیلی (اختیاری)</label>
              <textarea id="cc-notes" value={form.notes} onChange={setF('notes')} placeholder="جزئیات، شرایط یا منبع قول…" />
            </div>
          </div>
          <div className="form-section-head"><h3>جهت و طرف</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="cc-dir">جهت تعهد</label>
              <select id="cc-dir" value={form.direction} onChange={setF('direction')}>
                <option value="OURS">ما به طرفِ مقابل</option>
                <option value="THEIRS">طرفِ مقابل به ما</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cc-org">سازمان طرف <span className="req">*</span></label>
              <select id="cc-org" value={form.organizationId} onChange={setF('organizationId')}>
                <option value="">انتخاب سازمان…</option>
                {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cc-rel">رابطهٔ مرتبط</label>
              <select id="cc-rel" value={form.relationshipId} onChange={e => onRelPick(e.target.value)}>
                <option value="">بدون رابطه</option>
                {rels.map(r => (
                  <option key={r.id} value={r.id}>{r.sourceOrganization?.name ?? '—'} ↔ {r.targetOrganization?.name ?? '—'}{r.relationshipType ? ` (${fa(r.relationshipType)})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cc-meeting">جلسهٔ مبدأ</label>
              <select id="cc-meeting" value={form.meetingId} onChange={setF('meetingId')}>
                <option value="">بدون جلسه</option>
                {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cc-project">پروژهٔ مرتبط</label>
              <select id="cc-project" value={form.projectId} onChange={setF('projectId')}>
                <option value="">بدون پروژه</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-section-head"><h3>مسئولیت و پیگیری</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="cc-owner">مسئول اجرا</label>
              <select id="cc-owner" value={form.ownerId} onChange={setF('ownerId')}>
                <option value="">بدون مسئول</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.organization?.name ? ` — ${p.organization.name}` : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cc-person">شخص طرفِ مقابل</label>
              <select id="cc-person" value={form.personId} onChange={setF('personId')}>
                <option value="">بدون شخص</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.organization?.name ? ` — ${p.organization.name}` : ''}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cc-risk">ریسک</label>
              <select id="cc-risk" value={form.risk} onChange={setF('risk')}>
                {RISK_OPTIONS.map(r => <option key={r} value={r}>{fa(r)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cc-status">وضعیت شروع</label>
              <select id="cc-status" value={form.status} onChange={setF('status')}>
                {STATUS_OPTIONS.filter(s => s !== 'OVERDUE').map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cc-due">موعد</label>
              <JalaliDateField id="cc-due" withTime value={form.dueAt} onChange={setF('dueAt')} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cc-rem">یادآور</label>
              <JalaliDateField id="cc-rem" withTime value={form.reminderAt} onChange={setF('reminderAt')} />
            </div>
          </div>
        </form>
      </Modal>
    </main>
  );
}
