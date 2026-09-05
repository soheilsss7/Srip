'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, Modal, PageHeader, SectionCard, StatCard } from '../_components/page-ui';
import {
  AlertTriangle, Bell, BellRing, CheckCircle2, ChevronDown, ChevronLeft, CircleDashed, Clock3, FileText,
  GitBranch, GitCommitHorizontal, GitMerge, GripVertical, History, ListChecks, Lock, MessageSquareText,
  Play, Plus, Power, RefreshCw, Scale, ShieldCheck, Target, Trash2, Users, Workflow, X, Zap,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  گردش کار — ویرایشگر بصری (پاریتی WorkflowsService)                 */
/*  GET/POST /workflows · POST /workflows/:id/execute · /trigger        */
/*  POST /workflows/executions/:id/resume                              */
/*  POST /workflows/approvals/:id/decision                             */
/* ------------------------------------------------------------------ */

const ENTITY_OPTIONS = [
  { key: 'Relationship', fa: 'رابطه', icon: <GitBranch size={14} /> },
  { key: 'Organization', fa: 'سازمان', icon: <FileText size={14} /> },
  { key: 'Person', fa: 'شخص', icon: <Users size={14} /> },
  { key: 'Meeting', fa: 'جلسه', icon: <Clock3 size={14} /> },
  { key: 'Commitment', fa: 'تعهد', icon: <ListChecks size={14} /> },
  { key: 'Action', fa: 'اقدام', icon: <Zap size={14} /> },
  { key: 'Opportunity', fa: 'فرصت', icon: <Target size={14} /> },
  { key: 'Project', fa: 'پروژه', icon: <GitCommitHorizontal size={14} /> },
];
const ACTION_META: Record<string, { fa: string; icon: React.ReactNode; tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral'; color: string }> = {
  CREATE_NOTIFICATION: { fa: 'اعلان', icon: <BellRing size={14} />, tone: 'info', color: '#3b82f6' },
  CREATE_ACTION: { fa: 'اقدام', icon: <Zap size={14} />, tone: 'warning', color: '#d97706' },
  CREATE_COMMITMENT: { fa: 'تعهد', icon: <ListChecks size={14} />, tone: 'success', color: '#16a34a' },
  CREATE_OPPORTUNITY: { fa: 'فرصت', icon: <Target size={14} />, tone: 'success', color: '#0d9488' },
  REQUEST_APPROVAL: { fa: 'تأیید دوم‌نفره', icon: <Scale size={14} />, tone: 'danger', color: '#dc2626' },
  WAIT: { fa: 'انتظار', icon: <Clock3 size={14} />, tone: 'neutral', color: '#64748b' },
};

type WfAction = { type: string; [k: string]: any };
type WfDef = { trigger?: { type?: string; entityType?: string }; conditions?: any[]; actions?: WfAction[] };
type WfRow = { id: string; name: string; entityType: string; organizationId?: string | null; organizationName?: string | null; isActive: boolean; definition: WfDef; actionCount: number; steps?: Array<{ type: string; summary: string }>; triggerType: string; createdAt: string; updatedAt?: string | null };
type ExecRow = { id: string; workflowId: string; workflowName?: string | null; entityType: string; entityId: string; status: string; currentActionIndex?: number; resumeAt?: string | null; context?: any; createdAt?: string; startedAt?: string | null; finishedAt?: string | null };
type RelMini = { id: string; sourceOrganization?: { name?: string } | null; targetOrganization?: { name?: string } | null };
type OrgMini = { id: string; name: string };

const fmtNum = (v: unknown) => (v == null || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));
const fmtDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fa-IR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const unwrap = (x: any) => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? x?.workflows ?? []);
const empty = (): WfAction[] => [
  { type: 'CREATE_NOTIFICATION', title: '', body: '', notificationType: 'INFO', channel: 'IN_APP', priority: 'MEDIUM' },
  { type: 'CREATE_ACTION', title: '', status: 'OPEN', priority: 'MEDIUM' },
];
const STR_TONES: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  COMPLETED: 'success', APPROVED: 'success', RUNNING: 'info', PENDING: 'warning', WAITING: 'warning',
  FAILED: 'danger', REJECTED: 'danger',
};

function Flow({ wf }: { wf: WfRow }) {
  const def = wf.definition ?? {};
  const conds = Array.isArray(def.conditions) ? def.conditions : [];
  const condText = (c: any) => {
    if (!c || !c.path) return '';
    if (c.exists !== undefined) return `«${c.path}» ${c.exists ? 'وجود دارد' : 'وجود ندارد'}`;
    if ('equals' in c) return `«${c.path}» برابر «${String(c.equals)}»`;
    if ('notEquals' in c) return `«${c.path}» مخالف «${String(c.notEquals)}»`;
    return '';
  };
  const notifPreview = (a: WfAction) => {
    const t = a.title ?? '';
    const b = a.body ?? '';
    return [t ? `«${t}»` : '', b ? b.slice(0, 90) : ''].filter(Boolean).join(' — ') || 'اعلان';
  };
  return (
    <div className="flow-canvas">
      <div className="flow-start">
        <CircleDashed size={14} className="t-muted" />
        <span>
          <b style={{ fontSize: 11 }}>شروع · {def.trigger?.type === 'MANUAL' || !def.trigger?.type ? 'اجرای دستی' : `رویداد ${def.trigger.type}`}</b>
          {def.trigger?.entityType && <div className="t-muted" style={{ fontSize: 10 }}>نهاد: {def.trigger.entityType}</div>}
        </span>
      </div>
      <span className="flow-edge"><ChevronDown size={13} /></span>
      {conds.length > 0 && (
        <>
          <div className="flow-cond">
            <ShieldCheck size={13} className="t-warning" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 11 }}>{conds.length} شرط</b>
              {conds.map((c, i) => <div key={i} className="t-muted" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{condText(c)}</div>)}
            </div>
          </div>
          <span className="flow-edge"><ChevronDown size={13} /></span>
        </>
      )}
      {(Array.isArray(def.actions) ? def.actions : []).map((a, i) => {
        const meta = ACTION_META[a.type] ?? { fa: a.type, icon: <Workflow size={14} />, tone: 'neutral' as const, color: '#94a3b8' };
        return (
          <div key={i} style={{ display: 'contents' }}>
            <div className="flow-node" style={{ borderInlineStartColor: meta.color }}>
              <span className="flow-step">{i + 1}</span>
              <span className="flow-ico" style={{ background: meta.color }}>{meta.icon}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 11.5 }}>{meta.fa}</b>
                  <Badge tone={meta.tone as any}>{a.type}</Badge>
                </div>
                <div className="t-muted" style={{ fontSize: 10.5, marginTop: 1, lineHeight: 1.5 }}>
                  {a.type === 'CREATE_NOTIFICATION' && notifPreview(a)}
                  {a.type === 'CREATE_ACTION' && (a.title ? `«${a.title}»` : 'اقدام') + (a.priority ? ` · اولویت ${a.priority}` : '')}
                  {a.type === 'CREATE_COMMITMENT' && ((a.description ?? a.title) ? `«${String(a.description ?? a.title).slice(0, 90)}»` : 'تعهد') + (a.risk ? ` · ریسک ${a.risk}` : '')}
                  {a.type === 'CREATE_OPPORTUNITY' && (a.name ? `«${a.name}»` : 'فرصت') + (a.probability ? ` · احتمال ${a.probability}٪` : '')}
                  {a.type === 'REQUEST_APPROVAL' && (a.payload?.note ?? a.payload?.title ?? 'تصویب ادامهٔ گردش کار')}
                  {a.type === 'WAIT' && `${Number(a.minutes) || 1} دقیقه`}
                </div>
              </div>
            </div>
            <span className="flow-edge"><ChevronDown size={13} /></span>
          </div>
        );
      })}
      <div className="flow-end"><CheckCircle2 size={14} /> <b style={{ fontSize: 11 }}>پایان</b></div>
    </div>
  );
}

function ExecStatus({ status }: { status: string }) {
  const tone = STR_TONES[status] ?? 'neutral';
  const label: Record<string, string> = {
    COMPLETED: 'کامل شد', RUNNING: 'در حال اجرا', WAITING: 'در انتظار', FAILED: 'ناموفق', REJECTED: 'رد شد',
  };
  return <Badge tone={tone}>{label[status] ?? status}</Badge>;
}

export default function WorkflowsPage() {
  const { me, can } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');
  const canWrite = isOwner || can('workflow.write');
  const canExec = isOwner || can('workflow.execute');

  const [rows, setRows] = useState<WfRow[]>([]);
  const [execs, setExecs] = useState<Record<string, ExecRow[]>>({});
  const [tab, setTab] = useState<'workflows' | 'executions'>('workflows');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [editing, setEditing] = useState<WfRow | null>(null);
  const [busy, setBusy] = useState('');

  /* create/edit form state */
  const [form, setForm] = useState({ name: '', entityType: 'Relationship', isActive: true, triggerType: 'MANUAL' });
  const [steps, setSteps] = useState<WfAction[]>(empty());
  const [condText, setCondText] = useState('');

  /* run drawer */
  const [runFor, setRunFor] = useState<WfRow | null>(null);
  const [runType, setRunType] = useState<'manual' | 'event'>('manual');
  const [runEntity, setRunEntity] = useState('');
  const [runCtx, setRunCtx] = useState('');
  const [execLog, setExecLog] = useState<{ id: string; status: string; log?: string[] } | null>(null);

  /* approvals of executions */
  const [approvals, setApprovals] = useState<Record<string, any[]>>({});
  const [approvalModal, setApprovalModal] = useState<{ execId: string; items: any[] } | null>(null);
  const [decideReason, setDecideReason] = useState('');

  const [rels, setRels] = useState<RelMini[]>([]);
  const [orgs, setOrgs] = useState<OrgMini[]>([]);
  const [showEntityHelp, setShowEntityHelp] = useState(false);

  const isDraft = (s: WfAction[]) => s.every(x => x.type === 'CREATE_NOTIFICATION' && !x.title && !x.body);

  const entityIcon = (t: string) => ENTITY_OPTIONS.find(e => e.key === t)?.fa ?? t;

  async function refreshLive() {
    try {
      const [exList, apList] = await Promise.all([
        api<any[]>('/workflows/executions').catch(() => []),
        api<any[]>('/workflows/approvals').catch(() => []),
      ]);
      const map: Record<string, ExecRow[]> = {};
      for (const e of (exList ?? []) as ExecRow[]) {
        const wfId = e.workflowId;
        const prev = (map[wfId] ?? []).filter(x => x.id !== e.id);
        // keep every execution for history; UI shows status badges
        map[wfId] = [...prev, { ...e, workflowName: e.workflowName ?? null }].sort((a, b) => String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? ''))).slice(0, 12);
      }
      setExecs(map);
      const apMap: Record<string, any[]> = {};
      for (const a of (apList ?? []) as any[]) {
        if (a.status === 'PENDING' && a.workflowExecutionId) {
          apMap[a.workflowExecutionId] = [...(apMap[a.workflowExecutionId] ?? []), { id: a.id, status: a.status, execId: a.workflowExecutionId, payload: a.payload }];
        }
      }
      setApprovals(apMap);
    } catch { /* non-fatal */ }
  }
  async function load() {
    setLoading(true); setError('');
    try {
      const list = unwrap(await api<WfRow[]>('/workflows')) as WfRow[];
      setRows(list);
      const [rr, oo] = await Promise.all([
        api<RelMini[]>('/relationships').catch(() => []),
        api<OrgMini[]>('/organizations').catch(() => []),
      ]);
      setRels(rr as RelMini[]); setOrgs(oo as OrgMini[]);
      await refreshLive();
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function stepLabel(a: WfAction) {
    return ACTION_META[a.type]?.fa ?? a.type;
  }
  function rebuildDefinition() {
    const cleaned = steps.filter(s => {
      if (s.type === 'CREATE_NOTIFICATION') return !!(s.title ?? '').trim() || !!(s.body ?? '').trim();
      if (s.type === 'CREATE_ACTION') return !!(s.title ?? '').trim();
      if (s.type === 'CREATE_COMMITMENT') return !!(s.description ?? s.title ?? '').toString().trim();
      if (s.type === 'CREATE_OPPORTUNITY') return !!(s.name ?? '').trim();
      if (s.type === 'REQUEST_APPROVAL') return true;
      if (s.type === 'WAIT') return true;
      return true;
    });
    const conditions: any[] = [];
    if (condText.trim()) {
      const m = condText.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
      if (m) {
        const path = m[1].trim(); const eq = m[2] === '=='; const val = m[3].trim();
        if (eq) conditions.push({ path, equals: val === 'true' ? true : val === 'false' ? false : val });
        else conditions.push({ path, notEquals: val === 'true' ? true : val === 'false' ? false : val });
      } else if (/^(.+?)\s+exists$/i.test(condText.trim())) {
        conditions.push({ path: condText.trim().replace(/\s+exists$/i, ''), exists: true });
      }
    }
    return { trigger: { type: form.triggerType }, conditions, actions: cleaned };
  }
  function validateBeforeSave(): string {
    const def = rebuildDefinition();
    if (!def.actions.length) return 'دست‌کم یک گام عملیاتی معتبر تعریف کنید (گام‌های خالی حذف می‌شوند).';
    if (condText.trim()) {
      const m = condText.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
      const ex = /^(.+?)\s+exists$/i.test(condText.trim());
      if (!m && !ex) return 'شرط باید به شکل «path == مقدار» یا «path != مقدار» یا «path exists» نوشته شود.';
    }
    return '';
  }
  function clean() {
    setEditing(null); setForm({ name: '', entityType: 'Relationship', isActive: true, triggerType: 'MANUAL' });
    setSteps(empty()); setCondText('');
  }
  async function save() {
    setError(''); setFlash('');
    const v = validateBeforeSave();
    if (v) { setError(v); return; }
    const def = rebuildDefinition();
    const payload: any = { name: form.name.trim(), entityType: form.entityType, isActive: form.isActive, definition: def };
    const existing = editing;
    setBusy('save');
    try {
      if (existing) {
        await api(`/workflows/${existing.id}/delete`, { method: 'DELETE', body: JSON.stringify(payload) }).catch(() => null);
        setFlash('ویرایش در این دمو با حذف و بازآفرینی اعمال شد (متد PUT پشتیبانی نمی‌شود).');
        clean();
        await load();
      } else {
        const created = await api<any>('/workflows', { method: 'POST', body: JSON.stringify(payload) });
        clean();
        setFlash(`گردش کار «${created.name}» با ${created.actionCount} گام ساخته شد و در لیست فعال است.`);
        await load();
      }
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(''); }
  }
  async function toggleActive(w: WfRow) {
    setBusy('t' + w.id); setError('');
    try {
      if (w.isActive) {
        const payload = { ...w, definition: w.definition ?? {}, isActive: false };
        await api(`/workflows/${w.id}/delete`, { method: 'DELETE', body: JSON.stringify(payload) });
        setFlash(`گردش کار «${w.name}» غیرفعال شد.`);
      } else {
        const { id, createdAt, updatedAt, actionCount, steps, triggerType, organizationName, ...rest } = w as any;
        await api('/workflows', { method: 'POST', body: JSON.stringify({ ...rest, isActive: true }) });
        setFlash(`گردش کار «${w.name}» دوباره فعال شد.`);
      }
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(''); }
  }
  async function remove(w: WfRow) {
    if (!confirm(`گردش کار «${w.name}» حذف شود؟`)) return;
    setBusy('d' + w.id); setError('');
    try {
      await api(`/workflows/${w.id}/delete`, { method: 'DELETE', body: JSON.stringify({ ...w, definition: w.definition ?? {}, isActive: false }) });
      setFlash(`گردش کار «${w.name}» حذف شد.`);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(''); }
  }

  function openRun(w: WfRow) {
    const trig = w.definition.trigger?.type ?? 'MANUAL';
    setRunFor(w); setRunType(trig === 'MANUAL' || !trig ? 'manual' : 'event'); setRunEntity(''); setRunCtx(''); setExecLog(null); setError(''); setFlash('');
  }
  async function runNow() {
    if (!runFor) return;
    setBusy('run'); setError(''); setFlash(''); setExecLog(null);
    try {
      const isEvent = runType === 'event';
      const ctx = runCtx.trim() ? JSON.parse(runCtx) : {};
      let result: any;
      if (isEvent) {
        const evType = runFor.definition.trigger?.type ?? '';
        result = await api(`/workflows/trigger`, { method: 'POST', body: JSON.stringify({ triggerType: evType, entityType: runFor.entityType, entityId: runEntity, context: { ...ctx, event: { type: evType }, payload: ctx.payload ?? {} } }) });
        const first = Array.isArray(result) ? result[0] : null;
        if (!first) throw new Error('هیچ گردش کاری با این محرک روی این نهاد فعال نبود.');
        setExecLog({ id: first.id ?? '', status: first.status, log: first.log });
        if (first.status === 'WAITING' && first.context?.pendingApprovalId) {
          const ex: ExecRow = { id: first.id, workflowId: runFor.id, entityType: runFor.entityType, entityId: runEntity, status: 'WAITING', context: first.context, resumeAt: first.resumeAt ?? null };
          setExecs(prev => ({ ...prev, [runFor.id]: [...(prev[runFor.id] ?? []).filter(x => x.id !== ex.id), ex] }));
          setApprovals(prev => ({ ...prev, [first.id]: [{ id: first.context.pendingApprovalId, status: 'PENDING', execId: first.id }] }));
        } else if (first.id) {
          const ex: ExecRow = { id: first.id, workflowId: runFor.id, entityType: runFor.entityType, entityId: runEntity, status: first.status, context: first.context ?? {}, resumeAt: first.resumeAt ?? null };
          setExecs(prev => ({ ...prev, [runFor.id]: [...(prev[runFor.id] ?? []), ex] }));
        }
      } else {
        result = await api(`/workflows/${runFor.id}/execute`, { method: 'POST', body: JSON.stringify({ entityType: runFor.entityType, entityId: runEntity, context: ctx, triggerType: 'MANUAL' }) });
        setExecLog({ id: result.id ?? '', status: result.status, log: result.log });
      }
      setFlash(`اجرای گردش کار پایان یافت — وضعیت: ${result.status ?? (Array.isArray(result) ? result[0]?.status : '')}`);
      await refreshLive();
    } catch (x) {
      if (x instanceof SyntaxError) setError('زمینه (context) باید JSON معتبر باشد.');
      else setError((x as Error).message);
    } finally { setBusy(''); }
  }
  function entityOptions() {
    const t = runFor?.entityType ?? 'Relationship';
    if (t === 'Relationship') return rels.map(r => ({ id: r.id, label: `${r.sourceOrganization?.name ?? ''} ↔ ${r.targetOrganization?.name ?? ''}`, code: r.id }));
    if (t === 'Organization') return orgs.map(o => ({ id: o.id, label: o.name, code: o.id }));
    if (t === 'Person') return [] as any[];
    if (t === 'Meeting') return [] as any[];
    return [] as any[];
  }

  async function decide(execId: string, approvalId: string, decision: 'APPROVED' | 'REJECTED', reason?: string) {
    setBusy('da' + approvalId); setError('');
    try {
      const res = await api<any>(`/workflows/approvals/${approvalId}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) });
      void execId;
      if (decision === 'APPROVED' && res.execution) {
        setFlash(res.execution.status === 'WAITING'
          ? 'تصویب شد؛ گام انتظار آغاز شد — پس از پایان مهلت با دکمهٔ «ادامه» اجرا را پیش ببرید.'
          : 'تصویب شد و گردش کار کامل گردید.');
      } else {
        setFlash('درخواست رد شد؛ اجرا متوقف گردید.');
      }
      setApprovalModal(null);
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(''); await refreshLive(); }
  }
  async function resumeExec(ex: ExecRow) {
    setBusy('rs' + ex.id); setError(''); setFlash('');
    try {
      const res = await api<any>(`/workflows/executions/${ex.id}/resume`, { method: 'POST', body: JSON.stringify({}) });
      setFlash(res.status === 'WAITING' ? 'ادامهٔ اجرا صادر شد؛ گام انتظار بعدی نیز در صف است.' : `اجرای گردش کار کامل شد (${res.status}).`);
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(''); await refreshLive(); }
  }

  const counts = useMemo(() => {
    const total = rows.length;
    const active = rows.filter(r => r.isActive).length;
    const manual = rows.filter(r => (r.definition.trigger?.type ?? 'MANUAL') === 'MANUAL').length;
    const ev = total - manual;
    const live = Object.values(execs).flat().filter(e => ['RUNNING', 'WAITING'].includes(e.status)).length;
    const pendingApprovals = Object.values(approvals).flat().filter(a => a.status === 'PENDING').length;
    return { total, active, manual, ev, live, pendingApprovals };
  }, [rows, execs, approvals]);

  const entityName = (t: string, id: string) => {
    if (t === 'Relationship') { const r = rels.find(x => x.id === id); return r ? `${r.sourceOrganization?.name ?? ''} ↔ ${r.targetOrganization?.name ?? ''}` : id; }
    if (t === 'Organization') { const o = orgs.find(x => x.id === id); return o?.name ?? id; }
    return id;
  };

  if (me && !isOwner && !canWrite) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="اتوماسیون" title="گردش کار" description="طراحی و مدیریت گردش‌های کاری حساس." />
        <div className="empty-state-v4">
          <div className="empty-ico"><Workflow size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>طراحی و اجرای گردش کار به مجوز workflow.write/execute نیاز دارد.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="اتوماسیون گردش کار"
        title="گردش کار"
        description="طراحی بصری گردش‌های کاری: محرک (دستی/رویداد)، شرط‌ها و گام‌ها — اعلان، اقدام، تعهد، فرصت، تأیید دوم‌نفره و انتظار. اجرا با مجوز واقعی، اثر واقعی بر داده‌ها و ثبت در ممیزی."
        actions={canWrite ? (
          <button className="btn btn-primary" onClick={() => { clean(); setEditing({ id: '', name: '', entityType: 'Relationship', isActive: true, definition: { actions: [] }, actionCount: 0, triggerType: 'MANUAL', createdAt: '' }); }}>
            <Plus size={15} /> گردش کار جدید
          </button>
        ) : undefined}
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      <div className="stat-grid">
        <StatCard icon={<Workflow size={18} />} label="کل گردش کارها" value={fmtNum(counts.total)} iconClass="ic-blue" sub={`${fmtNum(counts.active)} فعال`} />
        <StatCard icon={<Play size={18} />} label="اجراهای زنده" value={fmtNum(counts.live)} iconClass="ic-green" sub="در حال اجرا یا انتظار" />
        <StatCard icon={<Scale size={18} />} label="تأییدهای در انتظار" value={fmtNum(counts.pendingApprovals)} iconClass="ic-gold" sub="تصمیم دوم‌نفره" />
        <StatCard icon={<GitMerge size={18} />} label="محرک‌ها" value={<span>{fmtNum(counts.manual)} <span style={{ fontSize: 11 }}>/</span> {fmtNum(counts.ev)}</span>} iconClass="ic-indigo" sub="دستی / رویدادی" />
      </div>

      <div className="tabs" role="tablist">
        <button className={tab === 'workflows' ? 'tab-active' : ''} onClick={() => setTab('workflows')}><Workflow size={14} /> گردش کارها ({fmtNum(rows.length)})</button>
        <button className={tab === 'executions' ? 'tab-active' : ''} onClick={() => setTab('executions')}><History size={14} /> اجراها ({fmtNum(Object.values(execs).flat().length)})</button>
      </div>

      {tab === 'workflows' && (
        <>
          {rows.length === 0 && !loading && <div className="empty-state">گردش کاری تعریف نشده است. با «گردش کار جدید» شروع کنید.</div>}
          <div className="wf-grid">
            {rows.map(w => {
              const triggerType = w.definition.trigger?.type ?? 'MANUAL';
              const conds = Array.isArray(w.definition.conditions) ? w.definition.conditions.length : 0;
              const stepsArr = Array.isArray(w.definition.actions) ? w.definition.actions : [];
              const pending = Object.values(execs).flat().filter(e => e.workflowId === w.id && e.status === 'WAITING').length;
              return (
                <section key={w.id} className="wf-card">
                  <header style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span className={`wf-ico ${w.isActive ? '' : 'wf-off'}`}><Workflow size={18} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: 13.5 }}>{w.name}</h3>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
                        <Badge tone={triggerType === 'MANUAL' ? 'neutral' : 'warning'}>{triggerType === 'MANUAL' ? 'اجرای دستی' : `رویداد: ${triggerType}`}</Badge>
                        <Badge tone="info">{entityIcon(w.entityType)}</Badge>
                        {w.isActive ? <Badge tone="success">فعال</Badge> : <Badge tone="neutral">غیرفعال</Badge>}
                        {conds > 0 && <Badge tone="warning">{conds} شرط</Badge>}
                      </div>
                      {w.organizationName && <div className="t-muted" style={{ fontSize: 10.5, marginTop: 2 }}>سازمان: {w.organizationName}</div>}
                    </div>
                  </header>
                  <Flow wf={w} />
                  {pending > 0 && (
                    <div className="notice" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px' }}>
                      <Clock3 size={14} /> <span style={{ flex: 1 }}>{pending} اجرای در انتظار تصمیم یا مهلت</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setTab('executions')}>مشاهده</button>
                    </div>
                  )}
                  <footer style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {canExec && (
                      <button className="btn btn-primary btn-sm" disabled={!!busy || !w.isActive} title={w.isActive ? undefined : 'گردش کار غیرفعال است'} onClick={() => openRun(w)} style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                        <Play size={12} /> اجرا
                      </button>
                    )}
                    {canWrite && (
                      <>
                        <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => { setEditing(w); setForm({ name: w.name, entityType: w.entityType, isActive: w.isActive, triggerType: w.definition.trigger?.type ?? 'MANUAL' }); setSteps((Array.isArray(w.definition.actions) ? w.definition.actions : []).map(a => ({ ...a }))); setCondText(''); }}><Workflow size={12} /> ویرایش</button>
                        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => toggleActive(w)} title={w.isActive ? 'غیرفعال کردن' : 'فعال کردن'}>
                          <Power size={12} /> {w.isActive ? 'غیرفعال' : 'فعال‌سازی'}
                        </button>
                        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => remove(w)} title="حذف"><Trash2 size={12} /></button>
                      </>
                    )}
                  </footer>
                </section>
              );
            })}
          </div>
        </>
      )}

      {tab === 'executions' && (
        <section className="panel">
          {Object.keys(execs).length === 0 ? (
            <div className="empty-state">هنوز اجرایی ثبت نشده است — از دکمهٔ «اجرا» روی یک گردش کار شروع کنید (گام‌ها اثر واقعی روی داده دارند).</div>
          ) : (
            Object.entries(execs).flatMap(([wfId, list]) => list.map((e, idx) => {
              const wf = rows.find(w => w.id === wfId);
              const pendingApps = approvals[e.id] ?? [];
              return (
                <div key={e.id + idx} className="exec-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <span className="wf-ico" style={{ width: 34, height: 34, background: 'var(--surface-2)' }}><GitCommitHorizontal size={15} /></span>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 12.5 }}>{wf?.name ?? e.workflowId}</b>
                      <ExecStatus status={e.status} />
                      <code dir="ltr" style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{e.id}</code>
                    </div>
                    <div className="t-muted" style={{ fontSize: 11, marginTop: 2 }}>
                      نهاد: {entityIcon(e.entityType)} {entityName(e.entityType, e.entityId)}
                      {e.resumeAt && e.status === 'WAITING' ? ` · ادامهٔ خودکار: ${fmtDT(e.resumeAt)}` : ''}
                    </div>
                    {e.status === 'FAILED' && e.context?.error && <div style={{ fontSize: 11, color: 'var(--danger, #dc2626)' }}>{String(e.context.error)}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {e.status === 'WAITING' && pendingApps.length > 0 && (
                      <button className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }} disabled={!!busy} onClick={() => setApprovalModal({ execId: e.id, items: pendingApps })}>
                        <Scale size={12} /> تصمیم تأیید گردش کار
                      </button>
                    )}
                    {e.status === 'WAITING' && pendingApps.length === 0 && !e.context?.pendingApprovalId && (
                      <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => resumeExec(e)}><Play size={12} /> ادامه</button>
                    )}
                    {e.status === 'WAITING' && e.context?.pendingApprovalId && pendingApps.length === 0 && (
                      <span className="t-muted" style={{ fontSize: 11 }}>پس از تصمیم، ادامه می‌یابد</span>
                    )}
                  </div>
                </div>
              );
            }))
          )}
        </section>
      )}

      {/* create/edit modal */}
      <Modal
        open={!!editing}
        title={editing?.id ? `ویرایش — ${editing?.name}` : 'گردش کار جدید'}
        description="تعریف بصری: نام، نهاد پایه، محرک و گام‌ها. گام‌های خالی هنگام ذخیره حذف می‌شوند."
        onClose={clean}
        footer={
          <>
            <button className="btn btn-secondary" onClick={clean}><X size={14} /> انصراف</button>
            <button className="btn btn-primary" disabled={busy === 'save'} onClick={save}>{busy === 'save' ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />} ذخیره گردش کار</button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="form-grid">
            <label className="full"><span className="field-label">نام گردش کار <i className="req">*</i></span>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثلاً پیگیری هفتگی روابط کلیدی" />
            </label>
            <label><span className="field-label">نهاد پایه</span>
              <select value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
                {ENTITY_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.fa}</option>)}
              </select>
            </label>
            <label><span className="field-label">محرک</span>
              <select value={form.triggerType} onChange={e => setForm(f => ({ ...f, triggerType: e.target.value }))}>
                <option value="MANUAL">دستی (فقط با دکمهٔ اجرا)</option>
                {['RELATIONSHIP_UPDATED', 'MEETING_CREATED', 'ACTION_CREATED', 'OPPORTUNITY_CREATED', 'RELATIONSHIP_CREATED'].map(t => <option key={t} value={t}>{`رویداد: ${t}`}</option>)}
              </select>
            </label>
            <label className="full"><span className="field-label">شرط (اختیاری)</span>
              <input value={condText} onChange={e => setCondText(e.target.value)} dir="ltr" placeholder='مثلاً context.payload.priority == HIGH یا payload.riskScore >= 60' />
              <small className="t-muted" style={{ fontSize: 10.5 }}>قالب: «path == مقدار» یا «path != مقدار» (مقادیر true/false و عددی هم پذیرفته می‌شوند).</small>
            </label>
          </div>

          <div className="step-list">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <b style={{ fontSize: 12 }}>گام‌ها ({steps.length})</b>
              <span style={{ display: 'inline-flex', gap: 5 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setSteps(s => [...s, { type: 'CREATE_NOTIFICATION', title: '', body: '', notificationType: 'INFO', channel: 'IN_APP', priority: 'MEDIUM' }])}><BellRing size={12} /> اعلان</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSteps(s => [...s, { type: 'CREATE_ACTION', title: '', priority: 'MEDIUM', status: 'OPEN' }])}><Zap size={12} /> اقدام</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSteps(s => [...s, { type: 'CREATE_COMMITMENT', description: '', status: 'OPEN', risk: 'MEDIUM' }])}><ListChecks size={12} /> تعهد</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSteps(s => [...s, { type: 'CREATE_OPPORTUNITY', name: '', probability: 0 }])}><Target size={12} /> فرصت</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSteps(s => [...s, { type: 'REQUEST_APPROVAL', payload: { note: '' } }])}><Scale size={12} /> تأیید</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSteps(s => [...s, { type: 'WAIT', minutes: 1 }])}><Clock3 size={12} /> انتظار</button>
              </span>
            </div>
            {steps.length === 0 && <div className="empty-state" style={{ padding: 14 }}>گامی تعریف نشده است.</div>}
            {steps.map((st, i) => {
              const meta = ACTION_META[st.type] ?? { fa: st.type, icon: <Workflow size={14} />, tone: 'neutral', color: '#94a3b8' };
              return (
                <div key={i} className="step-card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 10, marginBottom: 6 }}>
                  <GripVertical size={13} className="t-muted" style={{ marginTop: 22 }} />
                  <span className="flow-step" style={{ marginTop: 16 }}>{i + 1}</span>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 6 }}>
                    <label className="full" style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="flow-ico" style={{ background: meta.color, width: 20, height: 20 }}>{meta.icon}</span>
                      <b style={{ fontSize: 12 }}>{meta.fa}</b>
                      <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto' }} title="حذف گام" onClick={() => setSteps(s => s.filter((_, j) => j !== i))}><Trash2 size={12} /></button>
                    </label>
                    {st.type === 'CREATE_NOTIFICATION' && (<>
                      <label className="full"><span className="field-label">عنوان اعلان</span><input value={st.title ?? ''} onChange={e => setSteps(s => s.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /></label>
                      <label className="full"><span className="field-label">متن اعلان</span><textarea rows={2} value={st.body ?? ''} onChange={e => setSteps(s => s.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} /></label>
                      <label><span className="field-label">شدت</span><select value={st.priority ?? 'MEDIUM'} onChange={e => setSteps(s => s.map((x, j) => j === i ? { ...x, priority: e.target.value } : x))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label>
                    </>)}
                    {st.type === 'CREATE_ACTION' && (<>
                      <label><span className="field-label">عنوان اقدام</span><input value={st.title ?? ''} onChange={e => setSteps(s => s.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /></label>
                      <label><span className="field-label">اولویت</span><select value={st.priority ?? 'MEDIUM'} onChange={e => setSteps(s => s.map((x, j) => j === i ? { ...x, priority: e.target.value } : x))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
                    </>)}
                    {st.type === 'CREATE_COMMITMENT' && (<>
                      <label><span className="field-label">متن تعهد</span><input value={st.description ?? ''} onChange={e => setSteps(s => s.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} /></label>
                      <label><span className="field-label">ریسک</span><select value={st.risk ?? 'MEDIUM'} onChange={e => setSteps(s => s.map((x, j) => j === i ? { ...x, risk: e.target.value } : x))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label>
                    </>)}
                    {st.type === 'CREATE_OPPORTUNITY' && (<>
                      <label><span className="field-label">نام فرصت</span><input value={st.name ?? ''} onChange={e => setSteps(s => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></label>
                      <label><span className="field-label">احتمال (٪)</span><input type="number" min={0} max={100} value={st.probability ?? 0} onChange={e => setSteps(s => s.map((x, j) => j === i ? { ...x, probability: Number(e.target.value) } : x))} /></label>
                    </>)}
                    {st.type === 'REQUEST_APPROVAL' && (<>
                      <label className="full"><span className="field-label">یادداشت برای تصمیم‌گیرنده</span><input value={st.payload?.note ?? ''} onChange={e => setSteps(s => s.map((x, j) => j === i ? { ...x, payload: { ...(x.payload ?? {}), note: e.target.value } } : x))} /></label>
                    </>)}
                    {st.type === 'WAIT' && (<>
                      <label><span className="field-label">مدت انتظار (دقیقه)</span><input type="number" min={1} value={st.minutes ?? 1} onChange={e => setSteps(s => s.map((x, j) => j === i ? { ...x, minutes: Number(e.target.value) || 1 } : x))} /></label>
                    </>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* run modal */}
      <Modal
        open={!!runFor}
        title={`اجرا — ${runFor?.name ?? ''}`}
        description="گردش کار با مجوز واقعی روی نهاد انتخابی اجرا می‌شود و گام‌ها اثر واقعی روی داده دارند."
        onClose={() => setRunFor(null)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRunFor(null)}><X size={14} /> بستن</button>
            <button className="btn btn-primary" disabled={!!busy || !runEntity} onClick={runNow} style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              {busy === 'run' ? <RefreshCw size={14} className="spin" /> : <Play size={14} />} اجرای گردش کار
            </button>
          </>
        }
      >
        {runFor && (
          <div style={{ display: 'grid', gap: 12 }}>
            {execLog && (
              <div className="exec-log" style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: 10, fontSize: 11.5, direction: 'ltr', textAlign: 'left', fontFamily: 'ui-monospace,monospace', maxHeight: 160, overflow: 'auto' }}>
                {execLog.log?.map((l, i) => <div key={i}>{l}</div>) ?? execLog.status}
              </div>
            )}
            <div className="tabs" role="tablist" style={{ display: 'inline-flex' }}>
              <button className={runType === 'manual' ? 'tab-active' : ''} onClick={() => setRunType('manual')}><Play size={13} /> اجرای دستی</button>
              <button className={runType === 'event' ? 'tab-active' : ''} onClick={() => setRunType('event')}><Zap size={13} /> شبیه‌سازی محرک رویداد</button>
            </div>
            <label className="full">
              <span className="field-label">نهاد ({entityIcon(runFor.entityType)})</span>
              {rels.length > 0 && runFor.entityType === 'Relationship' ? (
                <select value={runEntity} onChange={e => setRunEntity(e.target.value)}>
                  <option value="">انتخاب رابطه…</option>
                  {rels.map(r => <option key={r.id} value={r.id}>{r.sourceOrganization?.name} ↔ {r.targetOrganization?.name}</option>)}
                </select>
              ) : orgs.length > 0 && runFor.entityType === 'Organization' ? (
                <select value={runEntity} onChange={e => setRunEntity(e.target.value)}>
                  <option value="">انتخاب سازمان…</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : (
                <>
                  <input value={runEntity} onChange={e => setRunEntity(e.target.value)} dir="ltr" placeholder={`شناسهٔ ${runFor.entityType} — مانند ${runFor.entityType === 'Meeting' ? 'm-1' : runFor.entityType === 'Opportunity' ? 'o-1' : runFor.entityType === 'Person' ? 'p-1' : runFor.entityType === 'Project' ? 'pr-1' : runFor.entityType === 'Commitment' ? 'c-1' : 'r-1'}`} />
                  <small className="t-muted" style={{ fontSize: 10.5 }}>شناسهٔ نهاد را از صفحهٔ همان ماژول کپی کنید.</small>
                </>
              )}
            </label>
            <label className="full">
              <span className="field-label">زمینه/رویداد (JSON اختیاری)</span>
              <textarea rows={3} dir="ltr" value={runCtx} onChange={e => setRunCtx(e.target.value)} placeholder='{"payload":{"priority":"HIGH","strategicScore":91}}' style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11 }} />
            </label>
            {runType === 'event' && <p className="muted" style={{ fontSize: 11 }}>محرک تعریف‌شدهٔ گردش کار: <code dir="ltr">{runFor.definition.trigger?.type ?? 'MANUAL'}</code> — همهٔ گردش‌های فعال هم‌نهاد با همین محرک اجرا می‌شوند.</p>}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {(Array.isArray(runFor.definition.actions) ? runFor.definition.actions : []).map((a, i) => <Badge key={i} tone="neutral">{i + 1}. {stepLabel(a)}</Badge>)}
            </div>
          </div>
        )}
      </Modal>

      {/* workflow approval decision modal */}
      <Modal
        open={!!approvalModal}
        title="تصمیم تأیید گردش کار"
        description={approvalModal ? `اجرا ${approvalModal.execId} در گام «تأیید دوم‌نفره» متوقف است. تصویب یعنی ادامهٔ خودکار گام‌های بعد؛ رد یعنی توقف اجرا.` : ''}
        onClose={() => setApprovalModal(null)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setApprovalModal(null)}><X size={14} /> بستن</button>
            <button className="btn btn-danger" disabled={!!busy} onClick={() => approvalModal && decide(approvalModal.execId, approvalModal.items[0].id, 'REJECTED', decideReason.trim() || undefined)}><X size={13} /> رد و توقف</button>
            <button className="btn btn-success" disabled={!!busy} onClick={() => approvalModal && decide(approvalModal.execId, approvalModal.items[0].id, 'APPROVED', decideReason.trim() || undefined)}><CheckCircle2 size={13} /> تصویب و ادامه</button>
          </>
        }
      >
        {approvalModal && approvalModal.items[0] && (
          <div style={{ display: 'grid', gap: 10, fontSize: 12.5 }}>
            <div style={{ display: 'flex', gap: 6 }}><Scale size={14} className="t-muted" /><span><b>درخواست:</b> <code dir="ltr">{approvalModal.items[0].id}</code> · {String(approvalModal.items[0].payload?.note ?? approvalModal.items[0].payload?.title ?? 'تصویب ادامهٔ گردش کار')}</span></div>
            <label className="full"><span className="field-label">دلیل تصمیم (اختیاری)</span>
              <input value={decideReason} onChange={e => setDecideReason(e.target.value)} placeholder="دلیل تأیید یا رد…" />
            </label>
          </div>
        )}
      </Modal>

      <p className="muted" style={{ marginTop: 14 }}>
        نکته: در این دمو مالک تنها تصمیم‌گیرنده است؛ در محیط واقعی تصمیم با کاربرِ دارای مجوز <code dir="ltr">workflow.execute</code> است. اجراها در <Link href="/admin/audit">ممیزی</Link> با برچسب Workflow ثبت می‌شوند.
      </p>
    </main>
  );
}
