'use client';
// ============================================================================
//  شبکهٔ خوشه‌ای (Cluster Orbit) — نگارش UI 4 · گراف ارتباطات
//  · هر سازمانِ مادر در یک «حباب» پاستلی نرم با برچسب نام + نقطهٔ وضعیت
//  · شرکتِ مرکز: کارت شیشه‌ای با آواتار گرادیانی، حلقهٔ سلامت و نشان ریسک
//  · اشخاص/پروژه‌ها: دایره‌های کوچک با حرف اول که به‌صورت مداری دور سازمان می‌چرخند
//  · پیوند رابطه: رنگ/خط‌چین بر اساس وضعیت + پهنای بر اساس وزن + نقطهٔ میانه
//  · پیوند مسیر: کهربایی متحرک (دش متحرک) · حالت تمرکز: غیرهمسایه‌ها کمرنگ
//  · کلیک (بدون کشیدن) = انتخاب؛ دابل‌کلیک = باز کردن صفحهٔ موجودیت؛
//    کارت شناورِ گرهٔ انتخاب‌شده دکمهٔ «مبدأ/مقصد مسیر» دارد.
//  · همگی SVG خالص — بدون کتابخانهٔ خارجی.
// ============================================================================
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  GGraph,
  GNode,
  GEdge,
  RISK_THRESHOLD,
  nodeDisplayName,
  edgeStatus,
  statusMeta,
  nodeCategoryColor,
  EGO_COLOR,
  EGO_FA,
  PUBLIC_CATEGORY_ORDER,
  PUBLIC_CATEGORY_META,
} from './_nodes';
import { localeTag, lt, t } from '../_lib/i18n';

export interface NetworkGraphHandle {
  fit: () => void;
  reset: () => void;
  zoomBy: (factor: number) => void;
}

export interface NetworkGraphProps {
  graph: GGraph;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  focusNodeId?: string | null;
  pathNodeIds?: Set<string> | null;
  pathEdgeIds?: Set<string> | null;
  analysisNodeIds?: Set<string> | null;
  dimOthers?: boolean;
  onNodeSelect?: (node: GNode | null) => void;
  onNodeHover?: (node: GNode | null) => void;
  onEdgeSelect?: (edge: string | null) => void;
  onEdgeHover?: (edgeLabel: string | null) => void;
  onRendered?: (counts: { nodes: number; edges: number }) => void;
  onNodeOpen?: (href: string) => void;
  onPathEnd?: (node: GNode, end: 'from' | 'to') => void;
  /** چیدمان: nested (پیش‌فرض — شبکهٔ فعال + سینی‌های دستهٔ تو در تو) | classic (شبکهٔ کامل) */
  variant?: 'nested' | 'classic';
}

type Pos = { x: number; y: number };

/** World canvas — aspect 1600/760. */
const W = 1600;
const H = 760;
const ORG_SIZE = 56;
const PERSON_R = 12;
const PROJECT_R = 13;
const CLUSTER_PAD = 66;

const TYPE_FA: Record<string, string> = lt( { organization: t('سازمان'), person: t('شخص'), project: t('پروژه') });

/* ---------- اندازه‌گیری واقعی عرض متن (تصویربردار SVG از کادر بیرون نزند) ---------- */
let _mctx: CanvasRenderingContext2D | null = null;
function textWidth(s: string, fontWeight: number, fontPx: number): number {
  if (!s) return 0;
  /* تخمین محافظه‌کارانه برای حروف فارسی: canvas ممکن است فونت واقعی را هنوز بارگذاری نکرده باشد */
  const perChar = s.split('').reduce((acc, ch) => (ch.trim() === '' ? acc + fontPx * 0.35 : acc + fontPx * 0.92), 0);
  if (typeof document === 'undefined' || !document.createElement) return perChar;
  if (!_mctx) _mctx = document.createElement('canvas').getContext('2d');
  if (!_mctx) return perChar;
  _mctx.font = `${fontWeight} ${fontPx}px Vazirmatn, Inter, ui-sans-serif, system-ui, sans-serif`;
  return Math.max(perChar, _mctx.measureText(s).width * 1.12);
}
const safeId = (s: string) => String(s).replace(/[^a-zA-Z0-9_-]/g, '');
/** برش متن با «…» وقتی از عرض مجاز بیشتر است. */
function fitText(s: string, maxW: number, fontWeight: number, fontPx: number): string {
  if (textWidth(s, fontWeight, fontPx) <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (textWidth(s.slice(0, mid) + '…', fontWeight, fontPx) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo <= 0 ? '…' : s.slice(0, lo) + '…';
}

/** Per-cluster pastel tint (fill + stroke). */
const CLUSTER_TINTS = [
  { fill: 'rgba(99,102,241,0.06)', stroke: 'rgba(99,102,241,0.4)' },   // indigo
  { fill: 'rgba(20,184,166,0.06)', stroke: 'rgba(13,148,136,0.36)' },   // teal
  { fill: 'rgba(59,130,246,0.055)', stroke: 'rgba(37,99,235,0.36)' },   // blue
  { fill: 'rgba(146,97,248,0.055)', stroke: 'rgba(124,58,237,0.34)' },  // purple
  { fill: 'rgba(245,158,11,0.055)', stroke: 'rgba(217,119,6,0.36)' },   // amber
  { fill: 'rgba(236,72,153,0.05)', stroke: 'rgba(219,39,119,0.3)' },    // pink
  { fill: 'rgba(14,165,233,0.055)', stroke: 'rgba(2,132,199,0.32)' },   // sky
  { fill: 'rgba(22,163,74,0.055)', stroke: 'rgba(21,128,61,0.32)' },    // green
];

type Cluster = { root: GNode; members: GNode[] };

function bareId(id: string): string {
  const i = id.indexOf(':');
  return i >= 0 ? id.slice(i + 1) : id;
}

/** Group nodes into clusters: one per organization (+ member nodes). */
function buildClusters(nodes: GNode[]): Cluster[] {
  const orgs = nodes.filter((n) => n.type === 'organization');
  const byOrg = new Map<string, GNode>();
  for (const o of orgs) byOrg.set(o.organizationId ?? bareId(o.id), o);
  const clusters: Cluster[] = orgs.map((root) => ({ root, members: [] }));
  for (const n of nodes) {
    if (n.type === 'organization') continue;
    const root = n.organizationId ? byOrg.get(n.organizationId) : undefined;
    if (root) {
      const c = clusters.find((x) => x.root === root);
      if (c) c.members.push(n);
    } else {
      clusters.push({ root: n, members: [] });
    }
  }
  for (const c of clusters) c.members.sort((a, b) => (a.id < b.id ? -1 : 1));
  return clusters;
}

/**
 * Deterministic cluster layout — no physics, no randomness, no hot loop.
 */
function layout(clusters: Cluster[], all: GNode[]): Map<string, Pos> {
  const pos = new Map<string, Pos>();
  const roots = clusters.map((c) => c.root);
  const n = roots.length;
  let cols: number;
  let rows: number;
  if (n <= 1) { cols = 1; rows = 1; }
  else if (n <= 4) { cols = n; rows = 1; }
  else if (n <= 10) { cols = Math.ceil(n / 2); rows = 2; }
  else if (n <= 18) { cols = Math.ceil(n / 3); rows = 3; }
  else { cols = Math.ceil(n / 4); rows = 4; }
  const ring =
    rows === 1 ? 118 :
    rows === 2 ? 96 :
    rows === 3 ? 76 :
    58;
  const stepX = Math.min(430, (W * 0.92) / Math.max(1, cols));
  clusters.forEach((c, i) => {
    const r = Math.floor(i / cols);
    const col = i % cols;
    const rowCount = Math.min(cols, n - r * cols);
    const rowStart = (W - (rowCount - 1) * stepX) / 2;
    const cy =
      rows === 1 ? H / 2 :
      rows === 2 ? (r === 0 ? 218 : 578) :
      (H * (2 * r + 1)) / (2 * rows);
    const cx = rowStart + col * stepX;
    pos.set(c.root.id, { x: cx, y: cy });
    const m = c.members.length;
    if (!m) return;
    c.members.forEach((member, j) => {
      const ang = -Math.PI / 2 + (j * Math.PI * 2) / m + (m % 2 === 0 ? Math.PI / m : 0);
      pos.set(member.id, { x: cx + Math.cos(ang) * ring, y: cy + Math.sin(ang) * ring });
    });
  });
  let fi = 0;
  for (const node of all) {
    if (!pos.has(node.id)) {
      const a = (fi++ * Math.PI * 2) / Math.max(1, all.length);
      pos.set(node.id, { x: W / 2 + Math.cos(a) * 240, y: H / 2 + Math.sin(a) * 200 });
    }
  }
  return pos;
}

/* ----------------- چیدمان مرحله‌ای (drill-down) -----------------
   صفحهٔ اول: خودِ شرکت در مرکز؛ زیرمجموعه‌های خودش و هلدینگ‌های بزرگ یک سو (راست)،
   روابط مستقیم سوی دیگر (چپ)، و بقیهٔ عموم‌ها به‌صورت «خط‌های قرمز» خورشیدی در
   بالای بوم (بخش‌بندی‌شده بر حسب دسته، با چیپ دسته در پایین).
   کلیک روی هر سازمان → تمرکز روی آن: زیرمجموعه‌هایش یک سو، روابطش سوی دیگر. */
type FocusLine = { id: string; x: number; y: number; color: string; cat: string };
type FocusSector = { key: string; fa: string; shortFa: string; color: string; count: number; members: GNode[]; chipX: number; chipY: number; chipW: number };
type FocusModel = {
  children: GNode[];
  relations: GNode[];
  hubs: GNode[];
  redOrgs: GNode[];
  egoPersons: GNode[];
  parentCount: Map<string, number>;
};
const RED_LINE_COLOR = '#DC2626';
const faNum = (v: number): string => new Intl.NumberFormat(localeTag()).format(v);

function layoutFocus(opts: {
  focus: GNode;
  isRoot: boolean;
  model: FocusModel;
  sectorMeta: (cat: string) => { fa: string; shortFa: string; color: string };
}): { pos: Map<string, Pos>; lines: FocusLine[]; sectors: FocusSector[]; center: Pos } {
  const { focus, isRoot, model, sectorMeta } = opts;
  const pos = new Map<string, Pos>();
  const C = { x: W / 2, y: 400 };
  pos.set(focus.id, C);

  /* ستون‌های کناری — راست: زیرمجموعه‌ها + هلدینگ‌ها · چپ: روابط مستقیم */
  const colX = (side: 1 | -1, i: number) => W / 2 + side * (340 + i * 250);
  const stack = (items: GNode[], side: 1 | -1) => {
    if (!items.length) return;
    const perCol = items.length <= 7 ? items.length : Math.ceil(items.length / 2);
    const yTop = 96, yBot = 655;
    const step = items.length <= 1 ? 0 : Math.min(74, (yBot - yTop) / (items.length <= 7 ? items.length - 1 : perCol - 1));
    const y0 = (yTop + yBot) / 2 - (step * (perCol - 1)) / 2;
    items.forEach((n, i) => {
      const col = items.length <= 7 ? 0 : Math.floor(i / perCol);
      const row = items.length <= 7 ? i : i % perCol;
      pos.set(n.id, { x: colX(side, col), y: y0 + row * step });
    });
  };
  stack([...model.children, ...model.hubs], 1);
  stack(model.relations, -1);

  /* حلقهٔ اشخاص/پروژه‌های خودِ شرکت — فقط در صفحهٔ اول، بیضی کم‌عمق دور مرکز */
  if (isRoot && model.egoPersons.length) {
    const m = model.egoPersons.length;
    const rx = Math.min(150, 84 + m * 4);
    const ry = m <= 8 ? 56 : 68;
    const phase = -Math.PI / 2 + Math.PI / m; /* نصف‌گام: خالی دقیقاً بالا/پایین */
    model.egoPersons.forEach((pn, j) => {
      const ang = phase + (j * Math.PI * 2) / m;
      pos.set(pn.id, { x: C.x + Math.cos(ang) * rx, y: C.y + Math.sin(ang) * ry });
    });
  }

  /* خط‌های قرمز عموم‌ها — فقط صفحهٔ اول؛ بخش‌های بالای بوم بر حسب دسته */
  const lines: FocusLine[] = [];
  const sectors: FocusSector[] = [];
  if (isRoot && model.redOrgs.length) {
    const groups = new Map<string, GNode[]>();
    for (const o of model.redOrgs) {
      const cat = o.category && PUBLIC_CATEGORY_META[o.category] ? o.category : 'OTHER';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(o);
    }
    const order = [
      ...PUBLIC_CATEGORY_ORDER.filter((c) => groups.has(c)),
      ...(groups.has('OTHER') ? ['OTHER'] : []),
    ];
    /* زاویه‌ها در نیم‌روزِ بالای بوم (200° تا 340°) — از ستون‌های کناری فاصله می‌گیرد */
    const spanTotal = 140;
    const total = model.redOrgs.length;
    const r1 = 150;
    const r2base = 268;
    const chipY = 718;
    const chipGap = 14;
    const chips = order.map((k) => {
      const meta = sectorMeta(k);
      const members = groups.get(k)!;
      const label = `${meta.shortFa} · ${faNum(members.length)}`;
      const chipW = Math.max(88, Math.ceil(textWidth(label, 800, 10.6)) + 36);
      return { k, meta, members, chipW };
    });
    const totalW = chips.reduce((acc, c) => acc + c.chipW, 0) + chipGap * (chips.length - 1);
    let cx = (W - totalW) / 2;
    let a0 = 200;
    for (const c of chips) {
      const span = (spanTotal * c.members.length) / total;
      c.members.forEach((o, j) => {
        const a = ((a0 + ((j + 0.5) * span) / c.members.length) * Math.PI) / 180;
        const r2 = r2base + (j % 2) * 16;
        lines.push({ id: o.id, x: C.x + Math.cos(a) * r2, y: C.y + Math.sin(a) * r2, color: c.meta.color, cat: c.k });
      });
      sectors.push({ key: c.k, fa: c.meta.fa, shortFa: c.meta.shortFa, color: c.meta.color, count: c.members.length, members: c.members, chipX: cx + c.chipW / 2, chipY, chipW: c.chipW });
      cx += c.chipW + chipGap;
      a0 += span;
    }
  }
  return { pos, lines, sectors, center: C };
}

/* ------------------------- helpers ------------------------- */
function initialOf(name: string): string {
  return (name ?? '').trim().charAt(0) || '•';
}
function visualHalf(type: string, name: string): number {
  const shape = type === 'organization' ? ORG_SIZE / 2 : type === 'project' ? PROJECT_R : PERSON_R;
  return Math.max(shape + 10, (name.length * 6.4) / 2 + 6);
}
function bottomPad(type: string): number {
  return type === 'organization' ? 46 : 28;
}
const nodeGrad = (n: GNode): string =>
  n.type === 'organization' ? 'url(#g-org)' : n.type === 'project' ? 'url(#g-project)' : 'url(#g-person)';

function membership(a: Pos, b: Pos): string {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}
function curve(a: Pos, b: Pos): { d: string; mx: number; my: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const bend = Math.min(52, len * 0.12);
  const cx = (a.x + b.x) / 2 - (dy / len) * bend;
  const cy = (a.y + b.y) / 2 + (dx / len) * bend;
  const mx = 0.25 * a.x + 0.5 * cx + 0.25 * b.x;
  const my = 0.25 * a.y + 0.5 * cy + 0.25 * b.y;
  return { d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`, mx, my };
}

/* per-node live metrics derived from rendered edges (kept stable via memo) */
interface NodeStats {
  degree: number;
  relCount: number;
  riskCount: number;
  score: number;            // avg health-ish (0..100)
  status: string;           // dominant status of incident rel edges
  hasRel: boolean;
}
function computeNodeStats(nodes: GNode[], edges: GEdge[]): Map<string, NodeStats> {
  const m = new Map<string, { degree: number; rel: GEdge[] }>();
  for (const n of nodes) m.set(n.id, { degree: 0, rel: [] });
  for (const e of edges) {
    const a = m.get(e.source);
    const b = m.get(e.target);
    if (a) { a.degree++; if (e.kind === 'relationship' || e.kind === 'person_relationship') a.rel.push(e); }
    if (b) { b.degree++; if (e.kind === 'relationship' || e.kind === 'person_relationship') b.rel.push(e); }
  }
  const out = new Map<string, NodeStats>();
  const statusOrder = ['ACTIVE', 'PROSPECTIVE', 'AT_RISK', 'WATCH', 'DORMANT', 'ARCHIVED'];
  for (const [id, v] of m) {
    const rels = v.rel;
    let riskCount = 0;
    let scoreSum = 0;
    const tally = new Map<string, number>();
    for (const e of rels) {
      const risk = Number.isFinite(e.risk) ? e.risk : 0;
      if (risk >= RISK_THRESHOLD) riskCount++;
      const health = Number.isFinite((e as any).health) ? (e as any).health : Math.max(0, Math.min(100, 100 - risk));
      scoreSum += health;
      const st = edgeStatus(e);
      tally.set(st, (tally.get(st) ?? 0) + 1);
    }
    let status = 'ACTIVE';
    let bestCount = -1;
    for (const s of statusOrder) {
      const c = tally.get(s) ?? 0;
      if (c > bestCount) { bestCount = c; status = s; }
    }
    out.set(id, {
      degree: v.degree,
      relCount: rels.length,
      riskCount,
      score: rels.length ? Math.round(scoreSum / rels.length) : 100,
      status,
      hasRel: rels.length > 0,
    });
  }
  return out;
}

function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const a0 = ((fromDeg - 90) * Math.PI) / 180;
  const a1 = ((toDeg - 90) * Math.PI) / 180;
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;
}

function scoreColor(score: number): string {
  if (score >= 75) return '#0E9F6E';
  if (score >= 45) return '#D97706';
  return '#DC2626';
}

/** چیپ سازمان در سینی/پنل دسته — کلیک = انتخاب، دابل‌کلیک = باز کردن صفحهٔ سازمان */
function TrayChip(props: { node: GNode; x: number; y: number; w: number; h: number; color: string; fontPx?: number; onSelect?: (n: GNode) => void; onOpen?: (n: GNode) => void }) {
  const { node, x, y, w, h, color, fontPx = 8.8, onSelect, onOpen } = props;
  const name = nodeDisplayName(node);
  return (
    <g
      style={{ cursor: 'pointer' }}
      onPointerDown={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(node); }}
      onDoubleClick={(e) => { e.stopPropagation(); onOpen?.(node); }}
    >
      <rect x={x} y={y} width={w} height={h} rx={h / 2}
        fill="var(--card-bg, #FFFFFF)" stroke={color} strokeWidth={1.1} />
      {/* RTL: نقطهٔ دسته سمت راست، متن در میانهٔ فضای باقی‌مانده (لنگر middle مستقل از جهت) */}
      <circle cx={x + w - h / 2} cy={y + h / 2} r={2.6} fill={color} />
      <text x={x + (w - h) / 2} y={y + h / 2 + fontPx * 0.36} textAnchor="middle"
        fontSize={fontPx} fontWeight={700} fill="var(--text-primary, #333)"
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {fitText(name, w - h - 10, 700, fontPx)}
      </text>
    </g>
  );
}

const NetworkGraph = forwardRef<NetworkGraphHandle, NetworkGraphProps>(function NetworkGraph(
  {
    graph,
    selectedNodeId,
    selectedEdgeId,
    focusNodeId,
    pathNodeIds,
    pathEdgeIds,
    analysisNodeIds,
    dimOthers = false,
    onNodeSelect,
    onNodeHover,
    onEdgeSelect,
    onEdgeHover,
    onRendered,
    onNodeOpen,
    onPathEnd,
    variant = 'nested',
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pos>({ x: 0, y: 0 });
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverRed, setHoverRed] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  /** پرسِ فعال: یا روی گره (برای کلیک/دابل‌کلیک) یا روی زمینه (برای پن نما). */
  const pressRef = useRef<
    | { kind: 'node'; id: string; x: number; y: number; t: number }
    | { kind: 'pan'; x: number; y: number; pan0: Pos }
    | null
  >(null);
  /** مقیاس واقعی SVG روی صفحه (عرض کادر ÷ عرض مختصات) — برای LOD و زوم اولیهٔ موبایل. */
  const [baseScale, setBaseScale] = useState(0);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBaseScale(Math.min(r.width / W, r.height / H));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  /** نمای فشرده (موبایل): متن گراف در مقیاس fit ناخواناست → زوم اولیهٔ بالاتر + برچسب افراد فقط بعد از بزرگ‌نمایی. */
  const compact = baseScale > 0 && baseScale < 0.45;
  const homeZoom = compact ? Math.min(3, Math.max(1, 0.6 / baseScale)) : 1;
  const screenScale = (baseScale || 1) * zoom;
  const minorLabels = !compact || screenScale >= 0.7;
  const userAdjustedZoomRef = useRef(false);
  useEffect(() => {
    if (baseScale > 0 && homeZoom > 1 && !userAdjustedZoomRef.current) setZoom(homeZoom);
  }, [baseScale, homeZoom]);
  const panRef = useRef<Pos>({ x: 0, y: 0 });
  useEffect(() => { panRef.current = pan; }, [pan]);
  const lastTapRef = useRef<{ id: string; t: number } | null>(null);
  /** پینچ لمسی: دو انگشت → زوم + جابه‌جایی با نقطۀ میانی. */
  const touchPtsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const zoomRef = useRef(1);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  /** دابل‌تپ روی زمینۀ گراف = زوم (و در سقف، بازگشت). */
  const bgTapRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const clampZoom = (v: number) => Math.min(3, Math.max(0.3, v));
  const twoFingerGeom = () => {
    const pts = [...touchPtsRef.current.values()];
    if (pts.length !== 2) return null;
    const [a, b] = pts;
    return { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  /* ─── نمای مرحله‌ای: تمرکز روی یک سازمان (پیش‌فرض: خودِ شرکت) ───
     کلیک روی سازمان → شبکهٔ خودِ آن سازمان: زیرمجموعه‌ها یک‌سو، روابط مستقیم سوی
     دیگر؛ بقیهٔ عموم‌ها در صفحهٔ اول به‌صورت خط‌های قرمز بخش‌بندی‌شده بر حسب دسته. */
  const nested = variant !== 'classic';
  const orgNodesAll = useMemo(() => graph.nodes.filter((n) => n.type === 'organization'), [graph.nodes]);
  const egoOrgNode = useMemo(() => orgNodesAll.find((n) => n.ego) ?? orgNodesAll[0] ?? null, [orgNodesAll]);
  const [crumbIds, setCrumbIds] = useState<string[]>([]);
  const [expandedTray, setExpandedTray] = useState<string | null>(null);
  /* برچسب کوتاه دسته‌ها برای چیپ‌ها */
  const TRAY_OTHER_FA = t('بدون دستهٔ عموم');
  const TRAY_OTHER_COLOR = '#64748B';
  const TRAY_SHORT_FA: Record<string, string> = {
    INTERNAL: t('داخلی'), INSTITUTIONAL: t('نهادی و حاکمیتی'), ACADEMIC: t('دانشگاهی و پژوهشی'),
    ECONOMIC: t('اقتصادی و سرمایه'), MEDIA: t('رسانه‌ای'), ECOSYSTEM: t('اکوسیستم فناوری'), OTHER: TRAY_OTHER_FA,
  };
  useEffect(() => {
    setCrumbIds((prev) => prev.filter((id) => graph.nodes.some((n) => n.id === id)));
    setExpandedTray(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.nodes]);

  const focusNode = useMemo(() => {
    if (!nested) return null;
    const last = crumbIds.length ? graph.nodes.find((n) => n.id === crumbIds[crumbIds.length - 1]) : null;
    return last && last.type === 'organization' ? last : egoOrgNode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crumbIds, graph.nodes, egoOrgNode, nested]);
  const isRoot = !focusNode || focusNode.id === egoOrgNode?.id;

  const clusters = useMemo(() => buildClusters(graph.nodes), [graph.nodes]);
  const sectorMeta = (cat: string) =>
    cat === 'OTHER'
      ? { fa: t('سایر سازمان‌ها'), shortFa: t('سایر'), color: TRAY_OTHER_COLOR }
      : { fa: PUBLIC_CATEGORY_META[cat]?.fa ?? cat, shortFa: TRAY_SHORT_FA[cat] ?? cat, color: PUBLIC_CATEGORY_META[cat]?.color ?? TRAY_OTHER_COLOR };

  /* مدل تمرکز: زیرمجموعه‌ها / روابط مستقیم / هلدینگ‌های بزرگ / عموم‌های بدون رابطه */
  const focusModel = useMemo<FocusModel | null>(() => {
    if (!nested || !focusNode) return null;
    const focusOrgId = focusNode.organizationId ?? bareId(focusNode.id);
    const parentCount = new Map<string, number>();
    for (const o of orgNodesAll) {
      const pid = o.parentOrganizationId ?? null;
      if (pid) parentCount.set(pid, (parentCount.get(pid) ?? 0) + 1);
    }
    const children = orgNodesAll.filter((o) => (o.parentOrganizationId ?? null) === focusOrgId);
    const childIds = new Set(children.map((o) => o.id));
    const neighborIds = new Set<string>();
    for (const e of graph.edges) {
      if (e.source === focusNode.id) neighborIds.add(e.target);
      else if (e.target === focusNode.id) neighborIds.add(e.source);
    }
    const relations = graph.nodes.filter((n) => n.id !== focusNode.id && !childIds.has(n.id) && neighborIds.has(n.id));
    /* هلدینگ‌های بزرگ (دارای زیرمجموعه) فقط در صفحهٔ اول — حتی بدون رابطهٔ مستقیم */
    let hubs: GNode[] = [];
    if (isRoot) {
      const hubOrgIds = new Set<string>();
      for (const o of orgNodesAll) {
        if (o.id === focusNode.id || childIds.has(o.id) || neighborIds.has(o.id)) continue;
        if ((parentCount.get(o.organizationId ?? bareId(o.id)) ?? 0) > 0) hubOrgIds.add(o.organizationId ?? bareId(o.id));
      }
      hubs = orgNodesAll.filter((o) => hubOrgIds.has(o.organizationId ?? bareId(o.id)));
    }
    /* خط قرمز فقط برای سازمان‌های « topLevel بی‌رابطه» — زیرمجموعهٔ هیچ سازمانی داخل
       والدش دیده می‌شود، نه به‌صورت خط قرمز */
    const redOrgs = isRoot
      ? orgNodesAll.filter((o) =>
          o.id !== focusNode.id &&
          !childIds.has(o.id) &&
          !neighborIds.has(o.id) &&
          !(o.parentOrganizationId ?? null) &&
          !hubs.some((h) => h.id === o.id),
        )
      : [];
    const egoOrgId = egoOrgNode?.organizationId ?? bareId(egoOrgNode?.id ?? '');
    const egoPersons = isRoot
      ? graph.nodes.filter((n) => n.type !== 'organization' && (n.organizationId ?? null) === egoOrgId)
      : [];
    return { children, relations, hubs, redOrgs, egoPersons, parentCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, nested, focusNode, isRoot, orgNodesAll]);

  useEffect(() => { setExpandedTray(null); }, [focusNode, variant]);
  const { positions, links, lines, sectors, focusCenter } = useMemo(() => {
    if (nested && focusNode && focusModel) {
      const lay = layoutFocus({ focus: focusNode, isRoot, model: focusModel, sectorMeta });
      const safe = graph.edges.filter((e) => lay.pos.has(e.source) && lay.pos.has(e.target));
      return { positions: lay.pos, links: safe, lines: lay.lines, sectors: lay.sectors, focusCenter: lay.center };
    }
    const pos = layout(clusters, graph.nodes);
    const safe = graph.edges.filter((e) => pos.has(e.source) && pos.has(e.target));
    return { positions: pos, links: safe, lines: [] as FocusLine[], sectors: [] as FocusSector[], focusCenter: { x: W / 2, y: H / 2 } as Pos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, clusters, nested, focusNode, focusModel, isRoot]);

  /* پنل بازشدهٔ دسته: شبکهٔ کاملِ اعضای آن دسته، مرتب در شبکه‌ای از چیپ‌ها */
  const panelGeo = useMemo(() => {
    const t = sectors.find((x) => x.key === expandedTray);
    if (!t) return null;
    const w = Math.min(1210, W - 90);
    const h = 620;
    const x = (W - w) / 2;
    const y = 64;
    const cols = 5;
    const chipW = (w - 48) / cols - 8;
    const chipH = 24;
    const rows = Math.max(1, Math.floor((h - 66) / 30));
    const capacity = cols * rows;
    const chipPos = new Map<string, Pos>();
    t.members.slice(0, capacity).forEach((m, j) => {
      const col = j % cols;
      const row = Math.floor(j / cols);
      chipPos.set(m.id, { x: x + 24 + col * (chipW + 10) + chipW / 2, y: y + 52 + row * 30 + chipH / 2 });
    });
    return { tray: t, x, y, w, h, cols, chipW, chipH, capacity, chipPos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedTray, sectors]);

  const chipPosAll = useMemo(() => {
    const m = new Map<string, Pos>();
    panelGeo?.chipPos.forEach((v, k) => m.set(k, v));
    return m;
  }, [panelGeo]);

  const nodeStats = useMemo(() => computeNodeStats(graph.nodes, links), [graph.nodes, links]);
  const idToNode = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const renderedNodeCount = nested ? positions.size + lines.length : graph.nodes.length;
  const renderedEdgeCount = links.length;
  const onRenderedRef = useRef(onRendered);
  useEffect(() => { onRenderedRef.current = onRendered; }, [onRendered]);
  useEffect(() => {
    onRenderedRef.current?.({ nodes: renderedNodeCount, edges: renderedEdgeCount });
  }, [renderedNodeCount, renderedEdgeCount]);

  /** موقعیت هر گره = چیدمان قطعی؛ گره‌های سینی = جای چیپ آن‌ها. */
  const posOf = (id: string): Pos => positions.get(id) ?? chipPosAll.get(id) ?? { x: 0, y: 0 };

  useImperativeHandle(ref, () => ({
    fit: () => { userAdjustedZoomRef.current = false; setZoom(homeZoom); setPan({ x: 0, y: 0 }); },
    reset: () => { userAdjustedZoomRef.current = false; setZoom(homeZoom); setPan({ x: 0, y: 0 }); },
    zoomBy: (factor: number) => { userAdjustedZoomRef.current = true; setZoom((z) => Math.min(3, Math.max(0.3, z * factor))); },
  }));

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      userAdjustedZoomRef.current = true;
      setZoom((z) => Math.min(3, Math.max(0.3, z * (e.deltaY < 0 ? 1.12 : 0.89))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const pathActive = Boolean(pathNodeIds && pathNodeIds.size > 0);
  const nodeAlpha = (id: string): number => {
    if (pathActive) return pathNodeIds?.has(id) ? 1 : 0.16;
    if (dimOthers && selectedNodeId != null && selectedNodeId !== id) return 0.32;
    return 1;
  };
  const edgeAlpha = (l: GEdge): number => {
    if (pathActive) return pathEdgeIds?.has(l.id) ? 1 : 0.07;
    if (dimOthers && selectedNodeId != null && l.source !== selectedNodeId && l.target !== selectedNodeId) return 0.24;
    return 1;
  };
  const edgeIsEmphasized = (l: GEdge) =>
    selectedEdgeId === l.id || hoverEdge === l.id || pathEdgeIds?.has(l.id) || analysisNodeIds?.has(l.id);
  const edgeColor = (l: GEdge): string => {
    if (pathEdgeIds?.has(l.id)) return '#B45309';
    if (selectedEdgeId === l.id) return '#3B4252';
    if (l.kind === 'membership' || l.kind === 'project') return '#AEB8CB';
    return statusMeta(edgeStatus(l)).color;
  };

  /* ---------------------------------------------------------------------
     تعامل پایدار: گره‌ها کشیدنی نیستند (کلیک = انتخاب، دابل‌کلیک = باز کردن).
     کشیدن فقط روی «زمینهٔ خالی» = پن نما. هیچ پرتاب/پرشی رخ نمی‌دهد.
     --------------------------------------------------------------------- */
  const CLICK_SLOP = 9; // px — هر جابجایی بیشتر از این = پن، نه کلیک
  const onSvgPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType !== 'mouse') touchPtsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchPtsRef.current.size === 2) {
      // انگشت دوم نشست → پن را ول کن و پینچ را ببند
      pressRef.current = null;
      setPanning(false);
      pinchRef.current = twoFingerGeom();
      return;
    }
    if ((e.target as Element) !== (e.currentTarget as Element)) return; // فقط خودِ بوم
    pressRef.current = { kind: 'pan', x: e.clientX, y: e.clientY, pan0: { ...panRef.current } };
    setPanning(true);
  };
  const onSvgPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' && touchPtsRef.current.has(e.pointerId)) {
      touchPtsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (touchPtsRef.current.size >= 2) {
      const g = twoFingerGeom();
      const base = pinchRef.current;
      if (g && base) {
        const el = svgRef.current;
        const rect = el?.getBoundingClientRect();
        const unit = rect && rect.width ? W / rect.width : 1;
        userAdjustedZoomRef.current = true;
        setZoom(clampZoom(zoomRef.current * (g.dist / base.dist)));
        setPan((panNow) => ({
          x: panNow.x - (g.cx - base.cx) * unit,
          y: panNow.y - (g.cy - base.cy) * unit,
        }));
        pinchRef.current = g;
      }
      return;
    }
    const p = pressRef.current;
    if (!p) return;
    if (p.kind === 'pan') {
      const el = svgRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width) return;
      const unit = W / rect.width; // پیکسل صفحه → واحد بوم
      setPan({
        x: p.pan0.x + (e.clientX - p.x) * unit,
        y: p.pan0.y + (e.clientY - p.y) * unit,
      });
      return;
    }
    // پرس روی گره: اگر ماوس بیش از آستانه جابه‌جا شد، کلیک منتفی و پن شروع می‌شود
    const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (dist > CLICK_SLOP) {
      pressRef.current = { kind: 'pan', x: p.x, y: p.y, pan0: { ...panRef.current } };
      setPanning(true);
    }
  };
  const onSvgPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') {
      touchPtsRef.current.delete(e.pointerId);
      if (touchPtsRef.current.size < 2) pinchRef.current = null;
    }
    const p = pressRef.current;
    pressRef.current = null;
    setPanning(false);
    // دابل‌تپ روی زمینۀ خالی: زوم ۱٫۶× (یا بازگشت اگر خیلی نزدیک باشیم)
    if (e.pointerType !== 'mouse' && (!p || p.kind === 'pan') && (e.target as Element) === (e.currentTarget as Element)) {
      const now = Date.now();
      const last = bgTapRef.current;
      const near = last && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 28;
      if (last && near && now - last.t < 380) {
        bgTapRef.current = null;
        userAdjustedZoomRef.current = true;
        setZoom((z) => (z >= 2.4 ? homeZoom : clampZoom(z * 1.6)));
      } else bgTapRef.current = { x: e.clientX, y: e.clientY, t: now };
    }
    if (!p || p.kind === 'pan') return;
    const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (dist > CLICK_SLOP) return;
    const n = idToNode.get(p.id);
    if (!n) return;
    /* نمای مرحله‌ای: کلیک روی سازمان = تمرکز روی شبکهٔ آن (زیرمجموعه‌ها/روابط) */
    if (nested && n.type === 'organization' && n.id !== focusNode?.id) {
      setCrumbIds((prev) => [...prev, n.id]);
      setExpandedTray(null);
      onNodeSelect?.(n);
      lastTapRef.current = { id: n.id, t: Date.now() };
      return;
    }
    onNodeSelect?.(n);
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === n.id && now - last.t < 420) {
      lastTapRef.current = null;
      if (onNodeOpen) {
        const prefix = n.type === 'organization' ? 'organizations' : n.type === 'person' ? 'people' : 'projects';
        const bare = n.id.slice(n.id.indexOf(':') + 1);
        onNodeOpen(`/${prefix}/${bare}`);
      }
      return;
    }
    lastTapRef.current = { id: n.id, t: now };
  };
  const clearPress = () => {
    pressRef.current = null;
    setPanning(false);
    if (touchPtsRef.current.size < 2) pinchRef.current = null;
    touchPtsRef.current.clear();
  };

  const onNodePointerDown = (e: React.PointerEvent, n: GNode) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); // جلوی فوکوس/انتخاب متن/رفتار پیش‌فرض را می‌گیرد
    e.stopPropagation(); // شروع پنِ بوم را لغو می‌کند
    pressRef.current = { kind: 'node', id: n.id, x: e.clientX, y: e.clientY, t: Date.now() };
  };

  const nodeAccent = (id: string): string | null => {
    if (pathNodeIds?.has(id)) return '#B45309';
    if (analysisNodeIds?.has(id)) return '#B45309';
    return null;
  };

  // cluster bubble geometry — فقط نمای کلاسیک (نمای مرحله‌ای بدون حباب است)
  const bubbles = useMemo(() => {
    const out: Array<{
      key: string;
      tint: (typeof CLUSTER_TINTS)[number];
      x: number; y: number; w: number; h: number;
      labelX: number; labelY: number;
      ids: Set<string>;
      root: GNode;
    }> = [];
    clusters.forEach((c, idx) => {
      const tint = CLUSTER_TINTS[idx % CLUSTER_TINTS.length];
      const pts: Array<{ x: number; y: number; n: GNode }> = [];
      const push = (n: GNode) => { const p = positions.get(n.id); if (p) pts.push({ ...p, n }); };
      push(c.root);
      c.members.forEach(push);
      if (!pts.length) return;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const padX = Math.max(CLUSTER_PAD, ...pts.map((p) => visualHalf(p.n.type, nodeDisplayName(p.n))));
      const minX = Math.min(...xs) - padX;
      const maxX = Math.max(...xs) + padX;
      const topMost = Math.min(...pts.map((p) => p.y - visualHalf(p.n.type, nodeDisplayName(p.n))));
      const bottomMost = Math.max(...pts.map((p) => p.y + bottomPad(p.n.type)));
      const top = topMost - 64;
      const bottom = bottomMost + 36;
      if (nested) return out;
      const w = Math.max(258, maxX - minX + 48);
      const h = Math.max(190, bottom - top);
      const x = minX + (maxX - minX) / 2 - w / 2;
      const y = top;
      out.push({
        key: c.root.id,
        tint,
        x, y, w, h,
        labelX: x + w / 2,
        labelY: y + 24,
        ids: new Set([c.root.id, ...c.members.map((m) => m.id)]),
        root: c.root,
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, graph.nodes.length]);

  const bubbleAlpha = (ids: Set<string>): number => {
    if (pathActive) {
      let any = false;
      ids.forEach((id) => { if (pathNodeIds?.has(id)) any = true; });
      return any ? 1 : 0.3;
    }
    if (dimOthers && selectedNodeId != null && !ids.has(selectedNodeId)) return 0.42;
    return 1;
  };
  const isRel = (l: GEdge) => l.kind === 'relationship' || l.kind === 'person_relationship';

  const selNode = selectedNodeId ? idToNode.get(selectedNodeId) ?? null : null;
  const hovered = hoverNode ? idToNode.get(hoverNode) ?? null : null;
  const cardNode = selNode ?? (hovered && !selNode ? hovered : null);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`${-pan.x} ${-pan.y} ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', touchAction: 'none', cursor: panning ? 'grabbing' : 'default' }}
      role="img"
      aria-label={t('گراف شبکه روابط — نمای مرحله‌ای: زیرمجموعه‌ها، روابط مستقیم و عموم‌ها')}
      onPointerDown={onSvgPointerDown}
      onPointerMove={onSvgPointerMove}
      onPointerUp={onSvgPointerUp}
      onPointerCancel={clearPress}
      onPointerLeave={clearPress}
    >
      <defs>
        <linearGradient id="g-org" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6C8FF7" />
          <stop offset="100%" stopColor="#3B5BDB" />
        </linearGradient>
        <linearGradient id="g-person" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2ED3A6" />
          <stop offset="100%" stopColor="#0E9F6E" />
        </linearGradient>
        <linearGradient id="g-project" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <filter id="node-shadow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="2.6" floodColor="#0F172A" floodOpacity="0.2" />
        </filter>
        <filter id="node-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="4.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="bg-soft" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* soft inner glow so the workspace feels deep, not flat */}
      <rect x={0} y={0} width={W} height={H} fill="url(#bg-soft)" opacity={0.5} pointerEvents="none" />
      <rect x={8} y={8} width={W - 16} height={H - 16} rx={26} fill="none"
        stroke="var(--card-border, #E6EAF2)" strokeWidth={1.2} opacity={0.7} pointerEvents="none" />

      <g transform={`translate(${W / 2 * (1 - zoom)} ${H / 2 * (1 - zoom)}) scale(${zoom})`} style={{ transformOrigin: '0 0' }}>
        {/* ==== شبکهٔ فعال (در نمای دسته‌ای، هنگام باز بودن پنل دسته کمرنگ می‌شود) ==== */}
        <g opacity={expandedTray ? 0.13 : 1} pointerEvents={expandedTray ? 'none' : undefined}
          style={{ transition: 'opacity .18s ease' }}>
        {/* ============ cluster bubbles ============ */}
        {bubbles.map((b) => {
          const st = nodeStats.get(b.root.id);
          const dotColor = st?.hasRel ? statusMeta(st.status).color : null;
          return (
            <g key={b.key} opacity={bubbleAlpha(b.ids)} style={{ transition: 'opacity .18s ease' }} pointerEvents="none">
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={32} fill={b.tint.fill} stroke={b.tint.stroke} strokeWidth={1.3} />
              <rect x={b.x} y={b.y} width={b.w} height={6} rx={3} fill={b.tint.stroke} opacity={0.28} />
              {/* label pill — عرض از اندازهٔ واقعی متن محاسبه می‌شود و متن داخل کادر کلاپ می‌شود */}
              {(() => {
                const memberCount = b.ids.size - 1;
                const nameText = nodeDisplayName(b.root).length > 26 ? nodeDisplayName(b.root).slice(0, 25) + '…' : nodeDisplayName(b.root);
                const labelText = memberCount > 0 ? `${nameText} · ${new Intl.NumberFormat(localeTag()).format(memberCount)}` : nameText;
                const pillW = Math.max(108, Math.ceil(textWidth(labelText, 800, 11)) + 40 + (dotColor ? 14 : 0));
                const pillX = b.labelX - pillW / 2;
                return (
                  <>
                    <clipPath id={`pill-clip-${safeId(b.key)}`}>
                      <rect x={pillX} y={b.y + 12} width={pillW} height={25} rx={12} />
                    </clipPath>
                    <rect x={pillX} y={b.y + 13} width={pillW} height={23} rx={12}
                      fill="var(--card-bg, #FFFFFF)" stroke={b.tint.stroke} strokeWidth={1} />
                    {dotColor && <circle cx={pillX + 13} cy={b.y + 24.5} r={3.4} fill={dotColor} />}
                  </>
                );
              })()}
              <text
                x={b.labelX + (dotColor ? 6 : 0)} y={b.y + 28.5}
                textAnchor="middle" fontSize={11} fontWeight={800}
                fill="var(--text-secondary, #667085)"
                clipPath={`url(#pill-clip-${safeId(b.key)})`}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {(() => { const mc = b.ids.size - 1; const nt = nodeDisplayName(b.root).length > 26 ? nodeDisplayName(b.root).slice(0, 25) + '…' : nodeDisplayName(b.root); return mc > 0 ? `${nt} · ${new Intl.NumberFormat(localeTag()).format(mc)}` : nt; })()}
              </text>
            </g>
          );
        })}

        {/* ============ edges ============ */}
        {links.map((l) => {
          const a = posOf(l.source);
          const b = posOf(l.target);
          const mem = l.kind === 'membership';
          const prj = l.kind === 'project';
          const geo = mem || prj ? { d: membership(a, b), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 } : curve(a, b);
          const meta = statusMeta(edgeStatus(l));
          const emphasized = edgeIsEmphasized(l);
          const alpha = edgeAlpha(l);
          const selected = selectedEdgeId === l.id;
          const isPath = Boolean(pathEdgeIds?.has(l.id));
          const relKind = isRel(l);
          const baseWidth = mem ? 1.2 : prj ? 1.6 : relKind ? Math.min(3.6, Math.max(1.4, 1.4 + (Number.isFinite(l.weight) ? l.weight : 40) / 40)) : 1.6;
          const width = mem ? 1.2 : selected ? baseWidth + 1.8 : emphasized ? baseWidth + 0.9 : baseWidth;
          const stroke = edgeColor(l);
          const dash = mem ? [2, 3] : prj ? undefined : relKind ? meta.dash : undefined;
          const risky = relKind && Number.isFinite(l.risk) && l.risk >= RISK_THRESHOLD;
          return (
            <g key={l.id} opacity={alpha} style={{ transition: 'opacity .18s ease' }}>
              <path d={geo.d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }}
                onPointerEnter={() => { setHoverEdge(l.id); onEdgeHover && onEdgeHover(l.id); }}
                onPointerLeave={() => { setHoverEdge(null); onEdgeHover && onEdgeHover(null); }}
                onPointerDown={(e) => { e.stopPropagation(); }}
                onClick={() => onEdgeSelect && onEdgeSelect(l.id)} />
              {/* soft halo under emphasized/risky edges */}
              {(emphasized || risky || isPath) && (
                <path d={geo.d} fill="none" stroke={stroke} strokeWidth={width + 5} opacity={risky ? 0.14 : 0.1}
                  strokeLinecap="round" style={{ pointerEvents: 'none' }} />
              )}
              <path d={geo.d} fill="none" stroke={stroke} strokeWidth={width}
                strokeDasharray={isPath ? '16 8' : dash?.join(' ')} strokeLinecap="round"
                style={{ pointerEvents: 'none', transition: 'stroke-width .12s ease' }}>
                {isPath && (
                  <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="1.15s" repeatCount="indefinite" />
                )}
              </path>
              {/* midpoint status marker (org-org rels always; person edges when emphasized) */}
              {relKind && (emphasized || (l.kind === 'relationship' && zoom >= 0.45)) && (
                <g style={{ pointerEvents: 'none' }}>
                  {emphasized && zoom >= 0.72 && l.kind === 'relationship' ? (
                    <>
                      <rect
                        x={geo.mx - 30} y={geo.my - 24}
                        width={60} height={17} rx={8.5}
                        fill="var(--card-bg, #FFFFFF)" stroke={meta.color} strokeWidth={1.1}
                      />
                      <circle cx={geo.mx - 24} cy={geo.my - 15.5} r={3} fill={selected ? '#3B4252' : meta.color} />
                      <text x={geo.mx + 3} y={geo.my - 11.5} fontSize={8.6} fontWeight={800} fill={meta.color}
                        textAnchor="middle" style={{ userSelect: 'none' }}>
                        {statusMeta(edgeStatus(l)).label}
                      </text>
                    </>
                  ) : (
                    <circle cx={geo.mx} cy={geo.my} r={emphasized ? 4.4 : 3.1}
                      fill={selected ? '#3B4252' : meta.color}
                      stroke="var(--card-bg, #FFFFFF)" strokeWidth={1.8} />
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* ============ nodes ============ */}
        {(nested ? graph.nodes.filter((n) => positions.has(n.id)) : graph.nodes).map((n) => {
          const p = posOf(n.id);
          const alpha = nodeAlpha(n.id);
          const acc = nodeAccent(n.id);
          const selected = selectedNodeId === n.id;
          const hoveredLocal = hoverNode === n.id;
          const focused = focusNodeId === n.id;
          const name = nodeDisplayName(n);
          const isOrg = n.type === 'organization';
          const catColor = nodeCategoryColor(n);
          const grad = acc ?? catColor ?? nodeGrad(n);
          const st = nodeStats.get(n.id) ?? { degree: 0, relCount: 0, riskCount: 0, score: 100, status: 'ACTIVE', hasRel: false };
          const metaColor = st.hasRel ? statusMeta(st.status).color : null;
          const glow = focused || selected || (pathActive && pathNodeIds?.has(n.id));
          const ringColor = selected ? '#3B4252' : focused ? '#2563EB' : null;
          const haloR = isOrg ? 30 : st.degree >= 3 ? PERSON_R + 6.5 : null;
          return (
            <g
              key={n.id}
              data-ego={n.ego ? 'true' : undefined}
              data-nt={n.type}
              data-cat={n.category ?? undefined}
              opacity={alpha}
              style={{ cursor: 'pointer', transition: 'opacity .18s ease' }}
              onPointerEnter={() => { setHoverNode(n.id); onNodeHover && onNodeHover(n); }}
              onPointerLeave={() => { setHoverNode(null); onNodeHover && onNodeHover(null); }}
              onPointerDown={(e) => onNodePointerDown(e, n)}
            >
              {/* soft influence halo (people with many links) */}
              {haloR && (
                <circle cx={p.x} cy={p.y} r={haloR} fill={grad} opacity={isOrg ? 0 : 0.1} style={{ pointerEvents: 'none' }} />
              )}

              {/* selection / hover / path rings */}
              {hoveredLocal && !selected && (
                isOrg ? (
                  <rect x={p.x - ORG_SIZE / 2 - 3.5} y={p.y - ORG_SIZE / 2 - 3.5} width={ORG_SIZE + 7} height={ORG_SIZE + 7}
                    rx={18} fill="none" stroke="#2563EB" strokeWidth={1.4} opacity={0.55} />
                ) : (
                  <circle cx={p.x} cy={p.y} r={(n.type === 'project' ? PROJECT_R : PERSON_R) + 5.5}
                    fill="none" stroke="#2563EB" strokeWidth={1.4} opacity={0.55} />
                )
              )}
              {selected && (
                <>
                  {isOrg ? (
                    <rect x={p.x - ORG_SIZE / 2 - 4.5} y={p.y - ORG_SIZE / 2 - 4.5} width={ORG_SIZE + 9} height={ORG_SIZE + 9}
                      rx={19} fill="none" stroke={ringColor ?? '#3B4252'} strokeWidth={2.2}
                      style={{ filter: 'url(#node-glow)', pointerEvents: 'none' }} />
                  ) : (
                    <circle cx={p.x} cy={p.y} r={(n.type === 'project' ? PROJECT_R : PERSON_R) + 7}
                      fill="none" stroke={ringColor ?? '#3B4252'} strokeWidth={2.2}
                      style={{ filter: 'url(#node-glow)', pointerEvents: 'none' }} />
                  )}
                </>
              )}
              {focused && (
                isOrg ? (
                  <rect x={p.x - ORG_SIZE / 2 - 8} y={p.y - ORG_SIZE / 2 - 8} width={ORG_SIZE + 16} height={ORG_SIZE + 16}
                    rx={21} fill="none" stroke="#2563EB" strokeWidth={1.5} strokeDasharray="3 4" />
                ) : (
                  <circle cx={p.x} cy={p.y} r={(n.type === 'project' ? PROJECT_R : PERSON_R) + 10}
                    fill="none" stroke="#2563EB" strokeWidth={1.5} strokeDasharray="3 4" />
                )
              )}

              {isOrg ? (
                /* ---- glass card: white tile + gradient avatar + health ring ---- */
                <g filter={glow ? 'url(#node-glow)' : undefined}>
                  {/* health progress ring (score of incident relationships) */}
                  {st.hasRel && !acc && (
                    <circle cx={p.x} cy={p.y} r={ORG_SIZE / 2 + 2.5} fill="none"
                      stroke={scoreColor(st.score)} strokeWidth={2}
                      strokeDasharray={`${(st.score / 100) * 2 * Math.PI * (ORG_SIZE / 2 + 2.5)} ${2 * Math.PI * (ORG_SIZE / 2 + 2.5)}`}
                      strokeLinecap="round" transform={`rotate(-90 ${p.x} ${p.y})`} opacity={0.85} />
                  )}
                  <rect x={p.x - ORG_SIZE / 2} y={p.y - ORG_SIZE / 2} width={ORG_SIZE} height={ORG_SIZE}
                    rx={15} fill={acc ? acc : 'var(--card-bg, #FFFFFF)'}
                    stroke={acc ? acc : hoveredLocal ? '#9DB4F5' : 'var(--card-border-strong, #DDE3EE)'}
                    strokeWidth={1.6} />
                  <rect x={p.x - 15.5} y={p.y - 15.5} width={31} height={31} rx={10}
                    fill={grad} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={1.2} />
                  <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize={15} fontWeight={800}
                    fill="#FFFFFF" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {initialOf(name)}
                  </text>
                  {/* risk badge */}
                  {st.riskCount > 0 && !acc && (
                    <g style={{ pointerEvents: 'none' }}>
                      <circle cx={p.x + ORG_SIZE / 2 - 6} cy={p.y - ORG_SIZE / 2 + 6} r={8} fill="#DC2626"
                        stroke="#FFFFFF" strokeWidth={1.6} />
                      <text x={p.x + ORG_SIZE / 2 - 6} y={p.y - ORG_SIZE / 2 + 8.8} textAnchor="middle"
                        fontSize={st.riskCount > 9 ? 7 : 8.4} fontWeight={900} fill="#FFFFFF">
                        {st.riskCount > 9 ? '!' : st.riskCount}
                      </text>
                    </g>
                  )}
                </g>
              ) : n.type === 'project' ? (
                <g filter="url(#node-shadow)">
                  <polygon
                    points={`${p.x},${p.y - PROJECT_R * 1.3} ${p.x + PROJECT_R * 1.2},${p.y + PROJECT_R * 0.9} ${p.x - PROJECT_R * 1.2},${p.y + PROJECT_R * 0.9}`}
                    fill={grad} stroke="#FFFFFF" strokeWidth={1.7} strokeLinejoin="round"
                  />
                  <text x={p.x} y={p.y + 2} textAnchor="middle" fontSize={8} fontWeight={800} fill="#FFFFFF"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {initialOf(name)}
                  </text>
                </g>
              ) : (
                /* ---- person: orbit dot + status dot ---- */
                <g filter={glow ? 'url(#node-glow)' : 'url(#node-shadow)'}>
                  <circle cx={p.x} cy={p.y} r={PERSON_R + (hoveredLocal ? 1.5 : 0)} fill={grad} stroke="#FFFFFF" strokeWidth={1.9} />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={hoveredLocal ? 8.6 : 8} fontWeight={800} fill="#FFFFFF"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {initialOf(name)}
                  </text>
                  {metaColor && st.riskCount > 0 && (
                    <circle cx={p.x + 7} cy={p.y - 7} r={4.2} fill={metaColor} stroke="#FFFFFF" strokeWidth={1.4}
                      style={{ pointerEvents: 'none' }} />
                  )}
                </g>
              )}

              {/* P3: نشان «خودِ شرکت» (ego) */}
              {nested && n.type === 'organization' && !n.ego && (focusModel?.parentCount.get(n.organizationId ?? bareId(n.id)) ?? 0) > 0 && (() => {
                const cCount = faNum(focusModel!.parentCount.get(n.organizationId ?? bareId(n.id)) ?? 0);
                const bLabel = `${cCount} ${t('زیرمجموعه')}`;
                const bW = Math.ceil(textWidth(bLabel, 800, 8.6)) + 14;
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x={p.x - bW / 2} y={p.y - ORG_SIZE / 2 - 24} width={bW} height={16} rx={8}
                      fill="var(--card-bg, #FFFFFF)" stroke={catColor ?? '#94A3B8'} strokeWidth={1} />
                    <text x={p.x} y={p.y - ORG_SIZE / 2 - 12.5} textAnchor="middle" fontSize={8.6} fontWeight={800}
                      fill={catColor ?? '#556070'} style={{ userSelect: 'none' }}>{bLabel}</text>
                  </g>
                );
              })()}
              {/* حلقهٔ تمرکز فعلی (سازمانی که شبکه‌اش باز است) */}
              {nested && n.id === focusNode?.id && !n.ego && (
                <rect x={p.x - ORG_SIZE / 2 - 6} y={p.y - ORG_SIZE / 2 - 6} width={ORG_SIZE + 12} height={ORG_SIZE + 12} rx={20}
                  fill="none" stroke="#3B4252" strokeWidth={1.6} strokeDasharray="6 4" opacity={0.6} style={{ pointerEvents: 'none' }} />
              )}

              {n.ego && (
                <>
                  {isOrg ? (
                    <rect x={p.x - ORG_SIZE / 2 - 5.5} y={p.y - ORG_SIZE / 2 - 5.5} width={ORG_SIZE + 11} height={ORG_SIZE + 11}
                      rx={19} fill="none" stroke={EGO_COLOR} strokeWidth={2.6}
                      strokeDasharray="5 4" opacity={0.95} style={{ pointerEvents: 'none' }} />
                  ) : (
                    <circle cx={p.x} cy={p.y} r={(n.type === 'project' ? PROJECT_R : PERSON_R) + 8}
                      fill="none" stroke={EGO_COLOR} strokeWidth={2.6}
                      strokeDasharray="5 4" opacity={0.95} style={{ pointerEvents: 'none' }} />
                  )}
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x={p.x - 17} y={p.y - (isOrg ? ORG_SIZE / 2 + 30 : 34)} width={34} height={14} rx={7}
                      fill={EGO_COLOR} />
                    <text x={p.x} y={p.y - (isOrg ? ORG_SIZE / 2 + 30 : 34) + 10} textAnchor="middle"
                      fontSize={8.6} fontWeight={900} fill="#FFFFFF">{EGO_FA}</text>
                  </g>
                </>
              )}

              {/* label under node — LOD: در نمای فشردهٔ موبایل pill خوشه نام سازمان را دارد؛
                  برچسب زیر گرهٔ سازمان فقط بعد از بزرگ‌نمایی، و برچسب افراد/پروژه‌ها فقط در زوم نزدیک */}
              {(() => {
                const showLabel = isOrg ? (nested || !compact || minorLabels) : minorLabels;
                if (!showLabel) return null;
                const maxChars = isOrg ? (compact ? 14 : 20) : 16;
                return (
                  <text
                    x={p.x}
                    y={p.y + (isOrg ? ORG_SIZE / 2 + 15 : (n.type === 'project' ? PROJECT_R : PERSON_R) + 16.5)}
                    textAnchor="middle"
                    fontSize={isOrg ? 11.6 : 10.4}
                    fontWeight={isOrg ? 700 : 600}
                    fill={selected ? 'var(--srip-accent-text, #2457D6)' : 'var(--text-primary, #3B4252)'}
                    stroke="var(--card-bg, #FFFFFF)"
                    strokeWidth={3.2}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name}
                  </text>
                );
              })()}
            </g>
          );
        })}
        </g>{/* پایان شبکهٔ فعال */}

        {/* ============ خط‌های قرمز عموم‌ها (نمای مرحله‌ای — فقط صفحهٔ اول) ============ */}
        {nested && !expandedTray && lines.length > 0 && (
          <g data-redlines="true">
            {lines.map((l) => {
              const hoveredLine = hoverRed === l.id;
              const ln = idToNode.get(l.id);
              return (
                <g key={l.id} data-redline={l.cat}>
                  <line x1={focusCenter.x} y1={focusCenter.y} x2={l.x} y2={l.y}
                    stroke={RED_LINE_COLOR} strokeOpacity={hoveredLine ? 0.9 : 0.38}
                    strokeWidth={hoveredLine ? 1.8 : 1} style={{ pointerEvents: 'none' }} />
                  {/* نقطهٔ پایان خط = خودِ سازمان عموم — کلیک = انتخاب، دابل‌کلیک = صفحه */}
                  <circle cx={l.x} cy={l.y} r={9} fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onPointerEnter={() => setHoverRed(l.id)}
                    onPointerLeave={() => setHoverRed((h) => (h === l.id ? null : h))}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); if (ln) onNodeSelect?.(ln); }}
                    onDoubleClick={(e) => { e.stopPropagation(); onNodeOpen?.(`/organizations/${l.id.slice(4)}`); }} />
                  <circle cx={l.x} cy={l.y} r={hoveredLine ? 4.8 : 3.4} fill={l.color} stroke="#FFFFFF" strokeWidth={1.1}
                    style={{ pointerEvents: 'none' }} />
                  {hoveredLine && ln && (() => {
                    const nm = nodeDisplayName(ln);
                    const bw2 = Math.ceil(textWidth(nm, 700, 10.2)) + 18;
                    const by = l.y > 64 ? l.y - 32 : l.y + 12;
                    return (
                      <g style={{ pointerEvents: 'none' }}>
                        <rect x={l.x - bw2 / 2} y={by} width={bw2} height={20} rx={10}
                          fill="var(--card-bg, #FFFFFF)" stroke={l.color} strokeWidth={1} style={{ filter: 'url(#node-shadow)' }} />
                        <text x={l.x} y={by + 14} textAnchor="middle" fontSize={10.2} fontWeight={700}
                          fill="var(--text-primary, #333)" style={{ userSelect: 'none' }}>{fitText(nm, bw2 - 10, 700, 10.2)}</text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </g>
        )}

        {/* ============ سرستون‌ها: زیرمجموعه‌ها/هلدینگ‌ها (راست) · روابط مستقیم (چپ) ============ */}
        {nested && !expandedTray && (() => {
          if (!focusModel) return null;
          const capR = focusModel.children.length || focusModel.hubs.length
            ? [focusModel.children.length ? t('زیرمجموعه‌ها') : '', focusModel.hubs.length ? t('هلدینگ‌های بزرگ') : ''].filter(Boolean).join(t('و'))
            : '';
          const capL = focusModel.relations.length ? t('روابط مستقیم') : '';
          if (!capR && !capL) return null;
          const capX = (side: 1 | -1) => {
            const items = side === 1 ? focusModel!.children.length + focusModel!.hubs.length : focusModel!.relations.length;
            const cols = items <= 7 ? 1 : 2;
            return W / 2 + side * (340 + ((cols - 1) * 250) / 2);
          };
          return (
            <g style={{ pointerEvents: 'none' }}>
              {capR && <text x={capX(1)} y={78} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="var(--text-muted, #7A8699)" style={{ userSelect: 'none' }}>{capR}</text>}
              {capL && <text x={capX(-1)} y={78} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="var(--text-muted, #7A8699)" style={{ userSelect: 'none' }}>{capL}</text>}
            </g>
          );
        })()}

        {/* ============ راهنما وقتی شبکهٔ سازمانِ تمرکز خالی است ============ */}
        {nested && focusModel && !focusModel.children.length && !focusModel.relations.length && !focusModel.hubs.length && !lines.length && (
          <text x={W / 2} y={520} textAnchor="middle" fontSize={11.5} fontWeight={700}
            fill="var(--text-muted, #7A8699)" style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {t('این سازمان هنوز زیرمجموعه یا رابطهٔ ثبت‌شده‌ای ندارد')}
          </text>
        )}

        {/* ============ پنل دستهٔ باز‌شده — همهٔ اعضا، شبکه‌ای و مرتب ============ */}
        {nested && panelGeo && (() => {
          const pg = panelGeo;
          const t = pg.tray;
          const shown = t.members.slice(0, pg.capacity);
          const rest = t.members.length - shown.length;
          return (
            <g data-tray-panel={t.key}>
              <rect x={0} y={0} width={W} height={H} fill="#F6F8FC" opacity={0.55}
                style={{ cursor: 'default' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setExpandedTray(null); }} />
              <rect x={pg.x} y={pg.y} width={pg.w} height={pg.h} rx={18}
                fill="var(--card-bg, #FFFFFF)" stroke={t.color} strokeWidth={1.4}
                style={{ filter: 'url(#node-shadow)' }} />
              <rect x={pg.x} y={pg.y} width={pg.w} height={38} rx={18} fill={t.color} opacity={0.09} />
              {/* RTL: عنوان دسته سمت راست (لنگر start = لبهٔ راست در RTL) */}
              <circle cx={pg.x + pg.w - 19} cy={pg.y + 19} r={5} fill={t.color} />
              <text x={pg.x + pg.w - 31} y={pg.y + 23.5} fontSize={13} fontWeight={800}
                fill="var(--text-primary, #2A3040)" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {fitText(t.fa, pg.w - 300, 800, 13)}
              </text>
              <text x={pg.x + pg.w - 43 - textWidth(fitText(t.fa, pg.w - 300, 800, 13), 800, 13) - 10} y={pg.y + 23.5} fontSize={10.5} fontWeight={700}
                fill="var(--text-muted, #7A8699)" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {new Intl.NumberFormat(localeTag()).format(t.members.length)} سازمان — کلیک = انتخاب · دابل‌کلیک = صفحهٔ سازمان
              </text>
              {/* بستن پنل — سمت چپ */}
              <g style={{ cursor: 'pointer' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setExpandedTray(null); }}>
                <rect x={pg.x + 12} y={pg.y + 8} width={30} height={22} rx={11} fill="#3B4252" opacity={0.08} />
                <text x={pg.x + 27} y={pg.y + 23.5} textAnchor="middle" fontSize={12} fontWeight={800}
                  fill="var(--text-secondary, #556070)" style={{ pointerEvents: 'none', userSelect: 'none' }}>✕</text>
              </g>
              {shown.map((m, j) => {
                const col = j % pg.cols;
                const row = Math.floor(j / pg.cols);
                return (
                  <TrayChip key={m.id} node={m} x={pg.x + 24 + col * (pg.chipW + 10)} y={pg.y + 52 + row * 30}
                    w={pg.chipW} h={pg.chipH} color={t.color} fontPx={9.4}
                    onSelect={(n) => onNodeSelect?.(n)}
                    onOpen={(n) => onNodeOpen?.(`/organizations/${n.organizationId ?? bareId(n.id)}`)} />
                );
              })}
              {rest > 0 && (
                <text x={pg.x + pg.w / 2} y={pg.y + pg.h - 14} textAnchor="middle" fontSize={9.6} fontWeight={700}
                  fill="var(--text-muted, #7A8699)" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  نمایش {new Intl.NumberFormat(localeTag()).format(shown.length)} از {new Intl.NumberFormat(localeTag()).format(t.members.length)} — برای یافتن سریع، از جستجوی نوار بالا استفاده کنید
                </text>
              )}
            </g>
          );
        })()}

        {/* ============ floating info card (hover/selection) ============ */}
        {cardNode && !pathActive && (() => {
          const p = posOf(cardNode.id);
          const st = nodeStats.get(cardNode.id) ?? { degree: 0, relCount: 0, riskCount: 0, score: 100, status: 'ACTIVE', hasRel: false };
          const isOrgCard = cardNode.type === 'organization';
          const metaC = st.hasRel ? statusMeta(st.status).color : null;
          const name = nodeDisplayName(cardNode);
          const line1 = `${TYPE_FA[cardNode.type] ?? cardNode.type}${metaC ? ` ${t('· وضعیت غالب:')} ${statusMeta(st.status).label}` : ''}`;
          const line2 = st.hasRel
            ? `${st.relCount} ${t('رابطه')}${st.riskCount ? ` · ${st.riskCount} ${t('پرریسک ⚠')}` : ''} · ${st.degree} ${t('پیوند')}`
            : `${st.degree} ${t('پیوند')}`;
          const hint = t('کلیک = جزئیات · دابل‌کلیک = صفحه');
          const nameRaw = name.length > 30 ? name.slice(0, 29) + '…' : name;
          /* عرض کارت از اندازهٔ واقعی هر خط محاسبه می‌شود تا متن از کادر بیرون نزند */
          const wName = textWidth(nameRaw, 800, 11.5);
          const wLine1 = textWidth(line1, 700, 9.2);
          const wLine2 = textWidth(line2, 600, 9.6);
          const hintW = textWidth(hint, 800, 8.6);
          const hintWc = Math.min(hintW, 110);
          const showHint = !(selectedNodeId === cardNode.id) && (wName + 24 + hintWc + 26) <= 320;
          const padL = 24, padR = showHint ? 16 : 14;
          const wCard = Math.min(340, Math.max(196, Math.ceil(Math.max(wName, wLine1, wLine2) + padL + padR + (showHint ? hintWc : 0))));
          /* به‌خاطر راست‌به‌چپ: متن از لبهٔ راست شروع می‌شود، پس فاصلهٔ داخلیِ راست باید شامل راهنما هم باشد */
          const rightInset = showHint ? padR + hintWc : padR;
          const innerW = wCard - padL - rightInset;
          const nameFinal = fitText(nameRaw, innerW, 800, 11.5);
          const line1Final = fitText(line1, innerW, 700, 9.2);
          const line2Final = fitText(line2, innerW, 600, 9.6);
          const hCard = isOrgCard ? 92 : 64;
          let cx = Math.min(Math.max(p.x, 100 + wCard / 2), W - 100 - wCard / 2);
          const above = p.y > 260;
          const cy = above ? p.y - (isOrgCard ? ORG_SIZE / 2 + hCard + 26 : PERSON_R + hCard + 22) : p.y + (isOrgCard ? ORG_SIZE / 2 + 58 : PERSON_R + 58);
          const x0 = cx - wCard / 2;
          const y0 = cy;
          const selectedCard = selectedNodeId === cardNode.id;
          const cardClip = `card-clip-${safeId(cardNode.id)}`;
          return (
            <g
              key={`card-${cardNode.id}`}
              style={{ pointerEvents: 'none' }}
              opacity={selectedCard ? 1 : 0.96}
            >
              <clipPath id={cardClip}>
                <rect x={x0} y={y0} width={wCard} height={hCard} rx={14} />
              </clipPath>
              <rect x={x0} y={y0} width={wCard} height={hCard} rx={14}
                fill="var(--card-bg, #FFFFFF)"
                stroke={metaC ?? 'var(--card-border-strong, #DDE3EE)'} strokeWidth={1.2}
                style={{ filter: 'url(#node-shadow)' }} />
              <circle cx={x0 + 13} cy={y0 + (isOrgCard ? 15 : 14)} r={4} fill={metaC ?? '#94A3B8'} />
              <g clipPath={`url(#${cardClip})`}>
                {/* جهت فارسی راست‌به‌چپ: لنگر متن در لبهٔ راستِ کادر است تا از چپ بیرون نزند */}
                <text x={x0 + wCard - rightInset} y={y0 + (isOrgCard ? 19 : 18)} fontSize={11.5} fontWeight={800}
                  fill="var(--text-primary, #222)" style={{ userSelect: 'none' }}>
                  {nameFinal}
                </text>
                <text x={x0 + wCard - rightInset} y={y0 + (isOrgCard ? 37 : 34)} fontSize={9.2} fontWeight={700}
                  fill={metaC ?? 'var(--text-muted, #667085)'} style={{ userSelect: 'none' }}>
                  {line1Final}
                </text>
                <text x={x0 + wCard - rightInset} y={y0 + (isOrgCard ? 52 : 48)} fontSize={9.6} fontWeight={600}
                  fill="var(--text-secondary, #555)" style={{ userSelect: 'none' }}>
                  {line2Final}
                </text>
                {showHint && (
                  <text x={x0 + wCard - padR - hintWc} y={y0 + (isOrgCard ? 19 : 18)} textAnchor="end" fontSize={8.6}
                    fill="var(--text-muted, #8892A6)" style={{ userSelect: 'none' }}>
                    {hint}
                  </text>
                )}
              </g>
              {isOrgCard && selectedCard && onPathEnd && (
                <g style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                  <rect
                    x={x0 + 12} y={y0 + hCard - 30} width={wCard / 2 - 18} height={20} rx={10}
                    fill="var(--srip-accent-text, #2457D6)"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onPathEnd(cardNode, 'from'); }}
                  />
                  <text
                    x={x0 + 12 + (wCard / 2 - 18) / 2} y={y0 + hCard - 16.5} textAnchor="middle"
                    fontSize={9.4} fontWeight={800} fill="#FFFFFF" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {t('مبدأ مسیر')}
                  </text>
                  <rect
                    x={x0 + wCard / 2 + 6} y={y0 + hCard - 30} width={wCard / 2 - 18} height={20} rx={10}
                    fill="#3B4252"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onPathEnd(cardNode, 'to'); }}
                  />
                  <text
                    x={x0 + wCard / 2 + 6 + (wCard / 2 - 18) / 2} y={y0 + hCard - 16.5} textAnchor="middle"
                    fontSize={9.4} fontWeight={800} fill="#FFFFFF" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {t('مقصد مسیر')}
                  </text>
                </g>
              )}
            </g>
          );
        })()}
      </g>

      {/* ============ چیپ دسته‌های عموم‌ها (پایین) — کلیک = پنل همهٔ اعضا ============ */}
      {nested && !expandedTray && sectors.map((sc) => (
        <g key={sc.key} data-sector={sc.key} style={{ cursor: 'pointer' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setExpandedTray(sc.key); }}>
          <rect x={sc.chipX - sc.chipW / 2} y={sc.chipY - 13} width={sc.chipW} height={26} rx={13}
            fill="var(--card-bg, #FFFFFF)" stroke={sc.color} strokeWidth={1.2} style={{ filter: 'url(#node-shadow)' }} />
          <circle cx={sc.chipX + sc.chipW / 2 - 13} cy={sc.chipY} r={4} fill={sc.color} />
          <text x={sc.chipX - sc.chipW / 2 + (sc.chipW - 26) / 2 + 13} y={sc.chipY + 3.8} textAnchor="middle"
            fontSize={10.6} fontWeight={800} fill="var(--text-primary, #2A3040)"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {`${sc.shortFa} · ${faNum(sc.count)}`}
          </text>
        </g>
      ))}

      {/* ============ مسیر تمرکز (breadcrumb) — نمای مرحله‌ای ============ */}
      {nested && crumbIds.length > 0 && egoOrgNode && (() => {
        const items: Array<{ label: string; onClick: (() => void) | null }> = [];
        const egoName = nodeDisplayName(egoOrgNode);
        items.push({ label: egoName.length > 14 ? egoName.slice(0, 13) + '…' : egoName, onClick: () => setCrumbIds([]) });
        crumbIds.forEach((id, i) => {
          const nd = idToNode.get(id);
          if (!nd) return;
          const nm = nodeDisplayName(nd);
          items.push({
            label: nm.length > 14 ? nm.slice(0, 13) + '…' : nm,
            onClick: i === crumbIds.length - 1 ? null : () => setCrumbIds(crumbIds.slice(0, i + 1)),
          });
        });
        /* چیدمان راست‌به‌چپ از لبهٔ راست بوم */
        let xr = W - 18;
        const chipsRow = items.map((it) => {
          const w = Math.ceil(textWidth(it.label, 800, 10.6)) + 24;
          const x = xr - w;
          xr = x - 16;
          return { ...it, x, w };
        });
        return (
          <g data-breadcrumb="true">
            {/* بازگشت یک سطح — سمت چپ */}
            <g style={{ cursor: 'pointer' }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setCrumbIds((prev) => prev.slice(0, -1)); }}>
              <rect x={18} y={16} width={86} height={26} rx={13} fill="var(--card-bg, #FFFFFF)"
                stroke="var(--card-border-strong, #DDE3EE)" strokeWidth={1.2} style={{ filter: 'url(#node-shadow)' }} />
              <text x={61} y={33} textAnchor="middle" fontSize={10.6} fontWeight={800}
                fill="var(--text-secondary, #556070)" style={{ userSelect: 'none' }}>{t('→ بازگشت')}</text>
            </g>
            {chipsRow.map((c, i) => (
              <g key={i}>
                {c.onClick ? (
                  <g style={{ cursor: 'pointer' }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); c.onClick!(); }}>
                    <rect x={c.x} y={16} width={c.w} height={26} rx={13} fill="var(--card-bg, #FFFFFF)"
                      stroke="var(--card-border-strong, #DDE3EE)" strokeWidth={1.2} style={{ filter: 'url(#node-shadow)' }} />
                    <text x={c.x + c.w / 2} y={33} textAnchor="middle" fontSize={10.6} fontWeight={700}
                      fill="var(--srip-accent-text, #2457D6)" style={{ userSelect: 'none' }}>{c.label}</text>
                  </g>
                ) : (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect x={c.x} y={16} width={c.w} height={26} rx={13} fill="#3B4252" />
                    <text x={c.x + c.w / 2} y={33} textAnchor="middle" fontSize={10.6} fontWeight={800}
                      fill="#FFFFFF" style={{ userSelect: 'none' }}>{c.label}</text>
                  </g>
                )}
                {i < chipsRow.length - 1 && (
                  <text x={c.x - 8} y={33} textAnchor="middle" fontSize={10} fontWeight={800}
                    fill="var(--text-muted, #94A3B8)" style={{ pointerEvents: 'none', userSelect: 'none' }}>‹</text>
                )}
              </g>
            ))}
          </g>
        );
      })()}
    </svg>
  );
});

export default NetworkGraph;
