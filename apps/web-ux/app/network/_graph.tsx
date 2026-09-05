'use client';
// ============================================================================
//  شبکهٔ خوشه‌ای (Cluster Orbit) — نگارش UI 4 · گراف ارتباطات
//  · هر سازمانِ مادر در یک «حباب» پاستلی نرم با برچسب نام + نقطهٔ وضعیت
//  · شرکتِ مرکز: کارت شیشه‌ای با آواتار گرادیانی، حلقهٔ سلامت و نشان ریسک
//  · اشخاص/پروژه‌ها: دایره‌های کوچک با حرف اول که به‌صورت مداری دور سازمان می‌چرخند
//  · یال رابطه: رنگ/خط‌چین بر اساس وضعیت + پهنای بر اساس وزن + نقطهٔ میانه
//  · یال مسیر: کهربایی متحرک (دش متحرک) · حالت تمرکز: غیرهمسایه‌ها کمرنگ
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
} from './_nodes';

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
}

type Pos = { x: number; y: number };

/** World canvas — aspect 1600/760. */
const W = 1600;
const H = 760;
const ORG_SIZE = 56;
const PERSON_R = 12;
const PROJECT_R = 13;
const CLUSTER_PAD = 66;

const TYPE_FA: Record<string, string> = { organization: 'سازمان', person: 'شخص', project: 'پروژه' };

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
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pos>({ x: 0, y: 0 });
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number; moved: number } | null>(null);
  const lastTapRef = useRef<{ id: string; t: number } | null>(null);

  const clusters = useMemo(() => buildClusters(graph.nodes), [graph]);
  const { positions, links } = useMemo(() => {
    const pos = layout(clusters, graph.nodes);
    const safe = graph.edges.filter((e) => pos.has(e.source) && pos.has(e.target));
    return { positions: pos, links: safe };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, clusters]);

  const nodeStats = useMemo(() => computeNodeStats(graph.nodes, links), [graph.nodes, links]);
  const idToNode = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const renderedNodeCount = graph.nodes.length;
  const renderedEdgeCount = links.length;
  const onRenderedRef = useRef(onRendered);
  useEffect(() => { onRenderedRef.current = onRendered; }, [onRendered]);
  useEffect(() => {
    onRenderedRef.current?.({ nodes: renderedNodeCount, edges: renderedEdgeCount });
  }, [renderedNodeCount, renderedEdgeCount]);

  /** Drag deltas are stored in screen(ish) space; manual = base + delta per node. */
  const [manual, setManual] = useState<Map<string, Pos> | null>(null);
  const posOf = (id: string): Pos => {
    const base = positions.get(id);
    if (!base) return { x: 0, y: 0 };
    const d = manual?.get(id);
    return d ? { x: base.x + d.x, y: base.y + d.y } : base;
  };

  useImperativeHandle(ref, () => ({
    fit: () => { setZoom(1); setPan({ x: 0, y: 0 }); },
    reset: () => { setZoom(1); setPan({ x: 0, y: 0 }); setManual(null); },
    zoomBy: (factor: number) => setZoom((z) => Math.min(3, Math.max(0.3, z * factor))),
  }));

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
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

  /* ---------- click vs drag: deterministic select on pointer-up ---------- */
  const onPointerDown = (e: React.PointerEvent, n: GNode) => {
    dragRef.current = { id: n.id, dx: e.clientX, dy: e.clientY, moved: 0 };
    setDragId(n.id);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const applyDelta = (d: { id: string; dx: number; dy: number }, cx: number, cy: number) => {
    setManual((prev) => {
      const next = new Map(prev ?? []);
      const base = positions.get(d.id);
      if (!base) return prev ?? next;
      // dragging an org moves its whole orbit cluster together
      const cluster = clusters.find((c) => c.root.id === d.id || c.members.some((mm) => mm.id === d.id));
      const ids = cluster && cluster.root.id === d.id
        ? [d.id, ...cluster.members.map((mm) => mm.id)]
        : [d.id];
      let changed = false;
      for (const id of ids) {
        const b = positions.get(id);
        if (!b) continue;
        next.set(id, { x: b.x + (cx - d.dx), y: b.y + (cy - d.dy) });
        changed = true;
      }
      return changed ? next : prev ?? next;
    });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dist = Math.hypot(e.clientX - d.dx, e.clientY - d.dy);
    d.moved = Math.max(d.moved, dist);
    if (d.moved < 4) return; // still a potential click
    setDragId((cur) => (cur ? cur : d.id));
    applyDelta(d, e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent, n: GNode) => {
    const d = dragRef.current;
    const wasClick = d && d.moved < 4;
    dragRef.current = null;
    setDragId(null);
    if (!wasClick) return;
    // a real click → select (and remember for double-click detection)
    onNodeSelect?.(n);
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === n.id && now - last.t < 380) {
      lastTapRef.current = null;
      const route = n.id.startsWith('org:') || n.id.startsWith('person:') || n.id.startsWith('project:');
      if (route && onNodeOpen) {
        const prefix = n.type === 'organization' ? 'organizations' : n.type === 'person' ? 'people' : 'projects';
        const bare = n.id.slice(n.id.indexOf(':') + 1);
        onNodeOpen(`/${prefix}/${bare}`);
      }
      return;
    }
    lastTapRef.current = { id: n.id, t: now };
  };

  const nodeAccent = (id: string): string | null => {
    if (pathNodeIds?.has(id)) return '#B45309';
    if (analysisNodeIds?.has(id)) return '#B45309';
    return null;
  };

  // cluster bubble geometry, derived live from current positions (incl. drag)
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
      const push = (n: GNode) => { const p = posOf(n.id); if (p) pts.push({ ...p, n }); };
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
  }, [clusters, graph.nodes.length, manual]);

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
      style={{ display: 'block', touchAction: 'none', cursor: dragId ? 'grabbing' : 'default' }}
      role="img"
      aria-label="گراف شبکه روابط — خوشه‌های سازمانی"
      onPointerMove={onPointerMove}
      onPointerLeave={() => { dragRef.current = null; setDragId(null); }}
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
        {/* ============ cluster bubbles ============ */}
        {bubbles.map((b) => {
          const st = nodeStats.get(b.root.id);
          const dotColor = st?.hasRel ? statusMeta(st.status).color : null;
          return (
            <g key={b.key} opacity={bubbleAlpha(b.ids)} style={{ transition: 'opacity .18s ease' }} pointerEvents="none">
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={32} fill={b.tint.fill} stroke={b.tint.stroke} strokeWidth={1.3} />
              <rect x={b.x} y={b.y} width={b.w} height={6} rx={3} fill={b.tint.stroke} opacity={0.28} />
              {/* label pill */}
              <rect
                x={b.labelX - Math.max(54, nodeDisplayName(b.root).length * 6 + 36) / 2}
                y={b.y + 13}
                width={Math.max(108, nodeDisplayName(b.root).length * 6 + 36)}
                height={23}
                rx={12}
                fill="var(--card-bg, #FFFFFF)"
                stroke={b.tint.stroke}
                strokeWidth={1}
              />
              {dotColor && <circle cx={b.labelX - (Math.max(54, nodeDisplayName(b.root).length * 6 + 36) / 2) + 13} cy={b.y + 24.5} r={3.4} fill={dotColor} />}
              <text
                x={b.labelX + (dotColor ? 6 : 0)} y={b.y + 28.5}
                textAnchor="middle" fontSize={11} fontWeight={800}
                fill="var(--text-secondary, #667085)"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {nodeDisplayName(b.root).length > 26 ? nodeDisplayName(b.root).slice(0, 25) + '…' : nodeDisplayName(b.root)}
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
                      <text x={geo.mx - 16} y={geo.my - 11.5} fontSize={8.6} fontWeight={800} fill={meta.color}
                        style={{ userSelect: 'none' }}>
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
        {graph.nodes.map((n) => {
          const p = posOf(n.id);
          const alpha = nodeAlpha(n.id);
          const acc = nodeAccent(n.id);
          const selected = selectedNodeId === n.id;
          const hoveredLocal = hoverNode === n.id;
          const focused = focusNodeId === n.id;
          const name = nodeDisplayName(n);
          const isOrg = n.type === 'organization';
          const grad = acc ?? nodeGrad(n);
          const st = nodeStats.get(n.id) ?? { degree: 0, relCount: 0, riskCount: 0, score: 100, status: 'ACTIVE', hasRel: false };
          const metaColor = st.hasRel ? statusMeta(st.status).color : null;
          const glow = focused || selected || (pathActive && pathNodeIds?.has(n.id));
          const ringColor = selected ? '#3B4252' : focused ? '#2563EB' : null;
          const pointerCursor = hoveredLocal ? 'pointer' : 'default';
          const haloR = isOrg ? 30 : st.degree >= 3 ? PERSON_R + 6.5 : null;
          return (
            <g
              key={n.id}
              opacity={alpha}
              style={{ cursor: pointerCursor, transition: 'opacity .18s ease' }}
              onPointerEnter={() => { setHoverNode(n.id); onNodeHover && onNodeHover(n); }}
              onPointerLeave={() => { setHoverNode(null); onNodeHover && onNodeHover(null); }}
              onPointerDown={(e) => onPointerDown(e, n)}
              onPointerUp={(e) => onPointerUp(e, n)}
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

              {/* label under node */}
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
                {name.length > (isOrg ? 20 : 16) ? name.slice(0, isOrg ? 19 : 15) + '…' : name}
              </text>
            </g>
          );
        })}

        {/* ============ floating info card (hover/selection) ============ */}
        {cardNode && !pathActive && (() => {
          const p = posOf(cardNode.id);
          const st = nodeStats.get(cardNode.id) ?? { degree: 0, relCount: 0, riskCount: 0, score: 100, status: 'ACTIVE', hasRel: false };
          const isOrgCard = cardNode.type === 'organization';
          const metaC = st.hasRel ? statusMeta(st.status).color : null;
          const name = nodeDisplayName(cardNode);
          const line1 = `${TYPE_FA[cardNode.type] ?? cardNode.type}${metaC ? ` · وضعیت غالب: ${statusMeta(st.status).label}` : ''}`;
          const line2 = st.hasRel
            ? `${st.relCount} رابطه${st.riskCount ? ` · ${st.riskCount} پرریسک ⚠` : ''} · ${st.degree} پیوند`
            : `${st.degree} پیوند`;
          const hint = isOrgCard ? 'کلیک = جزئیات · دابل‌کلیک = صفحه' : 'کلیک = جزئیات · دابل‌کلیک = صفحه';
          const wCard = Math.max(196, name.length * 7.2 + 56, line1.length * 6 + 48);
          const hCard = isOrgCard ? 92 : 64;
          let cx = Math.min(Math.max(p.x, 100 + wCard / 2), W - 100 - wCard / 2);
          const above = p.y > 260;
          const cy = above ? p.y - (isOrgCard ? ORG_SIZE / 2 + hCard + 26 : PERSON_R + hCard + 22) : p.y + (isOrgCard ? ORG_SIZE / 2 + 58 : PERSON_R + 58);
          const x0 = cx - wCard / 2;
          const y0 = cy;
          const selectedCard = selectedNodeId === cardNode.id;
          return (
            <g
              key={`card-${cardNode.id}`}
              style={{ pointerEvents: 'none' }}
              opacity={selectedCard ? 1 : 0.96}
            >
              <rect x={x0} y={y0} width={wCard} height={hCard} rx={14}
                fill="var(--card-bg, #FFFFFF)"
                stroke={metaC ?? 'var(--card-border-strong, #DDE3EE)'} strokeWidth={1.2}
                style={{ filter: 'url(#node-shadow)' }} />
              <circle cx={x0 + 13} cy={y0 + (isOrgCard ? 15 : 14)} r={4} fill={metaC ?? '#94A3B8'} />
              <text x={x0 + 24} y={y0 + (isOrgCard ? 19 : 18)} fontSize={11.5} fontWeight={800}
                fill="var(--text-primary, #222)" style={{ userSelect: 'none' }}>
                {name.length > 30 ? name.slice(0, 29) + '…' : name}
              </text>
              <text x={x0 + 24} y={y0 + (isOrgCard ? 37 : 34)} fontSize={9.2} fontWeight={700}
                fill={metaC ?? 'var(--text-muted, #667085)'} style={{ userSelect: 'none' }}>
                {line1}
              </text>
              <text x={x0 + 24} y={y0 + (isOrgCard ? 52 : 48)} fontSize={9.6} fontWeight={600}
                fill="var(--text-secondary, #555)" style={{ userSelect: 'none' }}>
                {line2}
              </text>
              {!selectedCard && (
                <text x={x0 + wCard - 12} y={y0 + (isOrgCard ? 19 : 18)} textAnchor="end" fontSize={8.6}
                  fill="var(--text-muted, #8892A6)" style={{ userSelect: 'none' }}>
                  {hint}
                </text>
              )}
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
                    مبدأ مسیر
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
                    مقصد مسیر
                  </text>
                </g>
              )}
            </g>
          );
        })()}
      </g>
    </svg>
  );
});

export default NetworkGraph;
