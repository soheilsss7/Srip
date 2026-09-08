'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, apiBlob } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, Modal, PageHeader, SectionCard, StatCard } from '../_components/page-ui';
import {
  Target, Users2, Database, FlaskConical, Telescope, FileDown, Plus, RefreshCw, Trash2,
  Copy, CheckCircle2, AlertTriangle, Layers, GitBranch, Upload, FileJson, FileSpreadsheet,
  Table2, Sparkles, ChevronLeft, Info, Download, Building2,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  تحلیل راهبردی (Strategy) — رقابت و تعامل با روش نظریه بازی‌ها        */
/*  اسم این ماژول «بازی» نیست. تحلیل تعادل فقط ۲بازیکنه.                 */
/* ------------------------------------------------------------------ */

type TreeAction = { label: string; pay?: [number, number]; child?: TreeNode };
type TreeNode = { player: 'self' | 'rival'; actions: TreeAction[] };
type Archetype = {
  id: string; fa: string; kind: 'normal' | 'sequential' | 'repeated'; story: string;
  self: string[]; rival: string[]; paySelf: number[][]; payRival: number[][];
  tree?: TreeNode; suggestSim?: { rounds: number; delta: number; selfRule: string; rivalRule: string };
};
type Party = { name: string; orgId?: string | null };
type Scenario = {
  id: string; orgId: string; name: string; kind: 'normal' | 'sequential'; archetypeId?: string | null;
  self: Party; rival: Party; selfStrats: string[]; rivalStrats: string[];
  paySelf: number[][]; payRival: number[][]; tree?: TreeNode | null;
  payoffSource?: string; source?: string; createdAt?: string;
};
type NECell = { i: number; j: number; pay: [number, number] };
type Analysis = {
  kind: 'normal' | 'sequential'; error?: string;
  bestResponses?: { selfBR: number[][]; rivalBR: number[][] };
  pureNE?: NECell[];
  mixed?: { valid: boolean; p?: number; q?: number; expPay?: [number, number]; reason?: string; note?: string } | null;
  delta?: { computable: boolean; deltaStar?: number; reason?: string; rule?: string; values?: { T: number; R: number; P: number; S: number } };
  dominance?: { steps: Array<{ type: string; index: number; label: string; by: string }>; remaining: { rows: number[]; cols: number[] } };
  spe?: { spePath: string[]; pay: [number, number]; steps: Array<{ player: string; choice: string; pay: [number, number] }> };
};
type SimRound = { round: number; self: number; rival: number; paySelf: number; payRival: number };
type SimResult = {
  scenarioId: string; rounds: number; delta: number; rules: { self: string; rival: string }; seed: string;
  history: SimRound[]; totals: { self: number; rival: number; discSelf: number; discRival: number };
  coopJointRate: number; selfStrats: string[]; rivalStrats: string[];
};
type PredResult = {
  scenarioId: string; total: number; dist: number[]; predicted: number; predictedTie: boolean;
  tftMatchRate: number | null; recommend: number; expPaySelf: number[];
  predictedLabel: string; recommendLabel: string; rivalStrats: string[]; selfStrats: string[];
};
type ImportRow = { id: string; format: string; kind: string; name: string; scenarioId: string; warnings: string[]; createdAt: string };
type OrgSuggest = { orgId: string; name: string; type: string | null; industry: string | null; suggested: string[] };

const TABS = [
  { key: 'overview', label: 'نمای کلی', icon: <Layers size={14} /> },
  { key: 'rivals', label: 'رقبا', icon: <Users2 size={14} /> },
  { key: 'data', label: 'اتصال داده', icon: <Database size={14} /> },
  { key: 'sim', label: 'شبیه‌سازی', icon: <FlaskConical size={14} /> },
  { key: 'predict', label: 'پیش‌بینی و واکنش', icon: <Telescope size={14} /> },
  { key: 'output', label: 'خروجی', icon: <FileDown size={14} /> },
] as const;
type TabKey = typeof TABS[number]['key'];

const RULES_FA: Record<string, string> = { TFT: 'تلافی‌مثل', GRIM: 'ماشه‌ای', ALLC: 'همیشه‌همکاری', ALLD: 'همیشه‌نقض', BESTRESP: 'بهترین‌پاسخ', RANDOM: 'تصادفی بذردار' };
const SOURCE_FA: Record<string, string> = { stated: 'اظهارشده', imported: 'واردشده', empirical: 'تجربی (میانگین تاریخچه)' };

const fmtNum = (v: unknown) => (v == null || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));
const fmtDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fa-IR', { day: 'numeric', month: 'short', year: '2-digit' });
};

function TreeView({ node, selfName, rivalName, path }: { node: TreeNode; selfName: string; rivalName: string; path: string[] }) {
  return (
    <ul className="tree-list">
      <li>
        <span className="chip info">{node.player === 'self' ? selfName : rivalName} تصمیم می‌گیرد</span>
        <ul>
          {node.actions.map((a, k) => (
            <li key={k}>
              <span className={path.includes(a.label) ? 'chip success' : 'chip'}>{a.label}{path.includes(a.label) ? ' ✓ مسیر تعادل' : ''}</span>
              {a.pay && <span className="t-muted"> — عایدی (خود، رقیب): {fmtNum(a.pay[0])}، {fmtNum(a.pay[1])}</span>}
              {a.child && <TreeView node={a.child} selfName={selfName} rivalName={rivalName} path={path} />}
            </li>
          ))}
        </ul>
      </li>
    </ul>
  );
}

export default function StrategyPage() {
  const { me, scopeId, can } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');
  const canRead = isOwner || can('strategy.read');
  const canWrite = isOwner || can('strategy.write');

  const primaryOrg = me?.memberships.find(m => m.isPrimary)?.organizationId ?? me?.memberships?.[0]?.organizationId ?? '';
  const [orgId, setOrgId] = useState<string>(() => (scopeId !== 'all' ? scopeId : primaryOrg));
  useEffect(() => { if (orgId !== scopeId && scopeId !== 'all') setOrgId(scopeId); }, [scopeId, orgId]);
  useEffect(() => { if (!orgId && primaryOrg) setOrgId(primaryOrg); }, [orgId, primaryOrg]);

  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState('');
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [pred, setPred] = useState<PredResult | null>(null);
  const [brief, setBrief] = useState<string[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [orgs, setOrgs] = useState<OrgSuggest[]>([]);

  /* ویرایشگر رقبا */
  const [edName, setEdName] = useState('');
  const [edSelf, setEdSelf] = useState('');
  const [edSelfOrg, setEdSelfOrg] = useState('');
  const [edRival, setEdRival] = useState('');
  const [edRivalOrg, setEdRivalOrg] = useState('');
  const [edSStrats, setEdSStrats] = useState<string[]>([]);
  const [edRStrats, setEdRStrats] = useState<string[]>([]);
  const [edA, setEdA] = useState<string[][]>([]);
  const [edB, setEdB] = useState<string[][]>([]);

  /* ورود داده */
  const [impFormat, setImpFormat] = useState<'json' | 'csv'>('json');
  const [impKind, setImpKind] = useState<'matrix' | 'rounds'>('matrix');
  const [impText, setImpText] = useState('');
  const [impName, setImpName] = useState('');
  const [impResult, setImpResult] = useState<{ ok: boolean; errors: string[]; warnings: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* شبیه‌سازی */
  const [simRounds, setSimRounds] = useState('10');
  const [simDelta, setSimDelta] = useState('0.9');
  const [simSelfRule, setSimSelfRule] = useState('TFT');
  const [simRivalRule, setSimRivalRule] = useState('TFT');
  const [simSeed, setSimSeed] = useState('srip-strategy');

  /* سناریو از قالب */
  const [tplOpen, setTplOpen] = useState(false);
  const [tplArch, setTplArch] = useState<Archetype | null>(null);
  const [tplName, setTplName] = useState('');

  /* چی می‌شود اگر */
  const [whatRival, setWhatRival] = useState(0);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 6000);
  };

  const selected = useMemo(() => scenarios.find(s => s.id === selectedId) ?? null, [scenarios, selectedId]);

  const refresh = useCallback(async (oid: string) => {
    setLoading(true); setError('');
    try {
      const [arch, scs, imps, sugg] = await Promise.all([
        api<{ items: Archetype[] }>('/strategy/archetypes').catch(() => null),
        api<{ items: Scenario[] }>(`/strategy/scenarios?orgId=${encodeURIComponent(oid)}`).catch(() => null),
        api<{ items: ImportRow[] }>('/strategy/imports').catch(() => null),
        api<{ items: OrgSuggest[] }>('/strategy/orgs/suggest').catch(() => null),
      ]);
      setArchetypes(arch?.items ?? []);
      setScenarios(scs?.items ?? []);
      setImports(imps?.items ?? []);
      setOrgs(sugg?.items ?? []);
      if (!selectedId && (scs?.items ?? []).length) setSelectedId((scs?.items ?? [])[0].id);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (orgId && canRead) refresh(orgId); }, [orgId, canRead, refresh]);

  const loadAnalysis = useCallback(async (sid: string) => {
    try {
      const an = await api<Analysis>(`/strategy/scenarios/${encodeURIComponent(sid)}/analysis`);
      setAnalysis(an);
    } catch (e) { notify(`خطا در تحلیل: ${(e as Error).message}`); }
  }, []);

  useEffect(() => {
    if (!selectedId) { setAnalysis(null); return; }
    loadAnalysis(selectedId);
    setSim(null); setPred(null); setBrief([]);
  }, [selectedId, loadAnalysis]);

  useEffect(() => {
    if (!selected) return;
    setEdName(selected.name);
    setEdSelf(selected.self?.name ?? '');
    setEdSelfOrg(selected.self?.orgId ?? '');
    setEdRival(selected.rival?.name ?? '');
    setEdRivalOrg(selected.rival?.orgId ?? '');
    setEdSStrats([...(selected.selfStrats ?? [])]);
    setEdRStrats([...(selected.rivalStrats ?? [])]);
    setEdA((selected.paySelf ?? []).map(r => r.map(String)));
    setEdB((selected.payRival ?? []).map(r => r.map(String)));
    setWhatRival(0);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardWrite = () => {
    if (!canWrite) { notify('مجوز ویرایش «تحلیل راهبردی» را ندارید.'); return false; }
    return true;
  };

  const createFromArchetype = async () => {
    if (!guardWrite() || !tplArch) return;
    if (!tplName.trim()) { notify('نام سناریو را بنویسید.'); return; }
    setBusy('tpl');
    try {
      const row = await api<Scenario>('/strategy/scenarios', {
        method: 'POST', body: JSON.stringify({ orgId, name: tplName.trim(), archetypeId: tplArch.id }),
      });
      setScenarios(s => [row, ...s]);
      setSelectedId(row.id);
      setTplOpen(false); setTplName('');
      notify(`سناریوی «${row.name}» از قالب «${tplArch.fa}» ساخته شد.`);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const removeScenario = async (sid: string) => {
    if (!guardWrite()) return;
    setBusy('del:' + sid);
    try {
      await api(`/strategy/scenarios/${encodeURIComponent(sid)}`, { method: 'DELETE' });
      setScenarios(s => s.filter(x => x.id !== sid));
      if (selectedId === sid) setSelectedId('');
      notify('سناریو حذف شد.');
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const saveRivals = async (asNew: boolean) => {
    if (!guardWrite()) return;
    if (!edName.trim() || !edSelf.trim() || !edRival.trim()) { notify('نام سناریو و هر دو طرف را بنویسید.'); return; }
    if (edSStrats.length < 2 || edRStrats.length < 2) { notify('هر طرف دست‌کم ۲ راهبرد لازم دارد.'); return; }
    if (edSStrats.some(s => !s.trim()) || edRStrats.some(s => !s.trim())) { notify('نام هیچ راهبردی نباید خالی باشد.'); return; }
    const num = (t: string) => (t.trim() === '' || !Number.isFinite(Number(t)) ? null : Number(t));
    const A = edA.map(r => r.map(num));
    const B = edB.map(r => r.map(num));
    if (A.some(r => r.some(v => v === null)) || B.some(r => r.some(v => v === null))) { notify('همهٔ خانه‌های هر دو ماتریس باید عدد باشند.'); return; }
    setBusy(asNew ? 'new' : 'save');
    try {
      const body = {
        orgId, name: edName.trim(), kind: 'normal',
        self: { name: edSelf.trim(), orgId: edSelfOrg || null },
        rival: { name: edRival.trim(), orgId: edRivalOrg || null },
        selfStrats: edSStrats.map(s => s.trim()), rivalStrats: edRStrats.map(s => s.trim()),
        paySelf: A, payRival: B,
      };
      if (asNew) {
        const row = await api<Scenario>('/strategy/scenarios', { method: 'POST', body: JSON.stringify(body) });
        setScenarios(s => [row, ...s]);
        setSelectedId(row.id);
        notify(`سناریوی «${row.name}» ساخته شد.`);
      } else if (selected) {
        const row = await api<Scenario>(`/strategy/scenarios/${encodeURIComponent(selected.id)}`, { method: 'PUT', body: JSON.stringify(body) });
        setScenarios(s => s.map(x => (x.id === row.id ? row : x)));
        loadAnalysis(row.id);
        notify('سناریو ذخیره شد.');
      }
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const applyOrgStrats = (side: 'self' | 'rival', orgIdSel: string) => {
    const o = orgs.find(x => x.orgId === orgIdSel);
    if (!o) return;
    if (side === 'self') { setEdSelf(o.name); setEdSelfOrg(o.orgId); setEdSStrats([...o.suggested]); }
    else { setEdRival(o.name); setEdRivalOrg(o.orgId); setEdRStrats([...o.suggested]); }
    notify(`راهبردهای پیشنهادی «${o.name}» اعمال شد؛ عایدی‌ها را بازبینی کنید.`);
  };

  const syncMatrixSize = (ss: string[], rs: string[], A: string[][], B: string[][]) => {
    const fit = (M: string[][]) => ss.map((_, i) => rs.map((_, j) => M[i]?.[j] ?? '0'));
    setEdA(fit(A)); setEdB(fit(B));
  };
  const addStrat = (side: 'self' | 'rival') => {
    if (side === 'self' && edSStrats.length < 12) {
      const ns = [...edSStrats, `راهبرد ${fmtNum(edSStrats.length + 1)}`];
      setEdSStrats(ns); syncMatrixSize(ns, edRStrats, edA, edB);
    }
    if (side === 'rival' && edRStrats.length < 12) {
      const ns = [...edRStrats, `راهبرد ${fmtNum(edRStrats.length + 1)}`];
      setEdRStrats(ns); syncMatrixSize(edSStrats, ns, edA, edB);
    }
  };
  const delStrat = (side: 'self' | 'rival', idx: number) => {
    if (side === 'self' && edSStrats.length > 2) {
      const ns = edSStrats.filter((_, i) => i !== idx);
      setEdSStrats(ns); syncMatrixSize(ns, edRStrats, edA, edB);
    }
    if (side === 'rival' && edRStrats.length > 2) {
      const ns = edRStrats.filter((_, i) => i !== idx);
      setEdRStrats(ns); syncMatrixSize(edSStrats, ns, edA, edB);
    }
  };

  const runValidate = async () => {
    if (!guardWrite()) return;
    if (!impText.trim()) { notify('متن یا فایل داده را وارد کنید.'); return; }
    setBusy('validate');
    try {
      const r = await api<{ ok: boolean; errors: string[]; warnings: string[] }>('/strategy/imports/validate', {
        method: 'POST', body: JSON.stringify({ format: impFormat, kind: impKind, payload: impText }),
      });
      setImpResult(r);
      notify(r.ok ? 'داده معتبر است؛ می‌توانید وارد کنید.' : `نامعتبر: ${r.errors.length} خطا`);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const runImport = async () => {
    if (!guardWrite()) return;
    if (!impText.trim()) { notify('متن یا فایل داده را وارد کنید.'); return; }
    setBusy('import');
    try {
      const r = await api<{ scenario: Scenario; warnings: string[] }>('/strategy/imports', {
        method: 'POST', body: JSON.stringify({ orgId, format: impFormat, kind: impKind, payload: impText, name: impName.trim() || 'سناریوی واردشده' }),
      });
      setScenarios(s => [r.scenario, ...s]);
      setSelectedId(r.scenario.id);
      setImpResult({ ok: true, errors: [], warnings: r.warnings });
      const h = await api<{ items: ImportRow[] }>('/strategy/imports').catch(() => null);
      if (h) setImports(h.items);
      notify(`سناریوی «${r.scenario.name}» از دادهٔ خارجی ساخته شد.`);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const downloadTemplate = async (format: 'json' | 'csv', kind: 'matrix' | 'rounds') => {
    try {
      const blob = await apiBlob(`/strategy/imports/template?format=${format}&kind=${kind}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'json' ? 'strategy-template.json' : `strategy-${kind}-template.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify('قالب دانلود شد.');
    } catch (e) { notify(`خطا: ${(e as Error).message}`); }
  };

  const onPickFile = (f: File | undefined) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setImpText(String(rd.result ?? ''));
    rd.readAsText(f);
  };

  const runSimulate = async () => {
    if (!guardWrite() || !selected) return;
    setBusy('sim');
    try {
      const r = await api<SimResult>(`/strategy/scenarios/${encodeURIComponent(selected.id)}/simulate`, {
        method: 'POST', body: JSON.stringify({
          rounds: Number(simRounds) || 10, delta: Number(simDelta) || 0.9,
          selfRule: simSelfRule, rivalRule: simRivalRule, seed: simSeed.trim() || selected.id,
        }),
      });
      setSim(r); setPred(null);
      notify(`شبیه‌سازی ${fmtNum(r.rounds)} دوره کامل شد.`);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const runPredict = async () => {
    if (!guardWrite() || !selected) return;
    setBusy('pred');
    try {
      const r = await api<PredResult>(`/strategy/scenarios/${encodeURIComponent(selected.id)}/predict`, { method: 'POST', body: JSON.stringify({}) });
      setPred(r);
      notify(`پیش‌بینی آماده شد؛ واکنش توصیه‌شده: ${r.recommendLabel}`);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const loadBrief = async () => {
    if (!selected) return;
    setBusy('brief');
    try {
      const r = await api<{ lines: string[] }>(`/strategy/brief/${encodeURIComponent(selected.id)}`);
      setBrief(r.lines);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const copyBrief = async () => {
    if (!brief.length) return;
    try { await navigator.clipboard.writeText(brief.join('\n')); notify('بریف کپی شد.'); }
    catch { notify('کپی نشد؛ متن را دستی انتخاب کنید.'); }
  };

  const downloadExport = async (format: 'json' | 'csv' | 'xls') => {
    if (!selected) return;
    setBusy('exp:' + format);
    try {
      if (format === 'json') {
        const r = await api<unknown>(`/strategy/export?orgId=${encodeURIComponent(orgId)}&scenarioId=${encodeURIComponent(selected.id)}&format=json`);
        const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `strategy-${selected.id}.json`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await apiBlob(`/strategy/export?orgId=${encodeURIComponent(orgId)}&scenarioId=${encodeURIComponent(selected.id)}&format=${format}`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `strategy-${selected.id}.${format}`; a.click();
        URL.revokeObjectURL(url);
      }
      notify('خروجی تحلیل راهبردی آماده شد.');
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const neSet = useMemo(() => new Set((analysis?.pureNE ?? []).map(c => `${c.i},${c.j}`)), [analysis]);
  const whatBest = useMemo(() => {
    if (!selected || selected.kind !== 'normal') return -1;
    let bi = 0;
    selected.paySelf.forEach((row, i) => { if ((row[whatRival] ?? 0) > (selected.paySelf[bi][whatRival] ?? 0)) bi = i; });
    return bi;
  }, [selected, whatRival]);

  if (!canRead) {
    return (
      <div className="page">
        <PageHeader eyebrow="هوشمندی" title="تحلیل راهبردی" description="رقابت و تعامل با روش نظریه بازی‌ها" />
        <ErrorCard message="مجوز مشاهدهٔ ماژول «تحلیل راهبردی» را ندارید." />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="هوشمندی"
        title="تحلیل راهبردی"
        description="رقابت و تعامل با روش نظریه بازی‌ها: سناریو، تعادل نش، شبیه‌سازی تکراری، پیش‌بینی و واکنش"
        actions={<><button className="btn" onClick={() => orgId && refresh(orgId)}><RefreshCw size={14} /> به‌روزرسانی</button></>}
      />
      {flash && <div className="notice success" role="status">{flash}</div>}
      <ErrorCard message={error} />
      {loading ? <Loading label="در حال بارگذاری هاب تحلیل راهبردی…" /> : (
        <>
          <div className="tabbar" role="tablist" aria-label="تب‌های تحلیل راهبردی">
            {TABS.map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'tab-active' : ''} onClick={() => setTab(t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <>
              <div className="stat-grid">
                <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label="سناریوها" value={fmtNum(scenarios.length)} />
                <StatCard icon={<Table2 size={16} />} iconClass="ic-teal" label="ماتریسی" value={fmtNum(scenarios.filter(s => s.kind === 'normal').length)} />
                <StatCard icon={<GitBranch size={16} />} iconClass="ic-orange" label="ترتیبی" value={fmtNum(scenarios.filter(s => s.kind === 'sequential').length)} />
                <StatCard icon={<Upload size={16} />} iconClass="ic-green" label="واردشده از بیرون" value={fmtNum(scenarios.filter(s => s.source === 'import' || s.payoffSource === 'empirical').length)} />
                <StatCard icon={<FlaskConical size={16} />} iconClass="ic-red" label="تعادل نش (منتخب)" value={fmtNum(analysis?.pureNE?.length ?? 0)} sub={selected?.name ?? 'سناریویی انتخاب نشده'} />
                <StatCard icon={<Sparkles size={16} />} iconClass="ic-blue" label="قالب کلاسیک" value={fmtNum(archetypes.length)} />
              </div>
              <SectionCard title="سناریوها" icon={<Target size={14} />} description="یک سناریو را انتخاب کنید تا همهٔ تب‌ها روی همان کار کنند">
                {!scenarios.length && <p className="t-muted">سناریویی نیست؛ از قالب کلاسیک بسازید یا داده وارد کنید.</p>}
                <div className="item-list">
                  {scenarios.map(s => (
                    <div key={s.id} className={'list-card' + (s.id === selectedId ? ' active' : '')}>
                      <div><strong>{s.name}</strong></div>
                      <div className="t-muted">{s.self?.name} در برابر {s.rival?.name}</div>
                      <div>
                        <Badge tone={s.kind === 'sequential' ? 'warning' : 'info'}>{s.kind === 'sequential' ? 'ترتیبی' : `ماتریسی ${fmtNum(s.selfStrats.length)}×${fmtNum(s.rivalStrats.length)}`}</Badge>
                        {' '}<Badge>{SOURCE_FA[s.payoffSource ?? 'stated'] ?? s.payoffSource}</Badge>
                      </div>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => setSelectedId(s.id)}>انتخاب</button>
                        <button className="btn btn-sm" onClick={() => { setSelectedId(s.id); setTab('sim'); }}>تحلیل <ChevronLeft size={12} /></button>
                        {canWrite && <button className="btn btn-sm btn-danger" disabled={busy === 'del:' + s.id} onClick={() => removeScenario(s.id)}><Trash2 size={12} /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="قالب‌های کلاسیک نظریه بازی‌ها" icon={<Info size={14} />} description="نقطه شروع آماده با عایدی‌های متعارف و روایت کسب‌وکاری">
                <div className="item-list">
                  {archetypes.map(a => (
                    <div key={a.id} className="list-card">
                      <div><strong>{a.fa}</strong> <Badge>{a.kind === 'sequential' ? 'ترتیبی' : a.kind === 'repeated' ? 'تکراری' : 'ماتریسی'}</Badge></div>
                      <div className="t-muted">{a.story}</div>
                      {canWrite && <div className="row-actions"><button className="btn btn-sm btn-primary" onClick={() => { setTplArch(a); setTplName(''); setTplOpen(true); }}><Plus size={12} /> ساخت سناریو از این قالب</button></div>}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          {tab === 'rivals' && (
            <>
              {!selected && <p className="t-muted">ابتدا در «نمای کلی» یک سناریو انتخاب کنید.</p>}
              {selected?.kind === 'sequential' && (
                <SectionCard title="سناریوی ترتیبی" icon={<GitBranch size={14} />} description="درخت ترتیبی در این نسخه فقط از قالب «بازدارندگی ورود» ساخته می‌شود؛ مسیر تعادل در تب شبیه‌سازی">
                  {selected.tree && <TreeView node={selected.tree} selfName={selected.self?.name ?? 'خود'} rivalName={selected.rival?.name ?? 'رقیب'} path={analysis?.spe?.spePath ?? []} />}
                </SectionCard>
              )}
              {(!selected || selected.kind === 'normal') && (
                <>
                  <SectionCard title="طرف‌ها" icon={<Users2 size={14} />} description="نام طرف‌ها + نگاشت به سازمان سامانه (با پیشنهاد راهبرد از روی نوع سازمان)">
                    <div className="form-grid">
                      <div className="field full"><label className="field-label">نام سناریو</label><input value={edName} onChange={e => setEdName(e.target.value)} placeholder="مثلاً: جنگ قیمت با پترو صنعت" /></div>
                      <div className="field"><label className="field-label">طرف خودی</label><input value={edSelf} onChange={e => setEdSelf(e.target.value)} /></div>
                      <div className="field"><label className="field-label">سازمان خودی (اختیاری)</label>
                        <select value={edSelfOrg} onChange={e => applyOrgStrats('self', e.target.value)}>
                          <option value="">بدون نگاشت</option>
                          {orgs.map(o => <option key={o.orgId} value={o.orgId}>{o.name} — {o.suggested.join(' / ')}</option>)}
                        </select>
                      </div>
                      <div className="field"><label className="field-label">طرف رقیب</label><input value={edRival} onChange={e => setEdRival(e.target.value)} /></div>
                      <div className="field"><label className="field-label">سازمان رقیب (اختیاری)</label>
                        <select value={edRivalOrg} onChange={e => applyOrgStrats('rival', e.target.value)}>
                          <option value="">بدون نگاشت</option>
                          {orgs.map(o => <option key={o.orgId} value={o.orgId}>{o.name} — {o.suggested.join(' / ')}</option>)}
                        </select>
                      </div>
                    </div>
                  </SectionCard>
                  <SectionCard title="راهبردها" icon={<Target size={14} />} description="هر طرف ۲ تا ۱۲ راهبرد؛ افزودن/حذف، ابعاد هر دو ماتریس را هماهنگ می‌کند">
                    <div className="form-grid">
                      <div className="field">
                        <label className="field-label">راهبردهای خود ({edSelf || 'خود'})</label>
                        {edSStrats.map((s, i) => (
                          <div key={i} className="inline-row"><input value={s} onChange={e => setEdSStrats(v => v.map((x, k) => (k === i ? e.target.value : x)))} />
                            <button className="btn btn-sm" disabled={edSStrats.length <= 2} onClick={() => delStrat('self', i)}><Trash2 size={12} /></button></div>
                        ))}
                        <button className="btn btn-sm" disabled={edSStrats.length >= 12} onClick={() => addStrat('self')}><Plus size={12} /> افزودن راهبرد</button>
                      </div>
                      <div className="field">
                        <label className="field-label">راهبردهای رقیب ({edRival || 'رقیب'})</label>
                        {edRStrats.map((s, i) => (
                          <div key={i} className="inline-row"><input value={s} onChange={e => setEdRStrats(v => v.map((x, k) => (k === i ? e.target.value : x)))} />
                            <button className="btn btn-sm" disabled={edRStrats.length <= 2} onClick={() => delStrat('rival', i)}><Trash2 size={12} /></button></div>
                        ))}
                        <button className="btn btn-sm" disabled={edRStrats.length >= 12} onClick={() => addStrat('rival')}><Plus size={12} /> افزودن راهبرد</button>
                      </div>
                    </div>
                  </SectionCard>
                  <SectionCard title="ماتریس‌های عایدی" icon={<Table2 size={14} />} description="دو ماتریس هم‌ابعاد با راهبردها؛ همهٔ خانه‌ها عدد">
                    <div className="duo">
                      <div>
                        <h4>عایدی خود ({edSelf || 'خود'})</h4>
                        <div className="table-wrap"><div className="matrix-scroll"><table className="matrix"><thead><tr><th>خود \ رقیب</th>{edRStrats.map((r, j) => <th key={j}>{r}</th>)}</tr></thead>
                          <tbody>{edSStrats.map((s, i) => <tr key={i}><th>{s}</th>{edRStrats.map((_, j) => <td key={j}><input className="cell-input" value={edA[i]?.[j] ?? ''} onChange={e => setEdA(v => v.map((row, ri) => (ri === i ? row.map((c, cj) => (cj === j ? e.target.value : c)) : row)))} /></td>)}</tr>)}</tbody></table></div></div>
                      </div>
                      <div>
                        <h4>عایدی رقیب ({edRival || 'رقیب'})</h4>
                        <div className="table-wrap"><div className="matrix-scroll"><table className="matrix"><thead><tr><th>خود \ رقیب</th>{edRStrats.map((r, j) => <th key={j}>{r}</th>)}</tr></thead>
                          <tbody>{edSStrats.map((s, i) => <tr key={i}><th>{s}</th>{edRStrats.map((_, j) => <td key={j}><input className="cell-input" value={edB[i]?.[j] ?? ''} onChange={e => setEdB(v => v.map((row, ri) => (ri === i ? row.map((c, cj) => (cj === j ? e.target.value : c)) : row)))} /></td>)}</tr>)}</tbody></table></div></div>
                      </div>
                    </div>
                    {canWrite && <div className="row-actions"><button className="btn btn-primary" disabled={busy === 'save' || !selected} onClick={() => saveRivals(false)}><CheckCircle2 size={14} /> ذخیره در همین سناریو</button><button className="btn" disabled={busy === 'new'} onClick={() => saveRivals(true)}><Plus size={14} /> ساخت سناریوی تازه از این چیدمان</button></div>}
                  </SectionCard>
                </>
              )}
            </>
          )}

          {tab === 'data' && (
            <>
              <SectionCard title="قالب‌های ورود داده" icon={<Download size={14} />} description="دادهٔ هر پلتفرم دیگر را در همین قالب‌ها بریزید و وارد کنید">
                <div className="row-actions">
                  <button className="btn" onClick={() => downloadTemplate('json', 'matrix')}><FileJson size={14} /> قالب JSON</button>
                  <button className="btn" onClick={() => downloadTemplate('csv', 'matrix')}><FileSpreadsheet size={14} /> قالب CSV ماتریس</button>
                  <button className="btn" onClick={() => downloadTemplate('csv', 'rounds')}><FileSpreadsheet size={14} /> قالب CSV دورها</button>
                </div>
                <p className="t-muted">سرستون ماتریس: strategy_self و strategy_rival و pay_self و pay_rival — سرستون دورها: round و self و rival (و paySelf و payRival اختیاری). در CSV دورها، عایدی هر خانه میانگین تجربی همان خانه است و خانهٔ دیده‌نشده با هشدار صریح صفر می‌شود.</p>
              </SectionCard>
              <SectionCard title="ورود داده" icon={<Upload size={14} />} description="متن را بچسبانید یا فایل انتخاب کنید؛ اول اعتبارسنجی، بعد ورود">
                <div className="form-grid">
                  <div className="field"><label className="field-label">قالب</label>
                    <select value={impFormat} onChange={e => setImpFormat(e.target.value as 'json' | 'csv')}>
                      <option value="json">JSON</option><option value="csv">CSV</option>
                    </select>
                  </div>
                  {impFormat === 'csv' && <div className="field"><label className="field-label">نوع CSV</label>
                    <select value={impKind} onChange={e => setImpKind(e.target.value as 'matrix' | 'rounds')}>
                      <option value="matrix">ماتریس</option><option value="rounds">دورها (تاریخچه)</option>
                    </select>
                  </div>}
                  <div className="field"><label className="field-label">نام سناریوی حاصل</label><input value={impName} onChange={e => setImpName(e.target.value)} placeholder="سناریوی واردشده" /></div>
                  <div className="field"><label className="field-label">فایل</label>
                    <input ref={fileRef} type="file" accept=".json,.csv,.txt" onChange={e => onPickFile(e.target.files?.[0])} />
                  </div>
                  <div className="field full"><label className="field-label">متن داده</label>
                    <textarea rows={8} value={impText} onChange={e => setImpText(e.target.value)} placeholder="متن JSON یا CSV…" dir="ltr" />
                  </div>
                </div>
                {canWrite && <div className="row-actions">
                  <button className="btn" disabled={busy === 'validate'} onClick={runValidate}><CheckCircle2 size={14} /> اعتبارسنجی</button>
                  <button className="btn btn-primary" disabled={busy === 'import'} onClick={runImport}><Upload size={14} /> ورود و ساخت سناریو</button>
                </div>}
                {impResult && (
                  <div>
                    {!impResult.ok && impResult.errors.map((e, i) => <div key={i} className="notice danger" role="alert"><AlertTriangle size={14} /> {e}</div>)}
                    {impResult.warnings.map((w, i) => <div key={i} className="notice warning"><Info size={14} /> {w}</div>)}
                    {impResult.ok && !impResult.warnings.length && <div className="notice success"><CheckCircle2 size={14} /> بدون خطا و هشدار.</div>}
                  </div>
                )}
              </SectionCard>
              <SectionCard title="سازمان‌های سامانه به‌عنوان بازیگر" icon={<Building2 size={14} />} description="هر سازمان با راهبردهای پیشنهادی نوع خودش؛ انتخاب در تب رقبا">
                <div className="item-list">
                  {orgs.map(o => (
                    <div key={o.orgId} className="list-card">
                      <div><strong>{o.name}</strong></div>
                      <div className="t-muted">{o.industry ?? ''} — راهبرد پیشنهادی: {o.suggested.join(' / ')}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="تاریخچه ورود" icon={<Database size={14} />} description="آخرین ورودهای داده از بیرون سامانه">
                {!imports.length && <p className="t-muted">هنوز ورودی ثبت نشده است.</p>}
                {!!imports.length && (
                  <div className="table-wrap"><table><thead><tr><th>نام</th><th>قالب</th><th>زمان</th><th>هشدارها</th></tr></thead>
                    <tbody>{imports.map(r => <tr key={r.id}><td>{r.name}</td><td>{r.format} / {r.kind === 'rounds' ? 'دورها' : 'ماتریس'}</td><td>{fmtDT(r.createdAt)}</td><td>{fmtNum(r.warnings?.length ?? 0)}</td></tr>)}</tbody></table></div>
                )}
              </SectionCard>
            </>
          )}

          {tab === 'sim' && (
            <>
              {!selected && <p className="t-muted">ابتدا در «نمای کلی» یک سناریو انتخاب کنید.</p>}
              {selected && !analysis && <Loading label="در حال تحلیل سناریو…" />}
              {selected && analysis?.error && <ErrorCard message={analysis.error} />}
              {selected && analysis && !analysis.error && selected.kind === 'sequential' && (
                <SectionCard title="مسیر تعادل کامل زیربازی (استقرای پسرو)" icon={<GitBranch size={14} />} description="درخت ترتیبی با استقرای پسرو حل می‌شود؛ شبیه‌سازی تکراری مخصوص سناریوی ماتریسی است">
                  <div className="stat-grid">
                    <StatCard icon={<ChevronLeft size={16} />} iconClass="ic-green" label="مسیر تعادل" value={(analysis.spe?.spePath ?? []).join(' ← ') || '—'} />
                    <StatCard icon={<Target size={16} />} iconClass="ic-blue" label="عایدی مسیر" value={`خود ${fmtNum(analysis.spe?.pay?.[0])}، رقیب ${fmtNum(analysis.spe?.pay?.[1])}`} />
                  </div>
                  {selected.tree && <TreeView node={selected.tree} selfName={selected.self?.name ?? 'خود'} rivalName={selected.rival?.name ?? 'رقیب'} path={analysis.spe?.spePath ?? []} />}
                </SectionCard>
              )}
              {selected && analysis && !analysis.error && selected.kind === 'normal' && (
                <>
                  <SectionCard title="ماتریس و تعادل نش" icon={<Table2 size={14} />} description={`خانه «عایدی خود، عایدی رقیب» — ${fmtNum(analysis.pureNE?.length ?? 0)} تعادل نش خالص (سبز)`}>
                    <div className="table-wrap"><div className="matrix-scroll"><table className="matrix"><thead><tr><th>خود \ رقیب</th>{selected.rivalStrats.map((r, j) => <th key={j}>{r}</th>)}</tr></thead>
                      <tbody>{selected.selfStrats.map((s, i) => (
                        <tr key={i}><th>{s}</th>{selected.rivalStrats.map((_, j) => {
                          const isNE = neSet.has(`${i},${j}`);
                          const brS = analysis.bestResponses?.selfBR?.[j]?.includes(i);
                          const brR = analysis.bestResponses?.rivalBR?.[i]?.includes(j);
                          return <td key={j} className={isNE ? 'cell-ne' : ''}>{fmtNum(selected.paySelf[i]?.[j])}، {fmtNum(selected.payRival[i]?.[j])}{isNE ? ' ★' : ''}{!isNE && (brS || brR) ? ' ·' : ''}</td>;
                        })}</tr>
                      ))}</tbody></table></div></div>
                    <p className="t-muted">★ تعادل نش خالص (بهترین پاسخ متقابل) — · بهترین پاسخ یک‌طرفه</p>
                    {!!(analysis.pureNE?.length) && <p>تعادل‌ها: {(analysis.pureNE ?? []).map(c => `(${selected.selfStrats[c.i]}، ${selected.rivalStrats[c.j]})`).join('؛ ')}</p>}
                    {!(analysis.pureNE?.length) && <p className="t-muted">تعادل نش خالص وجود ندارد.</p>}
                  </SectionCard>
                  <div className="duo">
                    <SectionCard title="تعادل مختلط (۲×۲)" icon={<Sparkles size={14} />} description="فقط وقتی ماتریس دقیقاً ۲×۲ است">
                      {!analysis.mixed && <p className="t-muted">ماتریس ۲×۲ نیست.</p>}
                      {analysis.mixed && !analysis.mixed.valid && <p className="t-muted">{analysis.mixed.reason}</p>}
                      {analysis.mixed?.valid && <p>خود {fmtNum(Math.round((analysis.mixed.p ?? 0) * 100))}٪ سطر اول و رقیب {fmtNum(Math.round((analysis.mixed.q ?? 0) * 100))}٪ ستون اول؛ عایدی موردانتظار خود {fmtNum(analysis.mixed.expPay?.[0])} و رقیب {fmtNum(analysis.mixed.expPay?.[1])}. {analysis.mixed.note}</p>}
                    </SectionCard>
                    <SectionCard title="پایداری همکاری (ماشه‌ای)" icon={<Info size={14} />} description="با فرض سطر/ستون اول = همکاری">
                      {!analysis.delta?.computable && <p className="t-muted">{analysis.delta?.reason}</p>}
                      {analysis.delta?.computable && <p>آستانه: δ ≥ {fmtNum((analysis.delta?.deltaStar ?? 0))} — {analysis.delta?.rule}</p>}
                    </SectionCard>
                  </div>
                  {!!(analysis.dominance?.steps?.length) && (
                    <SectionCard title="حذف راهبرد مغلوب" icon={<Trash2 size={14} />} description="مراحل حذف اکید تکراری">
                      <ol>{(analysis.dominance?.steps ?? []).map((s, i) => <li key={i}>«{s.label}» ({s.type === 'row' ? 'خود' : 'رقیب'}) چون «{s.by}» در همه حال بهتر است.</li>)}</ol>
                    </SectionCard>
                  )}
                  <SectionCard title="اجرای شبیه‌سازی تکراری" icon={<FlaskConical size={14} />} description="قاعده رفتاری هر طرف + تعداد دوره + عامل تنزیل + بذر (تکرارپذیر)">
                    <div className="form-grid">
                      <div className="field"><label className="field-label">دوره‌ها (۱ تا ۲۰۰)</label><input value={simRounds} onChange={e => setSimRounds(e.target.value)} inputMode="numeric" /></div>
                      <div className="field"><label className="field-label">عامل تنزیل δ (۰ تا ۱)</label><input value={simDelta} onChange={e => setSimDelta(e.target.value)} inputMode="decimal" /></div>
                      <div className="field"><label className="field-label">قاعده خود</label>
                        <select value={simSelfRule} onChange={e => setSimSelfRule(e.target.value)}>{Object.entries(RULES_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      </div>
                      <div className="field"><label className="field-label">قاعده رقیب</label>
                        <select value={simRivalRule} onChange={e => setSimRivalRule(e.target.value)}>{Object.entries(RULES_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      </div>
                      <div className="field full"><label className="field-label">بذر (اختیاری؛ خالی = شناسه سناریو)</label><input value={simSeed} onChange={e => setSimSeed(e.target.value)} dir="ltr" /></div>
                    </div>
                    {canWrite && <div className="row-actions"><button className="btn btn-primary" disabled={busy === 'sim'} onClick={runSimulate}><FlaskConical size={14} /> اجرای شبیه‌سازی</button></div>}
                    {sim && (
                      <>
                        <div className="stat-grid">
                          <StatCard icon={<Target size={16} />} iconClass="ic-blue" label="عایدی انباشته خود" value={fmtNum(sim.totals.self)} sub={`تنزیل‌شده: ${fmtNum(sim.totals.discSelf)}`} />
                          <StatCard icon={<Target size={16} />} iconClass="ic-orange" label="عایدی انباشته رقیب" value={fmtNum(sim.totals.rival)} sub={`تنزیل‌شده: ${fmtNum(sim.totals.discRival)}`} />
                          <StatCard icon={<CheckCircle2 size={16} />} iconClass="ic-green" label="همکاری دوطرفه" value={`${fmtNum(sim.coopJointRate)}٪`} sub={`${RULES_FA[sim.rules.self]} در برابر ${RULES_FA[sim.rules.rival]}`} />
                        </div>
                        <div className="table-wrap"><table><thead><tr><th>دور</th><th>خود</th><th>رقیب</th><th>عایدی خود</th><th>عایدی رقیب</th></tr></thead>
                          <tbody>{sim.history.map(h => <tr key={h.round}><td>{fmtNum(h.round)}</td><td>{sim.selfStrats[h.self]}</td><td>{sim.rivalStrats[h.rival]}</td><td>{fmtNum(h.paySelf)}</td><td>{fmtNum(h.payRival)}</td></tr>)}</tbody></table></div>
                      </>
                    )}
                  </SectionCard>
                </>
              )}
            </>
          )}

          {tab === 'predict' && (
            <>
              {!selected && <p className="t-muted">ابتدا در «نمای کلی» یک سناریو انتخاب کنید.</p>}
              {selected?.kind === 'sequential' && <p className="t-muted">پیش‌بینی مخصوص سناریوی ماتریسی است؛ سناریوی ترتیبی مسیر تعادل خودش را دارد.</p>}
              {selected?.kind === 'normal' && (
                <>
                  <SectionCard title="پیش‌بینی حرکت بعدی رقیب" icon={<Telescope size={14} />} description="از تاریخچهٔ آخرین شبیه‌سازی؛ توصیه = بهترین پاسخ به توزیع پیش‌بینی‌شده">
                    {canWrite && <div className="row-actions"><button className="btn btn-primary" disabled={busy === 'pred'} onClick={runPredict}><Telescope size={14} /> پیش‌بینی از آخرین شبیه‌سازی</button></div>}
                    {!pred && <p className="t-muted">هنوز پیش‌بینی اجرا نشده؛ اگر شبیه‌سازی هم نکرده‌اید اول در تب شبیه‌سازی اجرا کنید.</p>}
                    {pred && (
                      <>
                        <div className="stat-grid">
                          <StatCard icon={<Users2 size={16} />} iconClass="ic-orange" label="حرکت پیش‌بینی‌شده رقیب" value={pred.predictedLabel} sub={`از ${fmtNum(pred.total)} دور تاریخچه${pred.predictedTie ? ' (تساوی فراوانی)' : ''}`} />
                          <StatCard icon={<Target size={16} />} iconClass="ic-green" label="واکنش توصیه‌شده" value={pred.recommendLabel} sub="بهترین پاسخ به توزیع پیش‌بینی‌شده" />
                          <StatCard icon={<Info size={16} />} iconClass="ic-blue" label="تطابق الگوی تلافی‌مثل" value={pred.tftMatchRate == null ? '—' : `${fmtNum(pred.tftMatchRate)}٪`} />
                        </div>
                        <h4>توزیع پیش‌بینی رقیب</h4>
                        {pred.rivalStrats.map((r, j) => (
                          <div key={j} className="dist-row"><span>{r}</span>
                            <div className="dist-bar"><div className="dist-fill" style={{ width: `${(pred.dist[j] ?? 0) * 100}%` }} /></div>
                            <span>{fmtNum(Math.round((pred.dist[j] ?? 0) * 100))}٪</span>
                          </div>
                        ))}
                        <h4>عایدی موردانتظار راهبردهای خود</h4>
                        <div className="table-wrap"><table><thead><tr><th>راهبرد خود</th><th>عایدی موردانتظار</th><th>توصیه</th></tr></thead>
                          <tbody>{pred.selfStrats.map((s, i) => <tr key={i}><td>{s}</td><td>{fmtNum(pred.expPaySelf[i])}</td><td>{i === pred.recommend ? '✓' : ''}</td></tr>)}</tbody></table></div>
                      </>
                    )}
                  </SectionCard>
                  <SectionCard title="چه می‌شود اگر…" icon={<Sparkles size={14} />} description="اگر رقیب یک حرکت مشخص بزند، بهترین واکنش شما چیست؟ (محاسبه مستقیم از ماتریس)">
                    <div className="form-grid">
                      <div className="field"><label className="field-label">حرکت فرضی رقیب</label>
                        <select value={whatRival} onChange={e => setWhatRival(Number(e.target.value))}>
                          {selected.rivalStrats.map((r, j) => <option key={j} value={j}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                    {whatBest >= 0 && <p>بهترین واکنش: <strong>{selected.selfStrats[whatBest]}</strong> — عایدی شما {fmtNum(selected.paySelf[whatBest]?.[whatRival])} و رقیب {fmtNum(selected.payRival[whatBest]?.[whatRival])}.</p>}
                  </SectionCard>
                </>
              )}
            </>
          )}

          {tab === 'output' && (
            <>
              {!selected && <p className="t-muted">ابتدا در «نمای کلی» یک سناریو انتخاب کنید.</p>}
              {selected && (
                <>
                  <SectionCard title="بریف یک‌صفحه‌ای" icon={<FileDown size={14} />} description="خلاصهٔ تصمیم برای هیئت؛ با دکمه کپی">
                    <div className="row-actions"><button className="btn" disabled={busy === 'brief'} onClick={loadBrief}><RefreshCw size={14} /> ساخت بریف</button>
                      {!!brief.length && <button className="btn" onClick={copyBrief}><Copy size={14} /> کپی بریف</button>}</div>
                    {!!brief.length && <ol>{brief.map((l, i) => <li key={i}>{l}</li>)}</ol>}
                  </SectionCard>
                  <SectionCard title="دانلود خروجی" icon={<Download size={14} />} description="سناریوی منتخب با تحلیل و آخرین شبیه‌سازی">
                    <div className="row-actions">
                      <button className="btn" disabled={busy === 'exp:json'} onClick={() => downloadExport('json')}><FileJson size={14} /> خروجی JSON</button>
                      <button className="btn" disabled={busy === 'exp:csv'} onClick={() => downloadExport('csv')}><FileSpreadsheet size={14} /> دانلود CSV</button>
                      <button className="btn" disabled={busy === 'exp:xls'} onClick={() => downloadExport('xls')}><FileSpreadsheet size={14} /> دانلود Excel</button>
                    </div>
                  </SectionCard>
                </>
              )}
            </>
          )}
        </>
      )}

      <Modal open={tplOpen} title="ساخت سناریو از قالب" description={tplArch ? `${tplArch.fa} — ${tplArch.story}` : ''} onClose={() => setTplOpen(false)}
        footer={<><button className="btn" onClick={() => setTplOpen(false)}>انصراف</button><button className="btn btn-primary" disabled={busy === 'tpl'} onClick={createFromArchetype}><Plus size={14} /> ساخت سناریو</button></>}>
        <div className="form-grid">
          <div className="field full"><label className="field-label">نام سناریو</label><input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="مثلاً: رقابت قیمتی بهار" /></div>
        </div>
      </Modal>
    </div>
  );
}
