'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Card, Badge } from '@srip/design-system';
import { Modal } from '../_components/page-ui';
import {
  Users, Building2, Search, Plus, Crown, Handshake, ChevronLeft, Star,
  ArrowDownWideNarrow, CalendarDays, Zap, AlertTriangle,
} from 'lucide-react';

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  country?: string;
  status?: string;
  influenceScore?: number;
  decisionPower?: number;
  accessibilityScore?: number;
  organizationId: string;
  organization?: { id: string; name: string } | null;
};
type Meeting = { id: string; title: string; startAt: string; participants?: Array<{ person?: { id: string } } | { personId?: string }> };
type ActionItem = { id: string; title: string; status: string; priority?: string | null; dueAt?: string | null; ownerId?: string | null };

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'success', INACTIVE: 'neutral', ON_LEAVE: 'warning', DORMANT: 'neutral', ARCHIVED: 'danger',
};
const ORG_TYPES = ['HOLDING', 'SUBSIDIARY', 'CUSTOMER', 'PARTNER', 'BANK', 'GOVERNMENT', 'INVESTOR', 'SUPPLIER', 'OTHER'];
const DONE_STATUSES = ['DONE', 'COMPLETED', 'CANCELLED'];
const SORTS = [
  { value: 'influence', label: 'بیشترین نفوذ' },
  { value: 'name', label: 'نام (الف‌با)' },
  { value: 'actions', label: 'بیشترین اقدام باز' },
  { value: 'stale', label: 'قدیمی‌ترین جلسه' },
] as const;
type SortKey = typeof SORTS[number]['value'];

const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);

function personMeetingIds(m: Meeting): string[] {
  return (m.participants ?? [])
    .map((x: any) => x?.person?.id ?? x?.personId ?? '')
    .filter(Boolean);
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
function toneOfScore(v: number | undefined): 'hi' | 'mid' | 'lo' {
  const n = v ?? 0;
  if (n >= 75) return 'hi';
  if (n >= 50) return 'mid';
  return 'lo';
}
function priorityLevel(p?: string | null): number {
  if (p === 'CRITICAL') return 3;
  if (p === 'HIGH') return 2;
  if (p === 'MEDIUM') return 1;
  return 0;
}

export default function PeoplePage() {
  const { me, scopeId, can } = useWorkspace();
  const [items, setItems] = useState<Person[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string; type?: string }[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<SortKey>('influence');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ first: '', last: '', email: '', phone: '', org: '', title: '', department: '' });
  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const writable = can('person.write');
  const scopeQuery = (scopeId !== 'all' ? `?organizationId=${encodeURIComponent(scopeId)}` : '');

  async function load() {
    setError('');
    if (!items.length) setLoading(true);
    try {
      const [peopleRes, orgRes, meetRes, actRes] = await Promise.all([
        api<any>(`/people${scopeQuery}`),
        can('organization.read') ? api<any>('/organizations') : Promise.resolve([]),
        can('meeting.read') ? api<any>('/meetings') : Promise.resolve([]),
        can('action.read') ? api<any>('/actions') : Promise.resolve([]),
      ]);
      const unwrap = (x: any) => (Array.isArray(x) ? x : x?.data ?? x?.items ?? []);
      setItems(unwrap(peopleRes));
      setOrgs(unwrap(orgRes));
      setMeetings(unwrap(meetRes));
      setActions(unwrap(actRes));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- درگیری واقعی هر شخص: جلسات، اقدامات، تازگی ---- */
  const engagement = useMemo(() => {
    const map = new Map<string, { upcoming: Meeting[]; openActions: ActionItem[]; lastMeetingAt: string | null }>();
    const now = Date.now();
    const get = (pid: string) => {
      if (!map.has(pid)) map.set(pid, { upcoming: [], openActions: [], lastMeetingAt: null });
      return map.get(pid)!;
    };
    for (const m of meetings) {
      const t = new Date(m.startAt).getTime();
      for (const pid of personMeetingIds(m)) {
        const e = get(pid);
        if (t > now) e.upcoming.push(m);
        if (!e.lastMeetingAt || m.startAt > e.lastMeetingAt) e.lastMeetingAt = m.startAt;
      }
    }
    for (const a of actions) {
      if (!a.ownerId) continue;
      const e = get(a.ownerId);
      if (!DONE_STATUSES.includes(a.status ?? '')) e.openActions.push(a);
    }
    for (const e of map.values()) {
      e.upcoming.sort((a, b) => a.startAt.localeCompare(b.startAt));
      e.openActions.sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));
    }
    return map;
  }, [meetings, actions]);

  const sorted = useMemo(() => {
    const query = q.trim().toLowerCase();
    const out = items.filter(p => {
      if (statusFilter && (p.status ?? 'ACTIVE') !== statusFilter) return false;
      if (!query) return true;
      return (p.firstName + ' ' + p.lastName).toLowerCase().includes(query)
        || (p.email ?? '').toLowerCase().includes(query)
        || (p.title ?? '').toLowerCase().includes(query)
        || (p.department ?? '').toLowerCase().includes(query)
        || (p.organization?.name ?? '').toLowerCase().includes(query);
    });
    switch (sort) {
      case 'name':
        return [...out].sort((a, b) => (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName, 'fa'));
      case 'actions':
        return [...out].sort((a, b) =>
          (engagement.get(b.id)?.openActions.length ?? 0) - (engagement.get(a.id)?.openActions.length ?? 0));
      case 'stale':
        return [...out].sort((a, b) =>
          (engagement.get(a.id)?.lastMeetingAt ?? '').localeCompare(engagement.get(b.id)?.lastMeetingAt ?? ''));
      default:
        return [...out].sort((a, b) =>
          ((b.influenceScore ?? 0) + (b.decisionPower ?? 0)) - ((a.influenceScore ?? 0) + (a.decisionPower ?? 0)));
    }
  }, [items, q, statusFilter, sort, engagement]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter(p => (p.status ?? 'ACTIVE') === 'ACTIVE').length;
    const high = items.filter(p => (p.influenceScore ?? 0) >= 80).length;
    let openAct = 0, nextMeet = 0;
    for (const e of engagement.values()) { openAct += e.openActions.length; nextMeet += e.upcoming.length; }
    return { total, active, high, openAct, nextMeet };
  }, [items, engagement]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!writable) return;
    setSaving(true); setError('');
    try {
      await api('/people', { method: 'POST', body: JSON.stringify({
        firstName: form.first, lastName: form.last,
        email: form.email.trim() || undefined, phone: form.phone.trim() || undefined,
        title: form.title.trim() || undefined, department: form.department.trim() || undefined,
        organizationId: form.org,
      }) });
      setForm({ first: '', last: '', email: '', phone: '', org: '', title: '', department: '' });
      setCreateOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const scopeLabel = scopeId === 'all' ? 'همهٔ محدوده' : (me?.memberships?.find(m => m.organizationId === scopeId)?.organizationName ?? scopeId.slice(0, 12));

  return (
    <>
      <div className="people-page">
        <section className="page-heading">
          <div>
            <div className="eyebrow">فضای کاری · فهرست اصلی</div>
            <h1>اشخاص</h1>
            <p className="subtitle">فهرست اشخاص با نفوذ، قدرت تصمیم و درگیریِ واقعی هر شخص (جلسات پیشِ رو، اقدامات باز و تازگی تعامل) — محدودهٔ سازمانی شما.</p>
          </div>
          <div className="heading-tools">
            <span className="scope-chip"><Building2 size={13} /> {scopeLabel}</span>
            {writable && <button type="button" className="primary-action" onClick={() => { setError(''); setCreateOpen(true); }}><Plus size={14} /> افزودن شخص</button>}
          </div>
        </section>

        {error && <div className="error-card" role="alert">{error}</div>}

        {/* Stats */}
        <section className="stats-row" aria-label="شاخص‌های اشخاص">
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-purple"><Users size={18} /></span><span className="st-name">کل اشخاص</span></div>
            <strong className="st-value">{fmtNum(stats.total)}</strong>
            <div className="st-foot"><span className="st-delta up">در محدودهٔ فعلی</span></div>
          </div>
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-teal"><Handshake size={18} /></span><span className="st-name">فعال</span></div>
            <strong className="st-value">{fmtNum(stats.active)}</strong>
            <div className="st-foot"><span className="st-delta">{stats.total ? fmtNum(Math.round((stats.active / stats.total) * 100)) + '٪' : '—'}</span><span className="st-note">از کل</span></div>
          </div>
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-gold"><Crown size={18} /></span><span className="st-name">نفوذ بالا</span></div>
            <strong className="st-value">{fmtNum(stats.high)}</strong>
            <div className="st-foot"><span className="st-delta">نفوذ ۸۰ و بیشتر</span></div>
          </div>
          <div className="stat-card">
            <div className="st-top"><span className="st-ico ic-red"><Zap size={18} /></span><span className="st-name">اقدام باز</span></div>
            <strong className="st-value">{fmtNum(stats.openAct)}</strong>
            <div className="st-foot"><span className="st-delta">{fmtNum(stats.nextMeet)} جلسهٔ پیشِ رو</span></div>
          </div>
        </section>

        <Card className="people-directory">
          <div className="panel-title">
            <div><h2>فهرست اشخاص</h2><p>وضعیتِ واقعی هر شخص — بر پایهٔ جلسات، اقدامات و امتیازها</p></div>
            <div className="table-toolbar">
              <div className="search-box">
                <Search size={15} />
                <input placeholder="جستجوی نام، ایمیل، سمت یا سازمان…" value={q} onChange={e => setQ(e.target.value)} aria-label="جستجوی نام، ایمیل، سمت یا سازمان" />
              </div>
              <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
                <option value="">همهٔ وضعیت‌ها</option>
                {Object.keys(STATUS_TONE).map(s => <option key={s} value={s}>{fa(s)}</option>)}
              </select>
              <label className="toolbar-sort" aria-label="مرتب‌سازی">
                <ArrowDownWideNarrow size={14} />
                <select value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                  {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <span className="chip info">{fmtNum(sorted.length)} نتیجه</span>
            </div>
          </div>

          {loading ? (
            <div className="loading-row"><span className="spinner" /> در حال بارگذاری…</div>
          ) : sorted.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>شخص</th>
                    <th>سازمان / سمت</th>
                    <th>نفوذ</th>
                    <th>وضعیت</th>
                    <th>جلسات پیشِ رو</th>
                    <th>اقدامات باز</th>
                    <th>آخرین جلسه</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(p => {
                    const initials = `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`;
                    const eng = engagement.get(p.id);
                    const openActs = eng?.openActions ?? [];
                    const maxPrio = Math.max(0, ...openActs.map(a => priorityLevel(a.priority)));
                    const nextMeet = eng?.upcoming[0]?.startAt ?? null;
                    const lastMeet = eng?.lastMeetingAt ?? null;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="person-cell">
                            <span className="avatar">{initials || '؟'}</span>
                            <div>
                              <strong>{p.firstName} {p.lastName}</strong>
                              <small>{p.department ? p.department : (p.title || '—')}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="org-cell">
                            <strong>{p.organization?.name ?? '—'}</strong>
                            <small>{p.title || 'بدون سمت'}</small>
                          </div>
                        </td>
                        <td>
                          <div className="person-scores">
                            <span className={`person-score`} title="نفوذ">
                              <Star size={12} />
                              <b className={toneOfScore(p.influenceScore)}>{fmtNum(p.influenceScore ?? 0)}</b>
                            </span>
                          </div>
                        </td>
                        <td><Badge className={STATUS_TONE[p.status ?? 'ACTIVE'] ?? 'neutral'}>{fa(p.status ?? 'ACTIVE')}</Badge></td>
                        <td>
                          {nextMeet ? (
                            <span className="cell-count info" title={new Date(nextMeet).toLocaleDateString('fa-IR')}>
                              <CalendarDays size={12} /> {fmtNum(eng!.upcoming.length)}
                            </span>
                          ) : <span className="t-muted">—</span>}
                        </td>
                        <td>
                          {openActs.length ? (
                            <span className={`cell-count ${maxPrio >= 3 ? 'danger' : maxPrio === 2 ? 'warning' : ''}`}>
                              {maxPrio >= 2 ? <AlertTriangle size={12} /> : <Zap size={12} />} {fmtNum(openActs.length)}
                            </span>
                          ) : <span className="t-muted">—</span>}
                        </td>
                        <td className="t-muted">{timeAgo(lastMeet)}</td>
                        <td>
                          <Link className="row-action" href={`/people/${p.id}`} aria-label={`مشاهدهٔ ${p.firstName} ${p.lastName}`}>
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
              <Users size={28} />
              <p>{items.length === 0 ? 'شخصی در محدودهٔ فعلی ثبت نشده است.' : 'نتیجه‌ای با این فیلترها یافت نشد.'}</p>
              {writable && <button type="button" className="srip-button primary" onClick={() => { setError(''); setCreateOpen(true); }}><Plus size={14} /> افزودن اولین شخص</button>}
            </div>
          )}
        </Card>
      </div>

      {/* Create modal */}
      <Modal open={createOpen} title="افزودن شخص" description="شخص در محدودهٔ سازمانی شما ثبت می‌شود و بلافاصله در فهرست ظاهر می‌شود." onClose={() => setCreateOpen(false)}
        footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>انصراف</button>
          <button type="submit" form="person-create-form" className="srip-button primary" disabled={saving}>{saving ? 'در حال ذخیره…' : 'ایجاد شخص'}</button>
        </>}>
        <form id="person-create-form" className="entity-form org-form" onSubmit={create}>
          <div className="form-section-head"><h3>اطلاعات فردی</h3></div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="p-first">نام <span className="req">*</span></label>
              <input id="p-first" value={form.first} onChange={setF('first')} required placeholder="مثلاً: سارا" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-last">نام خانوادگی <span className="req">*</span></label>
              <input id="p-last" value={form.last} onChange={setF('last')} required placeholder="مثلاً: محمدی" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-email">ایمیل</label>
              <input id="p-email" type="email" dir="ltr" value={form.email} onChange={setF('email')} placeholder="sara@example.ir" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-phone">تلفن</label>
              <input id="p-phone" dir="ltr" value={form.phone} onChange={setF('phone')} placeholder="+98 ..." />
            </div>
          </div>

          <div className="form-section-head"><h3>سازمان و سمت</h3></div>
          <div className="form-grid">
            <div className="field full">
              <label className="field-label" htmlFor="p-org">سازمان <span className="req">*</span></label>
              <select id="p-org" value={form.org} onChange={setF('org')} required>
                <option value="">انتخاب کنید…</option>
                {orgs.map(o => <option value={o.id} key={o.id}>{o.name}{o.type ? ` — ${fa(o.type)}` : ''}</option>)}
              </select>
              <span className="field-hint">سازمان مبدأِ این شخص؛ بعداً می‌توانید نقش‌های سازمانی دیگری نیز برایش ثبت کنید.</span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-title">سمت</label>
              <input id="p-title" value={form.title} onChange={setF('title')} placeholder="مثلاً: مدیر فروش" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p-dept">بخش</label>
              <input id="p-dept" value={form.department} onChange={setF('department')} placeholder="مثلاً: فروش" />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
