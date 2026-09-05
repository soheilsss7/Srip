'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../_components/page-ui';
import {
  RefreshCw, Search, Plus, X, CheckCircle2, Target, ListChecks, CircleDot,
  Loader2, ShieldCheck, Ban, FileText, FolderKanban, ChevronLeft, Link2,
  Sparkles, Route, AlertTriangle, Building2, Wrench, TrendingUp, ShieldAlert,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  نیازمندی‌ها و پوشش ارتباطی — مدیریت نیازمندی‌های پروژه + تطبیق گراف  */
/*  بک‌اند: POST/PATCH/DELETE /projects/requirements ·                  */
/*          GET /requirements/:id/matches (موتور تطبیق رابطه)          */
/* ------------------------------------------------------------------ */

type Req = {
  id: string; title: string; description?: string | null; category?: string | null;
  status: string; priority: string; organizationId?: string | null; createdAt?: string | null;
};
type MiniOrg = { id: string; name: string };
type Proj = { id: string; name: string; status?: string; organizationId?: string | null };
type MatchConn = {
  targetOrganization: MiniOrg & { industry?: string | null; type?: string };
  connectionType: 'DIRECT' | 'INDIRECT' | 'GAP';
  targetFit: number; pathStrength: number; successProbability: number;
  path?: { hopCount: number; relationshipIds: string[]; organizationIds: string[]; connectorOrganizationId?: string } | null;
  connectorPerson?: { firstName: string; lastName: string; title?: string } | null;
  recommendation?: string;
};
type MatchResult = {
  requirement: Req; sourceOrganizationId: string | null; sourceOrganizationName?: string | null; projectName?: string | null;
  summary: { direct: number; indirect: number; gaps: number; internal: number; external: number };
  bestConnection?: MatchConn | null;
  directConnections?: MatchConn[]; indirectConnections?: MatchConn[];
  gaps?: MatchConn[]; recommendations?: Array<{ rank: number; title: string; rationale: string; successProbability: number; targetOrganizationId: string; type: string }>;
};

const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const fmtDT = (iso?: string | null) => iso
  ? new Date(iso).toLocaleDateString('fa-IR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);

const STATUS_FA: Record<string, string> = {
  OPEN: 'باز', IN_PROGRESS: 'در جریان', SATISFIED: 'برآورده', BLOCKED: 'مسدود', CANCELLED: 'لغو شده',
};
const STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  OPEN: 'warning', IN_PROGRESS: 'info', SATISFIED: 'success', BLOCKED: 'danger', CANCELLED: 'neutral',
};
const PRIO_FA: Record<string, string> = { LOW: 'کم', MEDIUM: 'متوسط', HIGH: 'زیاد', CRITICAL: 'بحرانی' };
const PRIO_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};
const CATS = ['فنی', 'تأمین', 'مالی', 'تجاری', 'فرایندی', 'حقوقی', 'زیرساخت', 'سازمانی'];
const CAT_ICON: Record<string, React.ReactNode> = {
  'فنی': <Wrench size={11} />, 'تأمین': <Link2 size={11} />, 'مالی': <TrendingUp size={11} />,
};
const personFull = (p?: { firstName: string; lastName: string } | null) => p ? `${p.firstName} ${p.lastName}` : '';
const orgName = (id: string | null | undefined, orgs: MiniOrg[]) => orgs.find(o => o.id === id)?.name ?? '—';

export default function RequirementsPage() {
  const { me } = useWorkspace();

  const [reqs, setReqs] = useState<Req[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [orgs, setOrgs] = useState<MiniOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [projFilter, setProjFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Req & { projectId: string } | null>(null);
  const [form, setForm] = useState({ projectId: '', title: '', description: '', category: '', priority: 'MEDIUM', status: 'OPEN', organizationId: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [matchReq, setMatchReq] = useState<Req | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [ps, o] = await Promise.all([
        api<Proj[]>('/projects'), api<MiniOrg[]>('/organizations'),
      ]);
      const pList = unwrap(ps) as Proj[];
      const oList = unwrap(o) as MiniOrg[];
      setProjects(pList); setOrgs(oList);
      const flat: Req[] = [];
      for (const p of pList) {
        const pv = p as Proj & { requirements?: Req[] };
        for (const r of pv.requirements ?? []) flat.push({ ...r });
      }
      setReqs(flat);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const projOf = useCallback((reqId: string) => {
    let name = '—'; let orgId: string | null = null;
    for (const p of projects) {
      const pv = p as Proj & { requirements?: Req[] };
      const hit = (pv.requirements ?? []).find(r => r.id === reqId);
      if (hit) { name = p.name; orgId = p.organizationId ?? null; break; }
    }
    return { name, orgId };
  }, [projects]);

  const stats = useMemo(() => {
    const by = (s: string) => reqs.filter(r => r.status === s).length;
    const covered = reqs.filter(r => r.organizationId).length;
    return {
      total: reqs.length, open: by('OPEN'), progress: by('IN_PROGRESS'),
      done: by('SATISFIED'), blocked: by('BLOCKED'),
      rate: reqs.length ? Math.round((covered / reqs.length) * 100) : 0,
    };
  }, [reqs]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const projOfReq = (r: Req) => projOf(r.id);
    return reqs.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (projFilter && projOfReq(r).name !== projFilter) return false;
      if (term) {
        const p = projOfReq(r);
        if (!`${r.title} ${r.description ?? ''} ${r.category ?? ''} ${p.name} ${orgName(r.organizationId, orgs)}`.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [reqs, q, projFilter, statusFilter, projOf, orgs]);

  const projNames = [...new Set(reqs.map(r => projOf(r.id).name))];

  function beginCreate() {
    setError(''); setFormError('');
    setEditing(null);
    setForm({ projectId: projects[0]?.id ?? '', title: '', description: '', category: '', priority: 'MEDIUM', status: 'OPEN', organizationId: '' });
    setOpen(true);
  }
  function beginEdit(r: Req) {
    setError(''); setFormError('');
    setEditing({ ...r, projectId: projOf(r.id).name === '—' ? '' : projects.find(p => p.id === (r as Req & { projectId?: string }).projectId)?.id ?? '' });
    // resolve project id from projects list by name match
    const p = projects.find(x => (x as Proj & { requirements?: Req[] }).requirements?.some(rr => rr.id === r.id));
    setEditing({ ...r, projectId: p?.id ?? '' });
    setForm({
      projectId: p?.id ?? '', title: r.title, description: r.description ?? '',
      category: r.category ?? '', priority: r.priority, status: r.status,
      organizationId: r.organizationId ?? '',
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    const body: Record<string, unknown> = { title: form.title.trim() };
    if (form.description.trim()) body.description = form.description.trim();
    if (form.category) body.category = form.category;
    body.priority = form.priority; body.status = form.status;
    body.organizationId = form.organizationId || null;
    try {
      if (editing) {
        const { projectId: _p, ...patch } = body;
        await api(`/projects/requirements/${editing.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
        setFlash(`نیازمندی «${form.title}» به‌روزرسانی شد.`);
      } else {
        body.projectId = form.projectId;
        await api('/projects/requirements', { method: 'POST', body: JSON.stringify(body) });
        setFlash(`نیازمندی «${form.title}» به پروژه افزوده شد.`);
      }
      setOpen(false);
      await load();
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  async function remove(r: Req) {
    if (!confirm(`نیازمندی «${r.title}» برای همیشه حذف شود؟`)) return;
    setBusy(r.id); setError('');
    try {
      await api(`/projects/requirements/${r.id}`, { method: 'DELETE' });
      setFlash(`نیازمندی «${r.title}» حذف شد.`);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  async function runMatch(r: Req) {
    setMatchReq(r); setMatch(null); setMatchLoading(true); setError('');
    try { setMatch(await api<MatchResult>(`/requirements/${r.id}/matches`)); }
    catch (x) { setError((x as Error).message); setMatchReq(null); }
    finally { setMatchLoading(false); }
  }

  async function chooseCoverage(conn: MatchConn) {
    if (!matchReq) return;
    setBusy(conn.targetOrganization.id); setError('');
    try {
      const body: Record<string, unknown> = { organizationId: conn.targetOrganization.id };
      if (matchReq.status === 'OPEN') body.status = 'IN_PROGRESS';
      await api(`/projects/requirements/${matchReq.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setFlash(`«${matchReq.title}» به «${conn.targetOrganization.name}» سپرده شد و وضعیتش «در جریان» شد.`);
      setMatch(null); setMatchReq(null);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  async function fillGap(g: MatchConn) {
    if (!match) return;
    if (!confirm(`رابطهٔ پیشنهادی با «${g.targetOrganization.name}» (نوع مشارکت، وضعیت بالقوه) ثبت شود؟ پس از ثبت، این سازمان از فهرست شکاف‌ها خارج و در نتایج مستقیم ظاهر می‌شود.`)) return;
    setBusy(g.targetOrganization.id); setError('');
    try {
      await api('/relationships', {
        method: 'POST',
        body: JSON.stringify({
          sourceOrganizationId: match.sourceOrganizationId, targetOrganizationId: g.targetOrganization.id,
          relationshipType: 'PARTNERSHIP', status: 'PROSPECTIVE',
        }),
      });
      setFlash(`رابطه با «${g.targetOrganization.name}» ثبت شد — دوباره پوشش ارتباطی محاسبه شد.`);
      await runMatch(match.requirement);
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  const hasOrg = orgs.length > 0;

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="نیازمندی‌ها"
        title="نیازمندی‌ها و پوشش ارتباطی"
        description="نیازمندی‌های پروژه‌ها (وضعیت/اولویت/سازمان پوشش) + موتور تطبیق: بهترین مسیر ارتباطی برای هر نیازمندی از گراف روابط؛ شکاف‌ها قابل پر کردن با ثبت رابطهٔ پیشنهادی."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button className="btn btn-primary" onClick={beginCreate} disabled={!hasOrg}><Plus size={16} /> نیازمندی جدید</button>
          </>
        }
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 320 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<ListChecks size={18} />} label="کل نیازمندی‌ها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub={`در ${projects.length} پروژه`} />
            <StatCard icon={<CircleDot size={18} />} label="باز" value={fmtNum(stats.open)} iconClass="ic-gold" sub="در انتظار پوشش" />
            <StatCard icon={<Loader2 size={18} />} label="در جریان" value={fmtNum(stats.progress)} iconClass="ic-teal" sub="دارای مسیر فعال" />
            <StatCard icon={<ShieldCheck size={18} />} label="برآورده" value={fmtNum(stats.done)} iconClass="ic-red" sub="تکمیل‌شده" />
            <StatCard icon={<ShieldAlert size={18} />} label="مسدود" value={fmtNum(stats.blocked)} iconClass="ic-gold" sub="نیازمند رفع مانع" />
            <StatCard icon={<Target size={18} />} label="پوشش تعیین‌شده" value={`٪${fmtNum(stats.rate)}`} iconClass="ic-teal" sub="دارای سازمان پوشش" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی عنوان، پروژه، دسته یا سازمان…">
            <select aria-label="فیلتر پروژه" value={projFilter} onChange={e => setProjFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ پروژه‌ها</option>
              {projNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ وضعیت‌ها</option>
              <option value="OPEN">باز</option><option value="IN_PROGRESS">در جریان</option>
              <option value="SATISFIED">برآورده</option><option value="BLOCKED">مسدود</option>
              <option value="CANCELLED">لغو شده</option>
            </select>
            <span className="chip info">{fmtNum(filtered.length)} نیازمندی</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>نیازمندی‌ای یافت نشد</strong>
              <p>با «نیازمندی جدید» ثبت کنید یا فیلترها را تغییر دهید.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>نیازمندی</th>
                    <th>پروژه</th>
                    <th>اولویت</th>
                    <th>وضعیت</th>
                    <th>سازمان پوشش</th>
                    <th>ایجاد</th>
                    <th style={{ width: 250 }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const p = projOf(r.id);
                    return (
                      <tr key={r.id}>
                        <td>
                          <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                            {CAT_ICON[r.category ?? ''] ?? <FileText size={12} className="t-muted" />}
                            <b className="t-primary" style={{ fontSize: 12.5 }}>{r.title}</b>
                          </span>
                          <div className="t-muted" style={{ fontSize: 10.5, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.description || '—'}
                          </div>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11.5 }}>
                            <FolderKanban size={11} className="t-muted" /> {p.name}
                          </span>
                          <div className="t-muted" style={{ fontSize: 10 }}>{r.category ?? '—'}</div>
                        </td>
                        <td><Badge tone={PRIO_TONE[r.priority] ?? 'neutral'}>{PRIO_FA[r.priority] ?? r.priority}</Badge></td>
                        <td><Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{STATUS_FA[r.status] ?? r.status}</Badge></td>
                        <td>
                          {r.organizationId
                            ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11.5 }}><Building2 size={11} className="t-muted" /> <b style={{ fontSize: 11.5 }}>{orgName(r.organizationId, orgs)}</b></span>
                            : <span className="t-muted" style={{ fontSize: 11 }}>—</span>}
                        </td>
                        <td><span className="t-muted" style={{ fontSize: 11 }}>{fmtDT(r.createdAt)}</span></td>
                        <td>
                          <span style={{ display: 'inline-flex', gap: 5 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => runMatch(r)} disabled={!!busy} title="محاسبهٔ پوشش ارتباطی از گراف"><Sparkles size={12} /> پوشش ارتباطی</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => beginEdit(r)} disabled={!!busy}><FileText size={12} /> ویرایش</button>
                            <button className="btn btn-ghost btn-sm danger-ghost" onClick={() => remove(r)} disabled={!!busy} title="حذف"><X size={12} /></button>
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

      {/* ------- create/edit ------- */}
      <Modal
        open={open}
        title={editing ? `ویرایش نیازمندی «${editing.title}»` : 'نیازمندی جدید'}
        description={editing ? 'وضعیت، اولویت یا سازمان پوشش را تغییر دهید.' : 'نیازمندی به پروژه افزوده می‌شود؛ سازمان پوشش را می‌توانید بعداً از نتیجهٔ «پوشش ارتباطی» تعیین کنید.'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="req-form" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />} {editing ? ' ذخیرهٔ تغییرات' : ' افزودن'}
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <form id="req-form" className="entity-form org-form" onSubmit={save}>
          <div className="form-grid">
            <label className="field full">
              <span className="field-label">عنوان <i className="req">*</i></span>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="مثال: تأمین تجهیزات زیرساخت" />
            </label>
            <label className="field">
              <span className="field-label">پروژه <i className="req">*</i></span>
              <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} disabled={!!editing} required>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">دسته</span>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">بدون دسته</option>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">اولویت</span>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {Object.entries(PRIO_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">وضعیت</span>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(STATUS_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">سازمان پوشش</span>
              <select value={form.organizationId} onChange={e => setForm(f => ({ ...f, organizationId: e.target.value }))}>
                <option value="">انتخاب نشده</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <small className="t-muted">سازمانی که این نیازمندی را پوشش می‌دهد.</small>
            </label>
            <label className="field full">
              <span className="field-label">توضیح</span>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="جزئیات نیازمندی — هرچه دقیق‌تر، تطبیق پوشش بهتر…" />
            </label>
          </div>
        </form>
      </Modal>

      {/* ------- coverage match modal ------- */}
      <Modal
        open={!!matchReq}
        title={`پوشش ارتباطی — ${matchReq?.title ?? ''}`}
        description={matchReq ? `${match?.projectName ?? ''} · مبدأ: ${match?.sourceOrganizationName ?? '—'}` : ''}
        onClose={() => { setMatch(null); setMatchReq(null); }}
        footer={<button type="button" className="btn btn-secondary" onClick={() => { setMatch(null); setMatchReq(null); }}><X size={14} /> بستن</button>}
      >
        {matchLoading ? (
          <div className="empty-state-v4"><RefreshCw size={20} className="spin" /><strong>محاسبهٔ مسیرها روی گراف روابط…</strong></div>
        ) : match ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Badge tone="success">مستقیم: {fmtNum(match.summary.direct)}</Badge>
              <Badge tone="info">دوگامی: {fmtNum(match.summary.indirect)}</Badge>
              <Badge tone="neutral">داخلی: {fmtNum(match.summary.internal)}</Badge>
              <Badge tone="danger">شکاف: {fmtNum(match.summary.gaps)}</Badge>
              {match.summary.direct + match.summary.indirect === 0 && match.summary.gaps === 0 && (
                <span className="t-muted" style={{ fontSize: 12 }}>کاندیدای هم‌پوشان با عنوان/توضیح این نیازمندی پیدا نشد — با «ویرایش» کلمات دقیق‌تری (صنعت/نوع هدف) بنویسید.</span>
              )}
            </div>

            {/* best connection hero */}
            {match.bestConnection && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderRadius: 14, border: '1px solid var(--srip-accent, #0969da)', background: 'var(--srip-accent-soft, rgba(9,105,218,.06))', flexWrap: 'wrap' }}>
                <div className="empty-ico"><Target size={18} /></div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 12 }} className="t-muted">بهترین مسیر</div>
                  <b style={{ fontSize: 14 }}>{match.bestConnection.targetOrganization.name}</b>
                  <div style={{ fontSize: 11.5, color: 'var(--text)' }}>
                    {match.bestConnection.connectionType === 'DIRECT' ? 'رابطهٔ مستقیم' : 'مسیر دوگامی'}
                    {match.bestConnection.connectorPerson ? ` از طریق ${personFull(match.bestConnection.connectorPerson)}` : ''}
                  </div>
                  <div style={{ fontSize: 10.5 }} className="t-muted">
                    {match.bestConnection.recommendation}
                  </div>
                </div>
                <div style={{ width: 130 }}>
                  <div className="prob-label" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>احتمال موفقیت</div>
                  <b style={{ fontSize: 19, color: 'var(--srip-accent)' }}>٪{fmtNum(match.bestConnection.successProbability)}</b>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => chooseCoverage(match.bestConnection as MatchConn)} disabled={busy === match.bestConnection.targetOrganization.id} title="این سازمان را به‌عنوان پوشش نیازمندی انتخاب کن">
                  <CheckCircle2 size={13} /> انتخاب به‌عنوان پوشش
                </button>
              </div>
            )}

            {/* all matches */}
            {[...(match.directConnections ?? []), ...(match.indirectConnections ?? [])].map((c, i) => (
              <div key={i} className="panel compact" style={{ padding: '12px 14px', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Building2 size={12} className="t-muted" /><b style={{ fontSize: 12.5 }}>{c.targetOrganization.name}</b></span>
                  <Badge tone={c.connectionType === 'DIRECT' ? 'success' : 'info'}>{c.connectionType === 'DIRECT' ? 'مستقیم' : 'دوگامی'}</Badge>
                  {c.connectorPerson && <span className="t-muted" style={{ fontSize: 11 }}>واسطه: {personFull(c.connectorPerson)}</span>}
                  {c.path && (
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <Route size={11} />
                      {c.path.organizationIds.map((oid, ix) => (
                        <span key={ix} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          {ix > 0 && <ChevronLeft size={10} />}<span dir="rtl">{orgName(oid, orgs)}</span>
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="chip info" style={{ marginInlineStart: 'auto' }}>
                    احتمال: ٪{fmtNum(c.successProbability)} · تناسب: ٪{fmtNum(c.targetFit)} · قدرت: ٪{fmtNum(c.pathStrength)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 4, overflow: 'hidden', background: 'var(--input-bg,#eef1f5)' }}>
                    <div style={{ height: '100%', width: `${c.successProbability}%`, background: c.successProbability >= 60 ? 'var(--srip-accent,#0969da)' : c.successProbability >= 40 ? '#b7791f' : '#c8453c' }} />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => chooseCoverage(c)} disabled={busy === c.targetOrganization.id}><CheckCircle2 size={13} /> انتخاب پوشش</button>
                </div>
              </div>
            ))}

            {/* gaps */}
            {(match.gaps ?? []).length > 0 && (
              <div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 6 }} className="t-muted">
                  <AlertTriangle size={13} /> شکاف‌های ارتباطی — سازمان‌های مناسبِ بدون مسیر ≤۲ گامی
                </div>
                {(match.gaps ?? []).map((g, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '9px 12px', borderRadius: 10, background: 'rgba(220,66,60,.05)', marginBottom: 6, flexWrap: 'wrap' }}>
                    <Building2 size={13} className="t-muted" />
                    <b style={{ fontSize: 12.5 }}>{g.targetOrganization.name}</b>
                    <Badge tone="neutral">تناسب ٪{fmtNum(g.targetFit)}</Badge>
                    <span className="t-muted" style={{ fontSize: 11, flex: 1, minWidth: 160 }}>{g.recommendation}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => fillGap(g)} disabled={busy === g.targetOrganization.id} title="ثبت رابطهٔ پیشنهادی (نوع مشارکت، بالقوه) برای پر کردن این شکاف">
                      <Link2 size={12} /> ثبت رابطهٔ پیشنهادی
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
