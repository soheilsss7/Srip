'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../_components/page-ui';
import {
  RefreshCw, Search, Plus, X, CheckCircle2, UserPlus, ArrowLeft, Handshake,
  ThumbsUp, Ban, XCircle, Building2, UserRound, Mail, StickyNote, Send,
  Clock3, CalendarCheck2, ChevronLeft,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  معرفی‌ها — مسیرهای معرفی، وضعیت و نتیجه                            */
/*  بک‌اند: GET/POST/PATCH /core-domain/referrals                      */
/* ------------------------------------------------------------------ */

type MiniOrg = { id: string; name: string };
type MiniPerson = { id: string; firstName: string; lastName: string };
type MiniUser = { id: string; name?: string; email?: string };
type RefRow = {
  id: string; title: string; message?: string | null; status: string;
  sourceOrganizationId?: string | null; targetOrganizationId?: string | null;
  sourcePersonId?: string | null; targetPersonId?: string | null;
  relationshipId?: string | null; notes?: string | null;
  completedAt?: string | null; createdAt?: string | null;
  sourceOrganization?: MiniOrg | null; targetOrganization?: MiniOrg | null;
  sourcePerson?: MiniPerson | null; targetPerson?: MiniPerson | null;
  createdBy?: MiniUser | null; recipientUser?: MiniUser | null;
};

const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const fmtDT = (iso?: string | null) => iso
  ? new Date(iso).toLocaleDateString('fa-IR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? x?.users ?? x?.referrals ?? []);

const STATUS_FA: Record<string, string> = {
  PENDING: 'در انتظار', ACCEPTED: 'پذیرفته‌شده', DECLINED: 'رد شده',
  COMPLETED: 'انجام‌شده', CANCELLED: 'لغو شده',
};
const STATUS_TONE: Record<string, 'warning' | 'info' | 'danger' | 'success' | 'neutral'> = {
  PENDING: 'warning', ACCEPTED: 'info', DECLINED: 'danger', COMPLETED: 'success', CANCELLED: 'neutral',
};
const personName = (p?: MiniPerson | null) => p ? `${p.firstName} ${p.lastName}` : '';
const orgName = (o?: MiniOrg | null) => o?.name ?? '';

export default function ReferralsPage() {
  const { me } = useWorkspace();

  const [rows, setRows] = useState<RefRow[]>([]);
  const [orgs, setOrgs] = useState<MiniOrg[]>([]);
  const [people, setPeople] = useState<MiniPerson[]>([]);
  const [users, setUsers] = useState<MiniUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', srcType: 'person', srcId: '', dstType: 'org', dstId: '', message: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<RefRow | null>(null);
  const [finishFor, setFinishFor] = useState<RefRow | null>(null);
  const [finishNotes, setFinishNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [refs, o, p, u] = await Promise.all([
        api<RefRow[]>('/core-domain/referrals'),
        api<MiniOrg[]>('/organizations'),
        api<MiniPerson[]>('/people'),
        api<MiniUser[]>('/admin/users'),
      ]);
      setRows(unwrap(refs) as RefRow[]);
      setOrgs(unwrap(o) as MiniOrg[]);
      setPeople(unwrap(p) as MiniPerson[]);
      setUsers(unwrap(u) as MiniUser[]);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const by = (s: string) => rows.filter(r => r.status === s).length;
    const done = by('COMPLETED');
    const decided = rows.filter(r => ['COMPLETED', 'DECLINED', 'ACCEPTED'].includes(r.status)).length;
    const mine = rows.filter(r => {
      if (!me) return false;
      return r.recipientUser?.id === me.id || r.createdBy?.id === me.id;
    }).length;
    return { total: rows.length, pending: by('PENDING'), accepted: by('ACCEPTED'), done, rate: decided ? Math.round((done / decided) * 100) : 0, mine };
  }, [rows, me]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (term) {
        const hay = `${r.title} ${r.message ?? ''} ${r.notes ?? ''} ${orgName(r.sourceOrganization)} ${orgName(r.targetOrganization)} ${personName(r.sourcePerson)} ${personName(r.targetPerson)} ${r.recipientUser?.email ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, statusFilter]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    const body: Record<string, string> = { title: form.title.trim() };
    if (form.message.trim()) body.message = form.message.trim();
    if (form.srcType === 'org') body.sourceOrganizationId = form.srcId; else body.sourcePersonId = form.srcId;
    if (form.dstType === 'org') body.targetOrganizationId = form.dstId;
    else if (form.dstType === 'person') body.targetPersonId = form.dstId;
    else body.recipientUserId = form.dstId;
    try {
      await api('/core-domain/referrals', { method: 'POST', body: JSON.stringify(body) });
      setOpen(false); setForm({ title: '', srcType: 'person', srcId: '', dstType: 'org', dstId: '', message: '' });
      setFlash('معرفی جدید ثبت شد و در وضعیت «در انتظار» قرار گرفت.');
      await load();
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  async function changeStatus(r: RefRow, status: string) {
    if (busy) return;
    setBusy(r.id); setError('');
    try {
      const body: Record<string, unknown> = { status };
      if (status === 'COMPLETED' && finishFor?.id === r.id && finishNotes.trim()) body.notes = finishNotes.trim();
      await api(`/core-domain/referrals/${r.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setFinishFor(null); setFinishNotes('');
      setFlash(`معرفی «${r.title}» به وضعیت «${STATUS_FA[status]}» رفت.`);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  const can = (s: string): string[] =>
    s === 'PENDING' ? ['ACCEPTED', 'DECLINED', 'CANCELLED']
      : s === 'ACCEPTED' ? ['COMPLETED', 'DECLINED', 'CANCELLED'] : [];

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="معرفی‌ها"
        title="معرفی‌ها"
        description="مسیرهای معرفی میان سازمان‌ها و اشخاص — از ثبت تا پذیرش، اجرا و نتیجه؛ هر تغییر وضعیت در لاگ ممیزی ثبت می‌شود."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button className="btn btn-primary" onClick={() => { setError(''); setFormError(''); setOpen(true); }}><UserPlus size={16} /> معرفی جدید</button>
          </>
        }
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 300 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<Handshake size={18} />} label="کل معرفی‌ها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در بازهٔ نگهداری" />
            <StatCard icon={<Clock3 size={18} />} label="در انتظار" value={fmtNum(stats.pending)} iconClass="ic-gold" sub="نیازمند تصمیم" />
            <StatCard icon={<ThumbsUp size={18} />} label="پذیرفته‌شده" value={fmtNum(stats.accepted)} iconClass="ic-teal" sub="در جریان" />
            <StatCard icon={<CalendarCheck2 size={18} />} label="انجام‌شده" value={fmtNum(stats.done)} iconClass="ic-red" sub="به نتیجه رسیده" />
            <StatCard icon={<CheckCircle2 size={18} />} label="نرخ موفقیت" value={`٪${fmtNum(stats.rate)}`} iconClass="ic-teal" sub="انجام ÷ قطعی‌شده" />
            <StatCard icon={<Send size={18} />} label="برای من / توسط من" value={fmtNum(stats.mine)} iconClass="ic-gold" sub="درگیر مستقیم" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی عنوان، مبدأ، مقصد یا گیرنده…">
            <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ وضعیت‌ها</option>
              <option value="PENDING">در انتظار</option>
              <option value="ACCEPTED">پذیرفته‌شده</option>
              <option value="COMPLETED">انجام‌شده</option>
              <option value="DECLINED">رد شده</option>
              <option value="CANCELLED">لغو شده</option>
            </select>
            <span className="chip info">{fmtNum(filtered.length)} معرفی</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>معرفی‌ای یافت نشد</strong>
              <p>با «معرفی جدید» نخستین مسیر معرفی را ثبت کنید.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>معرفی</th>
                    <th>مسیر (مبدأ ← مقصد)</th>
                    <th>وضعیت</th>
                    <th>گیرنده/معرف</th>
                    <th>تاریخ</th>
                    <th style={{ width: 230 }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td>
                        <b className="t-primary" style={{ fontSize: 12.5 }}>{r.title}</b>
                        <div className="t-muted" style={{ fontSize: 10.5, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.message ?? 'بدون پیام'}
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', color: 'var(--text)' }}>
                            {r.sourceOrganization
                              ? <><Building2 size={11} className="t-muted" /> <b>{orgName(r.sourceOrganization)}</b></>
                              : <><UserRound size={11} className="t-muted" /> <b>{personName(r.sourcePerson)}</b></>}
                          </span>
                          <ChevronLeft size={12} className="t-muted" />
                          <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', color: 'var(--text)' }}>
                            {r.targetOrganization
                              ? <><Building2 size={11} className="t-muted" /> <b>{orgName(r.targetOrganization)}</b></>
                              : r.targetPerson
                                ? <><UserRound size={11} className="t-muted" /> <b>{personName(r.targetPerson)}</b></>
                                : <><Mail size={11} className="t-muted" /> <b dir="ltr">{r.recipientUser?.email}</b></>}
                          </span>
                        </span>
                      </td>
                      <td><Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{STATUS_FA[r.status] ?? r.status}</Badge></td>
                      <td>
                        <span style={{ fontSize: 11 }}>{r.recipientUser?.email ?? '—'}</span>
                        <div className="t-muted" style={{ fontSize: 10 }}>معرف: {r.createdBy?.name ?? '—'}</div>
                      </td>
                      <td><span className="t-muted" style={{ fontSize: 11.5 }}>{fmtDT(r.createdAt)}</span></td>
                      <td>
                        <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
                          {can(r.status).length > 0 && (
                            <>
                              {can(r.status).includes('ACCEPTED') && (
                                <button className="btn btn-success btn-sm" onClick={() => changeStatus(r, 'ACCEPTED')} disabled={!!busy} title="پذیرش معرفی"><ThumbsUp size={12} /> پذیرش</button>
                              )}
                              {can(r.status).includes('COMPLETED') && (
                                <button className="btn btn-primary btn-sm" onClick={() => { setFinishFor(r); setFinishNotes(''); setError(''); }} disabled={!!busy} title="ثبت انجام‌شدن معرفی"><CheckCircle2 size={12} /> انجام شد</button>
                              )}
                              {can(r.status).includes('DECLINED') && (
                                <button className="btn btn-ghost btn-sm" onClick={() => changeStatus(r, 'DECLINED')} disabled={!!busy} title="رد معرفی"><XCircle size={12} /></button>
                              )}
                              {can(r.status).includes('CANCELLED') && (
                                <button className="btn btn-ghost btn-sm" onClick={() => changeStatus(r, 'CANCELLED')} disabled={!!busy} title="لغو معرفی"><Ban size={12} /></button>
                              )}
                            </>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => { setError(''); setDetail(r); }} title="جزئیات"><StickyNote size={12} /> جزئیات</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ------- new referral ------- */}
      <Modal
        open={open}
        title="معرفی جدید"
        description="مسیر معرفی از یک مبدأ (سازمان/شخص) به یک مقصد (سازمان/شخص/کاربر داخلی) ثبت می‌شود."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="ref-form" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : <UserPlus size={14} />} ثبت معرفی
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <form id="ref-form" className="entity-form org-form" onSubmit={create}>
          <div className="form-grid">
            <label className="field full">
              <span className="field-label">عنوان معرفی <i className="req">*</i></span>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثال: معرفی مدیر فروش به پترو صنعت" required />
            </label>
            <label className="field">
              <span className="field-label">مبدأ <i className="req">*</i></span>
              <select value={form.srcType} onChange={e => setForm(f => ({ ...f, srcType: e.target.value, srcId: '' }))}>
                <option value="person">شخص</option>
                <option value="org">سازمان</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">مبدأ — مقدار</span>
              <select value={form.srcId} onChange={e => setForm(f => ({ ...f, srcId: e.target.value }))} required>
                <option value="">انتخاب کنید…</option>
                {(form.srcType === 'org' ? orgs : people).map(x => (
                  <option key={x.id} value={x.id}>
                    {form.srcType === 'org' ? orgName(x as MiniOrg) : personName(x as MiniPerson)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">مقصد <i className="req">*</i></span>
              <select value={form.dstType} onChange={e => setForm(f => ({ ...f, dstType: e.target.value, dstId: '' }))}>
                <option value="org">سازمان</option>
                <option value="person">شخص</option>
                <option value="user">کاربر داخلی</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">مقصد — مقدار</span>
              <select value={form.dstId} onChange={e => setForm(f => ({ ...f, dstId: e.target.value }))} required>
                <option value="">انتخاب کنید…</option>
                {form.dstType === 'user'
                  ? users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)
                  : (form.dstType === 'org' ? orgs : people).map(x => (
                    <option key={x.id} value={x.id}>
                      {form.dstType === 'org' ? orgName(x as MiniOrg) : personName(x as MiniPerson)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field full">
              <span className="field-label">پیام</span>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} placeholder="توضیح کوتاهی دربارهٔ این معرفی…" />
            </label>
          </div>
        </form>
      </Modal>

      {/* ------- detail modal ------- */}
      <Modal
        open={!!detail}
        title={detail?.title ?? ''}
        description={`وضعیت: ${detail ? STATUS_FA[detail.status] : ''}`}
        onClose={() => setDetail(null)}
        footer={<button type="button" className="btn btn-secondary" onClick={() => setDetail(null)}><X size={14} /> بستن</button>}
      >
        {detail && (
          <div style={{ display: 'grid', gap: 10, fontSize: 12.5 }}>
            <div className="detail-row" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <ArrowLeft size={14} className="t-muted" style={{ marginTop: 2 }} />
              <span><b>مسیر:</b> {detail.sourceOrganization ? `سازمان «${orgName(detail.sourceOrganization)}»` : `شخص «${personName(detail.sourcePerson)}»`} ← {detail.targetOrganization ? `سازمان «${orgName(detail.targetOrganization)}»` : detail.targetPerson ? `شخص «${personName(detail.targetPerson)}»` : `کاربر داخلی (${detail.recipientUser?.email})`}</span>
            </div>
            {detail.message && <div style={{ display: 'flex', gap: 6 }}><StickyNote size={14} className="t-muted" /><span><b>پیام:</b> {detail.message}</span></div>}
            {detail.notes && <div style={{ display: 'flex', gap: 6 }}><CheckCircle2 size={14} className="t-muted" /><span><b>یادداشت پایانی:</b> {detail.notes}</span></div>}
            <div style={{ display: 'flex', gap: 6 }}><UserRound size={14} className="t-muted" /><span><b>معرف:</b> {detail.createdBy?.name ?? '—'} {detail.createdBy?.email ? `(${detail.createdBy.email})` : ''}</span></div>
            {detail.recipientUser && <div style={{ display: 'flex', gap: 6 }}><Mail size={14} className="t-muted" /><span><b>گیرنده:</b> {detail.recipientUser.email}</span></div>}
            <div style={{ display: 'flex', gap: 12, color: 'var(--text-muted)', fontSize: 11.5 }}>
              <span>ایجاد: {fmtDT(detail.createdAt)}</span>
              {detail.completedAt && <span>پایان: {fmtDT(detail.completedAt)}</span>}
            </div>
            {detail.relationshipId && <div><Badge tone="info">رابطهٔ پیوند: <code dir="ltr" style={{ fontSize: 10 }}>{detail.relationshipId}</code></Badge></div>}
          </div>
        )}
      </Modal>

      {/* ------- finish modal ------- */}
      <Modal
        open={!!finishFor}
        title="ثبت انجام‌شدن معرفی"
        description={finishFor ? `«${finishFor.title}» — با یادداشت پایانی (اختیاری) ثبت می‌شود.` : ''}
        onClose={() => setFinishFor(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setFinishFor(null)}><X size={14} /> انصراف</button>
            <button type="button" className="btn btn-primary" onClick={() => finishFor && changeStatus(finishFor, 'COMPLETED')} disabled={busy === finishFor?.id}>
              {busy === finishFor?.id ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />} ثبت
            </button>
          </>
        }
      >
        <label className="field">
          <span className="field-label">یادداشت پایانی</span>
          <textarea value={finishNotes} onChange={e => setFinishNotes(e.target.value)} rows={3} placeholder="نتیجهٔ معرفی؛ مثلاً: قرارداد امضا شد…" />
        </label>
      </Modal>
    </main>
  );
}
