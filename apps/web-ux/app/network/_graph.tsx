'use client';
// ============================================================================
//  گراف ارتباطات — چیدمان شعاعی سلسله‌مراتبی (قطعی، بدون تصادف)
//  ----------------------------------------------------------------------------
//  · ساختار واقعی شبکه: پیمایش BFS از گرهٔ کانونی (پیش‌فرض: خودِ شرکت)؛ هر
//    «هم‌سطح» روی یک حلقه؛ سهم زاویهٔ هر شاخه متناسب با اندازهٔ زیردرختش
//    (درخت شعاعی کلاسیک) → ساختار مالکیت/رابطه در یک نگاه خوانا می‌شود.
//  · سازمان‌های بدون رابطهٔ ثبت‌شده دیگر پراکنده نمی‌شوند: به‌صورت «دسته‌های
//    جمع‌شده» (چیپ با شمار) زیر گراف می‌آیند؛ کلیک = باز/بسته شدن اعضا.
//  · تعامل واقعی: زوم چرخ موس به سمت نشانگر · کشیدن زمینه = جابه‌جایی نما ·
//    کشیدن گره = چیدن دستی · کلیک = انتخاب (پنل جزئیات) · دابل‌کلیک = صفحهٔ
//    موجودیت · پینچ دو انگشتی روی موبایل.
//  · مسیر سازمانی: خط کهربایی متحرک · نتایج تحلیل و جستجو: حلقهٔ هاله‌دار.
//  · همگی SVG خالص — بدون کتابخانهٔ خارجی؛ چیدمان کاملاً قطعی است (ترتیب
//    پیمایش پایدار، بدون Math.random) پس هر بار همان تصویر ساخته می‌شود.
// ============================================================================
import {
  forwardRef,
  useCallback,
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
  nodeCategoryColor,
  nodeDisplayName,
  nodeEntityRoute,
  edgeStatus,
  statusMeta,
  DEFAULT_STATUS,
  PUBLIC_CATEGORY_ORDER,
  PUBLIC_CATEGORY_META,
  NODE_COLORS,
  WIDTH_MIN,
  WIDTH_MAX,
  PATH_COLOR,
  EGO_COLOR,
  EGO_FA,
} from './_nodes';
import { localeTag, t } from '../_lib/i18n';

export interface NetworkGraphHandle {
  fit: () => void;
  reset: () => void;
  zoomBy: (factor: number) => void;
  /** مرکز کردن نما روی یک گره (جستجو) */
  flyTo: (nodeId: string) => void;
}

export interface NetworkGraphProps {
  graph: GGraph;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  focusNodeId?: string | null;
  pathNodeIds?: Set<string> | null;
  pathEdgeIds?: Set<string> | null;
  analysisNodeIds?: Set<string> | null;
  /** شناسه‌های منطبق با جستجو — حلقهٔ هالهٔ آبی می‌گیرند */
  searchMatchIds?: Set<string> | null;
  dimOthers?: boolean;
  /** نمایش سازمان‌های بدون رابطه به‌صورت دسته‌های جمع‌شده (پیش‌فرض: مخفی) */
  showOrphans?: boolean;
  onNodeSelect?: (node: GNode | null) => void;
  onNodeHover?: (node: GNode | null) => void;
  onEdgeSelect?: (edge: string | null) => void;
  onEdgeHover?: (edgeLabel: string | null) => void;
  onRendered?: (counts: { nodes: number; edges: number }) => void;
  onNodeOpen?: (href: string) => void;
  onPathEnd?: (node: GNode, end: 'from' | 'to') => void;
  /** سازگاری با صفحه: هر دو مقدار به همان چیدمان جدید می‌رسند */
  variant?: 'nested' | 'classic';
}

/* ───────────────────────────── هندسه و کمکی‌ها ───────────────────────────── */
const W = 1600;
const H = 760;
type Pos = { x: number; y: number };

const faNum = (v: number): string => new Intl.NumberFormat(localeTag()).format(v);

/** عرض تقریبی متن (فارسی/لاتین) برای اندازه‌گیری چیپ‌ها — قطعی و سبک */
function textWidth(s: string, fontPx = 12, weight = 700): number {
  let units = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x600 && c <= 0x6ff) units += c === 0x200c ? 0.28 : 0.52; /* فارسی */
    else if (c >= 0x30 && c <= 0x39) units += 0.56;
    else if (c <= 0x7f) units += 0.54;
    else units += 0.5;
  }
  return units * fontPx * (weight >= 700 ? 1.06 : 1);
}

/** کوتاه‌کردن برچسب با «…» */
function fitLabel(s: string, maxChars: number): string {
  const arr = [...s.trim()];
  return arr.length <= maxChars ? s.trim() : `${arr.slice(0, maxChars - 1).join('')}…`;
}

/** علامت ثابت برای جهت خمیدگی یال (به‌جای تصادف — بر اساس نام یال) */
function bendSign(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h >>> 16) % 2 === 0 ? 1 : -1;
}

interface StackGroup {
  key: string;
  fa: string;
  color: string;
  members: GNode[];
  x: number;
  y: number;
  w: number;
}

interface LayoutResult {
  pos: Map<string, Pos>;
  /** گره‌های در حال رندر (هسته + اعضای دستهٔ بازشده) */
  visibleNodes: GNode[];
  visibleEdges: GEdge[];
  stacks: StackGroup[];
  orphanCount: number;
  rootId: string | null;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  empty: boolean;
}

const STACK_OTHER_FA = () => t('بدون دسته');
const STACK_OTHER_COLOR = '#64748B';
const stackMetaOf = (cat: string | null | undefined) => {
  if (cat && PUBLIC_CATEGORY_META[cat]) return { key: cat, fa: PUBLIC_CATEGORY_META[cat].fa, color: PUBLIC_CATEGORY_META[cat].color };
  return { key: 'OTHER', fa: STACK_OTHER_FA(), color: STACK_OTHER_COLOR };
};

/* ───────────────────── چیدمان درخت شعاعی (BFS + سهم زاویه) ───────────────────── */
function buildLayout(
  nodes: GNode[],
  edges: GEdge[],
  focusId: string | null,
  showOrphans: boolean,
  expandedStack: string | null,
): LayoutResult {
  const pos = new Map<string, Pos>();
  const degree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    for (const [a, b] of [[e.source, e.target], [e.target, e.source]] as const) {
      degree.set(a, (degree.get(a) ?? 0) + 1);
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a)!.push(b);
    }
  }
  for (const list of adj.values()) list.sort((a, b) => (a < b ? -1 : 1)); /* قطعیت */

  const core = nodes.filter((n) => (degree.get(n.id) ?? 0) > 0);
  const orphans = nodes.filter((n) => (degree.get(n.id) ?? 0) === 0);

  /* ریشهٔ چیدمان: گره کانونی ← خودِ شرکت ← پرارتباط‌ترین گره */
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let root: GNode | null = null;
  if (focusId && core.some((n) => n.id === focusId)) root = byId.get(focusId) ?? null;
  if (!root) {
    const ego = core.find((n) => n.ego) ?? null;
    if (ego) root = ego;
    else if (core.length) root = [...core].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || (a.id < b.id ? -1 : 1))[0];
  }

  const nodeBox = 92; /* قطر گره + فاصلهٔ برچسب */
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const touch = (x: number, y: number, pad = 46) => {
    minX = Math.min(minX, x - pad); maxX = Math.max(maxX, x + pad);
    minY = Math.min(minY, y - pad); maxY = Math.max(maxY, y + pad);
  };

  if (root) {
    /* BFS: سطح + والد + فرزندان (اولین دیدار) */
    const level = new Map<string, number>([[root.id, 0]]);
    const parent = new Map<string, string>();
    const children = new Map<string, string[]>();
    const queue = [root.id];
    const seen = new Set([root.id]);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of adj.get(cur) ?? []) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        level.set(nb, (level.get(cur) ?? 0) + 1);
        parent.set(nb, cur);
        if (!children.has(cur)) children.set(cur, []);
        children.get(cur)!.push(nb);
        queue.push(nb);
      }
    }
    /* اندازهٔ زیردرخت (تعداد برگ‌ها) برای سهم زاویه */
    const leafCount = new Map<string, number>();
    const weigh = (id: string): number => {
      const kids = children.get(id) ?? [];
      if (!kids.length) { leafCount.set(id, 1); return 1; }
      let s = 0;
      for (const k of kids) s += weigh(k);
      leafCount.set(id, s);
      return s;
    };
    weigh(root.id);

    const maxLevel = Math.max(0, ...[...level.values()]);
    const coreN = seen.size;
    /* گام حلقه‌ها: با تعداد گره‌ها مقیاس می‌شود تا برچسب‌ها روی هم نیفتند */
    const ringGap = Math.max(168, Math.min(252, 132 + Math.sqrt(Math.max(1, coreN)) * 17 + maxLevel * 6));
    /* rSelf = شعاعِ خودِ گره (والد تعیین کرده)؛ ریشه دقیقاً در مرکز است.
       شعاع فرزندان این‌جا محاسبه می‌شود: گامِ سطح، و اگر قوسِ سهم برای
       جای‌گذاری برچسب فرزندان تنگ بود، بزرگ‌تر — تا هیچ برچسبی روی دیگری نیفتد. */
    const place = (id: string, a0: number, a1: number, depth: number, rSelf: number) => {
      const kids = children.get(id) ?? [];
      const mid = (a0 + a1) / 2;
      const x = W / 2 + Math.cos(mid) * rSelf;
      const y = H / 2 + Math.sin(mid) * rSelf;
      pos.set(id, { x, y });
      touch(x, y);
      const childR = kids.length
        ? Math.max((depth + 1) * ringGap, (kids.length * nodeBox) / Math.max(0.35, a1 - a0), 140)
        : 0;
      let cursor = a0;
      const total = leafCount.get(id) ?? 1;
      for (const k of kids) {
        const w = ((leafCount.get(k) ?? 1) / total) * (a1 - a0);
        place(k, cursor, cursor + w, depth + 1, childR);
        cursor += w;
      }
    };
    place(root.id, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, 0, 0);
  }

  /* ─── دسته‌های سازمان‌های بدون رابطه (فقط وقتی خواسته شده) ─── */
  const stacks: StackGroup[] = [];
  if (showOrphans && orphans.length) {
    const groups = new Map<string, GNode[]>();
    for (const n of orphans) {
      const key = n.category && PUBLIC_CATEGORY_META[n.category] ? n.category : 'OTHER';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(n);
    }
    const order = [...PUBLIC_CATEGORY_ORDER.filter((k) => groups.has(k as string)), ...(groups.has('OTHER') ? ['OTHER'] : [])];
    const rowY = (root ? maxY : H / 2 - 60) + 150;
    const chips = order.map((key) => {
      const meta = stackMetaOf(key === 'OTHER' ? null : key);
      const members = [...(groups.get(key) ?? [])].sort((a, b) => (a.label < b.label ? -1 : 1));
      const label = `${meta.fa} · ${faNum(members.length)}`;
      return { key, meta, members, label, w: textWidth(label, 12, 800) + 46 };
    });
    const totalW = chips.reduce((a, c) => a + c.w + 18, -18);
    let x = W / 2 - totalW / 2;
    for (const c of chips) {
      stacks.push({ key: c.key, fa: c.meta.fa, color: c.meta.color, members: c.members, x, y: rowY, w: c.w });
      touch(x, rowY, 40);
      touch(x + c.w, rowY, 40);
      x += c.w + 18;
    }
    /* اعضای دستهٔ بازشده: حلقه(های) دور چیپ خودشان */
    const open = stacks.find((s) => s.key === expandedStack);
    if (open) {
      const n = open.members.length;
      const rings = n > 18 ? 2 : 1;
      const perRing = Math.ceil(n / rings);
      open.members.forEach((m, i) => {
        const ring = Math.min(rings - 1, Math.floor(i / perRing));
        const idxInRing = i % perRing;
        const countInRing = Math.min(perRing, n - ring * perRing);
        const R = Math.max(132, (ring + 1) * 148, (countInRing * nodeBox) / (Math.PI * 2 / rings));
        const a = -Math.PI / 2 + (idxInRing * Math.PI * 2) / countInRing + (countInRing % 2 === 0 ? Math.PI / countInRing : 0);
        const cx = open.x + open.w / 2 + Math.cos(a) * R;
        const cy = open.y + Math.sin(a) * (R * 0.82);
        pos.set(m.id, { x: cx, y: cy });
        touch(cx, cy);
      });
    }
  }

  const visibleSet = new Set(pos.keys());
  const visibleNodes = nodes.filter((n) => visibleSet.has(n.id));
  const visibleEdges = edges.filter((e) => visibleSet.has(e.source) && visibleSet.has(e.target));

  if (!Number.isFinite(minX)) { minX = W / 2 - 200; minY = H / 2 - 160; maxX = W / 2 + 200; maxY = H / 2 + 160; }

  return {
    pos,
    visibleNodes,
    visibleEdges,
    stacks,
    orphanCount: orphans.length,
    rootId: root?.id ?? null,
    bounds: { minX, minY, maxX, maxY },
    empty: visibleNodes.length === 0,
  };
}

/* ────────────────────────────── مؤلفهٔ گراف ────────────────────────────── */
const NetworkGraph = forwardRef<NetworkGraphHandle, NetworkGraphProps>(function NetworkGraph(
  {
    graph,
    selectedNodeId,
    selectedEdgeId,
    focusNodeId,
    pathNodeIds,
    pathEdgeIds,
    analysisNodeIds,
    searchMatchIds,
    dimOthers = false,
    showOrphans = false,
    onNodeSelect,
    onNodeHover,
    onEdgeSelect,
    onEdgeHover,
    onRendered,
    onNodeOpen,
    variant = 'nested',
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pos>({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState<Record<string, Pos>>({});
  const [expandedStack, setExpandedStack] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [viewportV, setViewportV] = useState(0); /* نسخهٔ نما برای fit خودکار */

  /* فشردگی نما (موبایل) — برچسب‌های درجه-۲ فقط بعد از بزرگ‌نمایی */
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
  const compact = baseScale > 0 && baseScale < 0.45;
  const screenScale = (baseScale || 1) * zoom;
  const minorLabels = !compact || screenScale >= 0.62;

  /* چیدمان: بازمحاسبه فقط با تغییر داده/کانون/دسته‌ها */
  const layout = useMemo(
    () => buildLayout(graph.nodes, graph.edges, focusNodeId ?? null, showOrphans, expandedStack),
    [graph, focusNodeId, showOrphans, expandedStack],
  );

  const posOf = useCallback((id: string): Pos => overrides[id] ?? layout.pos.get(id) ?? { x: W / 2, y: H / 2 }, [overrides, layout]);

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of graph.edges) {
      d.set(e.source, (d.get(e.source) ?? 0) + 1);
      d.set(e.target, (d.get(e.target) ?? 0) + 1);
    }
    return d;
  }, [graph.edges]);
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [graph.edges]);

  /* گره‌هایی که دست‌کم یک رابطهٔ پرریسک دارند — پیش‌محاسبه‌شده */
  const riskyNodeIds = useMemo(() => {
    const s = new Set<string>();
    for (const e of graph.edges) {
      if (Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD) {
        s.add(e.source);
        s.add(e.target);
      }
    }
    return s;
  }, [graph.edges]);

  const radiusOf = (n: GNode) => {
    const d = degree.get(n.id) ?? 0;
    return 13 + Math.min(16, Math.sqrt(d) * 6.5) + (n.ego ? 4 : 0);
  };

  /* ─── نما: fit / reset / zoom / flyTo ─── */
  const clampZoom = (v: number) => Math.min(3.2, Math.max(0.22, v));
  const fit = useCallback(() => {
    const b = layout.bounds;
    const bw = Math.max(140, b.maxX - b.minX);
    const bh = Math.max(140, b.maxY - b.minY);
    const k = clampZoom(Math.min((W - 90) / bw, (H - 70) / bh, 1.5));
    setZoom(k);
    setPan({ x: W / 2 - ((b.minX + b.maxX) / 2) * k, y: H / 2 - ((b.minY + b.maxY) / 2) * k });
    setViewportV((v) => v + 1);
  }, [layout]);
  const reset = useCallback(() => {
    setOverrides({});
    setExpandedStack(null);
    fit();
  }, [fit]);
  useImperativeHandle(ref, () => ({
    fit,
    reset,
    zoomBy: (factor: number) => {
      setZoom((z) => {
        const k = clampZoom(z * factor);
        setPan((p) => ({ x: W / 2 - (W / 2 - p.x) * (k / z), y: H / 2 - (H / 2 - p.y) * (k / z) }));
        return k;
      });
    },
    flyTo: (nodeId: string) => {
      const p = posOf(nodeId);
      setZoom((z) => Math.max(z, 1.05));
      setPan({ x: W / 2 - p.x * Math.max(zoom, 1.05), y: H / 2 - p.y * Math.max(zoom, 1.05) });
      setViewportV((v) => v + 1);
    },
  }), [fit, posOf, zoom]);

  /* fit خودکار وقتی داده یا کانون یا دسته‌ها عوض شد (مداخلهٔ دستی کاربر را بازنمی‌چیند) */
  const layoutKey = `${graph.nodes.length}:${graph.edges.length}:${focusNodeId ?? ''}:${showOrphans ? 1 : 0}`;
  const lastFitKey = useRef('');
  useEffect(() => {
    const key = `${layoutKey}:${expandedStack ?? ''}`;
    if (lastFitKey.current === key) return;
    lastFitKey.current = key;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, expandedStack]);

  useEffect(() => {
    onRendered?.({ nodes: layout.visibleNodes.length, edges: layout.visibleEdges.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  /* ─── تبدیل مختصات: صفحهٔ SVG ← جهان چیدمان ─── */
  const toWorld = (clientX: number, clientY: number): Pos => {
    const el = svgRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    const vy = ((clientY - r.top) / r.height) * H;
    return { x: (vx - pan.x) / zoom, y: (vy - pan.y) / zoom };
  };

  /* ─── اشاره‌گر: انتخاب/کشیدن گره، پن نما، پینچ ─── */
  type Press =
    | { kind: 'node'; id: string; sx: number; sy: number; moved: boolean }
    | { kind: 'pan'; sx: number; sy: number; pan0: Pos; moved: boolean }
    | { kind: 'pinch'; d0: number; c0: Pos; zoom0: number; pan0: Pos }
    | null;
  const pressRef = useRef<Press>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastTapRef = useRef<{ t: number; id: string } | null>(null);
  const zoomRef = useRef(1);
  const panRef = useRef<Pos>({ x: 0, y: 0 });
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    /* ثبت اشاره‌گر برای پن/پینچ — اگر مرورگر اجازهٔ capture نداد (رویداد ترکیبی/لمس قدیمی) ادامه بده */
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* بی‌خطر */ }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pressRef.current = {
        kind: 'pinch',
        d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        c0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        zoom0: zoomRef.current,
        pan0: { ...panRef.current },
      };
      return;
    }
    const nodeId = (e.target as Element).closest?.('[data-node]')?.getAttribute('data-node') ?? null;
    if (nodeId) {
      pressRef.current = { kind: 'node', id: nodeId, sx: e.clientX, sy: e.clientY, moved: false };
    } else {
      pressRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, pan0: { ...panRef.current }, moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const press = pressRef.current;
    if (!press) return;
    if (press.kind === 'pinch') {
      const pts = [...pointersRef.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts;
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const k = clampZoom(press.zoom0 * (d / press.d0));
      const el = svgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = ((press.c0.x - r.left) / r.width) * W;
      const cy = ((press.c0.y - r.top) / r.height) * H;
      setZoom(k);
      setPan({ x: cx - (cx - press.pan0.x) * (k / press.zoom0), y: cy - (cy - press.pan0.y) * (k / press.zoom0) });
      return;
    }
    const dx = e.clientX - press.sx;
    const dy = e.clientY - press.sy;
    if (Math.hypot(dx, dy) > 4) press.moved = true;
    if (press.kind === 'pan' && press.moved) {
      const el = svgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPan({ x: press.pan0.x + (dx * W) / r.width, y: press.pan0.y + (dy * H) / r.height });
    } else if (press.kind === 'node' && press.moved) {
      const w = toWorld(e.clientX, e.clientY);
      setOverrides((prev) => ({ ...prev, [press.id]: { x: w.x, y: w.y } }));
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(e.pointerId);
    const press = pressRef.current;
    if (pointersRef.current.size < 2 && press?.kind === 'pinch') pressRef.current = null;
    if (!press || press.kind === 'pinch') return;
    pressRef.current = null;
    if (!press.moved) {
      /* کلیک (بدون کشیدن) */
      if (press.kind === 'node') {
        const now = Date.now();
        const node = nodeById.get(press.id) ?? null;
        if (node && lastTapRef.current && now - lastTapRef.current.t < 340 && lastTapRef.current.id === press.id) {
          lastTapRef.current = null;
          const route = node.type === 'organization' ? nodeEntityRoute(node) : null;
          if (route && onNodeOpen) onNodeOpen(route.href);
          else onNodeSelect?.(node);
        } else {
          lastTapRef.current = { t: now, id: press.id };
          onNodeSelect?.(node);
        }
      } else {
        onNodeSelect?.(null);
        onEdgeSelect?.(null);
      }
    }
  };

  /* زوم چرخ موس به سمت نشانگر */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      const vx = ((ev.clientX - r.left) / r.width) * W;
      const vy = ((ev.clientY - r.top) / r.height) * H;
      setZoom((z) => {
        const k = clampZoom(z * Math.exp(-ev.deltaY * 0.0016));
        setPan((p) => ({ x: vx - (vx - p.x) * (k / z), y: vy - (vy - p.y) * (k / z) }));
        return k;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* دابل‌کلیک زمینه = زوم به داخل همان نقطه */
  const onDoubleClickBg = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest?.('[data-node],[data-edge],[data-stack]')) return;
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const vx = ((e.clientX - r.left) / r.width) * W;
    const vy = ((e.clientY - r.top) / r.height) * H;
    setZoom((z) => {
      const k = clampZoom(z * 1.45);
      setPan((p) => ({ x: vx - (vx - p.x) * (k / z), y: vy - (vy - p.y) * (k / z) }));
      return k;
    });
  };

  /* ─── برجستگی/کم‌رنگی ─── */
  const selectedSet = useMemo(() => {
    const s = new Set<string>();
    if (selectedNodeId) {
      s.add(selectedNodeId);
      neighbors.get(selectedNodeId)?.forEach((id) => s.add(id));
    }
    return s;
  }, [selectedNodeId, neighbors]);
  const nodeOpacity = (id: string): number => {
    if (pathNodeIds?.size) return pathNodeIds.has(id) ? 1 : 0.16;
    if (dimOthers && selectedSet.size) return selectedSet.has(id) ? 1 : 0.16;
    return 1;
  };

  /* ─── یال‌ها ─── */
  const edgeGeom = (e: GEdge) => {
    const a = posOf(e.source);
    const b = posOf(e.target);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const len = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const bend = Math.min(52, len * 0.11) * bendSign(e.id);
    return { a, b, c: { x: mx + nx * bend, y: my + ny * bend }, mid: { x: mx + (nx * bend) / 2, y: my + (ny * bend) / 2 } };
  };
  const edgeWidth = (e: GEdge) => {
    const w = Number.isFinite(e.weight) ? e.weight : 50;
    return WIDTH_MIN + ((Math.max(0, Math.min(100, w)) / 100) * (WIDTH_MAX - WIDTH_MIN));
  };

  const STATUS_GLYPH: Record<string, string> = { check: '✓', alert: '!', pause: '‖', x: '✕', plus: '+' };

  /* برچسب: همهٔ گره‌های اصلی تا سقف ۱۴۰ گره؛ بعد از آن فقط مهم‌ها */
  const dense = layout.visibleNodes.length > 140;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t('گراف ارتباطات')}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClickBg}
    >
      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        {/* یال‌ها */}
        {layout.visibleEdges.map((e) => {
          const g = edgeGeom(e);
          const st = statusMeta(edgeStatus(e)) ?? DEFAULT_STATUS;
          const isPath = pathEdgeIds?.has(e.id) ?? false;
          const isSel = selectedEdgeId === e.id;
          const isHover = hoverEdge === e.id;
          const dimmed = pathNodeIds?.size
            ? !(pathNodeIds.has(e.source) && pathNodeIds.has(e.target))
            : dimOthers && selectedSet.size
              ? !(selectedSet.has(e.source) && selectedSet.has(e.target))
              : false;
          const d = `M ${g.a.x} ${g.a.y} Q ${g.c.x} ${g.c.y} ${g.b.x} ${g.b.y}`;
          return (
            <g key={e.id} data-edge={e.id} opacity={dimmed ? 0.14 : 1} style={{ cursor: 'pointer' }}
              onPointerEnter={() => { setHoverEdge(e.id); onEdgeHover?.(e.id); }}
              onPointerLeave={() => { if (hoverEdge === e.id) { setHoverEdge(null); onEdgeHover?.(null); } }}
              onPointerDown={(ev) => { ev.stopPropagation(); onEdgeSelect?.(e.id); }}
            >
              {/* ناحیهٔ کلیک پهن‌تر */}
              <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
              <path
                d={d}
                fill="none"
                stroke={isPath ? PATH_COLOR : st.color}
                strokeWidth={(isPath ? 4.6 : edgeWidth(e)) * (isHover || isSel ? 1.75 : 1)}
                strokeDasharray={isPath ? '9 6' : (st.dash ? st.dash.join(' ') : undefined)}
                className={isPath ? 'net-edge-path' : undefined}
                strokeLinecap="round"
                opacity={0.92}
              />
              {/* کپسول وضعیت در میانهٔ یال */}
              <circle cx={g.mid.x} cy={g.mid.y} r={9.5} fill="#fff" stroke={st.color} strokeWidth={1.6 } />
              <text x={g.mid.x} y={g.mid.y + 3.6} textAnchor="middle" fontSize={10.5} fontWeight={900} fill={st.color} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {STATUS_GLYPH[st.icon] ?? '·'}
              </text>
            </g>
          );
        })}

        {/* ساقه‌های اعضای دستهٔ بازشده */}
        {layout.stacks.filter((s) => s.key === expandedStack).map((s) =>
          s.members.map((m) => {
            const p = posOf(m.id);
            const c = { x: s.x + s.w / 2, y: s.y };
            return <line key={`stem-${m.id}`} x1={c.x} y1={c.y} x2={p.x} y2={p.y} stroke={s.color} strokeWidth={1.1} opacity={0.38} />;
          }),
        )}

        {/* گره‌ها */}
        {layout.visibleNodes.map((n) => {
          const p = posOf(n.id);
          const r = radiusOf(n);
          const color = nodeCategoryColor(n) ?? NODE_COLORS[n.type] ?? '#2457D6';
          const isSel = selectedNodeId === n.id;
          const isHover = hoverNode === n.id;
          const isPath = pathNodeIds?.has(n.id) ?? false;
          const isAnalysis = analysisNodeIds?.has(n.id) ?? false;
          const isMatch = searchMatchIds?.has(n.id) ?? false;
          const inSpot = !(dimOthers && selectedSet.size) || selectedSet.has(n.id);
          const showLabel = (!dense && (n.type !== 'person' || minorLabels)) || isSel || isHover || isPath || isAnalysis;
          const label = fitLabel(nodeDisplayName(n), n.type === 'person' ? 16 : 19);
          return (
            <g
              key={n.id}
              data-node={n.id}
              data-nt={n.type}
              data-ego={n.ego ? 'true' : 'false'}
              opacity={nodeOpacity(n.id)}
              style={{ cursor: 'pointer' }}
              onPointerEnter={() => { setHoverNode(n.id); onNodeHover?.(n); }}
              onPointerLeave={() => { if (hoverNode === n.id) { setHoverNode(null); onNodeHover?.(null); } }}
            >
              {/* هالهٔ مسیر / تحلیل / جستجو */}
              {isPath && <circle cx={p.x} cy={p.y} r={r + 8} fill="none" stroke={PATH_COLOR} strokeWidth={2.6} strokeDasharray="4 3" />}
              {isAnalysis && !isPath && <circle cx={p.x} cy={p.y} r={r + 8} fill="none" stroke="#7A5AF8" strokeWidth={2.2} strokeDasharray="4 3" />}
              {isMatch && !isPath && !isAnalysis && <circle cx={p.x} cy={p.y} r={r + 8} fill="none" stroke="#2563EB" strokeWidth={2.4} strokeDasharray="3 3" />}
              {n.ego && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={EGO_COLOR} strokeWidth={3} opacity={0.9} />}
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={color}
                fillOpacity={inSpot ? 0.2 : 0.12}
                stroke={color}
                strokeWidth={isSel ? 4 : isHover ? 3 : 2}
              />
              {/* نشان ریسک: این گره دست‌کم یک رابطهٔ پرریسک دارد */}
              {riskyNodeIds.has(n.id) && (
                <circle cx={p.x + r * 0.72} cy={p.y - r * 0.72} r={5} fill="#B42318" stroke="#fff" strokeWidth={1.4} />
              )}
              {/* حرف اول نام — فقط اشخاص/پروژه‌ها (سازمان برچسب کامل زیر گره دارد) */}
              {n.type !== 'organization' && (
                <text
                  x={p.x}
                  y={p.y + 4.6}
                  textAnchor="middle"
                  fontSize={11.5}
                  fontWeight={800}
                  fill={color}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {[...nodeDisplayName(n)][0] ?? ''}
                </text>
              )}
              {showLabel && (
                <text
                  x={p.x}
                  y={p.y + r + 15}
                  textAnchor="middle"
                  fontSize={11.5}
                  fontWeight={700}
                  fill="#334155"
                  stroke="#fff"
                  strokeWidth={3.4}
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {label}
                </text>
              )}
              {n.ego && (
                <text x={p.x} y={p.y - r - 8} textAnchor="middle" fontSize={10} fontWeight={800} fill={EGO_COLOR} stroke="#fff" strokeWidth={3} paintOrder="stroke" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {EGO_FA}
                </text>
              )}
            </g>
          );
        })}

        {/* دسته‌های سازمان‌های بدون رابطه */}
        {layout.stacks.map((s) => {
          const open = s.key === expandedStack;
          return (
            <g
              key={s.key}
              data-stack={s.key}
              data-open={open ? 'true' : 'false'}
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setExpandedStack(open ? null : s.key)}
            >
              <rect x={s.x} y={s.y - 17} width={s.w} height={34} rx={17} fill="#fff" stroke={s.color} strokeWidth={open ? 2.4 : 1.5} />
              <circle cx={s.x + 18} cy={s.y} r={5.5} fill={s.color} />
              <text x={s.x + 30} y={s.y + 4} fontSize={12} fontWeight={800} fill="#334155" style={{ userSelect: 'none' }}>
                {s.fa} · {faNum(s.members.length)}
              </text>
              <text x={s.x + s.w - 14} y={s.y + 4.5} fontSize={11} fontWeight={900} fill={s.color} style={{ userSelect: 'none' }}>
                {open ? '−' : '+'}
              </text>
            </g>
          );
        })}
      </g>

      {/* حالت خالی */}
      {layout.empty && (
        <g>
          <rect x={W / 2 - 320} y={H / 2 - 44} width={640} height={88} rx={14} fill="#fff" stroke="#CBD5E1" />
          <text x={W / 2} y={H / 2 - 6} textAnchor="middle" fontSize={14} fontWeight={800} fill="#334155">{t('هنوز رابطه‌ای برای نمایش ثبت نشده است.')}</text>
          <text x={W / 2} y={H / 2 + 20} textAnchor="middle" fontSize={11.5} fill="#64748B">
            {showOrphans
              ? t('سازمان‌های بدون رابطه در دسته‌های پایین گراف جمع شده‌اند.')
              : t('برای دیدن سازمان‌های بدون رابطه، «نهادهای بدون رابطه» را روشن کنید.')}
          </text>
        </g>
      )}

      {/* راهنمای کوچک تعامل — گوشهٔ بوم */}
      <g opacity={0.8} style={{ pointerEvents: 'none' }}>
        <text x={W - 14} y={26} textAnchor="end" fontSize={11} fill="#64748B">
          {t('چرخ موس = زوم · کشیدن = جابه‌جایی · کلیک = جزئیات · دابل‌کلیک = صفحهٔ سازمان')}
        </text>
      </g>
    </svg>
  );
});

export default NetworkGraph;
