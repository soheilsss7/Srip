'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, apiBlob, unwrapList } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, Modal, PageHeader, SectionCard, StatCard, StatusBadge, Toolbar } from '../_components/page-ui';
import {
  Building2, Users2, Radar, AlertTriangle, Download, FileJson, FileSpreadsheet,
  Plus, RefreshCw, Trash2, SlidersHorizontal, Megaphone, Newspaper, Target, Eye, Heart,
  CheckCircle2, ChevronLeft, Layers, Landmark, GraduationCap, Briefcase, Newspaper as News2, Cpu,
  Copy, Sparkles, UserPlus, Pencil, RotateCcw, Power, Grid3x3, History, TrendingDown,
  Radio, ClipboardList, Search,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  عموم‌ها (Publics) — شناسنامهٔ سازمان، بازیگران و شکاف‌ها                      */
/*  GET catalog/self/:orgId · groups/:orgId · members · coverage · gaps */
/*  PUT self/:orgId · groups CRUD · POST/PATCH/DELETE members · export  */
/* ------------------------------------------------------------------ */

type CatMeta = { id: string; fa: string };
type PubGroup = {
  id: string; cat: string; fa: string; link: string; stage: [string, string];
  stance: string; kanal: string; note?: string;
};
type PubTpl = { id: string; fa: string; focus: string[]; note?: string; groups?: PubGroup[] };
type EffGroup = {
  id: string; cat: string; fa: string; link: string; stage: [string, string];
  stance: string; kanal: string; note: string; source: 'template' | 'custom';
  overridden: boolean; active: boolean; templateNote: string;
};
type GroupTotals = { total: number; active: number; inactive: number; custom: number; overridden: number };
type GroupsResp = { orgId: string; orgName: string | null; templateId: string; templateFa: string; groups: EffGroup[]; totals: GroupTotals };
type Catalog = {
  version: number; categories: CatMeta[]; linkages: Record<string, string>;
  stages: Record<string, string>; stances: Record<string, string>; templates: Record<string, PubTpl>;
};
type SelfRow = {
  orgId: string; orgName?: string | null; self: {
    orgId: string; companyType: string; templateId: string;
    structure: { sectors?: string[]; subsidiaries?: string[]; ownership?: string };
    missionTopic: string | null; reviewedAt: string | null; reviewIntervalDays: number; updatedBy?: string | null;
  } | null;
  template: { id: string; fa: string; focus: string[]; groups: number };
  structure: { sectors?: string[]; subsidiaries?: string[]; ownership?: string } | null;
  missionTopic: string | null; reviewedAt: string | null; reviewIntervalDays: number;
  effective: { total: number; active: number; custom: number; overridden: number } | null;
  coverage: CovTotals; templateCatalog: Catalog | null;
};
type MemberView = {
  id: string; orgId: string; groupId: string; sourceType: string; sourceId: string;
  linkage: string; stage: string; power: number; interest: number; stance: string; note?: string;
  assessedAt?: string | null; reviewDue?: string | null; orgName?: string | null; sourceName?: string | null;
  sourceLabel?: string; groupFa?: string | null; categoryId?: string | null; categoryFa?: string | null;
  linkageFa?: string | null; stageFa?: string | null; stanceFa?: string | null; kanal?: string | null;
  signals?: number; suggested?: { linkage: string; stage: string; power: number; interest: number; stance: string };
  stanceHistory?: StanceHistoryEntry[];
};
type StanceHistoryEntry = {
  at: string; fromStance: string; toStance: string; cause: string;
  causeNote?: string | null; source?: string | null; by?: string | null;
};
type CovRow = {
  categoryId: string; fa: string; expected: number; covered: number; members: number;
  stages: Record<string, number>; stances: Record<string, number>; coveragePct: number;
  criticalGaps: string[]; gapGroups: string[];
};
type CovTotals = {
  categories: number; groupsExpected: number; groupsCovered: number; members: number;
  keyPlayers: number; active: number; gaps: number; criticalGaps: number;
};
type Coverage = {
  orgId: string; orgName: string | null; companyType: string | null; templateId: string | null;
  templateFa: string | null; missionTopic: string | null; reviewedAt: string | null;
  reviewIntervalDays: number; generatedAt: string; byCategory: CovRow[]; totals: CovTotals;
};
type GapPathSuggestion = {
  category: string; categoryFa?: string | null;
  route: Array<{ id: string; label: string }>;
  hops: number; direct: boolean; bridges?: string[];
  note?: string; candidates?: string[];
};
type GapRow = {
  gapId: string; groupId?: string | null; groupFa?: string | null; categoryId?: string | null;
  categoryFa?: string | null; kind: 'missing' | 'lagging'; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  stance?: string | null; stanceFa?: string | null; memberId?: string | null; sourceName?: string | null; action?: string;
  pathSuggestion?: GapPathSuggestion | null;
};
type GapsResp = { orgId: string; generatedAt: string; totals: CovTotals & { missing?: number; lagging?: number }; gaps: GapRow[] };
type MediaRow = { id: string; name: string; type: string; url?: string | null; audience?: string | null; country?: string | null; note?: string | null; createdAt: string };
type OrgMini = { id: string; name: string; type?: string | null };
type PersonMini = { id: string; firstName?: string; lastName?: string; title?: string | null; organization?: { name?: string } | null };
type RelMini = { id: string; sourceOrganization?: { name?: string } | null; targetOrganization?: { name?: string } | null; relationshipType?: string };

const CAT_ICONS: Record<string, React.ReactNode> = {
  INTERNAL: <Users2 size={14} />, INSTITUTIONAL: <Landmark size={14} />, ACADEMIC: <GraduationCap size={14} />,
  ECONOMIC: <Briefcase size={14} />, MEDIA: <News2 size={14} />, ECOSYSTEM: <Cpu size={14} />,
};
const CAT_COLORS: Record<string, string> = {
  INTERNAL: '#0f9b8e', INSTITUTIONAL: '#7c3aed', ACADEMIC: '#2563eb', ECONOMIC: '#d97706',
  MEDIA: '#dc2626', ECOSYSTEM: '#16a34a',
};
const STANCE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  KEY_PLAYER: 'success', INFLUENCER: 'warning', SUPPORTER: 'info', OBSERVER: 'neutral',
};
const STAGE_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success', AWARE: 'info', LATENT: 'warning', NON_PUBLIC: 'neutral',
};
const MEDIA_TYPE_OPTIONS = [
  ['TECH_MEDIA', 'رسانه تخصصی فناوری'], ['ECONOMIC_MEDIA', 'رسانه اقتصادی'], ['GENERAL_MEDIA', 'رسانه عمومی'],
  ['INFLUENCER', 'اینفلوئنسر/خبرنگار'], ['OTHER', 'سایر'],
];
const SOURCE_LABELS: Record<string, string> = {
  organization: 'سازمان', person: 'شخص', relationship: 'رابطه', media: 'رسانه',
};

const fmtNum = (v: unknown) => (v == null || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));
const fmtDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fa-IR', { day: 'numeric', month: 'short', year: '2-digit' });
};
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/* ═══════════════════════════════════════════════════════════════════════
   مسترپلن فاز ۱/۳+۴ — ماتریس نفوذ×حمایت (الگوی Prolifiq: درگ‌اند‌دراپ)
   + تاریخچهٔ موضع با علت‌یابی (الگوی Squivr/ArcSight)
   ═══════════════════════════════════════════════════════════════════════ */
const STANCE_RANK: Record<string, number> = { OBSERVER: 0, SUPPORTER: 1, INFLUENCER: 2, KEY_PLAYER: 3 };
/* پالت معنایی نواحی: متحدِ پرنفوذ = سبز · قدرتمندِ کم‌حمایت = کهربایی · حامیِ کم‌نفوذ = آبی · ناظر = خاکستری */
const STANCE_DOT_COLOR: Record<string, string> = {
  KEY_PLAYER: '#16a34a', INFLUENCER: '#d97706', SUPPORTER: '#2563eb', OBSERVER: '#94a3b8',
};
const STANCE_FA: Record<string, string> = {
  KEY_PLAYER: 'بازیگر کلیدی', INFLUENCER: 'تأثیرگذار', SUPPORTER: 'حامی', OBSERVER: 'ناظر',
};
/* نواحی ماتریس با همان آستانهٔ موتور ارزیابی (۶۰/۶۰) — رنگ هر نقطه همیشه با ناحیه‌اش می‌خواند */
const ZONE_TH = 60;
const ZONES: Array<{ id: string; pos: 'tr' | 'tl' | 'br' | 'bl'; title: string; action: string }> = [
  { id: 'KEY_PLAYER', pos: 'tr', title: 'متحدان کلیدی', action: 'مدیریت نزدیک — تعامل منظم و مشارکت در تصمیم' },
  { id: 'INFLUENCER', pos: 'tl', title: 'قدرتمندان محتاط', action: 'راضی نگه‌داشتن — بدون اتلاف منابع' },
  { id: 'SUPPORTER', pos: 'br', title: 'حامیان عملیاتی', action: 'مطلع نگه‌داشتن و توانمندسازی' },
  { id: 'OBSERVER', pos: 'bl', title: 'ناظران', action: 'پایش دوره‌ای با حداقل هزینه' },
];
const zoneBoxStyle = (pos: 'tr' | 'tl' | 'br' | 'bl') => {
  const L = ZONE_TH, R = 100 - ZONE_TH;
  if (pos === 'tr') return { left: `${L}%`, top: 0, width: `${R}%`, height: `${R}%` };
  if (pos === 'tl') return { left: 0, top: 0, width: `${L}%`, height: `${R}%` };
  if (pos === 'br') return { left: `${L}%`, top: `${R}%`, width: `${R}%`, height: `${L}%` };
  return { left: 0, top: `${R}%`, width: `${L}%`, height: `${L}%` };
};
const zoneLabelStyle = (pos: 'tr' | 'tl' | 'br' | 'bl'): Record<string, string | number> => {
  if (pos === 'tr') return { top: 6, right: 8 };
  if (pos === 'tl') return { top: 6, left: 8 };
  if (pos === 'br') return { bottom: 18, right: 8 };
  return { bottom: 18, left: 8 };
};
const memberInitials = (m: MemberView) => {
  const name = (m.sourceName ?? m.id ?? '').replace(/[()«»]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) return '·';
  const words = name.split(' ').filter(w => w.length > 1);
  if (!words.length) return name.slice(0, 2);
  if (words.length === 1) return words[0].slice(0, 2);
  return `${words[0][0]}${words[1][0]}`;
};
const STANCE_CAUSES: Array<[string, string]> = [
  ['INTERACTION', 'تعامل مستقیم ما'], ['THIRD_PARTY', 'تأثیر شخص سوم'], ['POLICY', 'تغییر سیاست/تنظیم‌گری'],
  ['MARKET', 'تحول بازار'], ['COMPETITOR', 'اقدام رقیب'], ['INTERNAL', 'تحول درون سازمان آنها'],
  ['MEDIA', 'پوشش رسانه‌ای'], ['OTHER', 'سایر'],
];
const stanceOfPI = (p: number, i: number) => (p >= ZONE_TH && i >= ZONE_TH) ? 'KEY_PLAYER' : p >= ZONE_TH ? 'INFLUENCER' : i >= ZONE_TH ? 'SUPPORTER' : 'OBSERVER';
const causeLabel = (c: string) => STANCE_CAUSES.find(x => x[0] === c)?.[1] ?? c;
const isDecliningMember = (m: MemberView) => {
  const h = m.stanceHistory ?? [];
  if (!h.length) return false;
  const last = h[h.length - 1];
  return (STANCE_RANK[last.toStance] ?? 0) < (STANCE_RANK[last.fromStance] ?? 0);
};

function MatrixTab({ members, canWrite, onSave, onNotify, openAssess }: {
  members: MemberView[];
  canWrite: boolean;
  onSave: (m: MemberView, power: number, interest: number, cause?: string, causeNote?: string) => Promise<boolean>;
  onNotify: (msg: string) => void;
  openAssess: (m: MemberView) => void;
}) {
  const [cat, setCat] = useState('');
  const [declining, setDeclining] = useState(false);
  const [selId, setSelId] = useState('');
  const [pos, setPos] = useState<Record<string, { p: number; i: number }>>({});
  const [dragId, setDragId] = useState('');
  const [hoverId, setHoverId] = useState('');
  const [pending, setPending] = useState<{ m: MemberView; p: number; i: number } | null>(null);
  const [cause, setCause] = useState('INTERACTION');
  const [causeNote, setCauseNote] = useState('');
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const cats = [...new Set(members.map(m => m.categoryId).filter(Boolean))] as string[];
  const catFa = (c: string) => members.find(m => m.categoryId === c)?.categoryFa ?? c;
  const shown = members.filter(m => (!cat || m.categoryId === cat) && (!declining || isDecliningMember(m)));
  const getPI = (m: MemberView) => pos[m.id] ?? { p: m.power ?? 50, i: m.interest ?? 50 };
  const sel = members.find(m => m.id === selId) ?? null;
  const focus = shown.find(m => m.id === (hoverId || selId)) ?? null;
  const fpi = focus ? getPI(focus) : null;
  const zoneMembers = (z: string) => shown.filter(m => stanceOfPI(getPI(m).p, getPI(m).i) === z);

  const apply = async (m: MemberView, p: number, i: number, c?: string, note?: string) => {
    setBusy(true);
    const ok = await onSave(m, Math.round(p), Math.round(i), c, note);
    setBusy(false);
    return ok;
  };
  const finalize = (m: MemberView, p: number, i: number) => {
    if (!canWrite) { onNotify('برای جابه‌جایی نقطه‌ها مجوز «مدیریت عموم‌ها» لازم است.'); return; }
    if (stanceOfPI(p, i) !== m.stance) { setPending({ m, p, i }); setCause('INTERACTION'); setCauseNote(''); }
    else void apply(m, p, i);
  };
  const ptToPI = (clientX: number, clientY: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return null;
    return { i: clamp(Math.round((clientX - box.left) / box.width * 100)), p: clamp(Math.round((1 - (clientY - box.top) / box.height) * 100)) };
  };
  const TICKS = [0, 20, 40, 60, 80, 100];

  return (
    <div className="stack" style={{ gap: 14 }}>
      <SectionCard
        title="ماتریس نفوذ × حمایت"
        icon={<Target size={15} />}
        description="جابه‌جایی نقطه‌ها با درگ یا اسلایدر — مرز نواحی همان آستانهٔ موتور ارزیابی (۶۰) است و رنگ هر نقطه با ناحیه‌اش می‌خواند؛ تغییر موضع بدون ثبت «علت» پذیرفته نمی‌شود."
        actions={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <select aria-label="فیلتر دسته" value={cat} onChange={e => setCat(e.target.value)}>
              <option value="">همهٔ دسته‌ها</option>
              {cats.map(c => <option key={c} value={c}>{catFa(c)}</option>)}
            </select>
            <button className={`chip ${declining ? 'danger' : 'neutral'}`} style={{ border: 'none', cursor: 'pointer' }}
              onClick={() => setDeclining(v => !v)} title="فقط اعضایی که آخرین تغییر موضعشان نزولی بوده">
              <TrendingDown size={12} /> روند نزولی
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          {/* ── بوم ماتریس ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)' }}>نفوذ (قدرت) ↑</span>
              <span className="t-muted" style={{ fontSize: 10.5 }}>مقیاس هر محور: ۰ تا ۱۰۰ · آستانهٔ ناحیه‌ها: {fmtNum(ZONE_TH)}</span>
            </div>
            <div
              ref={boxRef}
              role="application"
              aria-label="ماتریس نفوذ و حمایت — محور افقی: حمایت (علاقه)؛ محور عمودی: نفوذ (قدرت)"
              style={{
                position: 'relative', height: 'clamp(300px, 46vw, 430px)', border: '1px solid var(--border,#e2e8f0)', borderRadius: 12,
                background: 'var(--card-bg,#fff)', overflow: 'hidden',
                touchAction: 'none', userSelect: 'none',
              }}
              onPointerMove={e => {
                if (!dragId) return;
                const pi = ptToPI(e.clientX, e.clientY);
                if (pi) setPos(pp => ({ ...pp, [dragId]: pi }));
              }}
              onPointerUp={e => {
                if (!dragId) return;
                const m = members.find(x => x.id === dragId);
                const pi = ptToPI(e.clientX, e.clientY) ?? getPI(m ?? ({ id: dragId } as MemberView));
                setDragId('');
                if (m) finalize(m, pi.p, pi.i);
              }}
              onPointerLeave={() => setDragId('')}
            >
              {/* نواحی رنگی — مرز روی آستانهٔ ۶۰ (همان موتور ارزیابی) */}
              {ZONES.map(z => (
                <div key={z.id} aria-hidden style={{ position: 'absolute', ...zoneBoxStyle(z.pos), background: `color-mix(in srgb, ${STANCE_DOT_COLOR[z.id]} 6%, transparent)` }} />
              ))}
              {/* خطوط راهنمای کم‌رنگ ۲۰/۴۰/۸۰ */}
              {[20, 40, 80].map(v => (
                <div key={`gv-${v}`} aria-hidden style={{ position: 'absolute', left: `${v}%`, top: 0, bottom: 0, borderLeft: '1px dashed color-mix(in srgb, var(--border,#e2e8f0) 70%, transparent)' }} />
              ))}
              {[20, 40, 80].map(v => (
                <div key={`gh-${v}`} aria-hidden style={{ position: 'absolute', top: `${100 - v}%`, left: 0, right: 0, borderTop: '1px dashed color-mix(in srgb, var(--border,#e2e8f0) 70%, transparent)' }} />
              ))}
              {/* مرز نواحی (آستانهٔ ۶۰) */}
              <div aria-hidden style={{ position: 'absolute', left: `${ZONE_TH}%`, top: 0, bottom: 0, borderLeft: '2px solid color-mix(in srgb, var(--border,#94a3b8) 80%, transparent)' }} />
              <div aria-hidden style={{ position: 'absolute', top: `${100 - ZONE_TH}%`, left: 0, right: 0, borderTop: '2px solid color-mix(in srgb, var(--border,#94a3b8) 80%, transparent)' }} />
              {/* درجه‌بندی محور حمایت (پایین) */}
              {TICKS.map(v => (
                <span key={`t-b-${v}`} aria-hidden style={{ position: 'absolute', bottom: 2, left: `${v}%`, transform: v === 0 ? 'none' : v === 100 ? 'translateX(-100%)' : 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: 'var(--text-muted,#94a3b8)' }}>{fmtNum(v)}</span>
              ))}
              {/* درجه‌بندی محور نفوذ (چپ) */}
              {TICKS.map(v => (
                <span key={`t-l-${v}`} aria-hidden style={{ position: 'absolute', left: 3, top: `${100 - v}%`, transform: v === 0 ? 'none' : v === 100 ? 'translateY(-100%)' : 'translateY(-50%)', fontSize: 9, fontWeight: 700, color: 'var(--text-muted,#94a3b8)' }}>{fmtNum(v)}</span>
              ))}
              {/* برچسب نواحی + شمار اعضای هر ناحیه */}
              {ZONES.map(z => (
                <span key={`zl-${z.id}`} style={{ position: 'absolute', ...zoneLabelStyle(z.pos), display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 99, background: 'color-mix(in srgb, var(--card-bg,#fff) 82%, transparent)', border: `1px solid color-mix(in srgb, ${STANCE_DOT_COLOR[z.id]} 35%, transparent)`, fontSize: 10, fontWeight: 800, color: STANCE_DOT_COLOR[z.id], pointerEvents: 'none' }}>
                  {z.title} · {fmtNum(zoneMembers(z.id).length)}
                </span>
              ))}
              {/* نشانگر متقاطع عضو کانونی */}
              {fpi && focus && (
                <>
                  <div aria-hidden style={{ position: 'absolute', left: `${fpi.i}%`, top: 0, bottom: 0, borderLeft: '1px dashed color-mix(in srgb, var(--border,#475569) 55%, transparent)', zIndex: 2 }} />
                  <div aria-hidden style={{ position: 'absolute', top: `${100 - fpi.p}%`, left: 0, right: 0, borderTop: '1px dashed color-mix(in srgb, var(--border,#475569) 55%, transparent)', zIndex: 2 }} />
                  <div style={{ position: 'absolute', left: `min(max(${fpi.i}%, 90px), calc(100% - 90px))`, top: `max(${100 - fpi.p}%, 26px)`, transform: 'translate(-50%, -130%)', zIndex: 3, pointerEvents: 'none', whiteSpace: 'nowrap', fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: 'var(--card-bg,#fff)', border: '1px solid var(--border,#cbd5e1)', boxShadow: '0 2px 10px rgba(15,23,42,.14)' }}>
                    {focus.sourceName ?? focus.id} — نفوذ {fmtNum(fpi.p)} · حمایت {fmtNum(fpi.i)}
                  </div>
                </>
              )}
              {/* نقطه‌های اعضا — علائم اختصاری داخل نقطه */}
              {shown.map(m => {
                const pi = getPI(m);
                const isSel = m.id === selId;
                const isFocus = m.id === (hoverId || selId);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-label={`${m.sourceName ?? m.id} — نفوذ ${fmtNum(pi.p)}، حمایت ${fmtNum(pi.i)}، موضع ${m.stanceFa ?? m.stance}`}
                    title={`${m.sourceName ?? m.id} — نفوذ ${fmtNum(pi.p)} / حمایت ${fmtNum(pi.i)} (${m.stanceFa ?? m.stance})`}
                    onPointerDown={e => {
                      e.preventDefault();
                      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                      setSelId(m.id);
                      setDragId(m.id);
                    }}
                    onPointerEnter={() => setHoverId(m.id)}
                    onPointerLeave={() => setHoverId('')}
                    onClick={() => setSelId(m.id)}
                    style={{
                      position: 'absolute', left: `${pi.i}%`, bottom: `${pi.p}%`,
                      width: isFocus ? 26 : 20, height: isFocus ? 26 : 20, borderRadius: '50%',
                      transform: 'translate(-50%, 50%)', border: isSel ? '3px solid #0f172a' : '2px solid rgba(255,255,255,.9)',
                      background: STANCE_DOT_COLOR[m.stance] ?? '#94a3b8', color: '#fff',
                      fontSize: 9, fontWeight: 800, lineHeight: 1, display: 'grid', placeItems: 'center', padding: 0,
                      cursor: canWrite ? 'grab' : 'pointer', zIndex: isFocus ? 5 : 4,
                      boxShadow: isFocus ? '0 0 0 5px color-mix(in srgb, currentColor 18%, transparent), 0 3px 10px rgba(15,23,42,.25)' : '0 2px 6px rgba(15,23,42,.22)',
                      transition: dragId === m.id ? 'none' : 'left .15s, bottom .15s, width .12s, height .12s',
                    }}
                  >{memberInitials(m)}</button>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)' }}>حمایت (علاقه) →</span>
            </div>
          </div>

          {/* ── راهنمای نواحی: عنوان ناحیه، شمار، اقدام راهبردی و اعضای برجسته ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: 8 }}>
            {ZONES.map(z => {
              const zm = zoneMembers(z.id).sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
              const pct = shown.length ? Math.round(zm.length / shown.length * 100) : 0;
              return (
                <div key={`zc-${z.id}`} className="panel" style={{ margin: 0, padding: '10px 12px', borderInlineStart: `3px solid ${STANCE_DOT_COLOR[z.id]}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <b style={{ fontSize: 12.5, color: STANCE_DOT_COLOR[z.id] }}>{z.title}</b>
                    <span className="chip neutral" title={`${fmtNum(zm.length)} از ${fmtNum(shown.length)} عضو`}>{fmtNum(zm.length)} عضو · {fmtNum(pct)}٪</span>
                  </div>
                  <div className="t-muted" style={{ fontSize: 10.5, marginTop: 2 }}>{z.action}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
                    {zm.slice(0, 3).map(m => (
                      <button key={`zc-m-${m.id}`} type="button" className="chip neutral" style={{ border: 'none', cursor: 'pointer', fontSize: 10.5 }}
                        onClick={() => { setCat(''); setSelId(m.id); }} title={`${m.sourceName ?? m.id} — نفوذ ${fmtNum(getPI(m).p)} / حمایت ${fmtNum(getPI(m).i)}`}>
                        {m.sourceName ?? m.id}
                      </button>
                    ))}
                    {zm.length > 3 && <span className="chip neutral" style={{ fontSize: 10.5 }}>+{fmtNum(zm.length - 3)} دیگر</span>}
                    {!zm.length && <span className="t-muted" style={{ fontSize: 10.5 }}>عضوی در این ناحیه نیست</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {pending && (
            <div className="notice" role="dialog" aria-label="ثبت علت تغییر موضع" style={{ border: '1px solid var(--gold,#f59e0b)', background: 'color-mix(in srgb, var(--gold,#f59e0b) 8%, transparent)' }}>
              <b>علت تغییر موضع «{pending.m.sourceName ?? pending.m.id}» را ثبت کنید</b>
              <p style={{ fontSize: 12, margin: '6px 0' }}>
                {pending.m.stanceFa ?? pending.m.stance} ({STANCE_FA[stanceOfPI(pending.m.power ?? 50, pending.m.interest ?? 50)] ?? '—'}) → {STANCE_FA[stanceOfPI(pending.p, pending.i)] ?? '—'} با {fmtNum(pending.p)}٪ نفوذ / {fmtNum(pending.i)}٪ حمایت
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="field" style={{ margin: 0 }}>
                  <label className="field-label" htmlFor="mx-cause">علت</label>
                  <select id="mx-cause" value={cause} onChange={e => setCause(e.target.value)}>
                    {STANCE_CAUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="field" style={{ margin: 0, flex: '1 1 220px' }}>
                  <label className="field-label" htmlFor="mx-cause-note">یادداشت علت</label>
                  <input id="mx-cause-note" value={causeNote} onChange={e => setCauseNote(e.target.value)} placeholder="چه اتفاقی این تغییر را درگیرد؟" />
                </div>
                <button className="btn btn-primary" disabled={busy} onClick={async () => {
                  const ok = await apply(pending.m, pending.p, pending.i, cause, causeNote.trim() || undefined);
                  if (ok) setPending(null);
                }}><CheckCircle2 size={14} /> ثبت موضع جدید</button>
                <button className="btn btn-ghost" onClick={() => setPending(null)}>انصراف</button>
              </div>
            </div>
          )}

          {/* ── پنل جزئیات عضو انتخاب‌شده ── */}
          {sel && (
            <div className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div>
                  <h3 style={{ fontSize: 14 }}>{sel.sourceName ?? sel.id}</h3>
                  <p style={{ fontSize: 12 }}>{sel.groupFa ?? '—'} {sel.categoryFa ? `· ${sel.categoryFa}` : ''} · ارزیابی: {fmtDT(sel.assessedAt)}{sel.kanal ? ` · کانال: ${sel.kanal}` : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge tone={STANCE_TONE[sel.stance] ?? 'neutral'}>{sel.stanceFa ?? sel.stance}</Badge>
                  <span className="chip neutral" style={{ fontSize: 10.5 }}>{ZONES.find(z => z.id === stanceOfPI(getPI(sel).p, getPI(sel).i))?.title ?? '—'}</span>
                </div>
              </div>

              {/* سنجه‌های نفوذ/حمایت — نوار درجه‌بندی‌شده */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, margin: '10px 0' }}>
                {([['نفوذ (قدرت)', getPI(sel).p, '#0f172a'], ['حمایت (علاقه)', getPI(sel).i, '#2563eb']] as const).map(([label, val, color]) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                      <span>{label}</span><b>{fmtNum(val)} <span className="t-muted" style={{ fontWeight: 400 }}>از ۱۰۰</span></b>
                    </div>
                    <div style={{ height: 9, borderRadius: 99, background: 'color-mix(in srgb, var(--border,#e2e8f0) 55%, transparent)', overflow: 'hidden', marginTop: 4, position: 'relative' }}>
                      <div style={{ height: '100%', width: `${clamp(val)}%`, background: color, borderRadius: 99, transition: 'width .2s' }} />
                      <div aria-hidden style={{ position: 'absolute', left: `${ZONE_TH}%`, top: -2, bottom: -2, borderLeft: '2px dashed rgba(71,85,105,.45)' }} title={`آستانهٔ ناحیه: ${fmtNum(ZONE_TH)}`} />
                    </div>
                  </div>
                ))}
              </div>

              {canWrite && (
                <div style={{ display: 'grid', gap: 8, margin: '10px 0' }}>
                  <label style={{ fontSize: 12, display: 'grid', gap: 4 }}>
                    نفوذ (قدرت): <b>{fmtNum(getPI(sel).p)}</b>
                    <input type="range" min={0} max={100} value={getPI(sel).p} aria-label="نفوذ"
                      onChange={e => setPos(pp => ({ ...pp, [sel.id]: { ...getPI(sel), p: Number(e.target.value) } }))} />
                  </label>
                  <label style={{ fontSize: 12, display: 'grid', gap: 4 }}>
                    حمایت (علاقه): <b>{fmtNum(getPI(sel).i)}</b>
                    <input type="range" min={0} max={100} value={getPI(sel).i} aria-label="حمایت"
                      onChange={e => setPos(pp => ({ ...pp, [sel.id]: { ...getPI(sel), i: Number(e.target.value) } }))} />
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" disabled={busy}
                      onClick={() => finalize(sel, getPI(sel).p, getPI(sel).i)}>
                      <SlidersHorizontal size={13} /> ذخیرهٔ جایگاه
                    </button>
                    <button className="btn btn-sm" onClick={() => openAssess(sel)} title="ارزیابی کامل: مرحله، پیوند و یادداشت">
                      <ClipboardList size={13} /> ارزیابی کامل
                    </button>
                  </div>
                </div>
              )}

              <div>
                <h4 style={{ fontSize: 12.5, display: 'flex', gap: 5, alignItems: 'center', margin: '8px 0 6px' }}><History size={13} /> خط زمان موضع و علل</h4>
                {!(sel.stanceHistory ?? []).length ? (
                  <p className="criteria-saved">تغییری ثبت نشده است — با اولین جابه‌جایی، علت آن در همین خط زمان ثبت می‌شود.</p>
                ) : (
                  <ul className="list" style={{ margin: 0 }}>
                    {[...(sel.stanceHistory ?? [])].reverse().map((h, idx) => {
                      const down = (STANCE_RANK[h.toStance] ?? 0) < (STANCE_RANK[h.fromStance] ?? 0);
                      return (
                        <li className="listRow" key={idx} style={{ alignItems: 'flex-start' }}>
                          <span className={`chip ${down ? 'danger' : 'success'}`}>
                            <TrendingDown size={11} style={{ transform: down ? undefined : 'rotate(180deg)' }} />
                            {down ? 'نزول' : 'صعود'}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
                            <b>{fmtDT(h.at)}</b> — {STANCE_FA[h.fromStance] ?? h.fromStance} به {STANCE_FA[h.toStance] ?? h.toStance}
                            <span className="chip neutral" style={{ marginInlineStart: 6 }}>علت: {causeLabel(h.cause)}</span>
                            {h.source === 'MATRIX' && <span className="chip neutral" style={{ marginInlineStart: 6 }}>ماتریس</span>}
                            {h.causeNote ? <small style={{ display: 'block', marginTop: 3 }}>{h.causeNote}</small> : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

/* ═══ مسترپلن فاز ۱/۶ — هیت‌مپ پوشش (الگوی Account Heatmap در DemandFarm) ═══ */
function HeatmapTab({ members, categories }: { members: MemberView[]; categories: { id: string; fa?: string | null }[] }) {
  const sources = useMemo(() => {
    const map = new Map<string, { key: string; name: string; label: string }>();
    members.forEach(m => {
      const key = `${m.sourceType}:${m.sourceId}`;
      if (!map.has(key)) map.set(key, { key, name: m.sourceName ?? m.sourceId, label: SOURCE_LABELS[m.sourceType] ?? m.sourceType });
    });
    return [...map.values()];
  }, [members]);
  const cats = categories.length ? categories : [...new Set(members.map(m => m.categoryId).filter(Boolean))].map(c => ({ id: c as string, fa: members.find(m => m.categoryId === c)?.categoryFa ?? c }));
  const cellOf = (srcKey: string, cat: string) => members.filter(m => `${m.sourceType}:${m.sourceId}` === srcKey && m.categoryId === cat);
  const bestOf = (rows: MemberView[]) => rows.slice().sort((a, b) => (STANCE_RANK[b.stance] ?? 0) - (STANCE_RANK[a.stance] ?? 0))[0];

  return (
    <SectionCard
      title="هیت‌مپ پوشش عمومی"
      icon={<Grid3x3 size={15} />}
      description="سازمان‌ها/منابع × شش دستهٔ عموم — رنگ هر خانه، بهترین موضع ثبت‌شده است؛ خانهٔ خالی یعنی گپ پوشش."
    >
      <div className="table-wrap">
        <table style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--panel,#fff)' }}>منبع</th>
              {cats.map(c => <th key={c.id} style={{ fontSize: 11 }}>{c.fa ?? c.id}</th>)}
            </tr>
          </thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.key}>
                <td style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--panel,#fff)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  <b>{s.name}</b> <span className="t-muted" style={{ fontSize: 10 }}>({s.label})</span>
                </td>
                {cats.map(c => {
                  const rows = cellOf(s.key, c.id);
                  const best = rows.length ? bestOf(rows) : null;
                  return (
                    <td key={c.id} style={{ padding: 4, textAlign: 'center' }}>
                      {best ? (
                        <span className="chip" style={{
                          background: STANCE_DOT_COLOR[best.stance] ?? '#94a3b8', color: '#fff', fontSize: 10.5,
                          border: 'none', padding: '4px 8px', borderRadius: 8,
                        }} title={`${rows.length} عضو — بهترین موضع: ${best.stanceFa ?? best.stance}${rows.length > 1 ? ` (+${fmtNum(rows.length - 1)} دیگر)` : ''}`}>
                          {best.stanceFa ?? best.stance}
                        </span>
                      ) : (
                        <span className="t-muted" style={{ fontSize: 10.5 }} title="بدون پوشش در این دسته — گپ">گپ</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chip-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {Object.entries(STANCE_DOT_COLOR).map(([k, c]) => (
          <span key={k} className="chip neutral"><span style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block' }} /> {members.find(m => m.stance === k)?.stanceFa ?? k}</span>
        ))}
        <span className="chip neutral">{fmtNum(sources.length)} منبع × {fmtNum(cats.length)} دسته</span>
      </div>
    </SectionCard>
  );
}

export default function PublicsPage() {
  const { me, scopeId, can } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');
  const canRead = isOwner || can('publics.read');
  const canWrite = isOwner || can('publics.write');

  const primaryOrg = me?.memberships.find(m => m.isPrimary)?.organizationId ?? me?.memberships?.[0]?.organizationId ?? '';
  const [orgId, setOrgId] = useState<string>(() => (scopeId !== 'all' ? scopeId : primaryOrg));
  useEffect(() => { if (orgId !== scopeId && scopeId !== 'all') setOrgId(scopeId); }, [scopeId, orgId]);
  useEffect(() => { if (!orgId && primaryOrg) setOrgId(primaryOrg); }, [orgId, primaryOrg]);

  const [tab, setTab] = useState<'groups' | 'members' | 'matrix' | 'heatmap' | 'gaps' | 'media' | 'export'>('groups');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selfRow, setSelfRow] = useState<SelfRow | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [gaps, setGaps] = useState<GapsResp | null>(null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [orgs, setOrgs] = useState<OrgMini[]>([]);
  const [people, setPeople] = useState<PersonMini[]>([]);
  const [rels, setRels] = useState<RelMini[]>([]);
  const [groups, setGroups] = useState<EffGroup[]>([]);
  const [groupTotals, setGroupTotals] = useState<GroupTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState('');

  /* filters */
  const [fCat, setFCat] = useState('');
  const [fStance, setFStance] = useState('');
  const [fStage, setFStage] = useState('');
  const [q, setQ] = useState('');
  const [gCat, setGCat] = useState('');
  const [gSrc, setGSrc] = useState('');
  const [gQ, setGQ] = useState('');
  /* مرتب‌سازی و فیلتر جدول اعضا */
  const [mSort, setMSort] = useState<{ key: 'power' | 'interest' | 'reviewDue' | ''; dir: 1 | -1 }>({ key: '', dir: -1 });
  const [overdueOnly, setOverdueOnly] = useState(false);

  /* مسترپلن فاز ۲/۱۴+۱۶: پوشش رسانه‌ای + نظرسنجی ذینفعان */
  const [mediaCovOrg, setMediaCovOrg] = useState('');
  const [mediaCov, setMediaCov] = useState<any>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [surveyLink, setSurveyLink] = useState<{ name: string; url: string } | null>(null);

  /* add-member */
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ groupId: '', sourceType: 'organization', sourceId: '', note: '' });
  const addFromGap = useRef<string | null>(null);

  /* assess */
  const [assessFor, setAssessFor] = useState<MemberView | null>(null);
  const [assessForm, setAssessForm] = useState({ stage: 'AWARE', linkage: 'DIFFUSED', power: 50, interest: 50, stance: 'OBSERVER', note: '', assess: true });

  /* self form */
  /* media form */
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaForm, setMediaForm] = useState({ name: '', type: 'TECH_MEDIA', url: '', audience: '', country: '', note: '' });

  /* group manager */
  const [gModal, setGModal] = useState<{ mode: 'create' } | { mode: 'edit'; g: EffGroup } | null>(null);
  const [gForm, setGForm] = useState({ cat: 'INTERNAL', fa: '', link: 'DIFFUSED', smin: 'AWARE', smax: 'ACTIVE', stance: 'OBSERVER', kanal: '', note: '' });
  const [gBusy, setGBusy] = useState(false);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 6000);
  };

  const refresh = useCallback(async (oid: string) => {
    setLoading(true); setError('');
    try {
      const [cat, self, grp, mem, cov, gap, med, orgsList, ppl, rls] = await Promise.all([
        api<Catalog>('/publics/catalog'),
        api<SelfRow>(`/publics/self/${oid}`).catch(() => null),
        api<GroupsResp>(`/publics/groups/${oid}`).catch(() => null),
        api<{ items: MemberView[] } & MemberView[]>(`/publics/members?orgId=${encodeURIComponent(oid)}`).catch(() => null),
        api<Coverage>(`/publics/coverage?orgId=${encodeURIComponent(oid)}`).catch(() => null),
        api<GapsResp>(`/publics/gaps?orgId=${encodeURIComponent(oid)}`).catch(() => null),
        api<{ items: MediaRow[] }>(`/publics/media`).catch(() => null),
        api<OrgMini[]>('/organizations').catch(() => null),
        api<PersonMini[]>('/people').catch(() => null),
        api<RelMini[]>('/relationships').catch(() => null),
      ]);
      setCatalog(cat ?? null);
      setSelfRow(self);
      setGroups(grp?.groups ?? []);
      setGroupTotals(grp?.totals ?? null);
      setMembers(unwrapList<MemberView>(mem));
      setCoverage(cov);
      setGaps(gap);
      setMedia(med?.items ?? []);
      setOrgs(Array.isArray(orgsList) ? orgsList : []);
      setPeople(Array.isArray(ppl) ? ppl : []);
      setRels(Array.isArray(rls) ? rls : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (orgId && canRead) refresh(orgId); }, [orgId, canRead, refresh]);

  const groupsByCat = useMemo(() => {
    const map: Record<string, EffGroup[]> = {};
    for (const g of groups.filter(x => x.active !== false)) { (map[g.cat] ??= []).push(g); }
    return map;
  }, [groups]);
  const catMeta = catalog?.categories ?? [];
  const catOf = (id?: string | null) => catMeta.find(c => c.id === id)?.fa ?? id ?? '—';

  const filteredMembers = useMemo(() => {
    const needle = (q || '').trim();
    return members.filter(m =>
      (!fCat || m.categoryId === fCat) &&
      (!fStance || m.stance === fStance) &&
      (!fStage || m.stage === fStage) &&
      (!overdueOnly || (!!m.reviewDue && new Date(m.reviewDue).getTime() < Date.now())) &&
      (!needle || [m.groupFa, m.sourceName, m.categoryFa, m.sourceLabel].some(v => v && String(v).includes(needle))),
    );
  }, [members, fCat, fStance, fStage, q, overdueOnly]);

  const overdueCount = useMemo(() => members.filter(m => !!m.reviewDue && new Date(m.reviewDue).getTime() < Date.now()).length, [members]);
  const avgPower = members.length ? Math.round(members.reduce((s2, m) => s2 + (m.power ?? 0), 0) / members.length) : 0;
  const avgInterest = members.length ? Math.round(members.reduce((s2, m) => s2 + (m.interest ?? 0), 0) / members.length) : 0;
  const sortedMembers = useMemo(() => {
    const key = mSort.key as 'power' | 'interest' | 'reviewDue' | null;
    if (!key) return filteredMembers;
    const arr = [...filteredMembers];
    arr.sort((a, b) => {
      const av = a[key] ?? 0;
      const bv = b[key] ?? 0;
      return (av > bv ? 1 : av < bv ? -1 : 0) * mSort.dir;
    });
    return arr;
  }, [filteredMembers, mSort]);

  /* ---------- group manager ---------- */
  const filteredGroups = useMemo(() => {
    const needle = (gQ || '').trim();
    return groups.filter(g =>
      (!gCat || g.cat === gCat) &&
      (!gSrc || (gSrc === 'custom' ? g.source === 'custom' : gSrc === 'overridden' ? g.overridden : gSrc === 'inactive' ? g.active === false : g.source === 'template' && !g.overridden)) &&
      (!needle || [g.fa, g.note, g.kanal].some(v => v && String(v).includes(needle))),
    );
  }, [groups, gCat, gSrc, gQ]);
  const openGroupCreate = () => {
    setGForm({ cat: 'INTERNAL', fa: '', link: 'DIFFUSED', smin: 'AWARE', smax: 'ACTIVE', stance: 'OBSERVER', kanal: '', note: '' });
    setGModal({ mode: 'create' });
  };
  const openGroupEdit = (g: EffGroup) => {
    setGForm({ cat: g.cat, fa: g.fa, link: g.link, smin: g.stage[0], smax: g.stage[1], stance: g.stance, kanal: g.kanal, note: g.note });
    setGModal({ mode: 'edit', g });
  };
  const saveGroup = async () => {
    if (!gModal) return;
    if (!gForm.fa.trim()) { notify('نام گروه لازم است.'); return; }
    setGBusy(true);
    try {
      if (gModal.mode === 'create') {
        await api<EffGroup>(`/publics/groups/${orgId}`, { method: 'POST', body: JSON.stringify({ ...gForm, fa: gForm.fa.trim(), kanal: gForm.kanal.trim(), note: gForm.note.trim() }) });
        notify(`گروه «${gForm.fa.trim()}» ساخته و به نقشهٔ سازمان اضافه شد.`);
      } else {
        await api<EffGroup>(`/publics/groups/${orgId}/${gModal.g.id}`, { method: 'PUT', body: JSON.stringify({ ...gForm, fa: gForm.fa.trim(), kanal: gForm.kanal.trim(), note: gForm.note.trim() }) });
        notify(`تغییرات گروه «${gForm.fa.trim()}» فقط در نقشهٔ همین سازمان ذخیره شد.`);
      }
      setGModal(null);
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setGBusy(false); }
  };
  const toggleGroup = async (g: EffGroup) => {
    setBusy(`gtog-${g.id}`);
    try {
      await api<EffGroup>(`/publics/groups/${orgId}/${g.id}`, { method: 'PUT', body: JSON.stringify({ active: g.active === false }) });
      notify(g.active === false ? `گروه «${g.fa}» فعال شد و به پوشش بازگشت.` : `گروه «${g.fa}» غیرفعال شد و از پوشش خارج شد.`);
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };
  const restoreGroup = async (g: EffGroup) => {
    setBusy(`gres-${g.id}`);
    try {
      await api<EffGroup>(`/publics/groups/${orgId}/${g.id}`, { method: 'PUT', body: JSON.stringify({ restore: true }) });
      notify(`گروه «${g.fa}» به حالت الگو بازگشت.`);
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };
  const deleteGroup = async (g: EffGroup) => {
    if (!window.confirm(`گروه اختصاصی «${g.fa}» به‌طور دائم حذف شود؟`)) return;
    setBusy(`gdel-${g.id}`);
    try {
      await api(`/publics/groups/${orgId}/${g.id}`, { method: 'DELETE' });
      notify('گروه اختصاصی حذف شد.');
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  /* ---------- add member ---------- */
  const openAdd = (groupId?: string, gapId?: string) => {
    addFromGap.current = gapId ?? null;
    setAddForm(f => ({ ...f, groupId: groupId ?? f.groupId, sourceId: '' }));
    setAddOpen(true);
  };
  const addMember = async () => {
    if (!addForm.groupId || !addForm.sourceId) { notify('گروه و منبع را انتخاب کنید.'); return; }
    setBusy('add');
    try {
      const created = await api<MemberView>('/publics/members', {
        method: 'POST',
        body: JSON.stringify({ orgId, ...addForm }),
      });
      setAddOpen(false);
      const s = created.suggested;
      notify(`عضو «${created.groupFa ?? created.groupId}» افزوده شد — پیشنهاد موتور: ${created.linkageFa ?? created.linkage}، ${created.stageFa ?? created.stage}، قدرت ${s?.power ?? created.power}/علاقه ${s?.interest ?? created.interest}، ${created.stanceFa ?? created.stance}${addFromGap.current ? ' — شکاف انتخاب‌شده پوشش داده شد.' : ''}`);
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  /* ---------- assess ---------- */
  const openAssess = (m: MemberView) => {
    setAssessFor(m);
    setAssessForm({
      stage: m.stage, linkage: m.linkage, power: m.power, interest: m.interest,
      stance: m.stance, note: m.note ?? '', assess: true,
    });
  };
  const stanceOf = (p: number, i: number) => (p >= 60 && i >= 60 ? 'KEY_PLAYER' : p >= 60 ? 'INFLUENCER' : i >= 60 ? 'SUPPORTER' : 'OBSERVER');
  const assessMember = async () => {
    if (!assessFor) return;
    setBusy('assess');
    try {
      const updated = await api<MemberView>(`/publics/members/${assessFor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...assessForm, power: Number(assessForm.power), interest: Number(assessForm.interest), assess: assessForm.assess }),
      });
      setAssessFor(null);
      notify(`ارزیابی «${updated.groupFa ?? updated.groupId}» ثبت شد — ${updated.stageFa ?? updated.stage} · ${updated.stanceFa ?? updated.stance} (قدرت ${updated.power}/علاقه ${updated.interest}). بازبینی: ${fmtDT(updated.reviewDue)}`);
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };
  const removeMember = async (m: MemberView) => {
    if (!window.confirm(`«${m.groupFa ?? m.groupId}» از نقشهٔ عموم‌ها حذف شود؟`)) return;
    setBusy(`del-${m.id}`);
    try {
      await api(`/publics/members/${m.id}`, { method: 'DELETE' });
      notify('عضو از نقشه حذف شد.');
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  /* ---------- media ---------- */
  const addMedia = async () => {
    if (!mediaForm.name.trim()) { notify('نام رسانه لازم است.'); return; }
    setBusy('media');
    try {
      await api<MediaRow>('/publics/media', { method: 'POST', body: JSON.stringify(mediaForm) });
      setMediaOpen(false);
      setMediaForm({ name: '', type: 'TECH_MEDIA', url: '', audience: '', country: '', note: '' });
      notify('رسانه ثبت شد و به فهرست منابع اضافه شد.');
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  /* ---------- export ---------- */
  const downloadExport = async (format: 'json' | 'csv' | 'xls') => {
    setBusy(`exp-${format}`);
    try {
      if (format === 'json') {
        const data = await api<any>(`/publics/export?orgId=${encodeURIComponent(orgId)}&format=json`);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `publics-${orgId}.json`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const fmt = format === 'xls' ? 'xls' : 'csv';
        const blob = await apiBlob(`/publics/export?orgId=${encodeURIComponent(orgId)}&format=${fmt}`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `publics-${orgId}.${fmt}`; a.click();
        URL.revokeObjectURL(url);
      }
      notify('خروجی نقشهٔ عموم‌ها آماده شد.');
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const runReview = async () => {
    setBusy('review');
    try {
      const r = await api<{ total: number }>(`/publics/review-due?orgId=${encodeURIComponent(orgId)}`);
      notify(r.total ? `بازبینی ${fmtNum(r.total)} عموم سررسید شده است؛ گردش‌کار بازبینی اجرا شد.` : 'بازبینی سررسیدشده‌ای وجود ندارد؛ همهٔ اعضا به‌تازگی ارزیابی شده‌اند.');
      await refresh(orgId);
    } catch (e) { notify(`خطا: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  /* مسترپلن فاز ۱/۳: ذخیرهٔ جایگاه ماتریس (نیازمند علت هنگام تغییر موضع) */
  const saveMatrix = async (m: MemberView, power: number, interest: number, cause?: string, causeNote?: string) => {
    try {
      await api(`/publics/members/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ power, interest, requireCause: true, source: 'matrix', ...(cause ? { cause, causeNote } : {}) }),
      });
      notify(`جایگاه «${m.sourceName ?? m.id}» به‌روزرسانی شد${cause ? ' — علت تغییر در خط زمان ثبت شد' : ''}.`);
      await refresh(orgId);
      return true;
    } catch (e) {
      notify(`خطا: ${(e as Error).message}`);
      return false;
    }
  };

  /* ── مسترپلن فاز ۲/۱۴: پوشش رسانه‌ای (رصد منابع منتخب — RSS فهرست رسانه‌ها) ── */
  const loadMediaCov = useCallback(async (target?: string) => {
    const oid = target ?? mediaCovOrg ?? orgId;
    if (!oid) return;
    setMediaCovOrg(oid);
    setMediaBusy(true);
    try { setMediaCov(await api<any>(`/media/coverage?organizationId=${encodeURIComponent(oid)}`)); }
    catch (e) { setError(String((e as Error).message)); setMediaCov(null); }
    finally { setMediaBusy(false); }
  }, [mediaCovOrg, orgId]);

  const scanMedia = async () => {
    setMediaBusy(true); setFlash('');
    try {
      const out = await api<any>('/media/scan', { method: 'POST', body: '{}' });
      setFlash(out?.message ?? 'پویش انجام شد.');
      await loadMediaCov();
    } catch (e) { setError(String((e as Error).message)); }
    finally { setMediaBusy(false); }
  };

  const reviewMention = async (id: string, tone: string) => {
    setMediaBusy(true);
    try {
      await api(`/media/mentions/${id}/review`, { method: 'POST', body: JSON.stringify({ tone }) });
      await loadMediaCov();
    } catch (e) { setError(String((e as Error).message)); }
    finally { setMediaBusy(false); }
  };

  /* ── مسترپلن فاز ۲/۱۶: نظرسنجی ذینفعان (لینک عمومی + اثر بر امتیاز) ── */
  const loadSurveys = useCallback(async () => {
    try {
      const out = await api<any>('/surveys');
      setSurveys(Array.isArray(out) ? out : (out?.items ?? []));
    } catch { setSurveys([]); }
  }, []);

  const createSurvey = async (m: MemberView) => {
    setBusy(`svy-${m.id}`); setFlash('');
    try {
      const out = await api<{ url: string; message: string }>('/surveys', { method: 'POST', body: JSON.stringify({ memberId: m.id }) });
      const publicUrl = `${typeof window !== 'undefined' ? window.location.origin + window.location.pathname.replace(/\/publics\/?$/, '') : ''}/p?survey=` + out.url.split('/').pop();
      setSurveyLink({ name: m.sourceName ?? m.id, url: publicUrl });
      try { await navigator.clipboard?.writeText(publicUrl); } catch {}
      setFlash(out.message + ' — لینک در حافظه کپی شد.');
      await loadSurveys();
    } catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(''); }
  };

  /* بارگذاری خودکار در ورود به تب پوشش رسانه‌ای */
  useEffect(() => {
    if (tab === 'media') { loadMediaCov(); loadSurveys(); }
    /* eslint-disable-next-line */
  }, [tab]);

  const TABS: Array<{ key: typeof tab; label: string; icon?: React.ReactNode }> = [
    { key: 'groups', label: 'گروه‌ها', icon: <Layers size={14} /> },
    { key: 'members', label: 'اعضا و ارزیابی', icon: <Users2 size={14} /> },
    { key: 'matrix', label: 'ماتریس نفوذ×حمایت', icon: <Target size={14} /> },
    { key: 'heatmap', label: 'پوشش (هیت‌مپ)', icon: <Grid3x3 size={14} /> },
    { key: 'gaps', label: 'شکاف‌ها و اقدام', icon: <AlertTriangle size={14} /> },
    { key: 'media', label: 'پوشش رسانه‌ای', icon: <Radio size={14} /> },
    { key: 'export', label: 'خروجی و رسانه', icon: <Download size={14} /> },
  ];

  const orgOptions = useMemo(() => {
    const mine = me?.accessibleOrganizationIds ?? [];
    const map = new Map(orgs.map(o => [o.id, o]));
    const out = mine.map(id => {
      const known = map.get(id);
      return { id, name: known?.name ?? id };
    });
    // fallback: نامهای شناختهشده از عضویت حتی اگر در فهرست سازمانها نیامده باشند
    for (const mb of me?.memberships ?? []) {
      if (!out.some(o => o.id === mb.organizationId)) out.push({ id: mb.organizationId, name: mb.organizationName });
    }
    return out;
  }, [me, orgs]);
  const selectedOrgName = orgOptions.find(o => o.id === orgId)?.name ?? selfRow?.orgName ?? orgId;

  const briefText = useMemo(() => {
    const cov = coverage?.totals;
    const pct = cov && cov.groupsExpected ? Math.round((cov.groupsCovered / cov.groupsExpected) * 100) : 0;
    const crit = (gaps?.gaps ?? []).filter(g => g.severity === 'CRITICAL');
    const top = crit.slice(0, 3);
    const route = top[0]?.pathSuggestion?.route.map(r => r.label).join(' ← ') ?? '—';
    return [
      `${coverage?.orgName ?? orgId} — خلاصهٔ مدیریتی نقشهٔ عموم‌ها`,
      `الگو: ${coverage?.templateFa ?? '—'} · ${fmtNum(cov?.groupsExpected ?? 0)} گروه · ${fmtNum(cov?.members ?? 0)} عضو ثبت‌شده · پوشش ${fmtNum(pct)}٪`,
      `شکاف‌ها: ${fmtNum(gaps?.totals.gaps ?? 0)} مورد (${fmtNum(gaps?.totals.criticalGaps ?? 0)} بحرانی) · بازیگر کلیدی: ${fmtNum(cov?.keyPlayers ?? 0)}`,
      top.length ? `اولویت‌های فوری: ${top.map(g => `${g.groupFa}${g.categoryFa ? ` (${g.categoryFa})` : ''}`).join('؛ ')}` : 'شکاف بحرانی فعالی وجود ندارد.',
      `اقدام اول: ${top[0]?.action ?? 'بازبینی دوره‌ای و تعامل با بازیگران کلیدی'} — مسیر پیشنهادی: ${route}`,
      `پیشنهاد: ${crit[0]?.pathSuggestion?.direct ? 'ورود مستقیم به گپ' : (top[0]?.pathSuggestion ? 'تقویت کانال موجود در شبکه' : 'بازبینی و تکمیل نقشه')}`,
    ].join('\n');
  }, [coverage, gaps, orgId]);

  if (!canRead) {
    return (
      <div className="page">
        <PageHeader eyebrow="عموم‌ها" title="نقشهٔ عموم‌ها" description="بازیگران اثرگذار و پوشش عموم‌های سازمان" />
        <ErrorCard message="مجوز مشاهدهٔ ماژول «عموم‌ها» را ندارید." />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="عموم‌ها"
        title="نقشهٔ عموم‌ها"
        description="چیدمان گروه‌ها، ارزیابی اعضا، ماتریس نفوذ×حمایت و تبدیل شکاف‌ها به اقدام"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="scope-chip" title="سازمانی که نقشهٔ عموم‌های آن را مشاهده می‌کنید">
              <span className="globe"><Building2 size={13} /></span>
              <span className="scope-label">{selectedOrgName}</span>
              <select aria-label="سازمان" value={orgId} onChange={e => setOrgId(e.target.value)}>
                {(scopeId === 'all' ? orgOptions : orgOptions.filter(o => o.id === scopeId)).map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
            <button className="btn icon-only" onClick={() => refresh(orgId)} title="بهروزرسانی" aria-label="بهروزرسانی"><RefreshCw size={14} /></button>
          </div>
        }
      />

      {/* خلاصهٔ خودشناسی سازمان — موضوع مأموریت و بازبینی؛ ویرایش در صفحهٔ سازمان */}
      {selfRow && !loading && (
        <div className="pubs-self-summary" data-self-summary="true">
          <span className="ps-label">خودشناسی:</span>
          <strong>{selfRow.self?.missionTopic || 'مأموریت ثبت نشده'}</strong>
          {selfRow.template?.fa ? <span className="ps-sep">·</span> : null}
          {selfRow.template?.fa ? <span>{selfRow.template.fa}</span> : null}
          <span className="ps-sep">·</span>
          <span>بازبینی هر {new Intl.NumberFormat('fa-IR').format(selfRow.self?.reviewIntervalDays ?? 90)} روز</span>
          <a className="ps-edit" href={`/organizations/${(selfRow.orgId ?? orgId ?? '').replace(/^org:/, '')}`}>ویرایش در صفحهٔ سازمان ←</a>
        </div>
      )}

      {flash && <div className="notice success" role="status">{flash}</div>}
      {error && <ErrorCard message={error} />}
      {loading && <Loading label="در حال بارگذاری نقشهٔ عموم‌ها…" />}

      {!loading && (
        <>
          <nav className="tabs" role="tablist" aria-label="بخش‌های عموم‌ها">
            {TABS.map(t => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'tab-active' : ''} onClick={() => setTab(t.key)}>
                {t.icon}{t.label}
              </button>
            ))}
          </nav>

          {/* ---------------- اعضا و ارزیابی ---------------- */}
          {tab === 'members' && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="stat-grid">
                <StatCard icon={<Users2 size={16} />} iconClass="ic-blue" label="اعضای نقشه" value={fmtNum(members.length)} />
                <StatCard icon={<Target size={16} />} iconClass="ic-red" label="بازیگر کلیدی" value={fmtNum(members.filter(m => m.stance === 'KEY_PLAYER').length)} sub="متحدان پرنفوذ" />
                <StatCard icon={<AlertTriangle size={16} />} iconClass="ic-orange" label="نیازمند بازبینی" value={fmtNum(overdueCount)} sub="سررسید گذشته" />
                <StatCard icon={<Radar size={16} />} iconClass="ic-teal" label="میانگین نفوذ / حمایت" value={`${fmtNum(avgPower)} / ${fmtNum(avgInterest)}`} sub={`آستانهٔ ناحیه: ${fmtNum(ZONE_TH)}`} />
              </div>

              <SectionCard
                title="خلاصهٔ تحلیل مواضع"
                icon={<Grid3x3 size={15} />}
                description="توزیع اعضا در نواحی ماتریس نفوذ × حمایت — مرز نواحی همان آستانهٔ موتور ارزیابی (۶۰) است."
                actions={<button className="btn btn-secondary btn-sm" onClick={() => setTab('matrix')}><Target size={13} /> ماتریس کامل نفوذ × حمایت</button>}
              >
                <div style={{ display: 'grid', gap: 12 }}>
                  {/* نوار توزیع مواضع */}
                  <div>
                    <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border,#e2e8f0)', background: 'var(--card-bg,#fff)' }} role="img" aria-label="نوار توزیع مواضع اعضا">
                      {ZONES.map(z => {
                        const n = members.filter(m => m.stance === z.id).length;
                        if (!n) return null;
                        const pct = members.length ? Math.round(n / members.length * 100) : 0;
                        return (
                          <div key={`db-${z.id}`} title={`${z.title}: ${fmtNum(n)} عضو (${fmtNum(pct)}٪)`} style={{ width: `${pct}%`, background: STANCE_DOT_COLOR[z.id], display: 'grid', placeItems: 'center', color: '#fff', fontSize: 10.5, fontWeight: 800, minWidth: 4 }}>
                            {pct >= 10 ? fmtNum(n) : ''}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {ZONES.map(z => (
                        <span key={`dl-${z.id}`} className="chip neutral"><span style={{ width: 9, height: 9, borderRadius: '50%', background: STANCE_DOT_COLOR[z.id], display: 'inline-block' }} /> {z.title} ({STANCE_FA[z.id]}): {fmtNum(members.filter(m => m.stance === z.id).length)}</span>
                      ))}
                    </div>
                  </div>
                  {/* نقشهٔ ۲×۲ نواحی — کلیک = رفتن به ماتریس */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    {ZONES.map(z => {
                      const n = members.filter(m => m.stance === z.id).length;
                      return (
                        <button key={`zm-${z.id}`} type="button" onClick={() => setTab('matrix')} title={`${z.action} — مشاهده در ماتریس`}
                          style={{ textAlign: 'start', cursor: 'pointer', padding: '9px 11px', borderRadius: 10, display: 'grid', gap: 2, border: `1px solid color-mix(in srgb, ${STANCE_DOT_COLOR[z.id]} 30%, transparent)`, background: `color-mix(in srgb, ${STANCE_DOT_COLOR[z.id]} 6%, transparent)` }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: STANCE_DOT_COLOR[z.id] }}>{z.title} — {STANCE_FA[z.id]}</span>
                          <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{fmtNum(n)}<span className="t-muted" style={{ fontSize: 11, fontWeight: 400 }}> عضو</span></span>
                          <span className="t-muted" style={{ fontSize: 10.5 }}>{z.action}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="اعضای نقشه"
                icon={<Users2 size={15} />}
                description={`${fmtNum(filteredMembers.length)} از ${fmtNum(members.length)} عضو — مرتب‌سازی با کلیک روی سرستون نفوذ، حمایت یا بازبینی`}
                actions={canWrite && <button className="btn btn-primary" onClick={() => openAdd()}><Plus size={14} /> افزودن عضو</button>}
              >
                <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی گروه/منبع…">
                  <select aria-label="دسته" value={fCat} onChange={e => setFCat(e.target.value)}>
                    <option value="">همهٔ دسته‌ها</option>
                    {catMeta.map(c => <option key={c.id} value={c.id}>{c.fa}</option>)}
                  </select>
                  <select aria-label="موضع" value={fStance} onChange={e => setFStance(e.target.value)}>
                    <option value="">همهٔ مواضع</option>
                    {Object.entries(catalog?.stances ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select aria-label="مرحله" value={fStage} onChange={e => setFStage(e.target.value)}>
                    <option value="">همهٔ مراحل</option>
                    {Object.entries(catalog?.stages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className={`chip ${overdueOnly ? 'danger' : 'neutral'}`} style={{ border: 'none', cursor: 'pointer' }} onClick={() => setOverdueOnly(v => !v)} title="فقط اعضایی که بازبینی‌شان سررسید گذشته است">
                    <AlertTriangle size={12} /> نیازمند بازبینی{overdueCount ? ` (${fmtNum(overdueCount)})` : ''}
                  </button>
                  {canWrite && <button className="btn" onClick={() => openAdd()}><Plus size={14} /> عضو جدید</button>}
                </Toolbar>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>عضو و کانال</th>
                        <th>گروه و دسته</th>
                        <th>موضع</th>
                        <th>
                          <button type="button" onClick={() => setMSort(s => ({ key: 'power', dir: s.key === 'power' && s.dir === -1 ? 1 : -1 }))} title="مرتب‌سازی بر پایهٔ نفوذ" style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            نفوذ / حمایت{mSort.key === 'power' ? (mSort.dir === -1 ? ' ↓' : ' ↑') : ' ↕'}
                          </button>
                        </th>
                        <th>مرحله</th>
                        <th>پیوند</th>
                        <th>
                          <button type="button" onClick={() => setMSort(s => ({ key: 'reviewDue', dir: s.key === 'reviewDue' && s.dir === -1 ? 1 : -1 }))} title="مرتب‌سازی بر پایهٔ سررسید بازبینی" style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            بازبینی{mSort.key === 'reviewDue' ? (mSort.dir === -1 ? ' ↓' : ' ↑') : ' ↕'}
                          </button>
                        </th>
                        {canWrite && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMembers.map(m => {
                        const overdue = !!m.reviewDue && new Date(m.reviewDue).getTime() < Date.now();
                        return (
                          <tr key={m.id}>
                            <td>
                              <button type="button" className="t-primary" style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, fontSize: 12 }} title="ارزیابی و به‌روزرسانی عضو" onClick={() => openAssess(m)}>{m.sourceName ?? m.sourceId}</button>
                              <div className="t-muted" style={{ fontSize: 10.5 }}>{m.sourceLabel ?? SOURCE_LABELS[m.sourceType] ?? m.sourceType}</div>
                              {m.kanal && <div className="t-muted" style={{ fontSize: 10.5 }}>{m.kanal}</div>}
                            </td>
                            <td>
                              <b style={{ fontSize: 12 }}>{m.groupFa ?? m.groupId}</b>
                              <div style={{ marginTop: 3 }}><StatusBadge tone="neutral">{CAT_ICONS[m.categoryId ?? '']}{m.categoryFa ?? m.categoryId}</StatusBadge></div>
                            </td>
                            <td><Badge tone={STANCE_TONE[m.stance] ?? 'neutral'}>{m.stanceFa ?? m.stance}</Badge></td>
                            <td>
                              <div style={{ minWidth: 118, display: 'grid', gap: 3 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                  <span className="t-muted" style={{ width: 36, flex: 'none' }}>نفوذ</span>
                                  <span style={{ flex: 1, height: 6, borderRadius: 99, background: 'color-mix(in srgb, var(--border,#e2e8f0) 55%, transparent)', overflow: 'hidden', display: 'block' }}>
                                    <span style={{ display: 'block', height: '100%', width: `${clamp(m.power)}%`, background: '#0f172a', opacity: .78, borderRadius: 99 }} />
                                  </span>
                                  <b style={{ minWidth: 20, textAlign: 'end' }}>{fmtNum(m.power)}</b>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                  <span className="t-muted" style={{ width: 36, flex: 'none' }}>حمایت</span>
                                  <span style={{ flex: 1, height: 6, borderRadius: 99, background: 'color-mix(in srgb, var(--border,#e2e8f0) 55%, transparent)', overflow: 'hidden', display: 'block' }}>
                                    <span style={{ display: 'block', height: '100%', width: `${clamp(m.interest)}%`, background: '#2563eb', opacity: .85, borderRadius: 99 }} />
                                  </span>
                                  <b style={{ minWidth: 20, textAlign: 'end' }}>{fmtNum(m.interest)}</b>
                                </div>
                              </div>
                              {m.signals != null && <div className="t-muted" style={{ fontSize: 10.5 }}>{fmtNum(m.signals)} سیگنال ۹۰ روز اخیر</div>}
                            </td>
                            <td><Badge tone={STAGE_TONE[m.stage] ?? 'neutral'}>{m.stageFa ?? m.stage}</Badge></td>
                            <td><Badge tone="info">{m.linkageFa ?? m.linkage}</Badge></td>
                            <td>
                              <span className="t-muted" style={{ fontSize: 11 }}>{fmtDT(m.reviewDue)}</span>
                              {overdue && <div><span className="chip danger" style={{ fontSize: 10 }}>سررسید گذشته</span></div>}
                            </td>
                            {canWrite && (
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="btn icon-only" title="ارزیابی و به‌روزرسانی" onClick={() => openAssess(m)}><SlidersHorizontal size={13} /></button>
                                  <button className="btn icon-only" title="ارسال نظرسنجی (لینک عمومی)" disabled={busy === `svy-${m.id}`} onClick={() => createSurvey(m)}><ClipboardList size={13} /></button>
                                  <button className="btn icon-only danger" title="حذف" disabled={busy === `del-${m.id}`} onClick={() => removeMember(m)}><Trash2 size={13} /></button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {!sortedMembers.length && (
                        <tr><td colSpan={canWrite ? 8 : 7}><div className="empty-state-v4" style={{ padding: 18 }}><p>عضوی با این فیلترها یافت نشد؛ از دکمهٔ «افزودن عضو» استفاده کنید.</p></div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ---------------- گروه‌ها ---------------- */}
          {tab === 'groups' && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="stat-grid">
                <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label="گروه‌های فعال نقشه" value={fmtNum(groupTotals?.active ?? 0)} sub={`${fmtNum(groupTotals?.total ?? 0)} گروه در نقشه`} />
                <StatCard icon={<Sparkles size={16} />} iconClass="ic-purple" label="گروه اختصاصی" value={fmtNum(groupTotals?.custom ?? 0)} sub="ساختهٔ شما" />
                <StatCard icon={<Pencil size={16} />} iconClass="ic-teal" label="ویرایش‌شده از الگو" value={fmtNum(groupTotals?.overridden ?? 0)} sub="نام/یادداشت/کانال عوض شده" />
                <StatCard icon={<Power size={16} />} iconClass="ic-orange" label="غیرفعال" value={fmtNum(groupTotals?.inactive ?? 0)} sub="در پوشش محاسبه نمی‌شود" />
              </div>
              <SectionCard
                title="گروه‌های نقشه"
                icon={<Layers size={15} />}
                description="الگو نقطهٔ شروع است: نام، یادداشت، کانال و موضع هر گروه را ویژهٔ سازمان خود کنید؛ گروه‌های غیرضروری را غیرفعال کنید و در صورت نیاز گروه جدید بسازید. پوشش، شکاف‌ها و خلاصهٔ مدیریتی از همین فهرست ساخته می‌شوند."
                actions={canWrite && <button className="btn btn-primary" onClick={openGroupCreate}><Plus size={14} /> گروه جدید</button>}
              >
                <Toolbar search={gQ} onSearch={setGQ} searchPlaceholder="جستجوی گروه/یادداشت…">
                  <select aria-label="دسته" value={gCat} onChange={e => setGCat(e.target.value)}>
                    <option value="">همهٔ دسته‌ها</option>
                    {catMeta.map(c => <option key={c.id} value={c.id}>{c.fa}</option>)}
                  </select>
                  <select aria-label="منبع" value={gSrc} onChange={e => setGSrc(e.target.value)}>
                    <option value="">همهٔ منابع</option>
                    <option value="custom">اختصاصی</option>
                    <option value="overridden">ویرایش‌شده</option>
                    <option value="template">بدون تغییر</option>
                    <option value="inactive">غیرفعال‌ها</option>
                  </select>
                </Toolbar>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>گروه</th><th>دسته</th><th>منبع</th><th>وضعیت</th><th>یادداشت</th>{canWrite && <th>اقدام</th>}</tr>
                    </thead>
                    <tbody>
                      {filteredGroups.map(g => (
                        <tr key={g.id} data-gid={g.id} data-active={g.active === false ? 'false' : 'true'}>
                          <td><b style={{ fontSize: 12 }}>{g.fa}</b>{g.kanal && <div className="t-muted" style={{ fontSize: 10.5 }}>کانال: {g.kanal}</div>}<div className="t-muted" style={{ fontSize: 10.5 }}>{PUBLIC_G(g.link)} · موضع پایه: {PUBLIC_S(g.stance)}</div></td>
                          <td><StatusBadge tone="neutral">{CAT_ICONS[g.cat]}{catOf(g.cat)}</StatusBadge></td>
                          <td>{g.source === 'custom' ? <Badge tone="info">اختصاصی</Badge> : g.overridden ? <Badge tone="warning">ویرایش‌شده</Badge> : <Badge tone="neutral">الگو</Badge>}</td>
                          <td>{g.active === false ? <Badge tone="neutral">غیرفعال</Badge> : <Badge tone="success">فعال</Badge>}</td>
                          <td className="t-muted" style={{ fontSize: 11 }}>{g.note || '—'}{g.overridden && g.templateNote && g.templateNote !== g.note && <div style={{ fontSize: 10.5 }}>یادداشت الگو: {g.templateNote}</div>}</td>
                          {canWrite && (
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn icon-only" data-act="edit" title="ویرایش" onClick={() => openGroupEdit(g)}><Pencil size={13} /></button>
                                <button className="btn icon-only" data-act="toggle" title={g.active === false ? 'فعال‌سازی' : 'غیرفعال‌سازی'} disabled={busy === `gtog-${g.id}`} onClick={() => toggleGroup(g)}><Power size={13} /></button>
                                {(g.overridden || g.active === false) && g.source === 'template' && <button className="btn icon-only" data-act="restore" title="بازگشت به الگو" disabled={busy === `gres-${g.id}`} onClick={() => restoreGroup(g)}><RotateCcw size={13} /></button>}
                                {g.source === 'custom' && <button className="btn icon-only danger" data-act="delete" title="حذف" disabled={busy === `gdel-${g.id}`} onClick={() => deleteGroup(g)}><Trash2 size={13} /></button>}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                      {!filteredGroups.length && (
                        <tr><td colSpan={canWrite ? 6 : 5}><div className="empty-state-v4" style={{ padding: 18 }}><p>گروهی با این فیلترها یافت نشد.</p></div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ---------------- پوشش ---------------- */}
          {/* ---------------- ماتریس نفوذ×حمایت ---------------- */}
          {tab === 'matrix' && (
            <MatrixTab members={members} canWrite={canWrite} onSave={saveMatrix} onNotify={notify} openAssess={openAssess} />
          )}

          {/* ---------------- پوشش (هیت‌مپ) — آمار + هیت‌مپ + دسته‌ها ---------------- */}
          {tab === 'heatmap' && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="stat-grid">
                <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label="گروه‌های نقشه" value={fmtNum(coverage?.totals.groupsExpected ?? 0)} sub={`${fmtNum(coverage?.totals.groupsCovered ?? 0)} پوشش‌داده‌شده`} />
                <StatCard icon={<Radar size={16} />} iconClass="ic-teal" label="٪ پوشش" value={`${fmtNum(coverage?.totals.groupsExpected ? Math.round((coverage.totals.groupsCovered / coverage.totals.groupsExpected) * 100) : 0)}٪`} />
                <StatCard icon={<AlertTriangle size={16} />} iconClass="ic-orange" label="شکاف‌ها" value={fmtNum(coverage?.totals.gaps ?? 0)} sub={`${fmtNum(coverage?.totals.criticalGaps ?? 0)} بحرانی`} />
                <StatCard icon={<Eye size={16} />} iconClass="ic-purple" label="اعضای فعال" value={fmtNum(coverage?.totals.active ?? 0)} />
              </div>
              <HeatmapTab members={members} categories={(coverage?.byCategory ?? []).map(c => ({ id: c.categoryId, fa: c.fa }))} />
              <div className="grid-2" style={{ gap: 14 }}>
                {(coverage?.byCategory ?? []).map(c => {
                  const pct = Math.round((c.covered / Math.max(1, c.expected)) * 100);
                  return (
                    <SectionCard key={c.categoryId} title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{CAT_ICONS[c.categoryId]}{c.fa}</span>} description={`${fmtNum(c.covered)} از ${fmtNum(c.expected)} گروه پوشش‌داده‌شده · ${fmtNum(c.members)} عضو`}>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>پوشش گروهی</span>
                          <b style={{ fontSize: 12, color: CAT_COLORS[c.categoryId] ?? 'var(--srip-accent)' }}>{fmtNum(pct)}٪</b>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: 'var(--card-bg-soft)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: CAT_COLORS[c.categoryId] ?? 'var(--srip-accent)' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {Object.entries(catalog?.stages ?? {}).map(([k, v]) => c.stages[k] ? <Badge key={k} tone={STAGE_TONE[k] ?? 'neutral'}>{v} {c.stages[k]}</Badge> : null)}
                        {Object.entries(catalog?.stances ?? {}).map(([k, v]) => c.stances[k] ? <Badge key={k} tone={STANCE_TONE[k] ?? 'neutral'}>{v} {c.stances[k]}</Badge> : null)}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {c.criticalGaps.length > 0 && <span className="chip danger"><AlertTriangle size={12} /> {fmtNum(c.criticalGaps.length)} شکاف بحرانی</span>}
                        <button className="chip info" onClick={() => { setFCat(c.categoryId); setTab('members'); }}>مشاهدهٔ اعضای این دسته <ChevronLeft size={12} /></button>
                      </div>
                    </SectionCard>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------------- شکاف‌ها و اقدام ---------------- */}
          {tab === 'gaps' && (
            <div className="stack" style={{ gap: 14 }}>
              <div className="stat-grid" data-kpi="publics">
                <StatCard icon={<Layers size={16} />} iconClass="ic-blue" label="پوشش نقشه" value={`${fmtNum(coverage?.totals.groupsExpected ? Math.round((coverage.totals.groupsCovered / coverage.totals.groupsExpected) * 100) : 0)}٪`} sub={`${fmtNum(coverage?.totals.groupsCovered ?? 0)} از ${fmtNum(coverage?.totals.groupsExpected ?? 0)} گروه`} />
                <StatCard icon={<Target size={16} />} iconClass="ic-orange" label="شکاف بحرانی" value={fmtNum(gaps?.totals.criticalGaps ?? 0)} />
                <StatCard icon={<AlertTriangle size={16} />} iconClass="ic-red" label="شکاف‌ها" value={fmtNum(gaps?.totals.gaps ?? 0)} />
                <StatCard icon={<Users2 size={16} />} iconClass="ic-purple" label="بازیگر کلیدی" value={fmtNum(coverage?.totals.keyPlayers ?? 0)} />
                <StatCard icon={<ClockIcon />} iconClass="ic-amber" label="سررسید بازبینی" value={fmtNum((members ?? []).filter(m => m.reviewDue && new Date(m.reviewDue).getTime() < Date.now()).length)} />
                <StatCard icon={<UserPlus size={16} />} iconClass="ic-green" label="عقب‌مانده" value={fmtNum(gaps?.totals.lagging ?? 0)} />
              </div>
              <SectionCard
                title="خلاصهٔ مدیریتی عموم‌ها"
                icon={<Sparkles size={15} />}
                description="خلاصهٔ اجرایی برای هیئت‌مدیره؛ ساخته‌شده از دادهٔ همین نقشه"
                actions={
                  <button className="btn" onClick={() => { navigator.clipboard?.writeText(briefText).then(() => notify('خلاصهٔ مدیریتی کپی شد.')).catch(() => notify('کپی خلاصهٔ مدیریتی ناموفق بود.')); }}><Copy size={13} /> کپی خلاصه</button>
                }
              >
                <pre data-brief="publics" dir="rtl" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.9, margin: 0, background: 'var(--card-bg-soft, #F7F9FC)', padding: '12px 14px', borderRadius: 10 }}>{briefText}</pre>
              </SectionCard>
              <SectionCard
                title="شکاف‌های نقشهٔ عموم‌ها"
                icon={<AlertTriangle size={15} />}
                description="نخست شکاف‌های بحرانی (بازیگر کلیدیِ غایب یا غیرفعال)، سپس اقدام پیشنهادی هر شکاف"
                actions={<button className="btn" disabled={busy === 'review'} onClick={runReview}><ClockIcon /> بررسی سررسید بازبینی</button>}
              >
                <div className="stack" style={{ gap: 8 }}>
                  {(gaps?.gaps ?? []).map(g => (
                    <div key={g.gapId} className="section-card" style={{ padding: '12px 14px', borderInlineStart: `3px solid ${g.severity === 'CRITICAL' ? 'var(--srip-danger)' : 'var(--srip-amber)'}` }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Badge tone={g.severity === 'CRITICAL' ? 'danger' : 'warning'}>{g.severity === 'CRITICAL' ? 'بحرانی' : 'بالا'}</Badge>
                        <Badge tone="neutral">{g.kind === 'lagging' ? 'عقب‌مانده' : 'غایب'}</Badge>
                        <span style={{ fontWeight: 800, fontSize: 12.5 }}>{g.groupFa ?? g.groupId ?? '—'}</span>
                        <span className="t-muted" style={{ fontSize: 11 }}>{g.categoryFa ?? catOf(g.categoryId)} · {g.stanceFa ?? g.stance ?? '—'}</span>
                        <span style={{ flex: 1 }} />
                        {g.kind === 'missing' && canWrite && (
                          <button className="btn" onClick={() => openAdd(g.groupId ?? undefined, g.gapId)}><Plus size={13} /> افزودن عضو</button>
                        )}
                        {g.kind === 'lagging' && canWrite && g.memberId && members.find(m => m.id === g.memberId) && (
                          <button className="btn" onClick={() => openAssess(members.find(m => m.id === g.memberId)!)}><SlidersHorizontal size={13} /> ارزیابی</button>
                        )}
                      </div>
                      <div className="t-muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                        {g.sourceName ? `منبع: ${g.sourceName} · ` : ''}{g.action}
                      </div>
                      {g.pathSuggestion && (
                        <div className="gap-path" style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5 }}>
                            <span style={{ fontWeight: 800, color: 'var(--srip-accent-text, #2457D6)' }}>مسیر پیشنهادی:</span>
                            {g.pathSuggestion.route.map((r, i) => (
                              <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {i > 0 && <span className="t-muted">←</span>}
                                <span className="chip neutral" style={{ fontSize: 10.5 }}>{r.label}{r.id?.endsWith(':') ? '' : ''}</span>
                              </span>
                            ))}
                            <span className="chip info" style={{ fontSize: 10.5 }}>
                              {g.pathSuggestion.direct ? 'ورود مستقیم' : `${g.pathSuggestion.hops} پرش`}
                            </span>
                          </div>
                          <div className="t-muted" style={{ fontSize: 10.8 }}>
                            {g.pathSuggestion.note}
                            {g.pathSuggestion.candidates && g.pathSuggestion.candidates.length > 0
                              ? ` گزینه‌ها: ${g.pathSuggestion.candidates.join('، ')}`
                              : ''}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {!gaps?.gaps?.length && <div className="empty-state-v4" style={{ padding: 18 }}><p className="t-muted">نقشهٔ عموم‌ها شکافی ندارد.</p></div>}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ---------------- خروجی و رسانه ---------------- */}
          {/* ---------------- مسترپلن فاز ۲/۱۴: پوشش رسانه‌ای ---------------- */}
          {tab === 'media' && (
            <div className="stack" style={{ gap: 14 }}>
              <SectionCard
                title="پوشش رسانه‌ای سازمان"
                icon={<Radio size={15} />}
                description="ذکرهای شناسایی‌شدهٔ سازمان در منابع منتخب (RSS رسانه‌های فهرست‌شده) با لحن قاعده‌دار — این «رصد منابع منتخب» است، نه پایش جامع."
                actions={canWrite && <button className="btn btn-primary" disabled={mediaBusy} onClick={scanMedia}><Radio size={14} /> پویش منابع</button>}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <select aria-label="سازمان هدف پوشش" value={mediaCovOrg || orgId} onChange={e => loadMediaCov(e.target.value)} style={{ minWidth: 220 }}>
                    {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <button className="btn btn-secondary" disabled={mediaBusy} onClick={() => loadMediaCov()}><RefreshCw size={13} /> به‌روزرسانی</button>
                </div>
                {mediaCov ? (
                  <>
                    <div className="stat-grid">
                      <StatCard icon={<Newspaper size={16} />} iconClass="ic-blue" label="ذکرهای شناسایی‌شده" value={fmtNum(mediaCov.totalDetected)} sub={`${fmtNum(mediaCov.pendingScan ?? 0)} در انتظار پویش بعدی`} />
                      <StatCard icon={<TrendingDown size={16} />} iconClass={mediaCov.tone?.toneScore >= 0 ? 'ic-teal' : 'ic-red'} label="امتیاز لحن" value={fmtNum(mediaCov.tone?.toneScore)} sub={`مثبت ${fmtNum(mediaCov.tone?.positive)} · منفی ${fmtNum(mediaCov.tone?.negative)} · خنثی ${fmtNum(mediaCov.tone?.neutral)}`} />
                      <StatCard icon={<Radio size={16} />} iconClass="ic-indigo" label="منابع" value={fmtNum(Object.keys(mediaCov.sources ?? {}).length)} sub={Object.entries(mediaCov.sources ?? {}).slice(0, 2).map(([k, v]) => `${k} (${fmtNum(v)})`).join(' · ')} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80, marginTop: 10 }} aria-label="روند ماهانهٔ لحن">
                      {(mediaCov.trend ?? []).map((t: any) => {
                        const max = Math.max(1, ...(mediaCov.trend ?? []).map((x: any) => x.total));
                        return (
                          <div key={t.ym} style={{ flex: 1, textAlign: 'center' }} title={`${t.ym} — کل ${t.total} · مثبت ${t.positive} · منفی ${t.negative}`}>
                            <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'flex-end', height: 52 }}>
                              <span style={{ width: 8, height: Math.max(3, (t.positive / max) * 48), background: '#16a34a', borderRadius: 3 }} />
                              <span style={{ width: 8, height: Math.max(3, (t.neutral / max) * 48), background: '#94a3b8', borderRadius: 3 }} />
                              <span style={{ width: 8, height: Math.max(3, (t.negative / max) * 48), background: '#dc2626', borderRadius: 3 }} />
                            </div>
                            <small className="t-muted" style={{ fontSize: 10 }}>{t.ym.slice(5)}</small>
                          </div>
                        );
                      })}
                    </div>
                    {(mediaCov.mentions ?? []).length ? (
                      <div className="list" style={{ marginTop: 10 }}>
                        {mediaCov.mentions.map((x: any) => (
                          <div className="listRow" key={x.id} style={{ alignItems: 'flex-start' }}>
                            <Badge tone={x.tone === 'POSITIVE' ? 'success' : x.tone === 'NEGATIVE' ? 'danger' : 'neutral'}>
                              {x.tone === 'POSITIVE' ? 'مثبت' : x.tone === 'NEGATIVE' ? 'منفی' : 'خنثی'}
                            </Badge>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: 12 }}>{x.title}</strong>
                              <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 2 }}>{x.mediaName} · {fmtDT(x.publishedAt)}{x.reviewedAt ? ' · بازبینی‌شده' : ` · قاعده: ${x.toneHits?.positive?.length ?? 0} مثبت/${x.toneHits?.negative?.length ?? 0} منفی`}</span>
                            </span>
                            {canWrite && !x.reviewedAt && (
                              <span style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-ghost btn-sm" title="تأیید لحن مثبت" disabled={mediaBusy} onClick={() => reviewMention(x.id, 'POSITIVE')}>✔</button>
                                <button className="btn btn-ghost btn-sm" title="اصلاح به خنثی" disabled={mediaBusy} onClick={() => reviewMention(x.id, 'NEUTRAL')}>≠</button>
                                <button className="btn btn-ghost btn-sm" title="اصلاح به منفی" disabled={mediaBusy} onClick={() => reviewMention(x.id, 'NEGATIVE')}>✖</button>
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="criteria-saved" style={{ marginTop: 10 }}>هنوز ذکری شناسایی نشده — «پویش منابع» را بزنید یا سازمان دیگری انتخاب کنید.</p>
                    )}
                    <p className="t-muted" style={{ fontSize: 11, marginTop: 8 }}>{mediaCov.honestyNote}</p>
                  </>
                ) : (
                  <p className="muted" style={{ fontSize: 12.5 }}>سازمانی را انتخاب کنید تا کارت پوشش رسانه‌ای آن ساخته شود.</p>
                )}
              </SectionCard>

              <SectionCard
                title="نظرسنجی‌های ذینفعان"
                icon={<ClipboardList size={15} />}
                description="لینک عمومی نظرسنجی برای هر عضو (همان زیرساخت پورتال) — پاسخ‌ها با برچسب منبع «نظرسنجی» در موضع و سلامت ثبت می‌شوند."
              >
                <button className="btn btn-secondary btn-sm" onClick={loadSurveys}><RefreshCw size={13} /> به‌روزرسانی فهرست</button>
                {surveys.length ? (
                  <div className="list" style={{ marginTop: 10 }}>
                    {surveys.map((sv: any) => (
                      <div className="listRow" key={sv.id}>
                        <Badge tone={sv.status === 'RESPONDED' ? 'success' : 'warning'}>{sv.status === 'RESPONDED' ? 'پاسخ داده شد' : 'در انتظار پاسخ'}</Badge>
                        <span style={{ flex: 1 }}>
                          <strong style={{ fontSize: 12.5 }}>{sv.targetName}</strong>
                          <span className="t-muted" style={{ display: 'block', fontSize: 10.5 }}>
                            {fmtDT(sv.createdAt)}{sv.satisfaction != null ? ` · رضایت ${fmtNum(sv.satisfaction)}/۵` : ''}{sv.perception ? ` · ادراک: ${sv.perception === 'SUPPORTER' ? 'حامی' : sv.perception === 'NEUTRAL' ? 'بی‌طرف' : 'مخالف'}` : ''}
                            {sv.effect?.healthDelta ? ` · اثر سلامت: ${sv.effect.healthDelta > 0 ? '+' : ''}${fmtNum(sv.effect.healthDelta)}` : ''}
                          </span>
                        </span>
                        {sv.status !== 'RESPONDED' && (
                          <button className="btn btn-ghost btn-sm" title="کپی لینک عمومی"
                            onClick={() => { const u = `${window.location.origin}${window.location.pathname.replace(/\/publics\/?$/, '')}/p?survey=${sv.token}`; try { navigator.clipboard?.writeText(u)?.catch?.(() => {}); } catch {} setFlash(`لینک نظرسنجی: ${u}`); }}>
                            <Copy size={12} /> لینک
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="criteria-saved" style={{ marginTop: 10 }}>نظرسنجی‌ای نساخته‌اید — از تب «اعضا و ارزیابی» با دکمهٔ کلیپ‌بورد برای هر عضو یک نظرسنجی بسازید.</p>
                )}
              </SectionCard>
            </div>
          )}

          {tab === 'export' && (
            <div className="grid-2" style={{ gap: 14 }}>
              <SectionCard title="خروجی نقشهٔ عموم‌ها" icon={<Download size={15} />} description="کل نقشه با ارزیابی‌ها؛ برای گزارش هیئت‌مدیره یا تحلیل بیرونی">
                <div className="stack" style={{ gap: 8 }}>
                  <button className="btn btn-primary" disabled={busy === 'exp-json'} onClick={() => downloadExport('json')}><FileJson size={14} /> خروجی JSON</button>
                  <button className="btn" disabled={busy === 'exp-csv'} onClick={() => downloadExport('csv')}><FileSpreadsheet size={14} /> خروجی CSV</button>
                  <button className="btn" disabled={busy === 'exp-xls'} onClick={() => downloadExport('xls')}><FileSpreadsheet size={14} /> خروجی Excel</button>
                  <span className="field-hint">ستون‌های خروجی: گروه، دسته، پیوند، مرحله، موضع، قدرت، علاقه، منبع، یادداشت، سررسید بازبینی.</span>
                </div>
              </SectionCard>
              <SectionCard
                title="رسانه‌ها و منابع خبری"
                icon={<Newspaper size={15} />}
                description="رسانه‌هایی که رصد می‌کنید؛ مبنای پوشش دستهٔ «رسانه و افکار عمومی»"
                actions={canWrite && <button className="btn btn-primary" onClick={() => setMediaOpen(true)}><Plus size={14} /> رسانهٔ جدید</button>}
              >
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>نام</th><th>نوع</th><th>مخاطب</th><th>کشور</th></tr></thead>
                    <tbody>
                      {media.map(m => (
                        <tr key={m.id}>
                          <td><b style={{ fontSize: 12 }}>{m.name}</b>{m.url && <div className="t-muted" style={{ fontSize: 10.5, direction: 'ltr', textAlign: 'right' }}>{m.url}</div>}</td>
                          <td><Badge tone="info">{MEDIA_TYPE_OPTIONS.find(([v]) => v === m.type)?.[1] ?? m.type}</Badge></td>
                          <td className="t-muted" style={{ fontSize: 11 }}>{m.audience ?? '—'}</td>
                          <td className="t-muted" style={{ fontSize: 11 }}>{m.country ?? '—'}</td>
                        </tr>
                      ))}
                      {!media.length && <tr><td colSpan={4}><div className="empty-state-v4" style={{ padding: 14 }}><p>هنوز رسانه‌ای ثبت نشده است.</p></div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}
        </>
      )}

      {/* ---------- modals ---------- */}
      <Modal open={addOpen} title="افزودن عضو عموم" description={addFromGap.current ? 'از شکاف انتخاب‌شده برای تکمیل نقشه استفاده می‌کنید' : 'گروه را از نقشهٔ سازمان خود انتخاب کنید؛ موتور مرحله و قدرت و علاقهٔ اولیه را پیشنهاد می‌دهد و شما تأیید می‌کنید.'} onClose={() => setAddOpen(false)}
        footer={<><button className="btn" onClick={() => setAddOpen(false)}>انصراف</button><button className="btn btn-primary" disabled={busy === 'add'} onClick={addMember}><Plus size={14} /> افزودن</button></>}>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">گروه <span className="req">*</span></label>
            <select value={addForm.groupId} onChange={e => { setAddForm(f => ({ ...f, groupId: e.target.value })); addFromGap.current = null; }}>
              <option value="">انتخاب گروه…</option>
              {catMeta.map(c => (
                <optgroup key={c.id} label={`${c.fa} (${(groupsByCat[c.id] ?? []).length})`}>
                  {(groupsByCat[c.id] ?? []).map(g => (
                    <option key={g.id} value={g.id}>{g.fa} — {PUBLIC_G(g.link)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {addForm.groupId && (() => { const g = (groups ?? []).find(x => x.id === addForm.groupId); return g ? <span className="field-hint">پیشنهاد نقشه: {g.kanal ? `کانال «${g.kanal}» · ` : ''}موضع پایه «{PUBLIC_S(g.stance)}»{g.note ? ` · راهنما: ${g.note}` : ''}</span> : null; })()}
          </div>
          <div className="field">
            <label className="field-label">نوع منبع <span className="req">*</span></label>
            <select value={addForm.sourceType} onChange={e => setAddForm(f => ({ ...f, sourceType: e.target.value, sourceId: '' }))}>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">منبع <span className="req">*</span></label>
            <select value={addForm.sourceId} onChange={e => setAddForm(f => ({ ...f, sourceId: e.target.value }))}>
              <option value="">انتخاب…</option>
              {addForm.sourceType === 'organization' && orgs.filter(o => o.id !== orgId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              {addForm.sourceType === 'person' && people.map(p => <option key={p.id} value={p.id}>{p.firstName ?? ''} {p.lastName ?? ''}{p.title ? ` — ${p.title}` : ''}{p.organization?.name ? ` (${p.organization.name})` : ''}</option>)}
              {addForm.sourceType === 'relationship' && rels.map(r => <option key={r.id} value={r.id}>{r.sourceOrganization?.name ?? '—'} ↔ {r.targetOrganization?.name ?? '—'}</option>)}
              {addForm.sourceType === 'media' && media.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field full">
            <label className="field-label">یادداشت (اختیاری)</label>
            <input value={addForm.note} onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))} placeholder="مثلاً: طرف مکاتبه در پروندهٔ …" />
          </div>
        </div>
      </Modal>

      <Modal open={gModal !== null} title={gModal?.mode === 'create' ? 'گروه جدید' : `ویرایش گروه: ${gModal?.mode === 'edit' ? gModal.g.fa : ''}`} description="این تغییر فقط در نقشهٔ سازمان شما اعمال می‌شود؛ الگوی مشترک بدون تغییر می‌ماند." onClose={() => setGModal(null)}
        footer={<><button className="btn" onClick={() => setGModal(null)}>انصراف</button><button className="btn btn-primary" disabled={gBusy} onClick={saveGroup}>{gModal?.mode === 'create' ? 'ساخت گروه' : 'ذخیره'}</button></>}>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">نام گروه <span className="req">*</span></label>
            <input data-gi="fa" value={gForm.fa} onChange={e => setGForm(f => ({ ...f, fa: e.target.value }))} placeholder="مثلاً: کارگروه تحول دیجیتال" />
          </div>
          <div className="field">
            <label className="field-label">دسته</label>
            <select data-gi="cat" value={gForm.cat} onChange={e => setGForm(f => ({ ...f, cat: e.target.value }))}>
              {catMeta.map(c => <option key={c.id} value={c.id}>{c.fa}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">نوع پیوند</label>
            <select data-gi="link" value={gForm.link} onChange={e => setGForm(f => ({ ...f, link: e.target.value }))}>
              {Object.entries(catalog?.linkages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">موضع پایه</label>
            <select data-gi="stance" value={gForm.stance} onChange={e => setGForm(f => ({ ...f, stance: e.target.value }))}>
              {Object.entries(catalog?.stances ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">کانال پیشنهادی</label>
            <input data-gi="kanal" value={gForm.kanal} onChange={e => setGForm(f => ({ ...f, kanal: e.target.value }))} placeholder="مثلاً: مکاتبه رسمی" />
          </div>
          <div className="field">
            <label className="field-label">کف بازهٔ مرحله</label>
            <select data-gi="smin" value={gForm.smin} onChange={e => setGForm(f => ({ ...f, smin: e.target.value }))}>
              {Object.entries(catalog?.stages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">سقف بازهٔ مرحله</label>
            <select data-gi="smax" value={gForm.smax} onChange={e => setGForm(f => ({ ...f, smax: e.target.value }))}>
              {Object.entries(catalog?.stages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field full">
            <label className="field-label">یادداشت گروه</label>
            <textarea data-gi="note" value={gForm.note} onChange={e => setGForm(f => ({ ...f, note: e.target.value }))} placeholder="راهنمای عملی کار با این گروه" />
            {gModal?.mode === 'edit' && gModal.g.source === 'template' && gModal.g.templateNote && (
              <span className="field-hint">یادداشت الگو: {gModal.g.templateNote}</span>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={!!assessFor} title={`ارزیابی: ${assessFor?.groupFa ?? assessFor?.groupId ?? ''}`} description={assessFor?.sourceName ? `منبع: ${assessFor.sourceName} · ${sourceLabel(assessFor.sourceType)} · سیگنال‌های ۹۰ روز اخیر: ${fmtNum(assessFor.signals)}` : undefined} onClose={() => setAssessFor(null)}
        footer={<><button className="btn" onClick={() => setAssessFor(null)}>انصراف</button><button className="btn btn-primary" disabled={busy === 'assess'} onClick={assessMember}><SlidersHorizontal size={14} /> ثبت ارزیابی</button></>}>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">موضع پیشنهادی بر اساس قدرت و علاقه: <b>{PUBLIC_S(stanceOf(assessForm.power, assessForm.interest))}</b></label>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label className="field-label">قدرت (نفوذ) — {fmtNum(assessForm.power)}</label>
                <input type="range" min={0} max={100} value={assessForm.power} onChange={e => setAssessForm(f => ({ ...f, power: Number(e.target.value) }))} />
              </div>
              <div className="field" style={{ flex: '1 1 200px' }}>
                <label className="field-label">علاقه (تمایل و تعهد) — {fmtNum(assessForm.interest)}</label>
                <input type="range" min={0} max={100} value={assessForm.interest} onChange={e => setAssessForm(f => ({ ...f, interest: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <div className="field">
            <label className="field-label">مرحلهٔ بلوغ</label>
            <select value={assessForm.stage} onChange={e => setAssessForm(f => ({ ...f, stage: e.target.value }))}>
              {Object.entries(catalog?.stages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">نوع پیوند</label>
            <select value={assessForm.linkage} onChange={e => setAssessForm(f => ({ ...f, linkage: e.target.value }))}>
              {Object.entries(catalog?.linkages ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">موضع</label>
            <select value={assessForm.stance} onChange={e => setAssessForm(f => ({ ...f, stance: e.target.value }))}>
              {Object.entries(catalog?.stances ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">بازبینی جدید</label>
            <label className="chip info" style={{ cursor: 'pointer' }}><input type="checkbox" checked={assessForm.assess} onChange={e => setAssessForm(f => ({ ...f, assess: e.target.checked }))} /> ثبت ارزیابی جدید (۹۰ روز از امروز)</label>
          </div>
          <div className="field full">
            <label className="field-label">یادداشت ارزیابی</label>
            <textarea value={assessForm.note} onChange={e => setAssessForm(f => ({ ...f, note: e.target.value }))} placeholder="دلیل تغییر مرحله یا موضع…" />
          </div>
        </div>
      </Modal>

      <Modal open={mediaOpen} title="ثبت رسانهٔ جدید" description="رسانه به فهرست منابع اضافه می‌شود تا در نقشه قابل اتصال باشد." onClose={() => setMediaOpen(false)}
        footer={<><button className="btn" onClick={() => setMediaOpen(false)}>انصراف</button><button className="btn btn-primary" disabled={busy === 'media'} onClick={addMedia}><Megaphone size={14} /> ثبت</button></>}>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">نام رسانه <span className="req">*</span></label>
            <input value={mediaForm.name} onChange={e => setMediaForm(f => ({ ...f, name: e.target.value }))} placeholder="مثلاً: خبرگزاری فارس" />
          </div>
          <div className="field">
            <label className="field-label">نوع</label>
            <select value={mediaForm.type} onChange={e => setMediaForm(f => ({ ...f, type: e.target.value }))}>
              {MEDIA_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">آدرس</label>
            <input value={mediaForm.url} onChange={e => setMediaForm(f => ({ ...f, url: e.target.value }))} placeholder="example.com" style={{ direction: 'ltr', textAlign: 'right' }} />
          </div>
          <div className="field">
            <label className="field-label">دامنهٔ مخاطب</label>
            <input value={mediaForm.audience} onChange={e => setMediaForm(f => ({ ...f, audience: e.target.value }))} placeholder="تخصصی فناوری" />
          </div>
          <div className="field">
            <label className="field-label">کشور</label>
            <input value={mediaForm.country} onChange={e => setMediaForm(f => ({ ...f, country: e.target.value }))} placeholder="ایران" />
          </div>
          <div className="field full">
            <label className="field-label">یادداشت</label>
            <textarea value={mediaForm.note} onChange={e => setMediaForm(f => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PUBLIC_G(v: string) {
  return ({ ENABLING: 'فعال‌کننده', FUNCTIONAL_INPUT: 'کارکردی-ورودی', FUNCTIONAL_OUTPUT: 'کارکردی-خروجی', NORMATIVE: 'هنجاری', DIFFUSED: 'پراکنده' } as Record<string, string>)[v] ?? v;
}
function PUBLIC_S(v: string) {
  return ({ KEY_PLAYER: 'بازیگر کلیدی', INFLUENCER: 'تأثیرگذار', SUPPORTER: 'حامی', OBSERVER: 'ناظر' } as Record<string, string>)[v] ?? v;
}
function sourceLabel(t: string) {
  return ({ organization: 'سازمان', person: 'شخص', relationship: 'رابطه', media: 'رسانه' } as Record<string, string>)[t] ?? t;
}
function ClockIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

/* ماتریس قدرت × علاقه */
