'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  ClipboardList, Target, ListChecks, Rows3, RotateCcw, BellRing, Bot,
} from 'lucide-react';
import { localeTag, lt, t } from '../_lib/i18n';

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
  requestStatus?: string | null; requestedAt?: string | null;
  outcome?: string | null; outcomeNote?: string | null;
  opportunity?: { id: string; name: string; status: string; value?: number | null } | null;
  connectorLoad?: number;
};

const fmtNum = (v: number): string => new Intl.NumberFormat(localeTag()).format(v);
const fmtDT = (iso?: string | null) => iso
  ? new Date(iso).toLocaleDateString(localeTag(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? x?.users ?? x?.referrals ?? []);

const STATUS_FA: Record<string, string> = lt({
  PENDING: t('در انتظار'), ACCEPTED: t('پذیرفته‌شده'), DECLINED: t('رد شده'),
  COMPLETED: t('انجام‌شده'), CANCELLED: t('لغو شده'),
});
const STATUS_TONE: Record<string, 'warning' | 'info' | 'danger' | 'success' | 'neutral'> = {
  PENDING: 'warning', ACCEPTED: 'info', DECLINED: 'danger', COMPLETED: 'success', CANCELLED: 'neutral',
};
const GATE_META: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; icon: ReactNode }> = lt({
  PASS: { label: t('ممیزی سبز'), tone: 'success', icon: <ShieldCheck size={12} /> },
  WARN: { label: t('ممیزی زرد'), tone: 'warning', icon: <ShieldAlert size={12} /> },
  BLOCKED: { label: t('ممیزی قرمز'), tone: 'danger', icon: <ShieldX size={12} /> },
  'N/A': { label: t('ممیزی ندارد'), tone: 'neutral', icon: <ShieldCheck size={12} /> },
});
const REQ_STATUS_FA: Record<string, { label: string; tone: 'warning' | 'info' | 'success' | 'neutral' | 'danger' }> = lt({
  REQUESTED: { label: t('درخواست از معرف ارسال شد'), tone: 'warning' },
  RESPONDED_YES: { label: t('معرف پذیرفت'), tone: 'success' },
  RESPONDED_NO: { label: t('معرف نپذیرفت'), tone: 'danger' },
  NO_RESPONSE: { label: t('بدون پاسخ از معرف'), tone: 'neutral' },
});
const OUTCOME_FA: Record<string, { label: string; tone: 'success' | 'info' | 'neutral' | 'warning' | 'danger' }> = lt({
  MEET_BOOKED: { label: t('ملاقات برقرار شد'), tone: 'success' },
  NO_REPLY: { label: t('بدون پاسخ'), tone: 'neutral' },
  DECLINED: { label: t('رد شد'), tone: 'danger' },
  BAD_FIT: { label: t('نامناسب بود'), tone: 'warning' },
});
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
            <button className="btn btn-ghost btn-sm" onClick={() => onCheckin(c.code)} title={t('ثبت شواهد این بررسی')}><BellRing size={12} /> {t('ثبت')}</button>}
        </li>
      ))}
    </ul>
  );
}

export default function ReferralsPage() {
  const { me, loading: meLoading } = useWorkspace();

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
  /* پیش‌پرشدن فرم از «پیشنهاد معرفی» شبکهٔ ارتباطات (پارامترهای آدرس) */
  const prefillRef = useRef(false);
  const suggestionRef = useRef('');

  const [detail, setDetail] = useState<RefRow | null>(null);
  const [finishFor, setFinishFor] = useState<RefRow | null>(null);
  const [finishNotes, setFinishNotes] = useState('');
  const [checkinFor, setCheckinFor] = useState<null | { ref: RefRow; code: string }>(null);
  const [checkinNote, setCheckinNote] = useState('');
  const [editInstr, setEditInstr] = useState<RefRow | null>(null);
  const [editForm, setEditForm] = useState({ goal: '', allowed: '', forbidden: '', boundaries: '', dueDays: '30' });
  const [editError, setEditError] = useState('');
  /* مسترپلن فاز ۱/۹ — مسیر گرم + حاکمیت واسطه (Affinity/Boomerang) + قیف تبدیل */
  const [warm, setWarm] = useState<any>(null);
  const [warmTarget, setWarmTarget] = useState('');
  const [warmBusy, setWarmBusy] = useState(false);
  const [conversion, setConversion] = useState<any>(null);
  const [introEdit, setIntroEdit] = useState<{ personId: string; name: string; active: boolean; maxRequestsPerMonth: number; preferredChannel: string; note: string } | null>(null);
  const [introBusy, setIntroBusy] = useState(false);

  /* ─── مسترپلن فاز ۴/۲۴: عامل معرفی خودکار (الگوی Boomerang/عامل Rudy) ───
     سه‌گام قطعی: یافتن مسیر گرم → انتخاب واسطهٔ مجاز (سقف ماهانه + رضایت صریح)
     → پیش‌نویس متن معرفی به لحن واسطه؛ حالت مستقیم بدون واسطه. بدون LLM. */
  const [agentTarget, setAgentTarget] = useState('');
  const [agentGoal, setAgentGoal] = useState('');
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentPlan, setAgentPlan] = useState<any>(null);
  const [agentDraftMsg, setAgentDraftMsg] = useState('');
  const [agentMsg, setAgentMsg] = useState('');
  const [agentLaunchBusy, setAgentLaunchBusy] = useState(false);
  const [agentRuns, setAgentRuns] = useState<any[]>([]);

  const loadAgentRuns = useCallback(async () => {
    try { setAgentRuns((await api<any>('/core-domain/referrals/agent/runs'))?.items ?? []); }
    catch { setAgentRuns([]); }
  }, []);

  const loadConversion = useCallback(async () => {
    try { setConversion(await api<any>('/core-domain/referrals/conversion')); } catch { setConversion(null); }
  }, []);

  const findWarmPath = useCallback(async (to: string) => {
    if (!to) return;
    setWarmBusy(true); setError('');
    try { setWarm(await api<any>(`/network/warm-path?to=${encodeURIComponent(to)}`)); }
    catch (e) { setError((e as Error).message); }
    finally { setWarmBusy(false); }
  }, []);

  const saveIntro = async () => {
    if (!introEdit) return;
    setIntroBusy(true);
    try {
      await api(`/people/${introEdit.personId}/intro-settings`, {
        method: 'PUT',
        body: JSON.stringify({ active: introEdit.active, maxRequestsPerMonth: introEdit.maxRequestsPerMonth, preferredChannel: introEdit.preferredChannel, note: introEdit.note }),
      });
      setFlash(`${t('تنظیمات واسطه‌گری «')}${introEdit.name}${t('» ذخیره شد.')}`);
      setIntroEdit(null);
      if (warmTarget) await findWarmPath(warmTarget);
    } catch (e) { setError((e as Error).message); }
    finally { setIntroBusy(false); }
  };

  /* عامل معرفی — گام ۱: برنامه‌ریزی (مسیر گرم + واسطهٔ مجاز + پیش‌نویس) */
  const runAgent = async () => {
    if (!agentTarget) return;
    setAgentBusy(true); setAgentMsg(''); setAgentPlan(null);
    try {
      const p = await api<any>('/core-domain/referrals/agent/plan', {
        method: 'POST',
        body: JSON.stringify({ targetOrganizationId: agentTarget, goal: agentGoal }),
      });
      setAgentPlan(p);
      setAgentDraftMsg(p?.draft?.message ?? '');
      await loadAgentRuns();
    } catch (e) { setAgentMsg((e as Error).message); }
    finally { setAgentBusy(false); }
  };

  /* عامل معرفی — گام ۲: اجرا. حالت واسطه‌ای فقط «درخواست رضایت» می‌سازد؛
     حالت مستقیم معرفی را مستقیم ثبت می‌کند (واسطه‌ای در کار نیست). */
  const launchAgent = async () => {
    if (!agentPlan?.to?.orgId) return;
    setAgentLaunchBusy(true); setAgentMsg('');
    try {
      const res = await api<any>('/core-domain/referrals/agent/launch', {
        method: 'POST',
        body: JSON.stringify({
          targetOrganizationId: agentPlan.to.orgId,
          intermediaryPersonId: agentPlan.mode === 'INTERMEDIARY' ? agentPlan.intermediary?.personId : '',
          draft: agentPlan.draft ? { ...agentPlan.draft, message: agentDraftMsg } : null,
        }),
      });
      setFlash(res?.message ?? t('عامل معرفی اجرا شد.'));
      setAgentPlan(null); setAgentTarget(''); setAgentGoal(''); setAgentDraftMsg('');
      await load(); await loadConversion(); await loadAgentRuns();
    } catch (e) { setAgentMsg((e as Error).message); }
    finally { setAgentLaunchBusy(false); }
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      /* فاز ۴: سرور /admin/users را فقط به مالک (isOwner) می‌دهد — همان قاعده
         این‌جا اعمال می‌شود تا برای کاربر عادی 403 (و خطای کنسول) تولید نشود */
      const usersCall = me?.isOwner
        ? api<MiniUser[]>('/admin/users').catch(() => [] as MiniUser[])
        : Promise.resolve([] as MiniUser[]);
      const [refs, o, p, u, rr] = await Promise.all([
        api<RefRow[]>('/core-domain/referrals'),
        api<MiniOrg[]>('/organizations'),
        api<MiniPerson[]>('/people'),
        usersCall,
        api<any[]>('/relationships'),
      ]);
      setRows(unwrap(refs) as RefRow[]);
      setOrgs(unwrap(o) as MiniOrg[]);
      setPeople(unwrap(p) as MiniPerson[]);
      setUsers(unwrap(u) as MiniUser[]);
      setRels(unwrap(rr) as any[]);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [me]);
  /* بارگذاری داده پس از آماده‌شدن هویت — تا can('admin.users') درست ارزیابی شود */
  useEffect(() => { if (!meLoading) { load(); loadConversion(); loadAgentRuns(); } }, [meLoading, load, loadConversion, loadAgentRuns]);

  /* پر کردن خودکار فرم از «پذیرش و پیگیری معرفی» در شبکهٔ ارتباطات */
  useEffect(() => {
    if (loading || prefillRef.current || typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('new') !== '1') return;
    prefillRef.current = true;
    const ppl = people as MiniPerson[];
    const orgsL = orgs as MiniOrg[];
    const usersL = users as MiniUser[];
    const srcType = sp.get('srcType') === 'org' ? 'org' : 'person';
    const dstType = sp.get('dstType') === 'user' ? 'user' : sp.get('dstType') === 'org' ? 'org' : 'person';
    const srcRaw = sp.get('src') ?? '';
    const dstRaw = sp.get('dst') ?? '';
    const srcOk = srcType === 'org' ? orgsL.some(o => o.id === srcRaw) : ppl.some(p => p.id === srcRaw);
    const dstOk = dstType === 'user' ? usersL.some(u => u.id === dstRaw) : dstType === 'org' ? orgsL.some(o => o.id === dstRaw) : ppl.some(p => p.id === dstRaw);
    const srcLabel = srcType === 'org'
      ? orgsL.find(o => o.id === srcRaw)?.name ?? ''
      : personName(ppl.find(p => p.id === srcRaw));
    const dstLabel = dstType === 'user'
      ? usersL.find(u => u.id === dstRaw)?.email ?? ''
      : dstType === 'org'
        ? orgsL.find(o => o.id === dstRaw)?.name ?? ''
        : personName(ppl.find(p => p.id === dstRaw));
    suggestionRef.current = sp.get('suggestion') ?? '';
    setForm(f => ({
      ...f,
      title: sp.get('title') || (srcLabel && dstLabel ? `${t('معرفی')} ${srcLabel} ${t('به')} ${dstLabel}` : ''),
      srcType, srcId: srcOk ? srcRaw : '',
      dstType, dstId: dstOk ? dstRaw : '',
      message: sp.get('message') ?? '',
      goal: sp.get('goal') || (srcLabel && dstLabel ? `${t('برقراری ارتباط و بررسی فرصت همکاری میان «')}${srcLabel}${t('» و «')}${dstLabel}»` : ''),
      forbidden: sp.get('forbidden') || t('مذاکره یا توافق نهایی بدون هماهنگی با واحد روابط'),
      boundaries: sp.get('boundaries') || t('حداکثر دو جلسهٔ مقدماتی؛ نتیجه حداکثر در ۳۰ روز ثبت شود.'),
      dueDays: sp.get('dueDays') || '30',
    }));
    setOpen(true);
    setFormError('');
    try { window.history.replaceState(null, '', window.location.pathname + window.location.hash); } catch {}
  }, [loading, people, orgs, users]);

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
    if (suggestionRef.current) body.suggestionId = suggestionRef.current;
    body.instruction = {
      goal: form.goal.trim(),
      allowed: form.allowed.split(/[,،;]/).map(s => s.trim()).filter(Boolean).slice(0, 6),
      forbidden: form.forbidden.split(/[,،;]/).map(s => s.trim()).filter(Boolean).slice(0, 6),
      boundaries: form.boundaries.trim(),
      dueDays: Number(form.dueDays) || 30,
    };
    try {
      const res: any = await api('/core-domain/referrals', { method: 'POST', body: JSON.stringify(body) });
      const fromSuggestion = !!suggestionRef.current;
      suggestionRef.current = '';
      setOpen(false);
      setForm({ title: '', srcType: 'person', srcId: '', dstType: 'org', dstId: '', message: '', goal: '', allowed: '', forbidden: '', boundaries: '', dueDays: '30', relationshipId: '' });
      const g = res?.audit?.gate;
      const gateMsg = g === 'BLOCKED'
        ? t('معرفی ثبت شد اما ممیزی قرمز است — پذیرش تا رفع موارد مسدودکننده ممکن نیست.')
        : g === 'WARN'
          ? t('معرفی ثبت شد؛ ممیزی زرد است — موارد هشدار را در جزئیات ببینید.')
          : t('معرفی ثبت شد و ممیزی پیش از پذیرش سبز است.');
      setFlash(fromSuggestion
        ? `${t('معرفی از پیشنهاد شبکه ثبت شد و به فهرست معرفیها اضافه شد —')} ${gateMsg}`
        : gateMsg);
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
      setFlash(`${t('معرفی «')}${r.title}${t('» به وضعیت «')}${STATUS_FA[status]}${t('» رفت.')}`);
      await load();
      if (status === 'ACCEPTED') setDetail(null);
    } catch (x) { setError((x as Error).message); await load(); }
    finally { setBusy(null); }
  }
  async function updateMission(r: RefRow, body: Record<string, unknown>, doneMsg: string) {
    if (busy) return;
    setBusy('mission-' + r.id); setError('');
    try {
      const res: any = await api(`/core-domain/referrals/${r.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setFlash(doneMsg);
      await load();
      setDetail(prev => prev ? { ...prev, ...res } : prev);
    } catch (x) { setError((x as Error).message); await load(); }
    finally { setBusy(null); }
  }
  async function rerunAudit(r: RefRow) {
    setBusy('audit-' + r.id); setError(''); setFlash('');
    try {
      const a: any = await api(`/core-domain/referrals/${r.id}/audit`, { method: 'POST' });
      setFlash(a?.gate === 'BLOCKED' ? `${t('ممیزی «')}${r.title}${t('» قرمز است (')}${a?.summary?.block} ${t('مسدود).')}` : a?.gate === 'WARN' ? `${t('ممیزی «')}${r.title}${t('» زرد است (')}${a?.summary?.warn} ${t('هشدار).')}` : `${t('ممیزی «')}${r.title}${t('» سبز شد.')}`);
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
      setFlash(t('شاهد بررسی ثبت شد و ممیزی پس از معرفی به‌روزرسانی شد.'));
      setDetail(null);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }
  function openEditInstr(r: RefRow) {
    const i = r.instruction;
    setEditForm({
      goal: i?.goal ?? '', allowed: (i?.allowed ?? []).join(t('،')), forbidden: (i?.forbidden ?? []).join(t('،')),
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
      setFlash(t('دستورالعمل و ممیزی معرفی به‌روزرسانی شد؛ ممیزی پیش دوباره اجرا شده است.'));
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
        eyebrow={t('معرفی‌ها')}
        title={t('معرفی‌ها')}
        description={t('هر معرفی با دستورالعملِ هدف و خط قرمز ثبت می‌شود؛ پیش از پذیرش ممیزی (سلامت رابطه، مقصد، تکرار، کامل بودن دستور) و پس از آن پیگیری/نتیجه/اثر بر رابطه اجرا می‌شود تا معرفی رابطه را خراب نکند.')}
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> {t('بازخوانی')}</button>
            <button className="btn btn-primary" onClick={() => { setError(''); setFormError(''); setOpen(true); }}><UserPlus size={16} /> {t('معرفی جدید')}</button>
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
            <StatCard icon={<Handshake size={18} />} label={t('کل معرفی‌ها')} value={fmtNum(stats.total)} iconClass="ic-indigo" sub={t('در بازهٔ نگهداری')} />
            <StatCard icon={<Clock3 size={18} />} label={t('در انتظار')} value={fmtNum(stats.pending)} iconClass="ic-gold" sub={t('نیازمند تصمیم')} />
            <StatCard icon={<ThumbsUp size={18} />} label={t('پذیرفته‌شده')} value={fmtNum(stats.accepted)} iconClass="ic-teal" sub={t('در جریان')} />
            <StatCard icon={<CheckCircle2 size={18} />} label={t('انجام‌شده')} value={fmtNum(stats.done)} iconClass="ic-red" sub={t('به نتیجه رسیده')} />
            <StatCard icon={<ShieldCheck size={18} />} label={t('ممیزی سبز')} value={fmtNum(stats.pass)} iconClass="ic-teal" sub={t('امن برای پذیرش')} />
            <StatCard icon={<ShieldAlert size={18} />} label={t('ممیزی زرد')} value={fmtNum(stats.warn)} iconClass="ic-gold" sub={t('با هشدار')} />
            <StatCard icon={<ShieldX size={18} />} label={t('ممیزی قرمز')} value={fmtNum(stats.block)} iconClass="ic-red" sub={t('پذیرش مسدود')} />
          </div>

          {/* ─── مسترپلن فاز ۱/۹: مسیر گرم + حاکمیت واسطه + قیف تبدیل (Affinity/Boomerang) ─── */}
          <section className="panel" aria-label={t('مسیر معرفی مطمئن و واسطه‌ها')}>
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Target size={16} /> {t('مسیر معرفی مطمئن و واسطه‌ها')}</h2>
                <p>{t('قوی‌ترین مسیر چندپرشی تا سازمان هدف با امتیاز هر پرش (سلامت + تازگی + ریسک)؛ واسطه‌ها سقف و کانال خودشان را تعیین می‌کنند — «هیچ واسطه‌ای در معرض سی درخواست نیست».')}</p>
              </div>
              {conversion && (
                <Badge tone={conversion.conversion?.meetingRate != null && conversion.conversion.meetingRate >= 50 ? 'success' : 'info'}>
                  مسیر مطمئن → جلسه: {conversion.conversion?.meetingRate != null ? `${fmtNum(conversion.conversion.meetingRate)}${t('٪')}` : '—'}
                </Badge>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
              <label className="field" style={{ margin: 0, flex: '1 1 240px' }}>
                <span className="field-label">{t('سازمان هدف')}</span>
                <select value={warmTarget} onChange={e => setWarmTarget(e.target.value)}>
                  <option value="">{t('انتخاب کنید…')}</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              <button className="btn btn-primary" style={{ minHeight: 0, padding: '8px 14px' }} disabled={!warmTarget || warmBusy}
                onClick={() => findWarmPath(warmTarget)}>
                {warmBusy ? t('در حال جست‌وجو…') : t('یافتن مسیر مطمئن')}
              </button>
              {conversion && (
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="chip neutral">معرفی: {fmtNum(conversion.total)}</span>
                  <span className="chip neutral">پذیرش: {fmtNum(conversion.accepted)} ({conversion.conversion?.acceptRate != null ? `${fmtNum(conversion.conversion.acceptRate)}${t('٪')}` : '—'})</span>
                  <span className="chip neutral">انجام: {fmtNum(conversion.completed)}</span>
                </span>
              )}
            </div>
            {warm && (
              <>
                {warm.paths?.length ? (
                  <div className="list">
                    {warm.paths.map((p: any, idx: number) => (
                      <div className="listRow" key={idx} style={{ alignItems: 'flex-start' }}>
                        <Badge tone={idx === 0 ? 'success' : 'neutral'}>{idx === 0 ? t('بهترین') : `${fmtNum(p.hopCount)} ${t('پرش')}`}</Badge>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: 12.5 }}>
                            {p.hops.map((h: any, i: number) => (
                              <span key={i}>{i > 0 && ' ← '}{h.fromOrgName}{i === p.hops.length - 1 ? ` ← ${h.toOrgName}` : ''}</span>
                            ))}
                          </strong>
                          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            <span className="chip info">امتیاز مسیر: {fmtNum(p.totalScore)}</span>
                            <span className="chip neutral">گلوگاه: {fmtNum(p.bottleneckScore)}</span>
                            {p.hops.map((h: any, i: number) => (
                              <span key={i} className="chip neutral" title={`${t('سلامت')} ${fmtNum(h.healthScore)}${h.daysSinceInteraction != null ? ` ${t('· آخرین تعامل')} ${fmtNum(h.daysSinceInteraction)} ${t('روز پیش')}` : ''}`}>
                                {h.fromOrgName}↔{h.toOrgName}: {fmtNum(h.score)}
                              </span>
                            ))}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="criteria-saved">{t('مسیری تا این سازمان در شبکهٔ روابط شما نیست — ابتدا یک رابطهٔ میانی بسازید یا از جلسات مشترک شروع کنید.')}</p>
                )}
                {warm.intermediaryPeople?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <h4 style={{ fontSize: 12.5, margin: '0 0 6px' }}>{t('واسطه‌های پیشنهادی (اشخاص پرنفوذ در مسیر)')}</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {warm.intermediaryPeople.map((ip: any) => (
                        <div key={ip.personId} className="kpi-card" style={{ margin: 0, flex: '1 1 230px' }}>
                          <small>{ip.name} — {ip.orgName}</small>
                          <strong style={{ fontSize: 13 }}>{ip.title ?? '—'}</strong>
                          <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                            {ip.champion && <span className="chip success">{t('حامی')}</span>}
                            {ip.influenceScore != null && <span className="chip neutral">نفوذ {fmtNum(ip.influenceScore)}</span>}
                            <span className={`chip ${ip.introSettings?.active === false ? 'danger' : 'neutral'}`}>
                              {ip.introSettings ? (ip.introSettings.active ? `${t('سقف:')} ${fmtNum(ip.introSettings.maxRequestsPerMonth)} ${t('درخواست/ماه')}` : t('درخواست نمی‌پذیرد')) : t('بدون سقف تعیین‌شده')}
                            </span>
                          </span>
                          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} title={`${t('تنظیم واسطه‌گری')} ${ip.name}`}
                            onClick={() => setIntroEdit({
                              personId: ip.personId, name: ip.name,
                              active: ip.introSettings?.active !== false,
                              maxRequestsPerMonth: ip.introSettings?.maxRequestsPerMonth ?? 2,
                              preferredChannel: ip.introSettings?.preferredChannel ?? 'EMAIL',
                              note: ip.introSettings?.note ?? '',
                            })}>
                            {t('تنظیم واسطه‌گری')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {introEdit && (
              <div className="notice" role="dialog" aria-label={t('تنظیم واسطه‌گری')} style={{ marginTop: 10, border: '1px solid var(--border,#e2e8f0)' }}>
                <b>حاکمیت واسطه‌گری — {introEdit.name}</b>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">{t('وضعیت')}</span>
                    <select value={introEdit.active ? '1' : '0'} onChange={e => setIntroEdit(introEdit ? { ...introEdit, active: e.target.value === "1" } : null)}>
                      <option value="1">{t('درخواست معرفی می‌پذیرد')}</option>
                      <option value="0">{t('فعلاً درخواست نمی‌پذیرد')}</option>
                    </select>
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">{t('سقف درخواست در ماه')}</span>
                    <input type="number" min={0} max={20} value={introEdit.maxRequestsPerMonth}
                      onChange={e => setIntroEdit(introEdit ? { ...introEdit, maxRequestsPerMonth: Number(e.target.value) } : null)} />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">{t('کانال ترجیحی')}</span>
                    <select value={introEdit.preferredChannel} onChange={e => setIntroEdit(introEdit ? { ...introEdit, preferredChannel: e.target.value } : null)}>
                      <option value="EMAIL">{t('ایمیل')}</option>
                      <option value="MEETING">{t('جلسه')}</option>
                      <option value="CALL">{t('تماس')}</option>
                      <option value="MESSAGE">{t('پیام')}</option>
                    </select>
                  </label>
                  <label className="field" style={{ margin: 0, flex: '1 1 200px' }}>
                    <span className="field-label">{t('یادداشت')}</span>
                    <input value={introEdit.note} onChange={e => setIntroEdit(introEdit ? { ...introEdit, note: e.target.value } : null)} placeholder={t('مثلاً: فقط با هماهنگی دفتر مدیرعامل')} />
                  </label>
                  <button className="btn btn-primary" style={{ minHeight: 0, padding: '8px 14px' }} disabled={introBusy} onClick={saveIntro}>{t('ذخیره')}</button>
                  <button className="btn btn-ghost" style={{ minHeight: 0, padding: '8px 14px' }} onClick={() => setIntroEdit(null)}>{t('انصراف')}</button>
                </div>
              </div>
            )}
          </section>

          {/* ─── مسترپلن فاز ۴/۲۴: عامل معرفی خودکار (الگوی Boomerang/عامل Rudy) ─── */}
          <section className="panel" aria-label={t('عامل معرفی خودکار')}>
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Bot size={16} /> {t('عامل معرفی خودکار')}</h2>
                <p>{t('عامل سه‌گامِ Boomerang را اجرا می‌کند: یافتن مسیر مطمئن، انتخاب واسطهٔ مجاز (سقف ماهانه + رضایت صریح)، و نوشتن پیش‌نویس معرفی به لحن واسطه — موتور قطعیِ قالب‌محور، بدون LLM.')}</p>
              </div>
              <Badge tone="info">{t('قطعی · بدون LLM')}</Badge>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className="field" style={{ margin: 0, flex: '1 1 240px' }}>
                <span className="field-label">{t('سازمان هدف')}</span>
                <select value={agentTarget} onChange={e => setAgentTarget(e.target.value)}>
                  <option value="">{t('انتخاب کنید…')}</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              <label className="field" style={{ margin: 0, flex: '1 1 240px' }}>
                <span className="field-label">{t('هدف معرفی (اختیاری)')}</span>
                <input value={agentGoal} onChange={e => setAgentGoal(e.target.value)} placeholder={t('مثلاً: جلسهٔ بررسی همکاری در حوزهٔ انرژی')} />
              </label>
              <button className="btn btn-primary" style={{ minHeight: 0, padding: '8px 14px' }} disabled={!agentTarget || agentBusy} onClick={runAgent}>
                {agentBusy ? t('در حال برنامه‌ریزی…') : t('برنامه‌ریزی عامل')}
              </button>
            </div>
            {agentMsg && <p className="form-error" role="alert" style={{ marginTop: 8 }}>{agentMsg}</p>}
            {agentPlan && (
              <div style={{ marginTop: 10, border: '1px solid var(--border,#e2e8f0)', borderRadius: 8, padding: 10 }}>
                {agentPlan.mode === 'DIRECT' && (
                  <p className="criteria-saved">{t('مسیر مستقیمِ قوی موجود است — عامل واسطه پیشنهاد نمی‌کند و پیش‌نویس معرفی را به لحن خودتان آماده کرده است.')}</p>
                )}
                {agentPlan.mode === 'INTERMEDIARY' && (
                  <p className="criteria-saved">{t('مسیر مطمئن یافت شد و عامل یک واسطهٔ «مجاز» (تنظیم فعال + سقف ماهانهٔ باز) انتخاب کرد.')}</p>
                )}
                {agentPlan.reason && <p className="form-error" role="alert">{agentPlan.reason}</p>}
                {agentPlan.bestPath && (
                  <p style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                    <span className="chip info">{t('بهترین مسیر')} ({fmtNum(agentPlan.bestPath.hopCount)} {t('پرش')}): </span>
                    {agentPlan.bestPath.hops.map((h: any, i: number) => (
                      <span key={i} className="chip neutral">{h.fromOrgName} ← {h.toOrgName} · {fmtNum(h.score)}</span>
                    ))}
                  </p>
                )}
                {agentPlan.intermediary && (
                  <div className="kpi-card" style={{ margin: '0 0 8px' }}>
                    <small>{t('واسطهٔ انتخاب‌شده')}: {agentPlan.intermediary.name} — {agentPlan.intermediary.orgName}</small>
                    <strong style={{ fontSize: 13 }}>{agentPlan.intermediary.title ?? '—'}</strong>
                    <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                      {agentPlan.intermediary.champion && <span className="chip success">{t('حامی')}</span>}
                      {agentPlan.intermediary.influenceScore != null && <span className="chip neutral">{t('نفوذ')} {fmtNum(agentPlan.intermediary.influenceScore)}</span>}
                      <span className="chip neutral">{t('کانال ترجیحی')}: {t(agentPlan.intermediary.preferredChannel === 'EMAIL' ? 'ایمیل' : agentPlan.intermediary.preferredChannel === 'MEETING' ? 'جلسه' : agentPlan.intermediary.preferredChannel === 'CALL' ? 'تماس' : 'پیام')}</span>
                      <span className={`chip ${agentPlan.intermediary.remaining > 0 ? 'success' : 'danger'}`}>
                        {t('سقف ماهانه')}: {fmtNum(agentPlan.intermediary.usedThisMonth)}/{fmtNum(agentPlan.intermediary.introSettings?.maxRequestsPerMonth ?? 0)}
                      </span>
                    </span>
                    <p style={{ fontSize: 11.5, marginTop: 6, marginBottom: 0 }}>{t('هیچ پیامی بدون پذیرش صریح واسطه ارسال نمی‌شود — تا پاسخ او پیش‌نویس نزد مقصد نمی‌رود.')}</p>
                  </div>
                )}
                {agentPlan.draft && (
                  <div>
                    <b style={{ fontSize: 12.5 }}>{t('پیش‌نویس معرفی')}: {agentPlan.draft.title}</b>
                    <textarea className="input" style={{ width: '100%', marginTop: 6, minHeight: 120, fontFamily: 'inherit' }}
                      aria-label={t('متن پیش‌نویس معرفی (قابل ویرایش)')}
                      value={agentDraftMsg} onChange={e => setAgentDraftMsg(e.target.value)} />
                    <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                      <span className="chip neutral">{t('هدف')}: {agentPlan.draft.instruction?.goal ?? '—'}</span>
                      {(agentPlan.draft.instruction?.allowed ?? []).map((a: string, i: number) => <span key={i} className="chip success">{t('مجاز')}: {a}</span>)}
                      {(agentPlan.draft.instruction?.forbidden ?? []).map((a: string, i: number) => <span key={i} className="chip danger">{t('ممنوع')}: {a}</span>)}
                      <span className="chip neutral">{t('مهلت')}: {fmtNum(agentPlan.draft.instruction?.dueDays ?? 30)} {t('روز')}</span>
                    </span>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary" disabled={agentLaunchBusy} onClick={launchAgent}>
                        {agentLaunchBusy ? t('در حال ثبت…') : (agentPlan.mode === 'INTERMEDIARY' ? t('ارسال درخواست رضایت واسطه') : t('ثبت معرفی مستقیم'))}
                      </button>
                      <button className="btn btn-ghost" onClick={() => { setAgentPlan(null); setAgentDraftMsg(''); }}>{t('انصراف')}</button>
                    </div>
                  </div>
                )}
                {!agentPlan.draft && agentPlan.mode !== 'NO_PATH' && agentPlan.alternatives?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 12.5, margin: '8px 0 6px' }}>{t('واسطه‌های موجود و وضعیت سقفشان')}</h4>
                    <div className="list">
                      {agentPlan.alternatives.map((a: any) => (
                        <div className="listRow" key={a.personId}>
                          <span style={{ flex: 1, minWidth: 0 }}>{a.name} — {a.orgName}</span>
                          <Badge tone={a.eligible ? 'success' : 'danger'}>
                            {a.eligible ? `${t('سقف باز')}: ${fmtNum(a.remaining)}` : (a.reason === 'INTRO_INACTIVE' ? t('درخواست نمی‌پذیرد') : t('سقف ماهانه پر'))}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {agentRuns.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <h4 style={{ fontSize: 12.5, margin: '0 0 6px' }}>{t('اجراهای اخیر عامل')}</h4>
                <div className="list">
                  {agentRuns.slice(0, 5).map((r: any) => (
                    <div className="listRow" key={r.id}>
                      <Badge tone={r.kind === 'LAUNCH' ? 'success' : 'neutral'}>{r.kind === 'LAUNCH' ? t('اجرای عامل') : t('برنامه‌ریزی')}</Badge>
                      <span style={{ flex: 1, minWidth: 0 }}>{r.fromOrgName} ← {r.toOrgName}{r.intermediaryName ? ` · ${t('واسطه')}: ${r.intermediaryName}` : ''}</span>
                      {r.referralId && <Link className="chip neutral" href="/referrals">{t('ثبت‌شده در معرفی‌ها')}</Link>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder={t('جستجوی عنوان، مبدأ، مقصد، دستورالعمل یا گیرنده…')}>
            <select aria-label={t('فیلتر وضعیت')} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
              <option value="">{t('همهٔ وضعیت‌ها')}</option>
              <option value="PENDING">{t('در انتظار')}</option>
              <option value="ACCEPTED">{t('پذیرفته‌شده')}</option>
              <option value="COMPLETED">{t('انجام‌شده')}</option>
              <option value="DECLINED">{t('رد شده')}</option>
              <option value="CANCELLED">{t('لغو شده')}</option>
            </select>
            <span className="chip info">{fmtNum(filtered.length)} معرفی</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>{t('معرفی‌ای یافت نشد')}</strong>
              <p>{t('با «معرفی جدید» نخستین مسیر معرفی را ثبت کنید.')}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('معرفی')}</th>
                    <th>{t('مسیر (مبدأ ← مقصد)')}</th>
                    <th>{t('ممیزی پیش')}</th>
                    <th>{t('وضعیت')}</th>
                    <th>{t('گیرنده/معرف')}</th>
                    <th>{t('تاریخ')}</th>
                    <th style={{ width: 260 }}>{t('عملیات')}</th>
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
                            {r.instruction?.goal || r.message || t('بدون پیام')}
                          </div>
                          {r.instruction && (
                            <div className="t-muted" style={{ fontSize: 10, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Ban size={9} style={{ verticalAlign: '-1px' }} /> خط قرمز: {(r.instruction.forbidden ?? []).slice(0, 2).join('، ') || '—'}
                            </div>
                          )}
                          {(r.outcome || r.requestStatus) && (
                            <div style={{ fontSize: 9.5, display: 'inline-flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
                              {r.requestStatus && REQ_STATUS_FA[r.requestStatus] && <span className="ref-mini"><Badge tone={REQ_STATUS_FA[r.requestStatus].tone}>{REQ_STATUS_FA[r.requestStatus].label}</Badge></span>}
                              {r.outcome && OUTCOME_FA[r.outcome] && <span className="ref-mini"><Badge tone={OUTCOME_FA[r.outcome].tone}>نتیجه: {OUTCOME_FA[r.outcome].label}</Badge></span>}
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
                          <span className="ref-gate" title={blocked ? t('پذیرش مسدود است — موارد قرمز را رفع کنید') : `${r.audit?.summary?.warn ?? 0} ${t('هشدار ·')} ${r.audit?.summary?.block ?? 0} ${t('مسدود')}`}>
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
                                title={blocked ? t('ممیزی قرمز است؛ ابتدا موارد مسدود را رفع کنید') : t('پذیرش معرفی')}>
                                <ThumbsUp size={12} /> پذیرش
                              </button>
                            )}
                            {can(r.status).includes('COMPLETED') && (
                              <button className="btn btn-primary btn-sm" onClick={() => { setFinishFor(r); setFinishNotes(''); setError(''); }} disabled={!!busy} title={t('ثبت انجام‌شدن معرفی')}><CheckCircle2 size={12} /> {t('انجام شد')}</button>
                            )}
                            {can(r.status).includes('DECLINED') && (
                              <button className="btn btn-ghost btn-sm" onClick={() => changeStatus(r, 'DECLINED')} disabled={!!busy} title={t('رد معرفی')}><XCircle size={12} /></button>
                            )}
                            {can(r.status).includes('CANCELLED') && (
                              <button className="btn btn-ghost btn-sm" onClick={() => changeStatus(r, 'CANCELLED')} disabled={!!busy} title={t('لغو معرفی')}><Ban size={12} /></button>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={() => { setError(''); setDetail(r); }} title={t('جزئیات و ممیزی')}><StickyNote size={12} /> {t('جزئیات')}</button>
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
        title={t('معرفی جدید (با دستورالعمل)')}
        description={t('هدف، موضوعات مجاز، خط قرمزها و مرزها را روشن کنید — پذیرنده دقیقاً می‌داند چه کند و چه نکند. پس از ثبت، ممیزی پیش از پذیرش خودکار اجرا می‌شود.')}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><X size={14} /> {t('انصراف')}</button>
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
              <span className="field-label">{t('عنوان معرفی')} <i className="req">*</i></span>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('مثال: معرفی مدیر فروش به سازمان همکار')} required />
            </label>
            <label className="field">
              <span className="field-label">{t('مبدأ')} <i className="req">*</i></span>
              <select value={form.srcType} onChange={e => setForm(f => ({ ...f, srcType: e.target.value, srcId: '' }))}>
                <option value="person">{t('شخص')}</option>
                <option value="org">{t('سازمان')}</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t('مبدأ — مقدار')}</span>
              <select value={form.srcId} onChange={e => setForm(f => ({ ...f, srcId: e.target.value }))} required>
                <option value="">{t('انتخاب کنید…')}</option>
                {(form.srcType === 'org' ? orgs : people).map(x => (
                  <option key={x.id} value={x.id}>
                    {form.srcType === 'org' ? orgName(x as MiniOrg) : personName(x as MiniPerson)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t('مقصد')} <i className="req">*</i></span>
              <select value={form.dstType} onChange={e => setForm(f => ({ ...f, dstType: e.target.value, dstId: '' }))}>
                <option value="org">{t('سازمان')}</option>
                <option value="person">{t('شخص')}</option>
                <option value="user">{t('کاربر داخلی')}</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t('مقصد — مقدار')}</span>
              <select value={form.dstId} onChange={e => setForm(f => ({ ...f, dstId: e.target.value }))} required>
                <option value="">{t('انتخاب کنید…')}</option>
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
              <span className="field-label">{t('رابطهٔ پیوند (برای ممیزی)')}</span>
              <select value={form.relationshipId ?? ''} onChange={e => setForm(f => ({ ...f, relationshipId: e.target.value }))}>
                <option value="">{t('بدون رابطهٔ مشخص')}</option>
                {rels.map(rr => (
                  <option key={rr.id} value={rr.id}>
                    {orgName(rr.sourceOrganization)} ↔ {orgName(rr.targetOrganization)}
                    {rr.criteria?.effectiveScore != null ? ` · ${fmtNum(rr.criteria.effectiveScore)}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field full">
              <span className="field-label">{t('پیام/توضیح (برای گیرنده)')}</span>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={2} placeholder={t('چند خط که در معرفی به طرف مقابل گفته می‌شود…')} />
            </label>
            <div className="field full ref-instruction-box">
              <div className="ref-instruction-head"><ClipboardList size={14} /> {t('دستورالعمل — این همان چیزی است که به معرفی‌شونده می‌دهید')}</div>
              <label className="field">
                <span className="field-label">{t('هدفِ معرفی (چرا این معرفی؟)')} <i className="req">*</i></span>
                <input value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} placeholder={t('مثال: بررسی امکان همکاری فروش در ۳۰ روز؛ بدون مذاکرهٔ قرارداد')} required />
              </label>
              <div className="ref-instruction-grid">
                <label className="field">
                  <span className="field-label">{t('موضوعات مجاز')}</span>
                  <input value={form.allowed} onChange={e => setForm(f => ({ ...f, allowed: e.target.value }))} placeholder={t('جدا با ویرگول؛ مثال: قیمت مصوب، زمان تحویل')} />
                </label>
                <label className="field">
                  <span className="field-label">{t('خط قرمز (ممنوع)')} <i className="req">*</i></span>
                  <input value={form.forbidden} onChange={e => setForm(f => ({ ...f, forbidden: e.target.value }))} placeholder={t('جدا با ویرگول؛ مثال: تخفیف جدید، تعهد حجم')} required />
                </label>
              </div>
              <label className="field">
                <span className="field-label">{t('مرزها و محدودیت‌ها')} <i className="req">*</i></span>
                <textarea value={form.boundaries} onChange={e => setForm(f => ({ ...f, boundaries: e.target.value }))} rows={2} placeholder={t('مثال: حداکثر ۲ جلسهٔ مقدماتی؛ مذاکره فقط با حضور مدیر حساب؛ نتیجه تا ۳۰ روز ثبت شود.')} required />
              </label>
              <label className="field ref-due">
                <span className="field-label">{t('مهلت نتیجه (روز)')}</span>
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
        description={`${t('وضعیت:')} ${detail ? STATUS_FA[detail.status] : ''} ${t('· ممیزی پیش:')} ${detail?.audit ? GATE_META[detail.audit.gate]?.label : '—'}`}
        onClose={() => setDetail(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => detail && rerunAudit(detail)} disabled={!!busy}><RotateCcw size={14} /> {t('بازاجرای ممیزی')}</button>
            {detail && ['PENDING', 'ACCEPTED'].includes(detail.status) && (
              <button type="button" className="btn btn-secondary" onClick={() => openEditInstr(detail)} disabled={!!busy}><ClipboardList size={14} /> {t('ویرایش دستورالعمل')}</button>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary" onClick={() => setDetail(null)}><X size={14} /> {t('بستن')}</button>
          </>
        }
      >
        {detail && (
          <div className="ref-detail">
            <div className="detail-row" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <ArrowLeft size={14} className="t-muted" style={{ marginTop: 2 }} />
              <span><b>{t('مسیر:')}</b> {detail.sourceOrganization ? `${t('سازمان «')}${orgName(detail.sourceOrganization)}»` : `${t('شخص «')}${personName(detail.sourcePerson)}»`} ← {detail.targetOrganization ? `${t('سازمان «')}${orgName(detail.targetOrganization)}»` : detail.targetPerson ? `${t('شخص «')}${personName(detail.targetPerson)}»` : `${t('کاربر داخلی (')}${detail.recipientUser?.email})`}</span>
            </div>
            {detail.relationshipCriteria && (
              <div className="ref-rel-line">
                <Target size={13} /> {t('رابطهٔ پیوند: امتیاز معیارها')} <b>{fmtNum(detail.relationshipCriteria.effectiveScore ?? detail.relationshipCriteria.score ?? 0)}</b>
                {' '}· پوشش {fmtNum(detail.relationshipCriteria.coverage ?? 0)}٪ · حکم «{detail.relationshipCriteria.verdictLabel}»
              </div>
            )}
            {detail.message && <div style={{ display: 'flex', gap: 6 }}><StickyNote size={14} className="t-muted" /><span><b>{t('پیام:')}</b> {detail.message}</span></div>}
            {detail.notes && <div style={{ display: 'flex', gap: 6 }}><CheckCircle2 size={14} className="t-muted" /><span><b>{t('یادداشت پایانی:')}</b> {detail.notes}</span></div>}
            <div className="ref-mission-panel">
              <div className="ref-instruction-head"><Send size={14} /> {t('مأموریت معرفی (ارکستراسیون)')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="t-muted" style={{ fontSize: 11.5 }}>{t('وضعیت درخواست از معرف:')}</span>
                {(['REQUESTED', 'RESPONDED_YES', 'RESPONDED_NO', 'NO_RESPONSE'] as const).map(st => (
                  <button key={st} type="button" className={`btn btn-sm ${detail.requestStatus === st ? 'btn-primary' : 'btn-ghost'}`} disabled={!!busy}
                    onClick={() => updateMission(detail, { requestStatus: st }, `${t('وضعیت درخواست به «')}${REQ_STATUS_FA[st].label}${t('» تغییر کرد.')}`)}>
                    {REQ_STATUS_FA[st].label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                <span className="t-muted" style={{ fontSize: 11.5 }}>{t('نتیجهٔ نهایی:')}</span>
                {(['MEET_BOOKED', 'NO_REPLY', 'DECLINED', 'BAD_FIT'] as const).map(oc => (
                  <button key={oc} type="button" className={`btn btn-sm ${detail.outcome === oc ? 'btn-primary' : 'btn-ghost'}`} disabled={!!busy}
                    onClick={() => updateMission(detail, { outcome: oc }, `${t('نتیجهٔ معرفی «')}${OUTCOME_FA[oc].label}${t('» ثبت شد.')}`)}>
                    {OUTCOME_FA[oc].label}
                  </button>
                ))}
              </div>
              {detail.outcome && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <StickyNote size={13} className="t-muted" />
                  <input className="ref-outcome-note" placeholder={t('یادداشت نتیجه (اختیاری)')} defaultValue={detail.outcomeNote ?? ''}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                    onBlur={e => { const v = e.target.value.trim(); if (v !== (detail.outcomeNote ?? '')) updateMission(detail, { outcomeNote: v }, t('یادداشت نتیجه ذخیره شد.')); }} />
                </div>
              )}
              {detail.opportunity && (
                <div className="ref-rel-line" style={{ marginTop: 8 }}>
                  <Link href={`/opportunities/${detail.opportunity.id}`}>فرصت متصل: {detail.opportunity.name} ({fa(detail.opportunity.status)})</Link>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => updateMission(detail, { opportunityId: null }, t('اتصال به فرصت برداشته شد.'))}>✕</button>
                </div>
              )}
              {detail.connectorLoad != null && detail.connectorLoad > 0 && (
                <small className="t-muted" style={{ display: 'block', marginTop: 6 }}>این معرف {fmtNum(detail.connectorLoad)} درخواست فعال دیگر نیز دارد.</small>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}><UserRound size={14} className="t-muted" /><span><b>{t('معرف:')}</b> {detail.createdBy?.name ?? '—'} {detail.createdBy?.email ? `(${detail.createdBy.email})` : ''}</span></div>
            <div style={{ display: 'flex', gap: 12, color: 'var(--text-muted)', fontSize: 11.5 }}>
              <span>ایجاد: {fmtDT(detail.createdAt)}</span>
              {detail.acceptedAt && <span>پذیرش: {fmtDT(detail.acceptedAt)}</span>}
              {detail.completedAt && <span>پایان: {fmtDT(detail.completedAt)}</span>}
            </div>

            {detail.instruction && (
              <div className="ref-instruction-panel">
                <div className="ref-instruction-head"><ClipboardList size={14} /> {t('دستورالعمل معرفی‌شونده')}</div>
                <p><b>{t('هدف:')}</b> {detail.instruction.goal || '—'}</p>
                <div className="ref-instr-cols">
                  <div><small>{t('موضوعات مجاز')}</small>
                    <ul>{(detail.instruction.allowed ?? []).map((a, i) => <li key={i}>✓ {a}</li>)}
                      {!detail.instruction.allowed?.length && <li className="t-muted">{t('تعیین نشده')}</li>}</ul>
                  </div>
                  <div className="ref-instr-danger"><small>{t('خط قرمز')}</small>
                    <ul>{(detail.instruction.forbidden ?? []).map((a, i) => <li key={i}>✕ {a}</li>)}
                      {!detail.instruction.forbidden?.length && <li className="t-muted">{t('تعیین نشده')}</li>}</ul>
                  </div>
                </div>
                <p><b>{t('مرزها:')}</b> {detail.instruction.boundaries || '—'}</p>
                <small className="t-muted">مهلت نتیجه: {fmtNum(detail.instruction.dueDays)} روز</small>
              </div>
            )}

            <div className="ref-audit-panel">
              <div className="ref-instruction-head"><ShieldCheck size={14} /> ممیزی پیش از پذیرش {detail.audit ? `— ${GATE_META[detail.audit.gate]?.label}` : ''}</div>
              <AuditList audit={detail.audit} emptyLabel={t('هنوز ممیزی اجرا نشده؛ با «بازاجرای ممیزی» اجرا کنید.')} />
            </div>

            {(detail.status === 'ACCEPTED' || detail.status === 'COMPLETED') && (
              <div className="ref-audit-panel">
                <div className="ref-instruction-head"><ListChecks size={14} /> ممیزی پس از معرفی {detail.postAudit ? `— ${GATE_META[detail.postAudit.gate]?.label}` : ''}</div>
                <AuditList audit={detail.postAudit} emptyLabel={t('پس از پذیرش، پیگیری و اثر بر رابطه به‌صورت خودکار بررسی می‌شود.')} onCheckin={(code) => { setCheckinFor({ ref: detail, code }); setCheckinNote(''); }} />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ------- edit instructions modal ------- */}
      <Modal
        open={!!editInstr}
        title={t('ویرایش دستورالعمل معرفی')}
        description={t('دستورالعمل دقیق تری برای معرفی‌شونده بنویسید؛ ممیزی پیش از پذیرش دوباره اجرا می‌شود و نتیجهٔ آن با ذخیره نمایش داده می‌شود.')}
        onClose={() => setEditInstr(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditInstr(null)}><X size={14} /> {t('انصراف')}</button>
            <button type="submit" form="ref-instr-edit" className="btn btn-primary" disabled={busy === `instr-${editInstr?.id}`}>
              <ClipboardList size={14} /> ذخیره و ممیزی
            </button>
          </>
        }
      >
        <ErrorCard message={editError} />
        <form id="ref-instr-edit" onSubmit={saveInstr}>
          <div className="ref-instruction-box">
            <div className="ref-instruction-head"><ClipboardList size={14} /> {t('دستورالعمل معرفی‌شونده')}</div>
            <label className="field">
              <span className="field-label">{t('هدفِ معرفی (چرا این معرفی؟)')} <i className="req">*</i></span>
              <input value={editForm.goal} onChange={e => setEditForm(f => ({ ...f, goal: e.target.value }))} required />
            </label>
            <div className="ref-instruction-grid">
              <label className="field">
                <span className="field-label">{t('موضوعات مجاز')}</span>
                <input value={editForm.allowed} onChange={e => setEditForm(f => ({ ...f, allowed: e.target.value }))} placeholder={t('جدا با ویرگول')} />
              </label>
              <label className="field">
                <span className="field-label">{t('خط قرمز (ممنوع)')} <i className="req">*</i></span>
                <input value={editForm.forbidden} onChange={e => setEditForm(f => ({ ...f, forbidden: e.target.value }))} placeholder={t('جدا با ویرگول')} required />
              </label>
            </div>
            <label className="field">
              <span className="field-label">{t('مرزها و محدودیت‌ها')} <i className="req">*</i></span>
              <textarea value={editForm.boundaries} onChange={e => setEditForm(f => ({ ...f, boundaries: e.target.value }))} rows={2} required />
            </label>
            <label className="field ref-due">
              <span className="field-label">{t('مهلت نتیجه (روز)')}</span>
              <input type="number" min={3} max={365} value={editForm.dueDays} onChange={e => setEditForm(f => ({ ...f, dueDays: e.target.value }))} />
            </label>
          </div>
        </form>
      </Modal>

      {/* ------- finish modal ------- */}
      <Modal
        open={!!finishFor}
        title={t('ثبت انجام‌شدن معرفی')}
        description={finishFor ? `«${finishFor.title}${t('» — پس از ثبت، ممیزی پس از معرفی (پیگیری، نتیجه، اثر بر رابطه) اجرا می‌شود.')}` : ''}
        onClose={() => setFinishFor(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setFinishFor(null)}><X size={14} /> {t('انصراف')}</button>
            <button type="button" className="btn btn-primary" onClick={() => finishFor && changeStatus(finishFor, 'COMPLETED')} disabled={busy === finishFor?.id}>
              {busy === finishFor?.id ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />} ثبت
            </button>
          </>
        }
      >
        <label className="field">
          <span className="field-label">{t('یادداشت پایانی (نتیجهٔ واقعی)')}</span>
          <textarea value={finishNotes} onChange={e => setFinishNotes(e.target.value)} rows={3} placeholder={t('مثال: جلسهٔ ارزیابی برگزار شد، تأمین‌کننده تأیید شد و قرارداد اولیه امضا شد…')} />
        </label>
      </Modal>

      {/* ------- checkin modal ------- */}
      <Modal
        open={!!checkinFor}
        title={checkinFor?.code === 'FOLLOW_UP' ? t('ثبت پیگیری پس از معرفی') : t('ثبت نتیجهٔ معرفی')}
        description={checkinFor ? `«${checkinFor.ref.title}${t('» — این شاهد در ممیزی پس از معرفی محاسبه می‌شود.')}` : ''}
        onClose={() => setCheckinFor(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCheckinFor(null)}><X size={14} /> {t('انصراف')}</button>
            <button type="button" className="btn btn-primary" onClick={checkin} disabled={busy === `${checkinFor?.code}-${checkinFor?.ref.id}`}>
              <BellRing size={14} /> ثبت شاهد
            </button>
          </>
        }
      >
        <label className="field">
          <span className="field-label">{t('توضیح شاهد')}</span>
          <textarea value={checkinNote} onChange={e => setCheckinNote(e.target.value)} rows={3} placeholder={checkinFor?.code === 'FOLLOW_UP' ? t('مثال: جلسهٔ آشنایی با مدیر خرید برگزار شد (۱۴۰۵/۰۶/۰۲)…') : t('مثال: قرارداد اولیه امضا شد و وضعیت رابطه بهبود یافت…')} />
        </label>
      </Modal>
    </main>
  );
}
