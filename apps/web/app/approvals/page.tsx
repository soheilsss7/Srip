'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../_components/page-ui';
import {
  RefreshCw, Search, Plus, X, CheckCircle2, ShieldQuestion, ThumbsUp, ThumbsDown,
  FileDown, Share2, UploadCloud, Trash2, TrendingUp, AlertTriangle, UserRound,
  Building2, GitBranch, Info, Clock3, Scale, History,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  تأییدها — درخواست‌های تأیید دوم‌نفره با اثر واقعی پس از تأیید       */
/*  بک‌اند: GET/POST /approvals · POST /approvals/:id/approve|reject   */
/* ------------------------------------------------------------------ */

type Approval = {
  id: string; entityType: string; entityId: string | null; actionType: string;
  organizationId?: string | null; organizationName?: string | null;
  requestedById: string; requestedByName?: string | null; requestedByEmail?: string | null;
  decidedById?: string | null; decidedByName?: string | null;
  status: string; reason?: string | null; decidedReason?: string | null;
  before?: Record<string, unknown> | null; after?: Record<string, unknown> | null;
  createdAt?: string | null; decidedAt?: string | null; entityLabel?: string | null;
};
type MiniOrg = { id: string; name: string; industry?: string | null; type?: string };
type Rel = { id: string; sourceOrganizationId?: string; targetOrganizationId?: string; relationshipType?: string; status?: string; strategicScore?: number };
type Person = { id: string; firstName: string; lastName: string; organizationId?: string };

const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const fmtDT = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString('fa-IR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);

const ACTION_FA: Record<string, string> = {
  EXPORT: 'خروجی داده', DATA_SHARING: 'اشتراک داده', DATA_IMPORT: 'ورود داده',
  DELETE: 'حذف دائمی', STRATEGIC_SCORE_CHANGE: 'تغییر امتیاز راهبردی',
  SENSITIVE_RELATIONSHIP_CREATE: 'ایجاد رابطهٔ حساس',
};
const ACTION_ICON: Record<string, React.ReactNode> = {
  EXPORT: <FileDown size={13} />, DATA_SHARING: <Share2 size={13} />, DATA_IMPORT: <UploadCloud size={13} />,
  DELETE: <Trash2 size={13} />, STRATEGIC_SCORE_CHANGE: <TrendingUp size={13} />,
  SENSITIVE_RELATIONSHIP_CREATE: <AlertTriangle size={13} />,
};
const ENTITY_FA: Record<string, string> = {
  Report: 'گزارش', Relationship: 'رابطه', DataLifecycle: 'چرخهٔ حیات داده',
  Organization: 'سازمان', Person: 'شخص', User: 'کاربر',
};
const REL_TYPES = ['STRATEGIC_PARTNERSHIP', 'BANKING', 'CUSTOMER', 'SUPPLY', 'INVESTMENT', 'PARTNERSHIP'];

const personFull = (p?: Person | null) => p ? `${p.firstName} ${p.lastName}` : '';
const orgName = (id: string | null | undefined, orgs: MiniOrg[]) => orgs.find(o => o.id === id)?.name ?? '—';

export default function ApprovalsPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [rows, setRows] = useState<Approval[]>([]);
  const [statusTab, setStatusTab] = useState('PENDING');
  const [q, setQ] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [orgs, setOrgs] = useState<MiniOrg[]>([]);
  const [rels, setRels] = useState<Rel[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    actionType: 'STRATEGIC_SCORE_CHANGE', entityType: 'Relationship', entityId: '',
    reason: '', strategicScore: '90', srcId: '', dstId: '', relType: 'PARTNERSHIP',
    delType: 'Person', classification: 'CONFIDENTIAL', recipient: '', reportType: 'relationship-health',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<Approval | null>(null);
  const [decideFor, setDecideFor] = useState<Approval | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [decideReason, setDecideReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const list = unwrap(await api<Approval[]>(`/approvals?status=${encodeURIComponent(statusTab)}`));
      setRows(list as Approval[]);
      const [o, r, p] = await Promise.all([
        api<MiniOrg[]>('/organizations').catch(() => []),
        api<Rel[]>('/relationships').catch(() => []),
        api<Person[]>('/people').catch(() => []),
      ]);
      setOrgs(unwrap(o) as MiniOrg[]);
      setRels(unwrap(r) as Rel[]);
      setPeople(unwrap(p) as Person[]);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [statusTab]);
  useEffect(() => { load(); }, [load]);

  const myPending = useMemo(() => rows.filter(a => a.status === 'PENDING' && isOwner).length, [rows, isOwner]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(a => {
      if (actionFilter && a.actionType !== actionFilter) return false;
      if (term) {
        const hay = `${ACTION_FA[a.actionType] ?? a.actionType} ${ENTITY_FA[a.entityType] ?? a.entityType} ${a.entityLabel ?? ''} ${a.entityId ?? ''} ${a.requestedByName ?? ''} ${a.requestedByEmail ?? ''} ${a.reason ?? ''} ${a.decidedReason ?? ''} ${a.organizationName ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, actionFilter]);

  const relLabel = (r?: Rel | null) => r ? `${orgName(r.sourceOrganizationId, orgs)} ↔ ${orgName(r.targetOrganizationId, orgs)} (امتیاز فعلی: ${r.strategicScore ?? '—'})` : '';
  const delTargets = form.delType === 'Person' ? people : orgs;

  async function requestNew(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    const f = form;
    const body: Record<string, unknown> = { actionType: f.actionType, reason: f.reason.trim() || undefined };
    try {
      if (f.actionType === 'STRATEGIC_SCORE_CHANGE') {
        body.entityType = 'Relationship'; body.entityId = f.entityId; body.strategicScore = Number(f.strategicScore);
        if (!f.entityId) throw new Error('انتخاب رابطه لازم است.');
      } else if (f.actionType === 'SENSITIVE_RELATIONSHIP_CREATE') {
        body.entityType = 'Relationship';
        body.after = { sourceOrganizationId: f.srcId, targetOrganizationId: f.dstId, relationshipType: f.relType, status: 'PROSPECTIVE' };
        if (!f.srcId || !f.dstId) throw new Error('سازمان مبدأ و مقصد لازم است.');
      } else if (f.actionType === 'DELETE') {
        body.entityType = 'DataLifecycle';
        body.entityId = f.entityId;
        body.after = { entityType: f.delType };
        if (!f.entityId) throw new Error('نهاد هدف را انتخاب کنید.');
      } else if (f.actionType === 'EXPORT') {
        body.entityType = 'Report'; body.entityId = f.reportType;
        body.after = { classification: f.classification, format: 'CSV' };
      } else if (f.actionType === 'DATA_SHARING') {
        body.entityType = f.entityType || 'Report'; body.entityId = f.entityId || 'network';
        body.after = { recipient: f.recipient };
        if (!f.recipient.trim()) throw new Error('گیرندهٔ اشتراک را بنویسید.');
      } else { // DATA_IMPORT
        body.entityType = 'Organization'; body.entityId = f.entityId || 'org-2';
        body.after = { fileName: f.recipient };
        if (!f.recipient.trim()) throw new Error('نام فایل ورود داده را بنویسید.');
      }
      const created = await api<Approval>('/approvals', { method: 'POST', body: JSON.stringify(body) });
      setOpen(false);
      setFlash(created.requestedById === me?.id
        ? (isOwner
          ? 'درخواست ثبت شد — در این دمو مالک تنها تصمیم‌گیرنده است و می‌تواند همین درخواست را از همین صفحه تأیید یا رد کند (در محیط واقعی، درخواست‌دهنده هرگز درخواست خودش را تصمیم نمی‌گیرد).'
          : 'درخواست ثبت شد — شما درخواست‌دهنده هستید؛ تصمیم با مالک سامانه است (درخواست‌دهنده نمی‌تواند درخواست خودش را تأیید کند).')
        : `درخواست «${ACTION_FA[created.actionType] ?? created.actionType}» ثبت شد و در صف انتظار است.`);
      await load();
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  async function decide() {
    if (!decideFor) return;
    setBusy(decideFor.id); setError(''); setFlash('');
    try {
      const res = await api<any>(`/approvals/${decideFor.id}/${decision}`, {
        method: 'POST', body: JSON.stringify({ reason: decideReason.trim() || undefined }),
      });
      const applied = res?.applied;
      const rel = rels.find(x => x.id === applied?.relationshipId);
      const msg = applied?.applied === 'STRATEGIC_SCORE_CHANGE'
        ? `تأیید اعمال شد — امتیاز راهبردی رابطه ${rel ? `${orgName(rel.sourceOrganizationId, orgs)} ↔ ${orgName(rel.targetOrganizationId, orgs)}` : ''} به ${fmtNum(applied.strategicScore)} تغییر کرد.`
        : applied?.applied === 'SENSITIVE_RELATIONSHIP_CREATE'
          ? 'تأیید اعمال شد — رابطهٔ حساس جدید در گراف ساخته شد.'
          : applied?.applied === 'DELETE'
            ? 'تأیید اعمال شد — حذف دائمی انجام شد.'
            : decision === 'approve'
              ? 'درخواست تأیید شد (مجوز صادر شد).'
              : 'درخواست رد شد.';
      setFlash(msg);
      setDetail(null); setDecideFor(null); setDecideReason('');
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  function beginCreate() {
    setError(''); setFormError('');
    setForm({ ...form, actionType: 'STRATEGIC_SCORE_CHANGE', strategicScore: '90', reason: '', entityId: '', srcId: '', dstId: '', recipient: '' });
    setOpen(true);
  }

  const delta = (a: Approval) => {
    if (a.actionType === 'STRATEGIC_SCORE_CHANGE') {
      const b = Number(a.before?.strategicScore ?? 0); const af = Number(a.after?.strategicScore ?? 0);
      return { text: `امتیاز راهبردی: ${fmtNum(b)} ← ${fmtNum(af)}`, from: b, to: af };
    }
    if (a.actionType === 'SENSITIVE_RELATIONSHIP_CREATE') {
      const d = a.after as Record<string, string> | undefined;
      return { text: `رابطهٔ جدید: ${orgName(d?.sourceOrganizationId ?? null, orgs)} ← ${orgName(d?.targetOrganizationId ?? null, orgs)} · ${d?.relationshipType ?? ''}`, from: 0, to: 0 };
    }
    if (a.actionType === 'DELETE') {
      const et = (a.after as Record<string, string> | undefined)?.entityType ?? a.entityType;
      return { text: `حذف دائمی «${ENTITY_FA[et] ?? et}» — ${a.entityLabel ?? a.entityId}`, from: 0, to: 0 };
    }
    if (a.actionType === 'EXPORT') {
      const cls = (a.after as Record<string, string> | undefined)?.classification;
      return { text: `خروجی «${ENTITY_FA[a.entityType] ?? a.entityType}»${cls ? ` با طبقه‌بندی ${cls}` : ''}`, from: 0, to: 0 };
    }
    if (a.actionType === 'DATA_SHARING') {
      const rcp = (a.after as Record<string, string> | undefined)?.recipient;
      return { text: `اشتراک داده با «${rcp ?? 'گیرندهٔ نامشخص'}»`, from: 0, to: 0 };
    }
    if (a.actionType === 'DATA_IMPORT') {
      const fn = (a.after as Record<string, string> | undefined)?.fileName;
      return { text: `ورود داده از «${fn ?? '—'}»`, from: 0, to: 0 };
    }
    return { text: '', from: 0, to: 0 };
  };

  const canDecide = (a: Approval) => isOwner && a.status === 'PENDING';

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="تأییدها"
        title="تأییدها"
        description="تصمیم‌گیری دوم‌نفره برای عملیات حساس: تغییر امتیاز راهبردی، ایجاد رابطهٔ حساس، خروجی/اشتراک/ورود داده و حذف دائمی — تأیید اثر واقعی دارد و در ممیزی ثبت می‌شود."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            {isOwner && <button className="btn btn-primary" onClick={beginCreate}><Plus size={16} /> درخواست تأیید</button>}
          </>
        }
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      <div className="stat-grid">
        <StatCard icon={<ShieldQuestion size={18} />} label="در انتظار" value={fmtNum(rows.filter(a => a.status === 'PENDING').length)} iconClass="ic-gold" sub={`نمای فعلی: ${statusTab === 'ALL' ? 'همه' : statusTab}`} />
        <StatCard icon={<Scale size={18} />} label="نیازمند تصمیم من" value={fmtNum(myPending)} iconClass="ic-indigo" sub={isOwner ? 'همهٔ درخواست‌های در انتظار (در دمو مالک تصمیم‌گیرنده است)' : 'کاربران غیرمالک در این دمو تصمیم نمی‌گیرند'} />
        <StatCard icon={<ThumbsUp size={18} />} label="تأییدشده (این نما)" value={fmtNum(rows.filter(a => a.status === 'APPROVED').length)} iconClass="ic-teal" sub={statusTab === 'APPROVED' ? 'در بازهٔ نگهداری' : 'از فیلتر وضعیت استفاده کنید'} />
        <StatCard icon={<ThumbsDown size={18} />} label="ردشده (این نما)" value={fmtNum(rows.filter(a => a.status === 'REJECTED').length)} iconClass="ic-red" sub={statusTab === 'REJECTED' ? 'در بازهٔ نگهداری' : 'از فیلتر وضعیت استفاده کنید'} />
        <StatCard icon={<History size={18} />} label="همهٔ عملیات" value={fmtNum(6)} iconClass="ic-teal" sub="۶ نوع عملیات قابل تأیید" />
      </div>

      {/* status tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['PENDING', 'در انتظار'], ['APPROVED', 'تأییدشده'], ['REJECTED', 'ردشده'], ['ALL', 'همه']].map(([v, l]) => (
          <button key={v} onClick={() => setStatusTab(v)} className={`tab-chip ${statusTab === v ? 'tab-chip-active' : ''}`}>{l}</button>
        ))}
      </div>

      <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی عملیات، نهاد، درخواست‌دهنده یا دلیل…">
        <select aria-label="فیلتر عملیات" value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="toolbar-select">
          <option value="">همهٔ عملیات‌ها</option>
          {Object.entries(ACTION_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="chip info">{fmtNum(filtered.length)} درخواست</span>
      </Toolbar>

      {loading ? (
        <div className="skeleton skeleton-table" style={{ height: 320 }} />
      ) : filtered.length === 0 ? (
        <div className="empty-state-v4">
          <div className="empty-ico"><Search size={24} /></div>
          <strong>درخواستی یافت نشد</strong>
          <p>در این وضعیت درخواستی نیست؛ تب دیگری را ببینید یا فیلتر را تغییر دهید.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>عملیات</th>
                <th>نهاد هدف</th>
                <th>سازمان</th>
                <th>درخواست‌دهنده</th>
                <th>وضعیت</th>
                <th>زمان</th>
                <th style={{ width: 250 }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const d = delta(a);
                return (
                  <tr key={a.id} className={canDecide(a) ? 'row-actionable' : ''}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {ACTION_ICON[a.actionType]} <b className="t-primary" style={{ fontSize: 12.5 }}>{ACTION_FA[a.actionType] ?? a.actionType}</b>
                      </span>
                      <div className="t-muted" style={{ fontSize: 10.5, maxWidth: 230 }}>{d.text}</div>
                      {a.reason && <div className="t-muted" style={{ fontSize: 10, maxWidth: 230 }} title={a.reason}>«{a.reason}»</div>}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11.5 }}>
                        {a.entityType === 'Relationship' ? <GitBranch size={11} className="t-muted" /> : a.entityType === 'Person' ? <UserRound size={11} className="t-muted" /> : a.entityType === 'Organization' ? <Building2 size={11} className="t-muted" /> : <Info size={11} className="t-muted" />}
                        <b style={{ fontSize: 11.5 }}>{ENTITY_FA[a.entityType] ?? a.entityType}</b>
                        {a.entityLabel && <span className="t-muted">· {a.entityLabel}</span>}
                        {a.entityId && <code dir="ltr" style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{a.entityId}</code>}
                      </span>
                    </td>
                    <td><span style={{ fontSize: 11.5 }}>{a.organizationName ?? '—'}</span></td>
                    <td>
                      <span style={{ fontSize: 11.5 }}>{a.requestedByName ?? '—'}</span>
                      <div className="t-muted" dir="ltr" style={{ fontSize: 10, textAlign: 'left' }}>{a.requestedByEmail}</div>
                    </td>
                    <td>
                      <Badge tone={a.status === 'PENDING' ? 'warning' : a.status === 'APPROVED' ? 'success' : 'danger'}>
                        {a.status === 'PENDING' ? 'در انتظار' : a.status === 'APPROVED' ? 'تأییدشده' : 'ردشده'}
                      </Badge>
                      {a.status !== 'PENDING' && (
                        <div className="t-muted" style={{ fontSize: 10, maxWidth: 170, marginTop: 2 }}>
                          {a.decidedByName} · {fmtDT(a.decidedAt)}
                        </div>
                      )}
                    </td>
                    <td><span className="t-muted" style={{ fontSize: 11 }}>{fmtDT(a.createdAt)}</span></td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
                        {a.status === 'PENDING' && isOwner && (
                          <>
                            <button className="btn btn-success btn-sm" disabled={!!busy} title="تأیید و اعمال اثر"
                              onClick={() => { setDecideFor(a); setDecision('approve'); setDecideReason(''); setError(''); }}>
                              <ThumbsUp size={12} /> تأیید
                            </button>
                            <button className="btn btn-secondary btn-sm" disabled={!!busy} title="رد درخواست"
                              onClick={() => { setDecideFor(a); setDecision('reject'); setDecideReason(''); setError(''); }}>
                              <ThumbsDown size={12} /> رد
                            </button>
                          </>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => { setError(''); setDetail(a); }}>جزئیات</button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* create modal */}
      <Modal
        open={open}
        title="درخواست تأیید جدید"
        description="درخواست به صف تأیید می‌رود. در محیط واقعی درخواست‌دهنده نمی‌تواند درخواست خودش را تصمیم بگیرد (تصمیم‌گیرنده باید فرد دیگری باشد)؛ در این دمو مالک سامانه تصمیم‌گیرنده است و درخواست‌های خودش را هم می‌تواند تأیید کند."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="ap-form" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : <ShieldQuestion size={14} />} ثبت درخواست
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <form id="ap-form" className="entity-form org-form" onSubmit={requestNew}>
          <div className="form-grid">
            <label className="field full">
              <span className="field-label">نوع عملیات <i className="req">*</i></span>
              <select value={form.actionType} onChange={e => setForm(f => ({ ...f, actionType: e.target.value }))}>
                {Object.entries(ACTION_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>

            {form.actionType === 'STRATEGIC_SCORE_CHANGE' && (
              <>
                <label className="field full">
                  <span className="field-label">رابطه <i className="req">*</i></span>
                  <select value={form.entityId} onChange={e => setForm(f => ({ ...f, entityId: e.target.value }))} required>
                    <option value="">انتخاب کنید…</option>
                    {rels.map(r => <option key={r.id} value={r.id}>{relLabel(r)}</option>)}
                  </select>
                </label>
                <label className="field full">
                  <span className="field-label">امتیاز راهبردی جدید: <b style={{ color: 'var(--srip-accent)' }}>{fmtNum(Number(form.strategicScore) || 0)}</b></span>
                  <input type="range" min={0} max={100} value={form.strategicScore} onChange={e => setForm(f => ({ ...f, strategicScore: e.target.value }))} style={{ width: '100%', accentColor: 'var(--srip-accent)' }} />
                </label>
              </>
            )}

            {form.actionType === 'SENSITIVE_RELATIONSHIP_CREATE' && (
              <>
                <label className="field"><span className="field-label">سازمان مبدأ <i className="req">*</i></span>
                  <select value={form.srcId} onChange={e => setForm(f => ({ ...f, srcId: e.target.value }))} required><option value="">انتخاب…</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                </label>
                <label className="field"><span className="field-label">سازمان مقصد <i className="req">*</i></span>
                  <select value={form.dstId} onChange={e => setForm(f => ({ ...f, dstId: e.target.value }))} required><option value="">انتخاب…</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                </label>
                <label className="field full"><span className="field-label">نوع رابطه</span>
                  <select value={form.relType} onChange={e => setForm(f => ({ ...f, relType: e.target.value }))}>
                    {REL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </>
            )}

            {form.actionType === 'DELETE' && (
              <>
                <label className="field"><span className="field-label">نوع نهاد</span>
                  <select value={form.delType} onChange={e => { setForm(f => ({ ...f, delType: e.target.value, entityId: '' })); }}>
                    <option value="Person">شخص</option><option value="Organization">سازمان</option>
                  </select>
                </label>
                <label className="field"><span className="field-label">نهاد هدف <i className="req">*</i></span>
                  <select value={form.entityId} onChange={e => setForm(f => ({ ...f, entityId: e.target.value }))} required>
                    <option value="">انتخاب…</option>
                    {delTargets.map(x => <option key={x.id} value={x.id}>{form.delType === 'Person' ? personFull(x as Person) : (x as MiniOrg).name}</option>)}
                  </select>
                </label>
                <div className="field full t-muted" style={{ fontSize: 11, display: 'flex', gap: 5, alignItems: 'center' }}>
                  <AlertTriangle size={12} style={{ color: '#c8453c' }} /> حذف پس از تأیید، دائمی و غیرقابل بازگشت است.
                </div>
              </>
            )}

            {form.actionType === 'EXPORT' && (
              <>
                <label className="field"><span className="field-label">نوع خروجی</span>
                  <select value={form.reportType} onChange={e => setForm(f => ({ ...f, reportType: e.target.value }))}>
                    <option value="relationship-health">سلامت روابط</option><option value="network">شبکه</option>
                    <option value="risk">ریسک</option><option value="meeting">جلسات</option><option value="company">فهرست شرکت‌ها</option>
                  </select>
                </label>
                <label className="field"><span className="field-label">طبقه‌بندی</span>
                  <select value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value }))}>
                    <option value="INTERNAL">داخلی</option><option value="CONFIDENTIAL">محرمانه</option>
                    <option value="RESTRICTED">محدود</option><option value="HIGHLY_CONFIDENTIAL">بسیار محرمانه</option>
                  </select>
                </label>
              </>
            )}

            {form.actionType === 'DATA_SHARING' && (
              <>
                <label className="field"><span className="field-label">نهاد</span>
                  <select value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
                    <option value="Report">گزارش</option><option value="Relationship">رابطه</option><option value="Organization">سازمان</option>
                  </select>
                </label>
                <label className="field full"><span className="field-label">گیرندهٔ اشتراک <i className="req">*</i></span>
                  <input value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))} placeholder="مثال: حسابرس مستقل" required />
                </label>
              </>
            )}

            {form.actionType === 'DATA_IMPORT' && (
              <label className="field full"><span className="field-label">نام فایل ورود داده <i className="req">*</i></span>
                <input value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))} placeholder="مثال: subsidiaries-1405.csv" required />
              </label>
            )}

            <label className="field full">
              <span className="field-label">دلیل / توضیح</span>
              <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} placeholder="چرا این عملیات لازم است؟" />
            </label>
          </div>
        </form>
      </Modal>

      {/* detail modal */}
      <Modal
        open={!!detail}
        title={`${detail ? ACTION_FA[detail.actionType] ?? detail.actionType : ''} — ${detail?.id ?? ''}`}
        description={detail ? `وضعیت: ${detail.status === 'PENDING' ? 'در انتظار' : detail.status === 'APPROVED' ? 'تأییدشده' : 'ردشده'} · نهاد: ${ENTITY_FA[detail.entityType] ?? detail.entityType}` : ''}
        onClose={() => setDetail(null)}
        footer={
          detail?.status === 'PENDING' && isOwner ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => { setDecideFor(detail); setDecision('reject'); setDecideReason(''); setDetail(null); }}><ThumbsDown size={13} /> رد</button>
              <button type="button" className="btn btn-success" onClick={() => { setDecideFor(detail); setDecision('approve'); setDecideReason(''); setDetail(null); }}><ThumbsUp size={13} /> تأیید و اعمال</button>
            </>
          ) : <button type="button" className="btn btn-secondary" onClick={() => setDetail(null)}><X size={14} /> بستن</button>
        }
      >
        {detail && (
          <div style={{ display: 'grid', gap: 10, fontSize: 12.5 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><Info size={14} className="t-muted" style={{ marginTop: 2 }} /><span><b>جزئیات:</b> {delta(detail).text}</span></div>
            <div style={{ display: 'flex', gap: 6 }}><Building2 size={14} className="t-muted" /><span><b>سازمان:</b> {detail.organizationName ?? '—'}</span></div>
            <div style={{ display: 'flex', gap: 6 }}><UserRound size={14} className="t-muted" /><span><b>درخواست‌دهنده:</b> {detail.requestedByName ?? '—'} {detail.requestedByEmail ? `(${detail.requestedByEmail})` : ''}</span></div>
            {detail.reason && <div style={{ display: 'flex', gap: 6 }}><Clock3 size={14} className="t-muted" /><span><b>دلیل درخواست:</b> {detail.reason}</span></div>}
            {detail.decidedReason && <div style={{ display: 'flex', gap: 6 }}><CheckCircle2 size={14} className="t-muted" /><span><b>دلیل تصمیم:</b> {detail.decidedReason}</span></div>}
            {detail.status !== 'PENDING' && (
              <div style={{ display: 'flex', gap: 6 }}><Scale size={14} className="t-muted" /><span><b>تصمیم‌گیرنده:</b> {detail.decidedByName ?? '—'} در {fmtDT(detail.decidedAt)}</span></div>
            )}
            <div style={{ display: 'flex', gap: 12, color: 'var(--text-muted)', fontSize: 11.5 }}>
              <span>ایجاد: {fmtDT(detail.createdAt)}</span><code dir="ltr" style={{ fontFamily: 'ui-monospace,monospace' }}>{detail.id}</code>
            </div>
          </div>
        )}
      </Modal>

      {/* decision modal */}
      <Modal
        open={!!decideFor}
        title={decideFor ? (decision === 'approve' ? `تأیید — ${ACTION_FA[decideFor.actionType] ?? ''}` : `رد — ${ACTION_FA[decideFor.actionType] ?? ''}`) : ''}
        description={decideFor ? `«${decideFor.entityLabel ?? decideFor.entityId ?? ENTITY_FA[decideFor.entityType] ?? ''}» — ${delta(decideFor).text}` : ''}
        onClose={() => setDecideFor(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDecideFor(null)}><X size={14} /> انصراف</button>
            <button type="button" className={decision === 'approve' ? 'btn btn-success' : 'btn btn-danger'} onClick={decide} disabled={busy === decideFor?.id}>
              {busy === decideFor?.id ? <RefreshCw size={14} className="spin" /> : decision === 'approve' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
              {decision === 'approve' ? ' تأیید و اعمال اثر' : ' رد درخواست'}
            </button>
          </>
        }
      >
        <label className="field">
          <span className="field-label">دلیل تصمیم {decision === 'reject' ? '(پیشنهادی)' : ''}</span>
          <textarea value={decideReason} onChange={e => setDecideReason(e.target.value)} rows={2} placeholder={decision === 'reject' ? 'چرا رد شد؟ (مثلاً: داده کامل نیست)' : 'مثلاً: توافقنامه امضا شد'} />
        </label>
        {decision === 'approve' && decideFor && (
          <p className="t-muted" style={{ fontSize: 11, display: 'flex', gap: 5, alignItems: 'center', marginTop: 8 }}>
            <AlertTriangle size={12} /> تأیید، اثر عملیات را بلافاصله اعمال می‌کند (تغییر امتیاز/ساخت رابطه/حذف) و در ممیزی ثبت می‌شود.
          </p>
        )}
      </Modal>
    </main>
  );
}
