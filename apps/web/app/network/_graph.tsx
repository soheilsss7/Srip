'use client';
// ============================================================================
//  شبکهٔ خوشه‌ای (Cluster Orbit) — مفهوم منتخب #۱
//  · هر سازمانِ مادر در یک «حباب» پاستلی نرم با برچسب نام (کپسول بالای حباب)
//  · شرکتِ مرکز: کارت شیشه‌ای سفید گردگوشه با آواتار گرادیانی + حرف اول
//  · اشخاص/پروژه‌ها: دایره‌های کوچک با حرف اول که به‌صورت مداری دور سازمان می‌چرخند
//  · خطوط بین خوشه‌ها باریک و بر اساس وضعیت رابطه رنگ/خط‌چین می‌شوند؛
//    نقطهٔ وضعیت کوچکی روی میانهٔ هر خط رابطه می‌نشیند (به‌جای قرص بزرگ)
//  · عضویت (person→org): خط صاف خاکستری کوتاه داخل حباب
//  · همگی SVG خالص — بدون کتابخانهٔ خارجی؛ hover/انتخاب/کشیدن/زوم حفظ شده
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
  PATH_COLOR,
  edgeStrokeColor,
  edgeDisplayLabel,
  nodeDisplayName,
  nodeEntityRoute,
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
}

type Pos = { x: number; y: number };

/** World canvas — aspect 1600/760 = 800/380 matches the .net-graph-zone box. */
const W = 1600;
const H = 760;
const ORG_SIZE = 50;      // org glass-card side
const PERSON_R = 11;      // person orbit dot radius
const PROJECT_R = 13;     // project diamond radius
const CLUSTER_PAD = 62;   // extra air between the content and the bubble edge

/** Per-cluster pastel tint (fill + border + avatar gradient start). */
const CLUSTER_TINTS = [
  { fill: 'rgba(99,102,241,0.055)', stroke: 'rgba(99,102,241,0.34)' },   // indigo
  { fill: 'rgba(20,184,166,0.06)',  stroke: 'rgba(13,148,136,0.32)' },   // teal
  { fill: 'rgba(59,130,246,0.05)',  stroke: 'rgba(37,99,235,0.30)' },    // blue
  { fill: 'rgba(146,97,248,0.05)',  stroke: 'rgba(124,58,237,0.30)' },   // purple
  { fill: 'rgba(245,158,11,0.05)',  stroke: 'rgba(217,119,6,0.30)' },    // amber
  { fill: 'rgba(236,72,153,0.04)',  stroke: 'rgba(219,39,119,0.26)' },   // pink
  { fill: 'rgba(14,165,233,0.05)',  stroke: 'rgba(2,132,199,0.28)' },    // sky
  { fill: 'rgba(22,163,74,0.05)',   stroke: 'rgba(21,128,61,0.28)' },    // green
];

type Cluster = { root: GNode; members: GNode[] };

function bareId(id: string): string {
  const i = id.indexOf(':');
  return i >= 0 ? id.slice(i + 1) : id;
}

/** Group nodes into clusters: one per organization (+ member nodes that belong to it). */
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
      // standalone node (no owning org in this graph) — its own micro-cluster
      clusters.push({ root: n, members: [] });
    }
  }
  for (const c of clusters) c.members.sort((a, b) => (a.id < b.id ? -1 : 1));
  return clusters;
}

/**
 * Deterministic cluster layout — no physics, no randomness, no hot loop:
 *  · roots (companies) sit on a centered grid (one/two/three rows by count)
 *  · each root's members orbit it on a ring, distributed evenly
 * Ring radius and row positions are tuned so that bubble boxes stay inside the
 * 1600×760 world with no overlap for the common 1–10-cluster cases.
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
    rows === 1 ? 112 :
    rows === 2 ? 92 :
    rows === 3 ? 74 :
    56;
  const stepX = Math.min(430, (W * 0.92) / Math.max(1, cols));
  // per-row horizontal centering (shorter last row stays centered)
  clusters.forEach((c, i) => {
    const r = Math.floor(i / cols);
    const col = i % cols;
    const rowCount = Math.min(cols, n - r * cols);
    const rowStart = (W - (rowCount - 1) * stepX) / 2;
    const cy =
      rows === 1 ? H / 2 :
      rows === 2 ? (r === 0 ? 222 : 576) :
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
  // safety: any node not placed yet (should not happen) gets a neutral spot
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
  return type === 'organization' ? 44 : 27; // node + label under it
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
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pos>({ x: 0, y: 0 });
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const clusters = useMemo(() => buildClusters(graph.nodes), [graph]);
  const { positions, links } = useMemo(() => {
    const pos = layout(clusters, graph.nodes);
    const safe = graph.edges.filter((e) => pos.has(e.source) && pos.has(e.target));
    return { positions: pos, links: safe };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, clusters]);

  // Report rendered counts ONLY when the numbers actually change (no loops).
  const renderedNodeCount = graph.nodes.length;
  const renderedEdgeCount = links.length;
  const onRenderedRef = useRef(onRendered);
  useEffect(() => { onRenderedRef.current = onRendered; }, [onRendered]);
  useEffect(() => {
    onRenderedRef.current?.({ nodes: renderedNodeCount, edges: renderedEdgeCount });
  }, [renderedNodeCount, renderedEdgeCount]);

  const [manual, setManual] = useState<Map<string, Pos> | null>(null);
  const posOf = (id: string): Pos => (manual?.get(id) ?? positions.get(id)) ?? { x: 0, y: 0 };

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
    if (pathActive) return pathNodeIds?.has(id) ? 1 : 0.15;
    if (dimOthers && selectedNodeId != null && selectedNodeId !== id) return 0.3;
    return 1;
  };
  const edgeAlpha = (l: GEdge): number => {
    if (pathActive) return pathEdgeIds?.has(l.id) ? 1 : 0.08;
    if (dimOthers && selectedNodeId != null && l.source !== selectedNodeId && l.target !== selectedNodeId) return 0.25;
    return 1;
  };
  const edgeIsEmphasized = (l: GEdge) =>
    selectedEdgeId === l.id || hoverEdge === l.id || pathEdgeIds?.has(l.id) || analysisNodeIds?.has(l.id);
  const edgeColor = (l: GEdge): string => {
    if (pathEdgeIds?.has(l.id)) return PATH_COLOR;
    if (selectedEdgeId === l.id) return '#111827';
    if (l.kind === 'membership' || l.kind === 'project') return '#A9B2C3';
    return statusMeta(edgeStatus(l)).color;
  };
  const nodeAccent = (id: string): string | null => {
    if (pathNodeIds?.has(id)) return PATH_COLOR;
    if (analysisNodeIds?.has(id)) return PATH_COLOR;
    return null;
  };

  const onPointerDown = (e: React.PointerEvent, n: GNode) => {
    const p = posOf(n.id);
    dragRef.current = { id: n.id, dx: p.x - e.clientX, dy: p.y - e.clientY };
    setDragId(n.id);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setManual((prev) => {
      const next = new Map(prev ?? []);
      next.set(d.id, { x: e.clientX + d.dx - pan.x, y: e.clientY + d.dy - pan.y });
      return next;
    });
  };
  const onPointerUp = () => { dragRef.current = null; setDragId(null); };

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
      const top = topMost - 62; // room for the label pill
      const bottom = bottomMost + 34;
      const w = Math.max(248, maxX - minX + 44);
      const h = Math.max(180, bottom - top);
      const x = minX + (maxX - minX) / 2 - w / 2;
      const y = top;
      out.push({
        key: c.root.id,
        tint,
        x, y, w, h,
        labelX: x + w / 2,
        labelY: y + 23,
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
      return any ? 1 : 0.32;
    }
    if (dimOthers && selectedNodeId != null && !ids.has(selectedNodeId)) return 0.45;
    return 1;
  };
  const isRel = (l: GEdge) => l.kind === 'relationship' || l.kind === 'person_relationship';

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
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
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
          <feDropShadow dx="0" dy="1.6" stdDeviation="2.4" floodColor="#0F172A" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* subtle world border glow (feels like a defined workspace) */}
      <rect x={8} y={8} width={W - 16} height={H - 16} rx={26} fill="none"
        stroke="var(--card-border, #E6EAF2)" strokeWidth={1.4} opacity={0.8} />

      <g transform={`translate(${W / 2 * (1 - zoom)} ${H / 2 * (1 - zoom)}) scale(${zoom})`} style={{ transformOrigin: '0 0' }}>
        {/* ============ cluster bubbles ============ */}
        {bubbles.map((b) => (
          <g key={b.key} opacity={bubbleAlpha(b.ids)} style={{ transition: 'opacity .18s ease' }} pointerEvents="none">
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={30} fill={b.tint.fill} stroke={b.tint.stroke} strokeWidth={1.4} />
            {/* label pill */}
            <rect
              x={b.labelX - Math.max(44, nodeDisplayName(b.root).length * 5.6 + 30) / 2}
              y={b.y + 12}
              width={Math.max(88, nodeDisplayName(b.root).length * 5.6 + 30)}
              height={22}
              rx={11}
              fill="var(--card-bg, #FFFFFF)"
              stroke={b.tint.stroke}
              strokeWidth={1}
            />
            <text
              x={b.labelX} y={b.y + 27}
              textAnchor="middle" fontSize={11} fontWeight={800}
              fill="var(--text-secondary, #667085)"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {nodeDisplayName(b.root).length > 24 ? nodeDisplayName(b.root).slice(0, 23) + '…' : nodeDisplayName(b.root)}
            </text>
          </g>
        ))}

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
          const width = mem ? 1.3 : selected ? meta.width + 1.6 : emphasized ? meta.width + 0.8 : meta.width - 0.5;
          const stroke = edgeColor(l);
          const dash = mem ? undefined : isRel(l) ? meta.dash : undefined;
          return (
            <g key={l.id} opacity={alpha}>
              <path d={geo.d} fill="none" stroke="transparent" strokeWidth={13} style={{ cursor: 'pointer' }}
                onPointerEnter={() => { setHoverEdge(l.id); onEdgeHover && onEdgeHover(edgeDisplayLabel(l)); }}
                onPointerLeave={() => { setHoverEdge(null); onEdgeHover && onEdgeHover(null); }}
                onClick={() => onEdgeSelect && onEdgeSelect(l.id)} />
              <path d={geo.d} fill="none" stroke={stroke} strokeWidth={width}
                strokeDasharray={dash?.join(' ')} strokeLinecap="round"
                style={{ pointerEvents: 'none', transition: 'stroke-width .12s ease' }} />
              {/* tiny status dot on relationship midpoints */}
              {isRel(l) && (emphasized || zoom >= 0.5) && (
                <circle cx={geo.mx} cy={geo.my} r={3.2}
                  fill={selected ? '#111827' : meta.color}
                  stroke="var(--card-bg, #FFFFFF)" strokeWidth={1.6}
                  style={{ pointerEvents: 'none' }} />
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
          const hovered = hoverNode === n.id;
          const focused = focusNodeId === n.id;
          const name = nodeDisplayName(n);
          const isOrg = n.type === 'organization';
          const grad = acc ?? nodeGrad(n);
          const href = nodeEntityRoute(n)?.href;

          const glow = focused || selected || (pathActive && pathNodeIds?.has(n.id));
          const clickHint = hovered || glow;
          return (
            <g
              key={n.id}
              opacity={alpha}
              style={{ cursor: hovered ? 'pointer' : 'default', transition: 'opacity .18s ease' }}
              onPointerEnter={() => { setHoverNode(n.id); onNodeHover && onNodeHover(n); }}
              onPointerLeave={() => { setHoverNode(null); onNodeHover && onNodeHover(null); }}
              onPointerDown={(e) => onPointerDown(e, n)}
              onClick={() => onNodeSelect && onNodeSelect(n)}
            >
              {/* selection / hover / path rings */}
              {hovered && !selected && (
                <circle cx={p.x} cy={p.y} r={(isOrg ? ORG_SIZE / 2 : PERSON_R) + 6}
                  fill="none" stroke="#2563EB" strokeWidth={1.4} opacity={0.55} />
              )}
              {selected && (
                <circle cx={p.x} cy={p.y} r={(isOrg ? ORG_SIZE / 2 : PERSON_R) + 7}
                  fill="none" stroke="#111827" strokeWidth={2.4} />
              )}
              {focused && (
                <circle cx={p.x} cy={p.y} r={(isOrg ? ORG_SIZE / 2 : PERSON_R) + 10}
                  fill="none" stroke="#2563EB" strokeWidth={1.5} strokeDasharray="3 4" />
              )}

              {isOrg ? (
                /* ---- glass card: white tile + gradient avatar with initial ---- */
                <g filter={clickHint ? undefined : 'url(#node-shadow)'}>
                  <rect x={p.x - ORG_SIZE / 2} y={p.y - ORG_SIZE / 2} width={ORG_SIZE} height={ORG_SIZE}
                    rx={14} fill={acc ? acc : 'var(--card-bg, #FFFFFF)'}
                    stroke={acc ? acc : (hovered ? '#A5B4FC' : '#E2E8F0')} strokeWidth={1.6} />
                  <rect x={p.x - 15} y={p.y - 15} width={30} height={30} rx={9}
                    fill={grad} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1} />
                  <text x={p.x} y={p.y + 5.5} textAnchor="middle" fontSize={14} fontWeight={800}
                    fill="#FFFFFF" style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {initialOf(name)}
                  </text>
                </g>
              ) : n.type === 'project' ? (
                <g filter="url(#node-shadow)">
                  <polygon
                    points={`${p.x},${p.y - PROJECT_R * 1.3} ${p.x + PROJECT_R * 1.2},${p.y + PROJECT_R * 0.9} ${p.x - PROJECT_R * 1.2},${p.y + PROJECT_R * 0.9}`}
                    fill={grad} stroke="#FFFFFF" strokeWidth={1.6} strokeLinejoin="round"
                  />
                  <text x={p.x} y={p.y + 2} textAnchor="middle" fontSize={8} fontWeight={800} fill="#FFFFFF"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {initialOf(name)}
                  </text>
                </g>
              ) : (
                /* ---- person: small orbit dot with initial ---- */
                <g filter="url(#node-shadow)">
                  <circle cx={p.x} cy={p.y} r={PERSON_R + (hovered ? 1.4 : 0)} fill={grad} stroke="#FFFFFF" strokeWidth={1.8} />
                  <text x={p.x} y={p.y + 3.6} textAnchor="middle" fontSize={8} fontWeight={800} fill="#FFFFFF"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {initialOf(name)}
                  </text>
                </g>
              )}

              {/* label under node */}
              <text
                x={p.x}
                y={p.y + (isOrg ? ORG_SIZE / 2 + 15 : PERSON_R + 16)}
                textAnchor="middle"
                fontSize={isOrg ? 12 : 10.5}
                fontWeight={isOrg ? 700 : 600}
                fill="var(--text-primary, #3B4252)"
                stroke="var(--card-bg, #FFFFFF)"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {name.length > (isOrg ? 20 : 16) ? name.slice(0, isOrg ? 19 : 15) + '…' : name}
              </text>
              {href && <title>{`${name} — کلیک برای باز کردن`}</title>}
            </g>
          );
        })}
      </g>
    </svg>
  );
});

export default NetworkGraph;
