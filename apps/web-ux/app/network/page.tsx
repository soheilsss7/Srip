'use client';
import { ShieldCheck, Network, Lightbulb, AlertTriangle, Zap, Maximize, Maximize2, X, Target, Clock } from 'lucide-react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { apiGet } from '../_lib/api';
import {fa} from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Empty, ErrorCard, Loading } from '../_components/page-ui';
import {
  GGraph,
  GNode,
  GEdge,
  EDGE_COLORS,
  EDGE_DASH,
  NODE_COLORS,
  RISK_COLOR,
  RISK_THRESHOLD,
  PATH_COLOR,
  kindLabel,
  nodeDisplayName,
  nodeEntityRoute,
  edgeStatus,
  statusMeta,
} from './_nodes';
import NetworkGraph, { NetworkGraphHandle } from './_graph';

// A crash inside the graph must never blank the whole page.
class GraphBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
          <p>نمایش گراف با خطا مواجه شد.</p>
          <button className="net-btn primary" onClick={() => this.setState({ failed: false })}>
            تلاش دوباره
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const STATUSES = ['ACTIVE', 'AT_RISK', 'DORMANT', 'PROSPECTIVE', 'ARCHIVED'];
const PAGE_LIMIT = 500;
/** Stable empty graph — module constant so its identity never changes between renders. */
const EMPTY_GRAPH: GGraph = {
  nodes: [], edges: [],
  meta: { organizationCount: 0, peopleCount: 0, projectCount: 0, relationshipCount: 0, personRelationshipCount: 0 },
  page: { limit: PAGE_LIMIT, nextCursor: null, bounded: true },
};

function bucketize(vals: number[], bins = 8): number[] {
  const out = new Array(bins).fill(0);
  if (!vals.length) return out;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  vals.forEach((v) => {
    const i = Math.min(bins - 1, Math.floor(((v - min) / span) * bins));
    out[i] += 1;
  });
  return out;
}

function AreaSpark({ id, values, color, height = 26 }: { id: string; values: number[]; color: string; height?: number }) {
  const max = Math.max(1, ...values);
  const w = 100;
  const h = height;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DetailButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="secondary-action"
      style={{ color: 'var(--srip-accent-text)', borderColor: 'var(--srip-accent)', background: 'var(--srip-surface)' }}
    >
      {label}
    </Link>
  );
}

function renderAnalysis(
  kind: string,
  rows: any[],
  onSelectNode: (id: string) => void,
  nodeSet: Set<string> | null,
) {
  if (!rows.length) return <Empty>داده‌ای برای این تحلیل یافت نشد.</Empty>;
  const nodeName = (x: any) => x?.node?.name ?? x?.node?.displayName ?? x?.node?.label ?? (typeof x?.node === 'string' ? x.node : '—');
  const nodeId = (x: any) => x?.node?.id ?? null;
  const fmt = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n.toFixed(2) : '—'; };
  const metric = (x: any) =>
    kind === 'centrality' ? ('degree' in x ? x.degree : x.degreeScore)
      : kind === 'bridges' ? ('bridgeScore' in x ? x.bridgeScore : '—')
        : kind === 'bottlenecks' ? ('bottleneckScore' in x ? x.bottleneckScore : '—')
          : ('fragmentationIncrease' in x ? x.fragmentationIncrease : '—');
  const cols =
    kind === 'bottlenecks'
      ? ['گره' as string, 'گلوگاه' as string, 'ریسک' as string]
      : kind === 'connectors'
        ? ['گره' as string, 'اتصال‌دهنده' as string, 'نسخه' as string]
        : ['گره' as string, 'امتیاز' as string];
  const renderNode = (x: any) => {
    const id = nodeId(x);
    const name = nodeName(x);
    if (!id || !nodeSet?.has(id)) return <span>{name}</span>;
    return (
      <button
        onClick={() => onSelectNode(id)}
        title="نمایش در گراف"
        aria-label={`نمایش ${name} در گراف`}
        className="net-btn"
        style={{ border: 0, background: 'none', color: 'var(--srip-accent-text)', padding: 0, fontWeight: 800, textAlign: 'right', minHeight: 'auto' }}
      >
        {name}
      </button>
    );
  };
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => {
            const cells: (string | ReactNode)[] =
              kind === 'connectors'
                ? [renderNode(x), fmt(x.connectorScore), x.scoreVersion ?? '—']
                : kind === 'bottlenecks'
                  ? [renderNode(x), fmt(x.bottleneckScore), x.riskyConnections ?? '—']
                  : [renderNode(x), String(metric(x))];
            return (
              <tr key={x?.node?.id ?? i}>
                {cells.map((c, ci) => (
                  <td key={ci}>{c}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TAB_LABELS: Record<string, string> = { all: 'همه', organization: 'شرکت‌ها', person: 'اشخاص', project: 'پروژه‌ها' };

export default function Page() {
  const { scopeId } = useWorkspace();
  const [graph, setGraph] = useState<GGraph | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('');
  const [relType, setRelType] = useState('');
  const [focus, setFocus] = useState('');
  const [mode, setMode] = useState<'shortest' | 'best'>('shortest');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [path, setPath] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisKind, setAnalysisKind] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [hoverNode, setHoverNode] = useState<GNode | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [renderCounts, setRenderCounts] = useState({ nodes: 0, edges: 0 });
  const [showLegend, setShowLegend] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [graphFs, setGraphFs] = useState(false);
  // تمام‌صفحهٔ گراف: Esc می‌بندد و اسکرول پشت آن قفل می‌شود
  useEffect(() => {
    if (!graphFs) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setGraphFs(false); };
    window.addEventListener('keydown', f);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = ''; };
  }, [graphFs]);
  const [railTab, setRailTab] = useState<'overview' | 'relationships' | 'insights'>('overview');
  const graphHandle = useRef<NetworkGraphHandle | null>(null);

  const [activities, setActivities] = useState<{ t: number; label: string }[]>([]);
  const log = useCallback((label: string) => {
    setActivities((a) => [{ t: Date.now(), label }, ...a].slice(0, 14));
  }, []);

  // Request sequencing + cancellation: only the most recent request may apply its result,
  // and pending requests are aborted on supersession/unmount to avoid stale overwrites and
  // setState-after-unmount (rapid filter/analytics switching, page navigation).
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const beginRequest = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++seqRef.current;
    return { seq, signal: controller.signal };
  }, []);
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const scopeQuery = useCallback(() => (scopeId !== 'all' ? `organizationId=${encodeURIComponent(scopeId)}` : ''), [scopeId]);

  // روابط واقعی (هم‌محدوده) برای ساخت «توصیه‌های هوشمند» همیشه‌فعال از روی داده
  const [relsList, setRelsList] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    apiGet<any>(`/relationships${scopeQuery() ? `?${scopeQuery()}` : ''}`)
      .then((d: any) => { if (alive) setRelsList(Array.isArray(d) ? d : (d?.data ?? d?.items ?? [])); })
      .catch(() => {});
    return () => { alive = false; };
  }, [scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (cursor?: string, append = false) => {
    const { seq, signal } = beginRequest();
    try {
      setError('');
      if (append) setLoadingMore(true);
      else setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (type !== 'all') params.set('type', type);
      if (status) params.set('status', status);
      if (focus) params.set('focus', focus);
      params.set('limit', String(PAGE_LIMIT));
      if (cursor) params.set('cursor', cursor);
      if (scopeId !== 'all') params.set('organizationId', scopeId);
      const data = await apiGet<GGraph>(`/network/graph?${params.toString()}`, { signal, timeoutMs: 20000 });
      if (seq !== seqRef.current) return;
      setGraph((prev) => {
        if (append && prev) {
          const seenNodeIds = new Set(prev.nodes.map((n) => n.id));
          const newNodes = data.nodes.filter((n) => !seenNodeIds.has(n.id));
          const seenEdgeIds = new Set(prev.edges.map((e) => e.id));
          const newEdges = data.edges.filter((e) => !seenEdgeIds.has(e.id));
          return { ...data, nodes: [...prev.nodes, ...newNodes], edges: [...prev.edges, ...newEdges], meta: data.meta, page: data.page };
        }
        return data;
      });
    } catch (e: any) {
      if (seq !== seqRef.current || e?.name === 'AbortError') return;
      setError(e?.message || 'Unable to load network');
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [q, type, status, focus, scopeId, beginRequest]);

  useEffect(() => {
    load();
  }, [load]);

  const nodeIds = useMemo(() => new Set(graph?.nodes.map((n) => n.id) ?? []), [graph]);
  const relTypeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const e of graph?.edges ?? []) if ((e.kind === 'relationship' || e.kind === 'person_relationship') && e.label) s.add(e.label);
    return [...s].sort();
  }, [graph]);
  const renderedEdges = useMemo(
    () => (graph ? graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target) && ((e.kind !== 'relationship' && e.kind !== 'person_relationship') || !relType || e.label === relType)) : []),
    [graph, nodeIds, relType],
  );
  const orphanEdges = graph ? graph.edges.length - renderedEdges.length : 0;
  // Stable graph object for the canvas: rebuilt ONLY when the data actually
  // changes.  Passing an inline object would give NetworkGraph a fresh
  // identity on every page render, forcing its layout memo + onRendered
  // effect to re-run each time (→ unbounded render/effect loop that froze
  // the tab and blocked navigation away from this page).
  const graphProp = useMemo(() => (graph ? { ...graph, edges: renderedEdges } : EMPTY_GRAPH), [graph, renderedEdges]);

  // Status distribution of rendered relationship edges (for chips + legend).
  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of renderedEdges) {
      if (e.kind !== 'relationship' && e.kind !== 'person_relationship') continue;
      const s = edgeStatus(e);
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  }, [renderedEdges]);
  const hasNext = Boolean(graph?.page?.nextCursor);
  const renderDegrees = useMemo(() => {
    const d = new Map<string, number>();
    renderedEdges.forEach((e) => {
      d.set(e.source, (d.get(e.source) ?? 0) + 1);
      d.set(e.target, (d.get(e.target) ?? 0) + 1);
    });
    return d;
  }, [renderedEdges]);

  const selected = selectedNode ?? hoverNode;
  const idToNode = useCallback((id: string) => graph?.nodes.find((n) => n.id === id) ?? null, [graph]);

  const selectedEdge = useMemo(
    () => graph?.edges.find((e) => e.id === selectedEdgeId) ?? null,
    [graph, selectedEdgeId],
  );

  // Path highlight sets (org-level semantics; only highlight nodes/edges present in the loaded graph).
  const pathNodeSet = useMemo(() => {
    const s = new Set<string>();
    (path?.nodes ?? []).forEach((n: any) => s.add(n?.id));
    return s;
  }, [path]);
  const pathEdgeSet = useMemo(() => {
    const s = new Set<string>();
    (path?.edges ?? []).forEach((e: any) => s.add(e?.id));
    return s;
  }, [path]);

  const analysisList = useMemo(
    () => (Array.isArray(analysis) ? analysis : analysis?.items ?? []),
    [analysis],
  );
  const analysisNodeSet = useMemo(() => {
    const s = new Set<string>();
    analysisList.forEach((r: any) => { if (r?.node?.id) s.add(r.node.id); });
    return s;
  }, [analysisList]);

  // ---- Real, data-derived KPI signals (computed from the loaded graph). ----
  const kpi = useMemo(() => {
    const health = renderedEdges.filter((e) => !(Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD)).length;
    const risk = renderedEdges.filter((e) => Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD).length;
    const opp = renderedEdges.filter((e) => Number.isFinite(e.strategicImportance) && e.strategicImportance >= 60).length;
    const total = renderedEdges.length || 1;
    const degree = new Map<string, number>();
    renderedEdges.forEach((e) => { degree.set(e.source, (degree.get(e.source) ?? 0) + 1); degree.set(e.target, (degree.get(e.target) ?? 0) + 1); });
    const people = (graph?.nodes ?? []).filter((n) => n.type === 'person');
    const influencer = [...people].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0] ?? null;
    const influencerDeg = influencer ? degree.get(influencer.id) ?? 0 : 0;
    return {
      health, risk, opp, total,
      graphHealth: Math.round((health / total) * 100),
      relationshipCount: graph?.meta?.relationshipCount ?? 0,
      personRelationshipCount: graph?.meta?.personRelationshipCount ?? 0,
      peopleCount: graph?.meta?.peopleCount ?? 0,
      influencer, influencerDeg,
    };
  }, [renderedEdges, graph]);

  const activeFilters: { key: string; label: string; onClear: () => void }[] = [];
  if (q) activeFilters.push({ key: 'q', label: `q: ${q}`, onClear: () => setQ('') });
  if (type !== 'all') activeFilters.push({ key: 'type', label: `type: ${type}`, onClear: () => setType('all') });
  if (status) activeFilters.push({ key: 'status', label: `status: ${status}`, onClear: () => setStatus('') });
  if (relType) activeFilters.push({ key: 'relType', label: `نوع رابطه: ${relType}`, onClear: () => setRelType('') });
  if (focus) {
    const focusNode = graph?.nodes.find((n) => n.id === focus);
    activeFilters.push({ key: 'focus', label: `focus: ${focusNode ? nodeDisplayName(focusNode) : focus}`, onClear: () => setFocus('') });
  }

  const runPath = async () => {
    if (!from || !to) return;
    const { seq, signal } = beginRequest();
    setError('');
    log('درخواست مسیر سازمانی');
    try {
      const sq = scopeQuery();
      const result = await apiGet(`/network/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${mode}${sq ? `&${sq}` : ''}`, { signal });
      if (seq === seqRef.current) setPath(result);
    } catch (e: any) {
      if (seq !== seqRef.current || e?.name === 'AbortError') return;
      setError(e?.message || 'Unable to calculate path');
    }
  };
  const clearPath = () => { setPath(null); log('مسیر پاک شد'); };
  const loadConnectors = async () => {
    const { seq, signal } = beginRequest();
    setError('');
    setAnalysisKind('connectors');
    log('اجرای تحلیل: Connecteurs');
    setShowAnalysis(true);
    try {
      const sq = scopeQuery();
      const result = await apiGet(`/network/connectors${sq ? `?${sq}` : ''}`, { signal });
      if (seq === seqRef.current) setAnalysis(result);
    } catch (e: any) {
      if (seq !== seqRef.current || e?.name === 'AbortError') return;
      setError(e?.message || 'Unable to load connectors');
    }
  };
  const runAnalysis = async (endpoint: string) => {
    const { seq, signal } = beginRequest();
    setError('');
    setAnalysisKind(endpoint);
    log(`اجرای تحلیل: ${endpoint}`);
    setShowAnalysis(true);
    try {
      const sq = scopeQuery();
      const result = await apiGet(`/network/${endpoint}${sq ? `?${sq}` : ''}`, { signal });
      if (seq === seqRef.current) setAnalysis(result);
    } catch (e: any) {
      if (seq !== seqRef.current || e?.name === 'AbortError') return;
      setError(e?.message || 'Unable to load analysis');
    }
  };
  const onRendered = useCallback((counts: { nodes: number; edges: number }) => setRenderCounts(counts), []);
  const loadMore = async () => {
    if (!graph?.page?.nextCursor) return;
    log('بارگذاری صفحه بعدی گراف');
    await load(graph.page.nextCursor, true);
  };

  // Neighbor expansion: reuse the backend focus capability and reload.
  const expandNode = (node: GNode) => {
    setSelectedNode(node);
    if (focus !== node.id) setFocus(node.id);
    log(`گسترش همسایه‌ها: ${nodeDisplayName(node)}`);
  };
  const clearFocus = () => {
    setFocus('');
    setSelectedNode(null);
  };

  // Analytics row click: highlight the node in the graph by selecting it.
  const selectAnalyticsNode = (id: string) => {
    const node = graph?.nodes.find((n) => n.id === id) ?? null;
    setSelectedNode(node);
    setRailTab('overview');
  };

  const onNodeSelect = useCallback((n: GNode | null) => {
    setSelectedNode(n);
    setRailTab('overview');
    if (n) setSelectedEdgeId(null);
  }, []);

  const orgNodes = graph ? graph.nodes.filter((n) => n.type === 'organization') : [];

  // ---- Priorities (top real risk edges) ----
  const riskPriorities = useMemo(
    () => renderedEdges
      .filter((e) => Number.isFinite(e.risk))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 5),
    [renderedEdges],
  );

  // ---- توصیه‌های هوشمند: همیشه‌فعال و مبتنی بر دادهٔ واقعی (روابط + امتیازها +
  //      سیگنال‌های ریسک). نتایج تحلیل‌های شبکه هم هنگام اجرا به آن افزوده می‌شوند.
  const ANALYSIS_FA: Record<string, string> = { centrality: 'مرکزیت', connectors: 'اتصال‌دهنده‌ها', bridges: 'افراد پل', bottlenecks: 'گلوگاه‌ها', 'single-points-of-failure': 'نقاط تک‌خطا' };
  const recommendations = useMemo(() => {
    type Rec = { text: string; sub: string | null; tone: 'danger' | 'warning' | 'success' | 'info'; href: string | null };
    const out: Rec[] = [];
    const relName = (r: any) => [r?.sourceOrganization?.name, r?.targetOrganization?.name].filter(Boolean).join(' ↔ ') || r?.id || '';
    const risky = (relsList as any[])
      .filter((r: any) => (r.riskScore ?? 0) >= 40 || (r.healthScore ?? 100) < 55 || r.status === 'WATCH' || r.status === 'AT_RISK')
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
      .slice(0, 4);
    for (const r of risky) {
      const name = relName(r);
      const drivers: Array<{ label: string; detail: string; tone: string }> = r.riskDrivers ?? [];
      const has = (t: string) => drivers.some((d) => d.label.includes(t));
      const det = (t: string) => drivers.find((d) => d.label.includes(t))?.detail ?? null;
      const link = `/relationships/${r.id}`;
      if (has('اقدام عقب‌افتاده'))
        out.push({ text: `اقدامِ عقب‌افتادهٔ «${name}» را پیگیری کنید`, sub: det('اقدام عقب‌افتاده'), tone: 'danger', href: link });
      else if (has('بدون اقدام اصلاحی باز'))
        out.push({ text: `برای «${name}» اقدام اصلاحی ثبت کنید`, sub: det('بدون اقدام اصلاحی باز') ?? `دلایل: ${drivers.slice(0, 2).map((d) => d.label).join('، ')}`, tone: 'warning', href: link });
      else if (has('قدمِ برنامه‌ریزی‌شده عقب افتاده'))
        out.push({ text: `قدم بعدی «${name}» را به‌روزرسانی کنید`, sub: det('قدمِ برنامه‌ریزی‌شده عقب افتاده'), tone: 'warning', href: link });
      else if (has('رکود تعامل') || has('فاصلهٔ طولانی'))
        out.push({ text: `تعامل تازه‌ای با «${name}» برنامه‌ریزی کنید`, sub: det('رکود تعامل') ?? det('فاصلهٔ طولانی'), tone: 'warning', href: link });
      else if ((r.riskScore ?? 0) >= 60)
        out.push({ text: `ریسک «${name}» بالاست — بررسی فوری کنید`, sub: `ریسک ${r.riskScore} · سلامت ${r.healthScore}`, tone: 'danger', href: link });
    }
    if (out.length < 4) {
      const opp = (relsList as any[])
        .filter((r: any) => (r.strategicScore ?? 0) >= 80 && (r.riskScore ?? 0) < 40 && (r.status ?? '') !== 'WATCH')
        .sort((a, b) => (b.strategicScore ?? 0) - (a.strategicScore ?? 0))[0];
      if (opp) out.push({ text: `مسیر پیشبرد «${relName(opp)}» را فعال کنید`, sub: `ارزش راهبردی ${opp.strategicScore} — کاندیدای ایده‌آل برای سرمایه‌گذاری رابطه`, tone: 'success', href: `/relationships/${opp.id}` });
    }
    if (analysisKind && analysisList.length) {
      analysisList.slice(0, 2).forEach((r: any) => {
        const name = nodeDisplayName(r?.node);
        let text: string; let tone: 'danger' | 'warning' | 'success' | 'info';
        if (analysisKind === 'connectors') { text = `${name} ارتباط‌دهندهٔ کلیدی است؛ مسیرهای بین‌سازمانی را حول او تقویت کنید.`; tone = 'success'; }
        else if (analysisKind === 'centrality') { text = `${name} با درجه ${r.degree} بیشترین تأثیر را در شبکه دارد.`; tone = 'info'; }
        else if (analysisKind === 'bridges') { text = `${name} به ${r.bridgeScore} سازمان پل می‌زند؛ همکاری او را پایش کنید.`; tone = 'info'; }
        else if (analysisKind === 'bottlenecks') { text = `${name} نقطهٔ گلوگاه است (${r.bottleneckScore})؛ وابستگی را تنوع ببخشید.`; tone = 'warning'; }
        else { text = `حذف ${name} شبکه را به ${r.fragmentationIncrease} مؤلفه می‌شکند؛ ریسک تک‌نقطه دارد.`; tone = 'warning'; }
        out.push({ text, sub: `بر پایهٔ تحلیل ${ANALYSIS_FA[analysisKind] ?? analysisKind}`, tone, href: null });
      });
    }
    if (!out.length) out.push({ text: 'وضعیت شبکهٔ شما نسبتاً سالم است؛ رابطهٔ پرریسکی بدون پوشش نیست.', sub: null, tone: 'success', href: null });
    return out.slice(0, 6);
  }, [analysisKind, analysisList, relsList]);

  // ---- Node/edge rail data ----
  const railRelationships = useMemo(() => {
    if (!selectedNode) return [];
    return renderedEdges
      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
      .sort((a, b) => (b.strategicImportance ?? 0) - (a.strategicImportance ?? 0));
  }, [selectedNode, renderedEdges]);

  const railNodeDegree = railRelationships.length;
  const railNodeRisky = railRelationships.filter((e) => Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD).length;
  const railNodeTopRel = railRelationships[0] ?? null;

  const derivedInsights: string[] = [];
  if (kpi.risk > 0) derivedInsights.push(`${kpi.risk} رابطه پرریسک (risk ≥ ${RISK_THRESHOLD}) در گراف بارگذاری‌شده شناسایی شد.`);
  if (kpi.opp > 0) derivedInsights.push(`${kpi.opp} رابطه راهبردی (امتیاز راهبردی ≥ 60) فرصت بالقوه در نظر گرفته می‌شود.`);
  if (kpi.influencer) derivedInsights.push(`${nodeDisplayName(kpi.influencer)} با ${kpi.influencerDeg} پیوند، پرنفوذترین شخص در گراف بارگذاری‌شده است.`);
  if (path?.found) derivedInsights.push(`مسیر کوتاه/بهینه سازمانی با ${path.hops} پرش یافت شد.`);
  if (path && !path.found) derivedInsights.push(`مسیر سازمانی بین دو گره انتخاب‌شده یافت نشد.`);
  if (!derivedInsights.length) derivedInsights.push('هنوز الگوی قابل‌توجهی از گراف بارگذاری‌شده استخراج نشده است.');

  function selectEdge(id: string) {
    setSelectedEdgeId(id);
    setSelectedNode(null);
    setRailTab('overview');
  }

  return (
    <main className="net-page">
      <ErrorCard message={error} />
      {loading ? <Loading /> : null}

      {/* Header */}
      <section className="net-head">
        <div>
          <div className="eyebrow">SRIP Workspace · Network Intelligence</div>
          <h1>شبکهٔ روابط</h1>
          <p className="subtitle">
            گراف تعاملی روابط استراتژیک با فیلتر، مسیر و تحلیل ریسک/نفوذ. همه مقادیر از سرور واقعی با مجوز و محدودهٔ سازمانی محاسبه می‌شوند.
          </p>
          <div className="net-stats-line">
            <span><b>{graph?.meta?.organizationCount ?? 0}</b> سازمان</span>
            <span><b>{graph?.meta?.peopleCount ?? 0}</b> شخص</span>
            <span><b>{graph?.meta?.projectCount ?? 0}</b> پروژه</span>
            <span><b>{graph?.meta?.relationshipCount ?? 0}</b> رابطه سازمانی</span>
            <span><b>{graph?.meta?.personRelationshipCount ?? 0}</b> رابطه شخص</span>
            <span><b>{renderCounts.nodes}</b> گره رندر شده · <b>{renderCounts.edges}</b> یال رندر شده</span>
            {orphanEdges > 0 ? <span style={{ color: 'var(--srip-danger)' }}>{orphanEdges} یال یتیم حذف شد</span> : null}
            {scopeId !== 'all' ? <span className="scope-badge">محدوده: {scopeId.slice(0, 8)}…</span> : null}
          </div>
        </div>
        <div className="net-tabs" role="tablist" aria-label="فیلتر بر اساس نوع گره">
          {Object.entries(TAB_LABELS).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={type === k}
              className={`tab ${type === k ? 'active' : ''}`}
              onClick={() => { setType(k); log(`فیلتر نوع: ${label}`); }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Stats row */}
      <section className="stats-row" aria-label="شاخص‌های کلیدی شبکه">
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-teal"><ShieldCheck size={14}/></span><span className="st-name">سلامت شبکه</span></div>
          <strong className="st-value">{kpi.graphHealth}%</strong>
          <AreaSpark id="sp-health" values={bucketize(renderedEdges.map((e) => (Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD ? 0 : 100)))} color="var(--teal)" />
          <div className="st-foot"><span className="st-delta up">{kpi.health} کم‌خطر</span><span className="st-note">نسبت به {kpi.total} یال</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-blue"><Network size={14}/></span><span className="st-name">کل روابط</span></div>
          <strong className="st-value">{kpi.relationshipCount}</strong>
          <AreaSpark id="sp-rel" values={bucketize((graph?.nodes ?? []).map((n) => renderDegrees.get(n.id) ?? 0))} color="var(--blue)" />
          <div className="st-foot"><span className="st-delta">{kpi.personRelationshipCount} شخص</span><span className="st-note">{renderedEdges.length} یال رندر</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-indigo"><Lightbulb size={14}/></span><span className="st-name">فرصت‌ها</span></div>
          <strong className="st-value">{kpi.opp}</strong>
          <AreaSpark id="sp-opp" values={bucketize(renderedEdges.map((e) => (Number.isFinite(e.strategicImportance) ? e.strategicImportance : 0)))} color="var(--indigo)" />
          <div className="st-foot"><span className="st-delta up">{kpi.total ? Math.round((kpi.opp / kpi.total) * 100) : 0}%</span><span className="st-note">اهمیت راهبردی ≥ ۶۰</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-red"><AlertTriangle size={14}/></span><span className="st-name">در معرض ریسک</span></div>
          <strong className="st-value">{kpi.risk}</strong>
          <AreaSpark id="sp-risk" values={bucketize(renderedEdges.map((e) => (Number.isFinite(e.risk) ? e.risk : 0)))} color="var(--red)" />
          <div className="st-foot"><span className="st-delta down">{kpi.total ? Math.round((kpi.risk / kpi.total) * 100) : 0}%</span><span className="st-note">risk ≥ {RISK_THRESHOLD}</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-gold"><Zap size={14}/></span><span className="st-name">نفوذ</span></div>
          <strong className="st-value">{kpi.influencerDeg}</strong>
          <AreaSpark id="sp-inf" values={bucketize((graph?.nodes ?? []).map((n) => renderDegrees.get(n.id) ?? 0))} color="var(--gold)" />
          <div className="st-foot"><span className="st-delta">{kpi.influencer ? nodeDisplayName(kpi.influencer) : '—'}</span><span className="st-note">پیوندها</span></div>
        </div>
      </section>

      {/* Filters */}
      <section className="net-filters">
        <input
          type="search"
          aria-label="جستجو در شبکه"
          placeholder="جستجوی سازمان، شخص یا پروژه…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { load(); log('جستجو اعمال شد'); } }}
        />
        <div className="status-chips" role="group" aria-label="فیلتر وضعیت رابطه">
          <button
            className={`status-chip ${status === '' ? 'active' : ''}`}
            onClick={() => { setStatus(''); log('فیلتر وضعیت: همه'); }}
          >
            همه
            <span className="status-count">{statusCounts.size ? [...statusCounts.values()].reduce((a, b) => a + b, 0) : 0}</span>
          </button>
          {STATUSES.map((s) => {
            const meta = statusMeta(s);
            const cnt = statusCounts.get(s) ?? 0;
            const active = status === s;
            return (
              <button
                key={s}
                className={`status-chip ${active ? 'active' : ''}`}
                style={active ? { background: meta.color, borderColor: meta.color } : { color: meta.color }}
                onClick={() => { setStatus(active ? '' : s); log(`فیلتر وضعیت: ${meta.label}`); }}
                disabled={!cnt}
                title={cnt ? `${meta.label} — ${cnt} رابطه` : `هیچ رابطه‌ای با وضعیت ${meta.label} نیست`}
              >
                <span className="status-dot" style={{ background: meta.color }} />
                {meta.label}
                <span className="status-count">{cnt}</span>
              </button>
            );
          })}
        </div>
        <select aria-label="نوع رابطه" value={relType} onChange={(e) => setRelType(e.target.value)}>
          <option value="">همه انواع رابطه</option>
          {relTypeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select aria-label="گره کانونی" value={focus} onChange={(e) => setFocus(e.target.value)}>
          <option value="">بدون کانون</option>
          {graph?.nodes.map((n) => (
            <option key={n.id} value={n.id}>{nodeDisplayName(n)}</option>
          ))}
        </select>
        <button className="net-btn primary" onClick={() => { load(); log('فیلترها اعمال شد'); }} disabled={loading}>
          اعمال فیلترها
        </button>
        <button className="net-btn" onClick={loadMore} disabled={loadingMore || !hasNext}>
          {loadingMore ? 'در حال بارگذاری…' : hasNext ? 'بارگذاری بیشتر' : 'همه بارگذاری شد'}
        </button>
        {activeFilters.length > 0 && (
          <div className="active-filters">
            <small>فیلترهای فعال:</small>
            {activeFilters.map((f) => (
              <span className="filter-chip" key={f.key}>
                {f.label}
                <button onClick={f.onClear} aria-label={`Clear filter ${f.label}`}>✕</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Workspace: graph + detail rail */}
      <div className="content-grid">
        <div className="content-main">
          <div className="panels-row">
        <div className="net-graph-shell">
          <div className="net-graph-head">
            <div>
              <h2>شبکهٔ خوشه‌ای ارتباطات</h2>
              <div className="counts">
                <b>{renderCounts.nodes}</b> گره نمایش داده شده · <b>{renderCounts.edges}</b> یال
                {orphanEdges > 0 ? <span style={{ color: 'var(--srip-danger)' }}> · {orphanEdges} یالِ نامرتبط حذف شد</span> : null}
              </div>
            </div>
            <div className="net-graph-toolbar">
              <button className="net-btn" onClick={() => graphHandle.current?.fit()} disabled={!graph} title="متناسب با نما"><Maximize size={12}/> متناسب</button>
              <button className="net-btn" onClick={() => graphHandle.current?.reset()} disabled={!graph} title="بازنشانی">بازنشانی</button>
              <button className="net-btn" onClick={() => graphHandle.current?.zoomBy(1.35)} disabled={!graph} title="بزرگ‌نمایی" aria-label="بزرگ‌نمایی">+</button>
              <button className="net-btn" onClick={() => graphHandle.current?.zoomBy(0.74)} disabled={!graph} title="کوچک‌نمایی" aria-label="کوچک‌نمایی">−</button>
              <button className="net-btn" onClick={() => setShowLegend(!showLegend)} title="نمایش/عدم نمایش راهنما">راهنما</button>
              {focus ? <button className="net-btn" onClick={clearFocus} title="بازگشت به نمای کلی">پاک‌کردن تمرکز</button> : null}
              <button className="net-btn primary" onClick={() => setGraphFs(true)} disabled={!graph} title="نمایش تمام‌صفحهٔ گراف"><Maximize2 size={13}/> تمام صفحه</button>
            </div>
          </div>

          {/* Path tool */}
          <div className="net-path-tool">
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--srip-text-2)' }}>مسیر سازمانی</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="مبدأ مسیر">
              <option value="">از</option>
              {orgNodes.map((n) => (
                <option key={n.id} value={n.id}>{nodeDisplayName(n)}</option>
              ))}
            </select>
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="مقصد مسیر">
              <option value="">تا</option>
              {orgNodes.map((n) => (
                <option key={n.id} value={n.id}>{nodeDisplayName(n)}</option>
              ))}
            </select>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} aria-label="حالت مسیر">
              <option value="shortest">کوتاه‌ترین</option>
              <option value="best">بهترین</option>
            </select>
            <button className="net-btn primary" onClick={runPath} disabled={!from || !to}>یافتن مسیر</button>
            {path ? <button className="net-btn" onClick={clearPath}>پاک‌کردن مسیر</button> : null}
          </div>
          {path && (
            <div className={`net-path-result ${path.found ? 'found' : 'notfound'}`}>
              {path.found
                ? `مسیر سازمانی یافت شد: ${path.hops} پرش · هزینه ${path.totalCost ?? '—'} · غیرمسیر کمرنگ می‌شود.`
                : 'مسیر سازمانی بین دو گره انتخاب‌شده یافت نشد.'}
            </div>
          )}

          {/* Graph canvas */}
          <div className="net-graph-zone">
            {graphFs ? (
              <div className="net-zone-fs-hold"><Maximize2 size={18}/> گراف در نمای تمام‌صفحه باز است — برای بازگشت دکمهٔ «بستن» یا Esc را بزنید.</div>
            ) : (
            <GraphBoundary>
              <NetworkGraph
                ref={graphHandle}
                graph={graphProp}
                selectedNodeId={selected?.id ?? null}
                selectedEdgeId={selectedEdgeId}
                focusNodeId={focus || null}
                pathNodeIds={path?.found ? pathNodeSet : null}
                pathEdgeIds={path?.found ? pathEdgeSet : null}
                analysisNodeIds={analysisNodeSet.size ? analysisNodeSet : null}
                dimOthers={Boolean(selectedNode)}
                onNodeSelect={onNodeSelect}
                onNodeHover={(n) => setHoverNode(n ?? null)}
                onEdgeSelect={(id) => { setSelectedEdgeId(id); setRailTab('overview'); }}
                onEdgeHover={(label) => setHoverEdge(label)}
                onRendered={onRendered}
              />
            </GraphBoundary>
            )}
          </div>
          <div className="net-hover-line">
            {hoverNode && !selectedNode
              ? <>گرهٔ نشان‌شده: <b>{nodeDisplayName(hoverNode)}</b> ({fa(hoverNode.type)}) — برای جزئیات کلیک کنید</>
              : hoverEdge && !selectedEdgeId
                ? <>یالِ نشان‌شده: <b>{fa(hoverEdge)}</b></>
                : 'نشانگر را روی یک گره ببرید و برای جزئیات کلیک کنید.'}
          </div>

          {/* Legend */}
          {showLegend && (
            <div className="net-legend">
              <div>
                <strong>گره‌ها</strong>{' '}
                <span className="lg"><span className="sw" style={{ background: 'linear-gradient(135deg,#6C8FF7,#3B5BDB)', borderRadius: 4 }} />سازمان</span>
                <span className="lg"><span className="sw" style={{ background: 'linear-gradient(135deg,#2ED3A6,#0E9F6E)', borderRadius: '50%' }} />شخص</span>
                <span className="lg"><span className="sw" style={{ background: 'linear-gradient(135deg,#9B6CF7,#6D28D9)', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)' }} />پروژه</span>
                <span className="lg"><span className="sw" style={{ background: PATH_COLOR }} />مسیر / تمرکز</span>
              </div>
              <div>
                <strong>وضعیت رابطه (روی خط)</strong>{' '}
                {STATUSES.map((s) => {
                  const meta = statusMeta(s);
                  const cnt = statusCounts.get(s) ?? 0;
                  return (
                    <span className="lg" key={s}>
                      <span
                        className="sw line"
                        style={{
                          background: meta.color,
                          backgroundImage: meta.dash
                            ? `repeating-linear-gradient(90deg, ${meta.color} 0 ${meta.dash[0]}px, transparent ${meta.dash[0]}px ${meta.dash[0] + meta.dash[1]}px)`
                            : undefined,
                        }}
                      />
                      {meta.label}
                      <b className="lg-count">{cnt}</b>
                    </span>
                  );
                })}
                <span className="lg"><span className="sw line" style={{ background: '#94A3B8' }} />عضویت (شخص ← سازمان)</span>
                <span className="lg"><span className="sw line" style={{ background: PATH_COLOR }} />یال مسیر</span>
              </div>
            </div>
          )}
        </div>

        {/* Right detail rail */}
        <aside className="net-detail" aria-label="جزئیات گره / یال">
          {selectedNode ? (
            <>
              <div className="net-detail-head">
                <div>
                  <h3>{nodeDisplayName(selectedNode)}</h3>
                  <div className="kind">{fa(selectedNode.type)} · {selectedNode.organizationId ? `شناسهٔ ${selectedNode.organizationId.slice(0, 8)}…` : 'سازمان آزاد'}</div>
                </div>
                <button className="net-btn" onClick={() => setSelectedNode(null)} title="بستن">✕</button>
              </div>
              <div className="net-detail-tabs">
                {(['overview', 'relationships', 'insights'] as const).map((t) => (
                  <button key={t} className={railTab === t ? 'active' : ''} onClick={() => setRailTab(t)}>
                    {t === 'overview' ? 'نمای کلی' : t === 'relationships' ? `روابط (${railRelationships.length})` : 'بینش‌ها'}
                  </button>
                ))}
              </div>
              <div className="net-detail-body">
                {railTab === 'overview' && (
                  <>
                    <div className="net-kv">
                      <div className="kv"><small>شناسه</small><strong>{selectedNode.id}</strong></div>
                      <div className="kv"><small>روابط مرتبط</small><strong>{railNodeDegree}</strong></div>
                    </div>
                    <div className="net-detail-actions" style={{ padding: 0, border: 0 }}>
                      {(() => { const r = nodeEntityRoute(selectedNode); return r ? <DetailButton href={r.href} label={`باز کردن ${fa(selectedNode.type)}`} /> : null; })()}
                      <button className="net-btn primary" onClick={() => expandNode(selectedNode)}>گسترش همسایه‌ها</button>
                    </div>
                  </>
                )}
                {railTab === 'relationships' && (
                  railRelationships.length ? (
                    <div className="net-entity-nav">
                      {railRelationships.map((e) => {
                        const other = e.source === selectedNode.id ? e.target : e.source;
                        const on = idToNode(other);
                        return (
                          <div className="en" key={e.id}>
                            <button
                              className="net-btn"
                              style={{ border: 0, background: 'none', padding: 0, textAlign: 'right', fontWeight: 700, minHeight: 'auto' }}
                              onClick={() => selectEdge(e.id)}
                              title="انتخاب خط در گراف"
                            >
                              {on ? nodeDisplayName(on) : other}
                              <small style={{ display: 'block', fontWeight: 400 }}>{kindLabel(e.kind)}{e.label ? ` · ${e.label}` : ''}{Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD ? <b style={{ color: 'var(--srip-danger)' }}> · risk {e.risk}</b> : ''}</small>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div className="net-empty">یالی برای این گره در گراف بارگذاری‌شده یافت نشد.</div>
                )}
                {railTab === 'insights' && (
                  <>
                    <div className="net-kv">
                      <div className="kv"><small>درجه (پیوندها)</small><strong>{railNodeDegree}</strong></div>
                      <div className="kv"><small>روابط پرریسک</small><strong style={{ color: railNodeRisky ? 'var(--srip-danger)' : 'var(--srip-success)' }}>{railNodeRisky}</strong></div>
                    </div>
                    {railNodeTopRel && (
                      <div className="insight-card">
                        <b>رابطه راهبردی برتر</b>
                        <p>{railNodeTopRel.label ?? kindLabel(railNodeTopRel.kind)} · strategic {railNodeTopRel.strategicImportance}</p>
                      </div>
                    )}
                    {kpi.influencer?.id === selectedNode.id && (
                      <div className="insight-card">
                        <b>گره پرنفوذ</b>
                        <p>پرنفوذترین شخص در گراف بارگذاری‌شده ({kpi.influencerDeg} پیوند).</p>
                        <span className="derive">derived — از همان گراف بارگذاری‌شده</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : selectedEdge ? (
            <>
              <div className="net-detail-head">
                <div>
                  <h3>{selectedEdge.label ?? kindLabel(selectedEdge.kind)}</h3>
                  <div className="kind">خط · سیاهه روابط</div>
                </div>
                <button className="net-btn" onClick={() => setSelectedEdgeId(null)} title="بستن">✕</button>
              </div>
              <div className="net-detail-body">
                {(() => {
                  const st = edgeStatus(selectedEdge);
                  const meta = statusMeta(st);
                  const risk = Number.isFinite(selectedEdge.risk) ? selectedEdge.risk : 0;
                  const strat = Number.isFinite(selectedEdge.strategicImportance) ? selectedEdge.strategicImportance : 0;
                  const health = Number.isFinite((selectedEdge as any).health) ? (selectedEdge as any).health : Math.max(0, Math.min(100, 100 - risk));
                  const weight = Number.isFinite(selectedEdge.weight) ? selectedEdge.weight : 0;
                  const bars = [
                    { label: 'سلامت رابطه', value: health, color: 'var(--teal, #0E9F6E)' },
                    { label: 'ریسک', value: risk, color: 'var(--red, #DC2626)' },
                    { label: 'ارزش استراتژیک', value: strat, color: 'var(--indigo, #4F46E5)' },
                    { label: 'قوت پیوند', value: Math.min(100, weight), color: 'var(--blue, #2563EB)' },
                  ];
                  return (
                    <>
                      <div className="score-banner" style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}33` }}>
                        <span className="status-dot" style={{ background: meta.color, width: 10, height: 10 }} />
                        <div>
                          <b style={{ color: meta.color }}>{meta.label}</b>
                          <small>وضعیت رابطه</small>
                        </div>
                        <span className="status-type">{selectedEdge.label ?? kindLabel(selectedEdge.kind)}</span>
                      </div>
                      <div className="score-bars">
                        {bars.map((b) => (
                          <div className="score-bar" key={b.label}>
                            <span>{b.label}</span>
                            <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, b.value))}%`, background: b.color }} /></span>
                            <b>{Math.round(b.value)}</b>
                          </div>
                        ))}
                      </div>
                      <div className="net-kv">
                        <div className="kv"><small>نوع</small><strong>{selectedEdge.label ?? kindLabel(selectedEdge.kind)}</strong></div>
                        <div className="kv"><small>شناسه</small><strong dir="ltr">{selectedEdge.id}</strong></div>
                      </div>
                    </>
                  );
                })()}
                <div className="net-entity-nav">
                  {[selectedEdge.source, selectedEdge.target].map((id) => {
                    const n = idToNode(id);
                    const r = n ? nodeEntityRoute(n) : null;
                    return (
                      <div className="en" key={id}>
                        <span>{n ? nodeDisplayName(n) : id}<small>{(n as any)?.type ?? ''}</small></span>
                        {r && n ? <Link href={r.href}>باز کردن</Link> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="net-detail-head">
                <div>
                  <h3>نمای کلی شبکه</h3>
                  <div className="kind">مشتق از داده‌های سرور</div>
                </div>
              </div>
              <div className="net-detail-body">
                <div className="net-kv">
                  <div className="kv"><small>سلامت گراف</small><strong>{kpi.graphHealth}%</strong></div>
                  <div className="kv"><small>یال‌های پرریسک</small><strong style={{ color: kpi.risk ? 'var(--srip-danger)' : 'var(--srip-success)' }}>{kpi.risk}</strong></div>
                  <div className="kv"><small>یال‌های راهبردی</small><strong>{kpi.opp}</strong></div>
                  <div className="kv"><small>روابط سازمان</small><strong>{kpi.relationshipCount}</strong></div>
                </div>
                <div className="insight-card">
                  <b>خلاصه هوشمند</b>
                  {derivedInsights.slice(0, 3).map((d, i) => <p key={i}>{d}</p>)}
                  <span className="derive">derived — از گراف بارگذاری‌شده با Authorization واقعی</span>
                </div>
                <div className="net-empty">یک گره یا یال را در گراف انتخاب کنید تا جزئیات، روابط و بینش‌های آن را ببینید.</div>
              </div>
            </>
          )}
          <div className="net-detail-actions">
            <button className="net-btn primary" onClick={() => setShowAnalysis((s) => !s)}>
              {showAnalysis ? 'بستن تحلیل کامل' : 'مشاهدهٔ تحلیل کامل'}
</button>
          </div>
        </aside>
          </div>

      {/* Full analysis sheet */}
      {showAnalysis && (
        <section className="card analysis-sheet">
          <div className="net-detail-tabs" style={{ padding: '0 0 8px', background: 'none' }}>
            <button className={analysisKind === 'centrality' ? 'active' : ''} onClick={() => runAnalysis('centrality')}>مرکزیت</button>
            <button className={analysisKind === 'connectors' ? 'active' : ''} onClick={loadConnectors}>اتصال‌دهنده‌ها</button>
            <button className={analysisKind === 'bridges' ? 'active' : ''} onClick={() => runAnalysis('bridges')}>افراد پل</button>
            <button className={analysisKind === 'bottlenecks' ? 'active' : ''} onClick={() => runAnalysis('bottlenecks')}>گلوگاه‌ها</button>
            <button className={analysisKind === 'single-points-of-failure' ? 'active' : ''} onClick={() => runAnalysis('single-points-of-failure')}>نقاط تک‌خطا</button>
          </div>
          <p className="muted">روی هر نتیجه کلیک کنید تا همان گره در گراف انتخاب شود.</p>
          {analysis ? (
            <div className="table-wrap">
              {renderAnalysis(analysisKind || 'centrality', analysisList, selectAnalyticsNode, analysisNodeSet)}
            </div>
          ) : <Empty>برای نمایش تحلیل کامل، یکی از دکمه‌های بالا را اجرا کنید.</Empty>}
        </section>
      )}
        </div>

        <aside className="content-side">
      {/* Side rail */}
        <div className="list-card">
          <div className="lc-head"><span className="lc-ico ic-red"><Target size={14}/></span><h3>امروز در اولویت</h3><span className="lc-badge">{riskPriorities.length}</span></div>
          <p className="panel-note">پرریسک‌ترین روابط در گراف بارگذاری‌شده (طبقه‌بندی بر اساس riskScore).</p>
          {riskPriorities.length ? (
            <div className="item-list">
              {riskPriorities.map((e) => {
                const a = idToNode(e.source); const b = idToNode(e.target);
                return (
                  <button className="item" key={e.id} onClick={() => selectEdge(e.id)} title="انتخاب در گراف">
                    <span>
                      <b>{a ? nodeDisplayName(a) : e.source} ↔ {b ? nodeDisplayName(b) : e.target}</b>
                      <small style={{ display: 'block' }}>{kindLabel(e.kind)}{e.label ? ` · ${e.label}` : ''}</small>
                    </span>
                    <span className="meta">ریسک {e.risk}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty>در گراف بارگذاری‌شده رابطه پرریسکی یافت نشد.</Empty>
          )}
        </div>
        <div className="list-card">
          <div className="lc-head"><span className="lc-ico ic-purple"><Zap size={14}/></span><h3>توصیه‌های هوشمند</h3></div>
          <p className="panel-note">مشتق از اجرای واقعی تحلیل‌های شبکه (مرکزیت / اتصال‌دهنده‌ها / افراد پل / گلوگاه‌ها / نقاط تک‌خطا).</p>
          <div className="item-list">
            {recommendations.map((r: any, i) => (
              <div className="item" key={i}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    {r.tone === 'danger' ? <AlertTriangle size={14} style={{ flex: '0 0 auto', marginTop: 2, color: 'var(--srip-danger)' }} />
                      : r.tone === 'warning' ? <AlertTriangle size={14} style={{ flex: '0 0 auto', marginTop: 2, color: 'var(--srip-warning, #f59e0b)' }} />
                        : <Lightbulb size={14} style={{ flex: '0 0 auto', marginTop: 2, color: 'var(--srip-success)' }} />}
                    <b style={{ fontSize: 12, lineHeight: 1.7 }}>{r.text}</b>
                  </span>
                  {r.sub && <span className="t-muted" style={{ fontSize: 10.5, lineHeight: 1.7 }}>{r.sub}</span>}
                  {r.href && (
                    <Link href={r.href} style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 800, color: 'var(--srip-accent-text)', textDecoration: 'none' }}>
                      مشاهدهٔ رابطه ←
                    </Link>
                  )}
                </span>
                <span className={`ui-badge ${r.tone}`}>
                  {r.tone === 'danger' ? 'فوری' : r.tone === 'warning' ? 'هشدار' : r.tone === 'info' ? 'بینش' : 'پیشنهاد'}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <span className="t-muted" style={{ fontSize: 10.5 }}>تحلیل شبکه:</span>
            <button className="net-btn" style={{ padding: '3px 9px', fontSize: 10.5 }} onClick={() => runAnalysis('centrality')}>مرکزیت</button>
            <button className="net-btn" style={{ padding: '3px 9px', fontSize: 10.5 }} onClick={loadConnectors}>اتصال‌دهنده‌ها</button>
            <button className="net-btn" style={{ padding: '3px 9px', fontSize: 10.5 }} onClick={() => runAnalysis('bridges')}>افراد پل</button>
            <button className="net-btn" style={{ padding: '3px 9px', fontSize: 10.5 }} onClick={() => runAnalysis('bottlenecks')}>گلوگاه‌ها</button>
          </div>
        </div>
        <div className="list-card">
          <div className="lc-head"><span className="lc-ico ic-blue"><Clock size={14}/></span><h3>فعالیت‌های این نشست</h3><span className="lc-badge">{activities.length}</span></div>
          <p className="panel-note">رویدادهای واقعی تعامل شما با این صفحه در جلسه فعلی.</p>
          {activities.length ? (
            <div style={{ display: 'grid', gap: 4 }}>
              {activities.map((a, i) => (
                <div className="activity" key={i}>
                  {a.label}
                  <time>{new Date(a.t).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              ))}
            </div>
          ) : (
            <Empty>هنوز فعالیتی ثبت نشده؛ فیلتر، مسیر یا تحلیلی را امتحان کنید.</Empty>
          )}
        </div>
        <div className="footer-note">
          همه مقادیر از سرور واقعی با مجوز سازمانی گرفته شده‌اند؛ هیچ داده نمایشی/جعلی اضافه نشده است.
        </div>
        </aside>
      </div>

      {typeof document !== 'undefined' && graphFs
        ? createPortal(
            <div className="net-fs" role="dialog" aria-modal="true" aria-label="گراف شبکه — تمام صفحه">
              <div className="net-fs-bar">
                <div className="net-fs-title">
                  <Network size={16} />
                  <div>
                    <b>شبکهٔ خوشه‌ای ارتباطات</b>
                    <span className="counts">{renderCounts.nodes} گره · {renderCounts.edges} یال</span>
                  </div>
                </div>
                <div className="net-graph-toolbar">
                  <button className="net-btn" onClick={() => graphHandle.current?.fit()} title="متناسب با نما"><Maximize size={12}/> متناسب</button>
                  <button className="net-btn" onClick={() => graphHandle.current?.reset()} title="بازنشانی">بازنشانی</button>
                  <button className="net-btn" onClick={() => graphHandle.current?.zoomBy(1.35)} title="بزرگ‌نمایی" aria-label="بزرگ‌نمایی">+</button>
                  <button className="net-btn" onClick={() => graphHandle.current?.zoomBy(0.74)} title="کوچک‌نمایی" aria-label="کوچک‌نمایی">−</button>
                  <button className="net-btn" onClick={() => setShowLegend(!showLegend)} title="نمایش/عدم نمایش راهنما">راهنما</button>
                  {focus ? <button className="net-btn" onClick={clearFocus} title="بازگشت به نمای کلی">پاک‌کردن تمرکز</button> : null}
                  <button className="net-btn primary" onClick={() => setGraphFs(false)} title="بستن نمای تمام‌صفحه"><X size={13}/> بستن</button>
                </div>
              </div>
              <div className="net-fs-canvas">
                <GraphBoundary>
<NetworkGraph
                                  ref={graphHandle}
                                  graph={graphProp}
                                  selectedNodeId={selected?.id ?? null}
                                  selectedEdgeId={selectedEdgeId}
                                  focusNodeId={focus || null}
                                  pathNodeIds={path?.found ? pathNodeSet : null}
                                  pathEdgeIds={path?.found ? pathEdgeSet : null}
                                  analysisNodeIds={analysisNodeSet.size ? analysisNodeSet : null}
                                  dimOthers={Boolean(selectedNode)}
                                  onNodeSelect={onNodeSelect}
                                  onNodeHover={(n) => setHoverNode(n ?? null)}
                                  onEdgeSelect={(id) => { setSelectedEdgeId(id); setRailTab('overview'); }}
                                  onEdgeHover={(label) => setHoverEdge(label)}
                                  onRendered={onRendered}
                                />
                </GraphBoundary>
              </div>
            </div>,
            document.body
          )
        : null}
            {/* Node details shown in right rail above; graph canvas reveals details onClick */}
    </main>
  );
}