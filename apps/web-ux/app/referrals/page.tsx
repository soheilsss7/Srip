'use client';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../_lib/api';
import { fa } from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../_components/page-ui';
import {
  RefreshCw, Search, Plus, X, CheckCircle2, UserPlus, ArrowLeft, Handshake,
  ThumbsUp, Ban, XCircle, Building2, UserRound, Mail, StickyNote, Send,
  Clock3, CalendarCheck2, ChevronLeft, ShieldCheck, ShieldAlert, ShieldX,
  ClipboardList, Target, ListChecks, Rows3, RotateCcw, BellRing,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  معرفی‌ها — مسیرهای معرفی با دستورالعمل و ممیزی (معرفیِ امن)        */
/*  قبل از پذیرش: ممیزی پیش؛ بعد از پذیرش: پیگیری/نتیجه/اثر بر رابطه  */
/* ------------------------------------------------------------------ */

type MiniOrg = { id: string; name: string; type?: string; status?: string };
type MiniPerson = { id: string; firstName: string; lastName: string };
type MiniUser = { id: string; name?: string; email?: string };
type AuditCheck = { code: string; label: string; level: 'PASS' | 'WARN' | 'BLOCK'; detail: string; evidence?: string };
type Audit = { gate: 'PASS' | 'WARN' | 'BLOCKED' | 'N/A'; checks: AuditCheck[]; summary: { pass: number; warn: number; block: number }; checkedAt?: string };
type Instruction = { goal: string; allowed: string[]; forbidden: string[]; boundaries: string; dueDays: number };
type RefRow = {
  id: string; title: string; message?: string | null; status: string;
  sourceOrganizationId?: string | null; targetOrganizationId?: string | null;
  sourcePersonId?: string | null; targetPersonId?: string | null;
  relationshipId?: string | null; notes?: string | null; acceptedAt?: string | null;
  completedAt?: string | null; createdAt?: string | null;
  sourceOrganization?: MiniOrg | null; targetOrganization?: MiniOrg | null;
  sourcePerson?: MiniPerson | null; targetPerson?: MiniPerson | null;
  createdBy?: MiniUser | null; recipientUser?: MiniUser | null;
  instruction?: Instruction | null;
  audit?: Audit | null; postAudit?: Audit | null;
  relationshipCriteria?: { score?: number; effectiveScore?: number; coverage?: number; verdictLabel?: string; verdict?: string } | null;
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
const GATE_META: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; icon: ReactNode }> = {
  PASS: { label: 'ممیزی سبز', tone: 'success', icon: <ShieldCheck size={12} /> },
  WARN: { label: 'ممیزی زرد', tone: 'warning', icon: <ShieldAlert size={12} /> },
  BLOCKED: { label: 'ممیزی قرمز', tone: 'danger', icon: <ShieldX size={12} /> },
  'N/A': { label: 'ممیزی ندارد', tone: 'neutral', icon: <ShieldCheck size={12} /> },
};
const personName = (p?: MiniPerson | null) => p ? `${p.firstName} ${p.lastName}` : '';
const orgName = (o?: MiniOrg | null) => o?.name ?? '';

function AuditList({ audit, emptyLabel, onCheckin }: { audit?: Audit | null; emptyLabel: string; onCheckin?: (code: string) => void }) {
  if (!audit || !audit.checks?.length) return <p className="criteria-saved">{emptyLabel}</p>;
  return (
    <ul className="ref-audit-list">
      {audit.checks.map((c) => (
        <li key={c.code} className={`ref-audit-item ${c.level.toLowerCase()}`}>
          <span className="ref-audit-ico">
            {c.level === 'PASS' ? <CheckCircle2 size={13} /> : c.level === 'WARN' ? <ShieldAlert size={13} /> : <ShieldX size={13} />}
          </span>
          <div>
            <b>{c.label}</b>
            <small>{c.detail}</small>
            {c.evidence && <code className="ref-audit-evidence" dir="ltr">{c.evidence}</code>}
          </div>
          {onCheckin && ['FOLLOW_UP', 'OUTCOME'].includes(c.code) &&
            <button className="btn btn-ghost btn-sm" onClick={() => onCheckin(c.code)} title="ثبت شواهد این بررسی"><BellRing size={12} /> ثبت</button>}
        </li>
      ))}
    </ul>
  );
}

export default function ReferralsPage() {
  const { me } = useWorkspace();

  const [rows, setRows] = useState<RefRow[]>([]);
  const [orgs, setOrgs] = useState<MiniOrg[]>([]);
  const [people, setPeople] = useState<MiniPerson[]>([]);
  const [users, setUsers] = useState<MiniUser[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', srcType: 'person', srcId: '', dstType: 'org', dstId: '', message: '',
    goal: '', allowed: '', forbidden: '', boundaries: '', dueDays: '30', relationshipId: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<RefRow | null>(null);
  const [finishFor, setFinishFor] = useState<RefRow | null>(null);
  const [finishNotes, setFinishNotes] = useState('');
  const [checkinFor, setCheckinFor] = useState<null | { ref: RefRow; code: string }>(null);
  const [checkinNote, setCheckinNote] = useState('');
  const [editInstr, setEditInstr] = useState<RefRow | null>(null);
  const [editForm, setEditForm] = useState({ goal: '', allowed: '', forbidden: '', boundaries: '', dueDays: '30' });
  const [editError, setEditError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [refs, o, p, u, rr] = await Promise.all([
        api<RefRow[]>('/core-domain/referrals'),
        api<MiniOrg[]>('/organizations'),
        api<MiniPerson[]>('/people'),
        api<MiniUser[]>('/admin/users'),
        api<any[]>('/relationships'),
      ]);
      setRows(unwrap(refs) as RefRow[]);
      setOrgs(unwrap(o) as MiniOrg[]);
      setPeople(unwrap(p) as MiniPerson[]);
      setUsers(unwrap(u) as MiniUser[]);
      setRels(unwrap(rr) as any[]);
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
    const gates = { pass: 0, warn: 0, block: 0 };
    for (const r of rows) { const g = r.audit?.gate; if (g === 'PASS') gates.pass++; else if (g === 'WARN') gates.warn++; else if (g === 'BLOCKED') gates.block++; }
    return { total: rows.length, pending: by('PENDING'), accepted: by('ACCEPTED'), done, rate: decided ? Math.round((done / decided) * 100) : 0, mine, ...gates };
  }, [rows, me]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (term) {
        const hay = `${r.title} ${r.message ?? ''} ${r.notes ?? ''} ${orgName(r.sourceOrganization)} ${orgName(r.targetOrganization)} ${personName(r.sourcePerson)} ${personName(r.targetPerson)} ${r.recipientUser?.email ?? ''} ${r.instruction?.goal ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, statusFilter]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    const body: any = { title: form.title.trim() };
    if (form.message.trim()) body.message = form.message.trim();
    if (form.srcType === 'org') body.sourceOrganizationId = form.srcId; else body.sourcePersonId = form.srcId;
    if (form.dstType === 'org') body.targetOrganizationId = form.dstId;
    else if (form.dstType === 'person') body.targetPersonId = form.dstId;
    else body.recipientUserId = form.dstId;
    if (form.relationshipId) body.relationshipId = form.relationshipId;
    body.instruction = {
      goal: form.goal.trim(),
      allowed: form.allowed.split(/[,،;]/).map(s => s.trim()).filter(Boolean).slice(0, 6),
      forbidden: form.forbidden.split(/[,،;]/).map(s => s.trim()).filter(Boolean).slice(0, 6),
      boundaries: form.boundaries.trim(),
      dueDays: Number(form.dueDays) || 30,
    };
    try {
      const res: any = await api('/core-domain/referrals', { method: 'POST', body: JSON.stringify(body) });
      setOpen(false);
      setForm({ title: '', srcType: 'person', srcId: '', dstType: 'org', dstId: '', message: '', goal: '', allowed: '', forbidden: '', boundaries: '', dueDays: '30', relationshipId: '' });
      const g = res?.audit?.gate;
      setFlash(g === 'BLOCKED'
        ? 'معرفی ثبت شد اما ممیزی قرمز است — پذیرش تا رفع موارد مسدودکننده ممکن نیست.'
        : g === 'WARN'
          ? 'معرفی ثبت شد؛ ممیزی زرد است — موارد هشدار را در جزئیات ببینید.'
          : 'معرفی ثبت شد و ممیزی پیش از پذیرش سبز است.');
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
      if (status === 'ACCEPTED') setDetail(null);
    } catch (x) { setError((x as Error).message); await load(); }
    finally { setBusy(null); }
  }
  async function rerunAudit(r: RefRow) {
    setBusy('audit-' + r.id); setError(''); setFlash('');
    try {
      const a: any = await api(`/core-domain/referrals/${r.id}/audit`, { method: 'POST' });
      setFlash(a?.gate === 'BLOCKED' ? `ممیزی «${r.title}» قرمز است (${a?.summary?.block} مسدود).` : a?.gate === 'WARN' ? `ممیزی «${r.title}» زرد است (${a?.summary?.warn} هشدار).` : `ممیزی «${r.title}» سبز شد.`);
      setDetail(null);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }
  async function checkin() {
    if (!checkinFor) return;
    setBusy(`${checkinFor.code}-${checkinFor.ref.id}`); setError('');
    try {
      await api(`/core-domain/referrals/${checkinFor.ref.id}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ code: checkinFor.code, note: checkinNote.trim() }),
      });
      setCheckinFor(null); setCheckinNote('');
      setFlash('شاهد بررسی ثبت شد و ممیزی پس از معرفی به‌روزرسانی شد.');
      setDetail(null);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }
  function openEditInstr(r: RefRow) {
    const i = r.instruction;
    setEditForm({
      goal: i?.goal ?? '', allowed: (i?.allowed ?? []).join('، '), forbidden: (i?.forbidden ?? []).join('، '),
      boundaries: i?.boundaries ?? '', dueDays: String(i?.dueDays ?? 30),
    });
    setEditError(''); setEditInstr(r);
  }
  async function saveInstr(e: React.FormEvent) {
    e.preventDefault(); if (!editInstr) return;
    setBusy('instr-' + editInstr.id); setEditError('');
    try {
      await api(`/core-domain/referrals/${editInstr.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          instruction: {
            goal: editForm.goal.trim(),
            allowed: editForm.allowed.split(/[,،;]/).map(s => s.trim()).filter(Boolean).slice(0, 6),
            forbidden: editForm.forbidden.split(/[,،;]/).map(s => s.trim()).filter(Boolean).slice(0, 6),
            boundaries: editForm.boundaries.trim(),
            dueDays: Number(editForm.dueDays) || 30,
          },
        }),
      });
      setEditInstr(null); setDetail(null);
      setFlash('دستورالعمل و ممیزی معرفی به‌روزرسانی شد؛ ممیزی پیش دوباره اجرا شده است.');
      await load();
    } catch (x) { setEditError((x as Error).message); }
    finally { setBusy(null); }
  }

  const can = (s: string): string[] =>
    s === 'PENDING' ? ['ACCEPTED', 'DECLINED', 'CANCELLED']
      : s === 'ACCEPTED' ? ['COMPLETED', 'DECLINED', 'CANCELLED'] : [];

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="معرفی‌ها"
        title="معرفی‌ها (با ممیزی)"
        description="هر معرفی با دستورالعملِ هدف و خط قرمز ثبت می‌شود؛ پیش از پذیرش ممیزی (سلامت رابطه، مقصد، تکرار، کامل بودن دستور) و پس از آن پیگیری/نتیجه/اثر بر رابطه اجرا می‌شود تا معرفی رابطه را خراب نکند."
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
          <div className="stat-grid">{[0, 1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 300 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<Handshake size={18} />} label="کل معرفی‌ها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در بازهٔ نگهداری" />
            <StatCard icon={<Clock3 size={18} />} label="در انتظار" value={fmtNum(stats.pending)} iconClass="ic-gold" sub="نیازمند تصمیم" />
            <StatCard icon={<ThumbsUp size={18} />} label="پذیرفته‌شده" value={fmtNum(stats.accepted)} iconClass="ic-teal" sub="در جریان" />
            <StatCard icon={<CheckCircle2 size={18} />} label="انجام‌شده" value={fmtNum(stats.done)} iconClass="ic-red" sub="به نتیجه رسیده" />
            <StatCard icon={<ShieldCheck size={18} />} label="ممیزی سبز" value={fmtNum(stats.pass)} iconClass="ic-teal" sub="امن برای پذیرش" />
            <StatCard icon={<ShieldAlert size={18} />} label="ممیزی زرد" value={fmtNum(stats.warn)} iconClass="ic-gold" sub="با هشدار" />
            <StatCard icon={<ShieldX size={18} />} label="ممیزی قرمز" value={fmtNum(stats.block)} iconClass="ic-red" sub="پذیرش مسدود" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی عنوان، مبدأ، مقصد، دستورالعمل یا گیرنده…">
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
                    <th>ممیزی پیش</th>
                    <th>وضعیت</th>
                    <th>گیرنده/معرف</th>
                    <th>تاریخ</th>
                    <th style={{ width: 260 }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const gate = r.audit?.gate ?? 'N/A';
                    const gm = GATE_META[gate] ?? GATE_META['N/A'];
                    const blocked = gate === 'BLOCKED' && r.status === 'PENDING';
                    return (
                      <tr key={r.id} className={blocked ? 'row-alert' : ''}>
                        <td>
                          <b className="t-primary" style={{ fontSize: 12.5 }}>{r.title}</b>
                          <div className="t-muted" style={{ fontSize: 10.5, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.instruction?.goal || r.message || 'بدون پیام'}
                          </div>
                          {r.instruction && (
                            <div className="t-muted" style={{ fontSize: 10, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Ban size={9} style={{ verticalAlign: '-1px' }} /> خط قرمز: {(r.instruction.forbidden ?? []).slice(0, 2).join('، ') || '—'}
                            </div>
                          )}
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
                        <td>
                          <span className="ref-gate" title={blocked ? 'پذیرش مسدود است — موارد قرمز را رفع کنید' : `${r.audit?.summary?.warn ?? 0} هشدار · ${r.audit?.summary?.block ?? 0} مسدود`}>
                            <Badge tone={gm.tone}>{gm.icon} {gm.label} ({fmtNum((r.audit?.summary?.warn ?? 0) + (r.audit?.summary?.block ?? 0))})</Badge>
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
                            {can(r.status).includes('ACCEPTED') && (
                              <button className="btn btn-success btn-sm" onClick={() => changeStatus(r, 'ACCEPTED')} disabled={!!busy || blocked}
                                title={blocked ? 'ممیزی قرمز است؛ ابتدا موارد مسدود را رفع کنید' : 'پذیرش معرفی'}>
                                <ThumbsUp size={12} /> پذیرش
                              </button>
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
                            <button className="btn btn-ghost btn-sm" onClick={() => { setError(''); setDetail(r); }} title="جزئیات و ممیزی"><StickyNote size={12} /> جزئیات</button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ------- new referral ------- */}
      <Modal
        open={open}
        title="معرفی جدید (با دستورالعمل)"
        description="هدف، موضوعات مجاز، خط قرمزها و مرزها را روشن کنید — پذیرنده دقیقاً می‌داند چه کند و چه نکند. پس از ثبت، ممیزی پیش از پذیرش خودکار اجرا می‌شود."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="ref-form" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : <UserPlus size={14} />} ثبت و ممیزی
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
            <label className="field">
              <span className="field-label">رابطهٔ پیوند (برای ممیزی)</span>
              <select value={form.relationshipId ?? ''} onChange={e => setForm(f => ({ ...f, relationshipId: e.target.value }))}>
                <option value="">بدون رابطهٔ مشخص</option>
                {rels.map(rr => (
                  <option key={rr.id} value={rr.id}>
                    {orgName(rr.sourceOrganization)} ↔ {orgName(rr.targetOrganization)}
                    {rr.criteria?.effectiveScore != null ? ` · ${fmtNum(rr.criteria.effectiveScore)}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field full">
              <span className="field-label">پیام/توضیح (برای گیرنده)</span>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={2} placeholder="چند خط که در معرفی به طرف مقابل گفته می‌شود…" />
            </label>
            <div className="field full ref-instruction-box">
              <div className="ref-instruction-head"><ClipboardList size={14} /> دستورالعمل — این همان چیزی است که به معرفی‌شونده می‌دهید</div>
              <label className="field">
                <span className="field-label">هدفِ معرفی (چرا این معرفی؟) <i className="req">*</i></span>
                <input value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} placeholder="مثال: بررسی امکان همکاری فروش در ۳۰ روز؛ بدون مذاکرهٔ قرارداد" required />
              </label>
              <div className="ref-instruction-grid">
                <label className="field">
                  <span className="field-label">موضوعات مجاز</span>
                  <input value={form.allowed} onChange={e => setForm(f => ({ ...f, allowed: e.target.value }))} placeholder="جدا با ویرگول؛ مثال: قیمت مصوب، زمان تحویل" />
                </label>
                <label className="field">
                  <span className="field-label">خط قرمز (ممنوع) <i className="req">*</i></span>
                  <input value={form.forbidden} onChange={e => setForm(f => ({ ...f, forbidden: e.target.value }))} placeholder="جدا با ویرگول؛ مثال: تخفیف جدید، تعهد حجم" required />
                </label>
              </div>
              <label className="field">
                <span className="field-label">مرزها و محدودیت‌ها <i className="req">*</i></span>
                <textarea value={form.boundaries} onChange={e => setForm(f => ({ ...f, boundaries: e.target.value }))} rows={2} placeholder="مثال: حداکثر ۲ جلسهٔ مقدماتی؛ مذاکره فقط با حضور مدیر حساب؛ نتیجه تا ۳۰ روز ثبت شود." required />
              </label>
              <label className="field ref-due">
                <span className="field-label">مهلت نتیجه (روز)</span>
                <input type="number" min={3} max={365} value={form.dueDays} onChange={e => setForm(f => ({ ...f, dueDays: e.target.value }))} />
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* ------- detail + audit modal ------- */}
      <Modal
        open={!!detail}
        title={detail?.title ?? ''}
        description={`وضعیت: ${detail ? STATUS_FA[detail.status] : ''} · ممیزی پیش: ${detail?.audit ? GATE_META[detail.audit.gate]?.label : '—'}`}
        onClose={() => setDetail(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => detail && rerunAudit(detail)} disabled={!!busy}><RotateCcw size={14} /> بازاجرای ممیزی</button>
            {detail && ['PENDING', 'ACCEPTED'].includes(detail.status) && (
              <button type="button" className="btn btn-secondary" onClick={() => openEditInstr(detail)} disabled={!!busy}><ClipboardList size={14} /> ویرایش دستورالعمل</button>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary" onClick={() => setDetail(null)}><X size={14} /> بستن</button>
          </>
        }
      >
        {detail && (
          <div className="ref-detail">
            <div className="detail-row" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <ArrowLeft size={14} className="t-muted" style={{ marginTop: 2 }} />
              <span><b>مسیر:</b> {detail.sourceOrganization ? `سازمان «${orgName(detail.sourceOrganization)}»` : `شخص «${personName(detail.sourcePerson)}»`} ← {detail.targetOrganization ? `سازمان «${orgName(detail.targetOrganization)}»` : detail.targetPerson ? `شخص «${personName(detail.targetPerson)}»` : `کاربر داخلی (${detail.recipientUser?.email})`}</span>
            </div>
            {detail.relationshipCriteria && (
              <div className="ref-rel-line">
                <Target size={13} /> رابطهٔ پیوند: امتیاز معیارها <b>{fmtNum(detail.relationshipCriteria.effectiveScore ?? detail.relationshipCriteria.score ?? 0)}</b>
                {' '}· پوشش {fmtNum(detail.relationshipCriteria.coverage ?? 0)}٪ · حکم «{detail.relationshipCriteria.verdictLabel}»
              </div>
            )}
            {detail.message && <div style={{ display: 'flex', gap: 6 }}><StickyNote size={14} className="t-muted" /><span><b>پیام:</b> {detail.message}</span></div>}
            {detail.notes && <div style={{ display: 'flex', gap: 6 }}><CheckCircle2 size={14} className="t-muted" /><span><b>یادداشت پایانی:</b> {detail.notes}</span></div>}
            <div style={{ display: 'flex', gap: 6 }}><UserRound size={14} className="t-muted" /><span><b>معرف:</b> {detail.createdBy?.name ?? '—'} {detail.createdBy?.email ? `(${detail.createdBy.email})` : ''}</span></div>
            <div style={{ display: 'flex', gap: 12, color: 'var(--text-muted)', fontSize: 11.5 }}>
              <span>ایجاد: {fmtDT(detail.createdAt)}</span>
              {detail.acceptedAt && <span>پذیرش: {fmtDT(detail.acceptedAt)}</span>}
              {detail.completedAt && <span>پایان: {fmtDT(detail.completedAt)}</span>}
            </div>

            {detail.instruction && (
              <div className="ref-instruction-panel">
                <div className="ref-instruction-head"><ClipboardList size={14} /> دستورالعمل معرفی‌شونده</div>
                <p><b>هدف:</b> {detail.instruction.goal || '—'}</p>
                <div className="ref-instr-cols">
                  <div><small>موضوعات مجاز</small>
                    <ul>{(detail.instruction.allowed ?? []).map((a, i) => <li key={i}>✓ {a}</li>)}
                      {!detail.instruction.allowed?.length && <li className="t-muted">تعیین نشده</li>}</ul>
                  </div>
                  <div className="ref-instr-danger"><small>خط قرمز</small>
                    <ul>{(detail.instruction.forbidden ?? []).map((a, i) => <li key={i}>✕ {a}</li>)}
                      {!detail.instruction.forbidden?.length && <li className="t-muted">تعیین نشده</li>}</ul>
                  </div>
                </div>
                <p><b>مرزها:</b> {detail.instruction.boundaries || '—'}</p>
                <small className="t-muted">مهلت نتیجه: {fmtNum(detail.instruction.dueDays)} روز</small>
              </div>
            )}

            <div className="ref-audit-panel">
              <div className="ref-instruction-head"><ShieldCheck size={14} /> ممیزی پیش از پذیرش {detail.audit ? `— ${GATE_META[detail.audit.gate]?.label}` : ''}</div>
              <AuditList audit={detail.audit} emptyLabel="هنوز ممیزی اجرا نشده؛ با «بازاجرای ممیزی» اجرا کنید." />
            </div>

            {(detail.status === 'ACCEPTED' || detail.status === 'COMPLETED') && (
              <div className="ref-audit-panel">
                <div className="ref-instruction-head"><ListChecks size={14} /> ممیزی پس از معرفی {detail.postAudit ? `— ${GATE_META[detail.postAudit.gate]?.label}` : ''}</div>
                <AuditList audit={detail.postAudit} emptyLabel="پس از پذیرش، پیگیری و اثر بر رابطه به‌صورت خودکار بررسی می‌شود." onCheckin={(code) => { setCheckinFor({ ref: detail, code }); setCheckinNote(''); }} />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ------- edit instructions modal ------- */}
      <Modal
        open={!!editInstr}
        title="ویرایش دستورالعمل معرفی"
        description="دستورالعمل دقیق تری برای معرفی‌شونده بنویسید؛ ممیزی پیش از پذیرش دوباره اجرا می‌شود و نتیجهٔ آن با ذخیره نمایش داده می‌شود."
        onClose={() => setEditInstr(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditInstr(null)}><X size={14} /> انصراف</button>
            <button type="submit" form="ref-instr-edit" className="btn btn-primary" disabled={busy === `instr-${editInstr?.id}`}>
              <ClipboardList size={14} /> ذخیره و ممیزی
            </button>
          </>
        }
      >
        <ErrorCard message={editError} />
        <form id="ref-instr-edit" onSubmit={saveInstr}>
          <div className="ref-instruction-box">
            <div className="ref-instruction-head"><ClipboardList size={14} /> دستورالعمل معرفی‌شونده</div>
            <label className="field">
              <span className="field-label">هدفِ معرفی (چرا این معرفی؟) <i className="req">*</i></span>
              <input value={editForm.goal} onChange={e => setEditForm(f => ({ ...f, goal: e.target.value }))} required />
            </label>
            <div className="ref-instruction-grid">
              <label className="field">
                <span className="field-label">موضوعات مجاز</span>
                <input value={editForm.allowed} onChange={e => setEditForm(f => ({ ...f, allowed: e.target.value }))} placeholder="جدا با ویرگول" />
              </label>
              <label className="field">
                <span className="field-label">خط قرمز (ممنوع) <i className="req">*</i></span>
                <input value={editForm.forbidden} onChange={e => setEditForm(f => ({ ...f, forbidden: e.target.value }))} placeholder="جدا با ویرگول" required />
              </label>
            </div>
            <label className="field">
              <span className="field-label">مرزها و محدودیت‌ها <i className="req">*</i></span>
              <textarea value={editForm.boundaries} onChange={e => setEditForm(f => ({ ...f, boundaries: e.target.value }))} rows={2} required />
            </label>
            <label className="field ref-due">
              <span className="field-label">مهلت نتیجه (روز)</span>
              <input type="number" min={3} max={365} value={editForm.dueDays} onChange={e => setEditForm(f => ({ ...f, dueDays: e.target.value }))} />
            </label>
          </div>
        </form>
      </Modal>

      {/* ------- finish modal ------- */}
      <Modal
        open={!!finishFor}
        title="ثبت انجام‌شدن معرفی"
        description={finishFor ? `«${finishFor.title}» — پس از ثبت، ممیزی پس از معرفی (پیگیری، نتیجه، اثر بر رابطه) اجرا می‌شود.` : ''}
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
          <span className="field-label">یادداشت پایانی (نتیجهٔ واقعی)</span>
          <textarea value={finishNotes} onChange={e => setFinishNotes(e.target.value)} rows={3} placeholder="مثال: جلسهٔ ارزیابی برگزار شد، تأمین‌کننده تأیید شد و قرارداد اولیه امضا شد…" />
        </label>
      </Modal>

      {/* ------- checkin modal ------- */}
      <Modal
        open={!!checkinFor}
        title={checkinFor?.code === 'FOLLOW_UP' ? 'ثبت پیگیری پس از معرفی' : 'ثبت نتیجهٔ معرفی'}
        description={checkinFor ? `«${checkinFor.ref.title}» — این شاهد در ممیزی پس از معرفی محاسبه می‌شود.` : ''}
        onClose={() => setCheckinFor(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCheckinFor(null)}><X size={14} /> انصراف</button>
            <button type="button" className="btn btn-primary" onClick={checkin} disabled={busy === `${checkinFor?.code}-${checkinFor?.ref.id}`}>
              <BellRing size={14} /> ثبت شاهد
            </button>
          </>
        }
      >
        <label className="field">
          <span className="field-label">توضیح شاهد</span>
          <textarea value={checkinNote} onChange={e => setCheckinNote(e.target.value)} rows={3} placeholder={checkinFor?.code === 'FOLLOW_UP' ? 'مثال: جلسهٔ آشنایی با مدیر خرید برگزار شد (۱۴۰۵/۰۶/۰۲)…' : 'مثال: قرارداد اولیه امضا شد و وضعیت رابطه بهبود یافت…'} />
        </label>
      </Modal>
    </main>
  );
}
