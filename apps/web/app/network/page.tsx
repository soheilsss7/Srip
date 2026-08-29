'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { apiGet } from '../_lib/api';
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
} from './_nodes';
import type { NetworkGraphHandle } from './_graph';

// Browser-only graph (canvas + d3-zoom); safe for SWC/WASM build via lazy ssr:false.
const NetworkGraph = dynamic(() => import('./_graph'), { ssr: false, loading: () => <Loading /> });

const STATUSES = ['PROSPECTIVE', 'ACTIVE', 'AT_RISK', 'DORMANT', 'ARCHIVED'];
const PAGE_LIMIT = 500;

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
      ? ['Node' as string, 'Bottleneck' as string, 'Risky' as string]
      : kind === 'connectors'
        ? ['Node' as string, 'Connector' as string, 'Version' as string]
        : ['Node' as string, 'Score' as string];
  const renderNode = (x: any) => {
    const id = nodeId(x);
    const name = nodeName(x);
    if (!id || !nodeSet?.has(id)) return <span>{name}</span>;
    return (
      <button
        onClick={() => onSelectNode(id)}
        title="Highlight in graph"
        aria-label={`Highlight ${name} in the graph`}
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

const TAB_LABELS: Record<string, string> = { all: 'All', organization: 'Organizations', person: 'People', project: 'Projects' };

export default function Page() {
  const { scopeId } = useWorkspace();
  const [graph, setGraph] = useState<GGraph | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('');
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
      const data = await apiGet<GGraph>(`/network/graph?${params.toString()}`, { signal });
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
  const renderedEdges = useMemo(
    () => (graph ? graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)) : []),
    [graph, nodeIds],
  );
  const orphanEdges = graph ? graph.edges.length - renderedEdges.length : 0;
  const hasNext = Boolean(graph?.page.nextCursor);
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
      relationshipCount: graph?.meta.relationshipCount ?? 0,
      personRelationshipCount: graph?.meta.personRelationshipCount ?? 0,
      peopleCount: graph?.meta.peopleCount ?? 0,
      influencer, influencerDeg,
    };
  }, [renderedEdges, graph]);

  const activeFilters: { key: string; label: string; onClear: () => void }[] = [];
  if (q) activeFilters.push({ key: 'q', label: `q: ${q}`, onClear: () => setQ('') });
  if (type !== 'all') activeFilters.push({ key: 'type', label: `type: ${type}`, onClear: () => setType('all') });
  if (status) activeFilters.push({ key: 'status', label: `status: ${status}`, onClear: () => setStatus('') });
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
    if (!graph?.page.nextCursor) return;
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

  // ---- Derived recommendations (from real analysis output when present) ----
  const recommendations = useMemo(() => {
    if (!analysisKind || !analysisList.length) return [];
    const lines: { text: string; tone: string }[] = [];
    analysisList.slice(0, 3).forEach((r: any) => {
      const name = nodeDisplayName(r?.node);
      if (analysisKind === 'connectors') lines.push({ text: `${name} ارتباط‌دهنده کلیدی است؛ مسیرهای بین‌سازمانی را حول او تقویت کنید.`, tone: 'success' });
      else if (analysisKind === 'centrality') lines.push({ text: `${name} با درجه ${r.degree} بیشترین تأثیر را در شبکه دارد.`, tone: 'info' });
      else if (analysisKind === 'bridges') lines.push({ text: `${name} به ${r.bridgeScore} سازمان دسترسی پل می‌زند؛ همکاری او را پایش کنید.`, tone: 'info' });
      else if (analysisKind === 'bottlenecks') lines.push({ text: `${name} نقطه گلوگاه است (${r.bottleneckScore})؛ وابستگی را تنوع ببخشید.`, tone: 'warning' });
      else if (analysisKind === 'single-points-of-failure') lines.push({ text: `حذف ${name} شبکه را به ${r.fragmentationIncrease} مؤلفه بیشتر می‌شکند؛ ریسک تک‌نقطه دارد.`, tone: 'warning' });
    });
    return lines;
  }, [analysisKind, analysisList]);

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
  if (kpi.opp > 0) derivedInsights.push(`${kpi.opp} رابطه راهبردی (strategic ≥ 60) فرصت بالقوه در نظر گرفته می‌شود.`);
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
          <h1>شبکه اطلاعاتی</h1>
          <p className="subtitle">
            گراف تعاملی روابط استراتژیک با فیلتر، مسیر و تحلیل ریسک/نفوذ. همه مقادیر از Backend واقعی با Authorization و Scope سازمانی محاسبه می‌شوند.
          </p>
          <div className="net-stats-line">
            <span><b>{graph?.meta.organizationCount ?? 0}</b> سازمان</span>
            <span><b>{graph?.meta.peopleCount ?? 0}</b> شخص</span>
            <span><b>{graph?.meta.projectCount ?? 0}</b> پروژه</span>
            <span><b>{graph?.meta.relationshipCount ?? 0}</b> رابطه سازمانی</span>
            <span><b>{graph?.meta.personRelationshipCount ?? 0}</b> رابطه شخص</span>
            <span><b>{renderCounts.nodes}</b> گره رندر شده · <b>{renderCounts.edges}</b> یال رندر شده</span>
            {orphanEdges > 0 ? <span style={{ color: 'var(--srip-danger)' }}>{orphanEdges} یال یتیم حذف شد</span> : null}
            {scopeId !== 'all' ? <span className="scope-badge">محدوده: {scopeId.slice(0, 8)}…</span> : null}
          </div>
        </div>
        <div className="net-tabs" role="tablist" aria-label="Filter by node type">
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
      <section className="stats-row" aria-label="Network key metrics">
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-teal">🛡</span><span className="st-name">Network Health</span></div>
          <strong className="st-value">{kpi.graphHealth}%</strong>
          <AreaSpark id="sp-health" values={bucketize(renderedEdges.map((e) => (Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD ? 0 : 100)))} color="var(--teal)" />
          <div className="st-foot"><span className="st-delta up">{kpi.health} کم‌خطر</span><span className="st-note">نسبت به {kpi.total} یال</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-blue">🕸</span><span className="st-name">Total Relationships</span></div>
          <strong className="st-value">{kpi.relationshipCount}</strong>
          <AreaSpark id="sp-rel" values={bucketize((graph?.nodes ?? []).map((n) => renderDegrees.get(n.id) ?? 0))} color="var(--blue)" />
          <div className="st-foot"><span className="st-delta">{kpi.personRelationshipCount} شخص</span><span className="st-note">{renderedEdges.length} یال رندر</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-indigo">💡</span><span className="st-name">Opportunities</span></div>
          <strong className="st-value">{kpi.opp}</strong>
          <AreaSpark id="sp-opp" values={bucketize(renderedEdges.map((e) => (Number.isFinite(e.strategicImportance) ? e.strategicImportance : 0)))} color="var(--indigo)" />
          <div className="st-foot"><span className="st-delta up">{kpi.total ? Math.round((kpi.opp / kpi.total) * 100) : 0}%</span><span className="st-note">strategicImportance ≥ 60</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-red">⚠</span><span className="st-name">Risk Exposure</span></div>
          <strong className="st-value">{kpi.risk}</strong>
          <AreaSpark id="sp-risk" values={bucketize(renderedEdges.map((e) => (Number.isFinite(e.risk) ? e.risk : 0)))} color="var(--red)" />
          <div className="st-foot"><span className="st-delta down">{kpi.total ? Math.round((kpi.risk / kpi.total) * 100) : 0}%</span><span className="st-note">risk ≥ {RISK_THRESHOLD}</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-gold">⚡</span><span className="st-name">Influence</span></div>
          <strong className="st-value">{kpi.influencerDeg}</strong>
          <AreaSpark id="sp-inf" values={bucketize((graph?.nodes ?? []).map((n) => renderDegrees.get(n.id) ?? 0))} color="var(--gold)" />
          <div className="st-foot"><span className="st-delta">{kpi.influencer ? nodeDisplayName(kpi.influencer) : '—'}</span><span className="st-note">پیوندها</span></div>
        </div>
      </section>

      {/* Filters */}
      <section className="net-filters">
        <input
          type="search"
          aria-label="Search network"
          placeholder="جستجوی سازمان، شخص یا پروژه…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { load(); log('جستجو اعمال شد'); } }}
        />
        <select aria-label="Relationship status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">همه وضعیت‌ها</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Focus node" value={focus} onChange={(e) => setFocus(e.target.value)}>
          <option value="">بدون Focus</option>
          {graph?.nodes.map((n) => (
            <option key={n.id} value={n.id}>{nodeDisplayName(n)}</option>
          ))}
        </select>
        <button className="net-btn primary" onClick={() => { load(); log('فیلترها اعمال شد'); }} disabled={loading}>
          Apply
        </button>
        <button className="net-btn" onClick={loadMore} disabled={loadingMore || !hasNext}>
          {loadingMore ? 'Loading…' : hasNext ? 'Load more' : 'همه بارگذاری شد'}
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
              <h2>Interactive Graph</h2>
              <div className="counts">
                <b>{renderCounts.nodes}</b> nodes rendered · <b>{renderCounts.edges}</b> edges rendered
                {orphanEdges > 0 ? <span style={{ color: 'var(--srip-danger)' }}> · {orphanEdges} orphan edges dropped</span> : null}
              </div>
            </div>
            <div className="net-graph-toolbar">
              <button className="net-btn" onClick={() => graphHandle.current?.fit()} disabled={!graph} title="Fit to view">⛶ Fit</button>
              <button className="net-btn" onClick={() => graphHandle.current?.reset()} disabled={!graph} title="Reset">Reset</button>
              <button className="net-btn" onClick={() => graphHandle.current?.zoomBy(1.35)} disabled={!graph} title="Zoom in" aria-label="Zoom in">+</button>
              <button className="net-btn" onClick={() => graphHandle.current?.zoomBy(0.74)} disabled={!graph} title="Zoom out" aria-label="Zoom out">−</button>
              <button className="net-btn" onClick={() => setShowLegend(!showLegend)} title="Toggle legend">Legend</button>
              {focus ? <button className="net-btn" onClick={clearFocus} title="Return to broader view">Clear focus</button> : null}
            </div>
          </div>

          {/* Path tool */}
          <div className="net-path-tool">
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--srip-text-2)' }}>Organization path</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Path from">
              <option value="">از</option>
              {orgNodes.map((n) => (
                <option key={n.id} value={n.id}>{nodeDisplayName(n)}</option>
              ))}
            </select>
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Path to">
              <option value="">تا</option>
              {orgNodes.map((n) => (
                <option key={n.id} value={n.id}>{nodeDisplayName(n)}</option>
              ))}
            </select>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} aria-label="Path mode">
              <option value="shortest">کوتاه‌ترین</option>
              <option value="best">بهترین</option>
            </select>
            <button className="net-btn primary" onClick={runPath} disabled={!from || !to}>Find path</button>
            {path ? <button className="net-btn" onClick={clearPath}>Clear path</button> : null}
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
            <NetworkGraph
              ref={graphHandle}
              graph={graph ?? { nodes: [], edges: [], meta: { organizationCount: 0, peopleCount: 0, projectCount: 0, relationshipCount: 0, personRelationshipCount: 0 }, page: { limit: PAGE_LIMIT, nextCursor: null, bounded: true as const } }}
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
          </div>
          <div className="net-hover-line">
            {hoverNode && !selectedNode
              ? <>Hovering: <b>{nodeDisplayName(hoverNode)}</b> ({hoverNode.type}) — برای جزئیات کلیک کنید</>
              : hoverEdge && !selectedEdgeId
                ? <>Hovering edge: <b>{hoverEdge}</b></>
                : 'نشانگر را روی یک گره ببرید و برای جزئیات کلیک کنید.'}
          </div>

          {/* Legend */}
          {showLegend && (
            <div className="net-legend">
              <div>
                <strong>Nodes</strong>{' '}
                {Object.entries(NODE_COLORS).map(([k, c]) => (
                  <span className="lg" key={k}>
                    <span className="sw" style={{ background: c, borderRadius: k === 'person' ? '50%' : 3 }} />
                    {k}
                  </span>
                ))}
                <span className="lg"><span className="sw" style={{ background: PATH_COLOR }} />Path / Focus</span>
              </div>
              <div>
                <strong>Edges</strong>{' '}
                {Object.entries(EDGE_COLORS).map(([k, c]) => (
                  <span className="lg" key={k}>
                    <span className="sw line" style={{ background: c }} />
                    {kindLabel(k as any)}
                    {EDGE_DASH[k as keyof typeof EDGE_DASH] ? ' (dashed)' : ''}
                  </span>
                ))}
                <span className="lg"><span className="sw line" style={{ background: RISK_COLOR }} />Risk ≥ {RISK_THRESHOLD}</span>
                <span className="lg"><span className="sw line" style={{ background: PATH_COLOR }} />Path edge</span>
              </div>
            </div>
          )}
        </div>

        {/* Right detail rail */}
        <aside className="net-detail" aria-label="Node / edge details">
          {selectedNode ? (
            <>
              <div className="net-detail-head">
                <div>
                  <h3>{nodeDisplayName(selectedNode)}</h3>
                  <div className="kind">{selectedNode.type} · {selectedNode.organizationId ? `org ${selectedNode.organizationId.slice(0, 8)}…` : 'سازمان آزاد'}</div>
                </div>
                <button className="net-btn" onClick={() => setSelectedNode(null)} title="Close">✕</button>
              </div>
              <div className="net-detail-tabs">
                {(['overview', 'relationships', 'insights'] as const).map((t) => (
                  <button key={t} className={railTab === t ? 'active' : ''} onClick={() => setRailTab(t)}>
                    {t === 'overview' ? 'Overview' : t === 'relationships' ? `Relationships (${railRelationships.length})` : 'Insights'}
                  </button>
                ))}
              </div>
              <div className="net-detail-body">
                {railTab === 'overview' && (
                  <>
                    <div className="net-kv">
                      <div className="kv"><small>ID</small><strong>{selectedNode.id}</strong></div>
                      <div className="kv"><small>Associated relationships</small><strong>{railNodeDegree}</strong></div>
                    </div>
                    <div className="net-detail-actions" style={{ padding: 0, border: 0 }}>
                      {(() => { const r = nodeEntityRoute(selectedNode); return r ? <DetailButton href={r.href} label={`Open ${selectedNode.type}`} /> : null; })()}
                      <button className="net-btn primary" onClick={() => expandNode(selectedNode)}>Expand neighbors</button>
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
                              title="Select edge in graph"
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
                  <div className="kind">Edge · سیاهه روابط</div>
                </div>
                <button className="net-btn" onClick={() => setSelectedEdgeId(null)} title="Close">✕</button>
              </div>
              <div className="net-detail-body">
                <div className="net-kv">
                  <div className="kv"><small>Weight</small><strong>{selectedEdge.weight}</strong></div>
                  <div className="kv"><small>Risk</small><strong style={{ color: selectedEdge.risk >= RISK_THRESHOLD ? 'var(--srip-danger)' : 'var(--srip-success)' }}>{selectedEdge.risk}</strong></div>
                  <div className="kv"><small>Strategic</small><strong>{selectedEdge.strategicImportance}</strong></div>
                  <div className="kv"><small>Kind</small><strong>{kindLabel(selectedEdge.kind)}</strong></div>
                </div>
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
                  <h3>Network Overview</h3>
                  <div className="kind">Derived from Backend data</div>
                </div>
              </div>
              <div className="net-detail-body">
                <div className="net-kv">
                  <div className="kv"><small>Graph Health</small><strong>{kpi.graphHealth}%</strong></div>
                  <div className="kv"><small>Risky edges</small><strong style={{ color: kpi.risk ? 'var(--srip-danger)' : 'var(--srip-success)' }}>{kpi.risk}</strong></div>
                  <div className="kv"><small>Strategic edges</small><strong>{kpi.opp}</strong></div>
                  <div className="kv"><small>Org relationships</small><strong>{kpi.relationshipCount}</strong></div>
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
              {showAnalysis ? 'بستن تحلیل کامل' : 'View Full Analysis'}
</button>
          </div>
        </aside>
          </div>

      {/* Full analysis sheet */}
      {showAnalysis && (
        <section className="card analysis-sheet">
          <div className="net-detail-tabs" style={{ padding: '0 0 8px', background: 'none' }}>
            <button className={analysisKind === 'centrality' ? 'active' : ''} onClick={() => runAnalysis('centrality')}>Centrality</button>
            <button className={analysisKind === 'connectors' ? 'active' : ''} onClick={loadConnectors}>Connectors</button>
            <button className={analysisKind === 'bridges' ? 'active' : ''} onClick={() => runAnalysis('bridges')}>Bridge people</button>
            <button className={analysisKind === 'bottlenecks' ? 'active' : ''} onClick={() => runAnalysis('bottlenecks')}>Bottlenecks</button>
            <button className={analysisKind === 'single-points-of-failure' ? 'active' : ''} onClick={() => runAnalysis('single-points-of-failure')}>Single points of failure</button>
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
          <div className="lc-head"><span className="lc-ico ic-red">🎯</span><h3>امروز در اولویت</h3><span className="lc-badge">{riskPriorities.length}</span></div>
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
                    <span className="meta">risk {e.risk}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty>در گراف بارگذاری‌شده رابطه پرریسکی یافت نشد.</Empty>
          )}
        </div>
        <div className="list-card">
          <div className="lc-head"><span className="lc-ico ic-purple">⚡</span><h3>توصیه‌های هوشمند</h3></div>
          <p className="panel-note">مشتق از اجرای واقعی تحلیل‌های شبکه (Centrality / Connectors / Bridges / Bottlenecks / SPOF).</p>
          {recommendations.length ? (
            <div className="item-list">
              {recommendations.map((r, i) => (
                <div className="item" key={i}>
                  <span>{r.text}</span>
                  <span className={`ui-badge ${r.tone}`}>{r.tone}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="net-empty" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              برای تولید توصیه‌های مبتنی بر داده، ابتدا یکی از تحلیل‌ها را اجرا کنید.
              <button className="net-btn primary" onClick={() => runAnalysis('centrality')}>اجرای Centrality</button>
            </div>
          )}
        </div>
        <div className="list-card">
          <div className="lc-head"><span className="lc-ico ic-blue">🕒</span><h3>فعالیت‌های این نشست</h3><span className="lc-badge">{activities.length}</span></div>
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
          همه مقادیر از Backend واقعی با Authorization سازمانی گرفته شده‌اند؛ هیچ داده نمایشی/جعلی اضافه نشده است.
        </div>
        </aside>
      </div>

      {/* Node details shown in right rail above; graph canvas reveals details onClick */}
    </main>
  );
}