'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { apiGet } from '../_lib/api';
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
  edgeDisplayLabel,
} from './_nodes';
import type { NetworkGraphHandle } from './_graph';

// Browser-only graph (canvas + d3-zoom); safe for SWC/WASM build via lazy ssr:false.
const NetworkGraph = dynamic(() => import('./_graph'), { ssr: false, loading: () => <Loading /> });

const STATUSES = ['PROSPECTIVE', 'ACTIVE', 'AT_RISK', 'DORMANT', 'ARCHIVED'];
const PAGE_LIMIT = 500;

const PANEL_STYLE: CSSProperties = {
  position: 'fixed',
  insetInlineEnd: 0,
  top: 0,
  height: '100vh',
  width: 340,
  maxWidth: '92vw',
  background: '#fff',
  borderInlineStart: '1px solid #e5eaf2',
  boxShadow: '-12px 0 30px rgba(16,32,51,.12)',
  zIndex: 50,
  overflowY: 'auto',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(16,32,51,.28)',
  zIndex: 49,
};

function DetailButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid #315cf5',
        color: '#315cf5',
        background: '#fff',
        borderRadius: 10,
        padding: '9px 14px',
        fontWeight: 700,
        textDecoration: 'none',
        minHeight: 40,
      }}
    >
      {label}
    </Link>
  );
}

function NodeDetails({ node, onExpand, onClose }: { node: GNode; onExpand: () => void; onClose: () => void }) {
  const route = nodeEntityRoute(node);
  const fields: [string, string][] = [
    ['Type', node.type],
    ['ID', node.id],
    ['Display name', node.label],
    ...(node.organizationId ? ([['Organization ID', node.organizationId]] as [string, string][]) : []),
  ];
  return (
    <>
      <div style={OVERLAY_STYLE} onClick={onClose} aria-hidden />
      <aside className="net-panel" style={PANEL_STYLE} role="dialog" aria-label="Node details">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Node details</h2>
          <button onClick={onClose} aria-label="Close node details" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, minHeight: 40 }}>
            ✕
          </button>
        </div>
        <div>
          <p style={{ margin: '0 0 12px', color: '#6b7788' }}>{nodeDisplayName(node)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {route && <DetailButton href={route.href} label={`Open ${node.type}`} />}
            <button
              onClick={onExpand}
              style={{ border: '1px solid #315cf5', background: '#315cf5', color: '#fff', borderRadius: 10, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', minHeight: 40 }}
            >
              Expand neighbors (focus)
            </button>
          </div>
        </div>
        <div className="detail-grid" style={{ gridTemplateColumns: '1fr' }}>
          {fields.map(([k, v]) => (
            <div className="detail-item" key={k} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
              <small>{k}</small>
              <strong style={{ overflowWrap: 'anywhere' }}>{v}</strong>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

function EdgeDetails({ edge, onClose }: { edge: GEdge; onClose: () => void }) {
  const hasRisk = Number.isFinite(edge.risk);
  const hasWeight = Number.isFinite(edge.weight);
  const hasStrategic = Number.isFinite(edge.strategicImportance);
  const fields: [string, string][] = [
    ['Kind', kindLabel(edge.kind)],
    ...(edge.label ? ([['Relationship type', edge.label]] as [string, string][]) : []),
    ...(hasWeight ? ([['Weight', String(edge.weight)]] as [string, string][]) : []),
    ...(hasRisk ? ([['Risk', String(edge.risk)]] as [string, string][]) : []),
    ...(hasStrategic ? ([['Strategic importance', String(edge.strategicImportance)]] as [string, string][]) : []),
  ];
  return (
    <>
      <div style={OVERLAY_STYLE} onClick={onClose} aria-hidden />
      <aside className="net-panel" style={PANEL_STYLE} role="dialog" aria-label="Edge details">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Edge details</h2>
          <button onClick={onClose} aria-label="Close edge details" style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 20, minHeight: 40 }}>
            ✕
          </button>
        </div>
        <p style={{ margin: 0, color: '#6b7788' }}>{edgeDisplayLabel(edge)}</p>
        <div className="detail-grid" style={{ gridTemplateColumns: '1fr' }}>
          {fields.map(([k, v]) => (
            <div className="detail-item" key={k} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
              <small>{k}</small>
              <strong style={{ overflowWrap: 'anywhere' }}>{v}</strong>
            </div>
          ))}
        </div>
      </aside>
    </>
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
        style={{ border: 0, background: 'none', color: '#315cf5', cursor: 'pointer', padding: 0, fontWeight: 700, textAlign: 'right', minHeight: 'auto' }}
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
            const cells:  (string | ReactNode)[] =
              kind === 'connectors'
                ? [renderNode(x), Number(x.connectorScore).toFixed(2), x.scoreVersion ?? '—']
                : kind === 'bottlenecks'
                  ? [renderNode(x), Number(x.bottleneckScore).toFixed(2), x.riskyConnections ?? '—']
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

export default function Page() {
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
  const graphHandle = useRef<NetworkGraphHandle | null>(null);

  const load = useCallback(async (cursor?: string, append = false) => {
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
      const data = await apiGet<GGraph>(`/network/graph?${params.toString()}`);
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
      setError(e?.message || 'Unable to load network');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [q, type, status, focus]);

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

  const selected = selectedNode ?? hoverNode;

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
    setError('');
    try {
      setPath(await apiGet(`/network/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${mode}`));
    } catch (e: any) {
      setError(e?.message || 'Unable to calculate path');
    }
  };
  const clearPath = () => setPath(null);
  const loadConnectors = async () => {
    setError('');
    setAnalysisKind('connectors');
    try {
      setAnalysis(await apiGet('/network/connectors'));
    } catch (e: any) {
      setError(e?.message || 'Unable to load connectors');
    }
  };
  const runAnalysis = async (endpoint: string) => {
    setError('');
    setAnalysisKind(endpoint);
    try {
      setAnalysis(await apiGet(`/network/${endpoint}`));
    } catch (e: any) {
      setError(e?.message || 'Unable to load analysis');
    }
  };
  const onRendered = useCallback((counts: { nodes: number; edges: number }) => setRenderCounts(counts), []);
  const loadMore = async () => {
    if (!graph?.page.nextCursor) return;
    await load(graph.page.nextCursor, true);
  };

  // Neighbor expansion: reuse the backend focus capability and reload.
  const expandNode = (node: GNode) => {
    setSelectedNode(node);
    if (focus !== node.id) setFocus(node.id);
  };
  const clearFocus = () => {
    setFocus('');
    setSelectedNode(null);
  };

  // Analytics row click: highlight the node in the graph by selecting it.
  const selectAnalyticsNode = (id: string) => {
    const node = graph?.nodes.find((n) => n.id === id) ?? null;
    setSelectedNode(node);
  };

  const onNodeSelect = useCallback((n: GNode | null) => {
    setSelectedNode(n);
    if (n) setSelectedEdgeId(null);
  }, []);

  const orgNodes = graph ? graph.nodes.filter((n) => n.type === 'organization') : [];

  return (
    <main className="shell">
      <header className="topbar">
        <strong>SRIP</strong>
        <a href="/">Dashboard</a>
      </header>
      <section className="hero">
        <p className="eyebrow">SRIP Workspace</p>
        <h1>Network Intelligence</h1>
        <p>Interactive force-directed relationship graph · filters · paths · network-risk analysis.</p>
      </section>
      {loading ? (
        <Loading />
      ) : (
        <>
          <ErrorCard message={error} />
          <section className="card">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input aria-label="Search network" placeholder="Search organizations, people, projects" value={q} onChange={(e) => setQ(e.target.value)} />
              <select aria-label="Node type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="all">All</option>
                <option value="organization">Organizations</option>
                <option value="person">People</option>
                <option value="project">Projects</option>
              </select>
              <select aria-label="Relationship status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select aria-label="Focus node" value={focus} onChange={(e) => setFocus(e.target.value)}>
                <option value="">No focus</option>
                {graph?.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {nodeDisplayName(n)}
                  </option>
                ))}
              </select>
              <button onClick={() => load()} disabled={loading}>
                Apply
              </button>
              <button onClick={() => graphHandle.current?.fit()} disabled={!graph}>
                Fit to view
              </button>
              <button onClick={() => graphHandle.current?.reset()} disabled={!graph}>
                Reset
              </button>
            </div>
            {activeFilters.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <small style={{ color: '#667085' }}>Active filters:</small>
                {activeFilters.map((f) => (
                  <span
                    key={f.key}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eef4ff', color: '#315cf5', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}
                  >
                    {f.label}
                    <button
                      onClick={f.onClear}
                      aria-label={`Clear filter ${f.label}`}
                      style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 14, lineHeight: 1, minHeight: 'auto' }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          {graph && (
            <>
              <section className="card">
                <h2>Graph</h2>
                <p>
                  <strong>{renderCounts.nodes}</strong> nodes rendered · <strong>{renderCounts.edges}</strong> edges rendered
                  {orphanEdges > 0 ? <span style={{ color: RISK_COLOR }}> · {orphanEdges} orphan edges dropped</span> : null}
                </p>
                <p className="muted">
                  {graph.meta.organizationCount} organizations · {graph.meta.peopleCount} people · {graph.meta.projectCount} projects ·{' '}
                  {graph.meta.relationshipCount} org relationships · {graph.meta.personRelationshipCount} person relationships
                </p>
                {path?.found ? (
                  <p style={{ color: PATH_COLOR, fontWeight: 700 }}>
                    Organization path: {path.hops} hop{path.hops === 1 ? '' : 's'} · nodes highlighted. Non-path content dimmed.
                  </p>
                ) : path && !path.found ? (
                  <p style={{ color: '#b42318' }}>Organization path: no visible path found between the selected organizations.</p>
                ) : null}
                <div style={{ border: '1px solid #e5eaf2', borderRadius: 8, overflow: 'hidden', minHeight: 360 }}>
                  <NetworkGraph
                    ref={graphHandle}
                    graph={graph}
                    selectedNodeId={selected?.id ?? null}
                    selectedEdgeId={selectedEdgeId}
                    focusNodeId={focus || null}
                    pathNodeIds={path?.found ? pathNodeSet : null}
                    pathEdgeIds={path?.found ? pathEdgeSet : null}
                    analysisNodeIds={analysisNodeSet.size ? analysisNodeSet : null}
                    dimOthers={Boolean(selectedNode)}
                    onNodeSelect={onNodeSelect}
                    onNodeHover={(n) => setHoverNode(n ?? null)}
                    onEdgeSelect={(id) => setSelectedEdgeId(id)}
                    onEdgeHover={(label) => setHoverEdge(label)}
                    onRendered={onRendered}
                  />
                </div>
                {hoverNode && !selectedNode ? (
                  <p className="muted" style={{ marginTop: 10 }}>
                    Hovering: {nodeDisplayName(hoverNode)} ({hoverNode.type}) — click for details
                  </p>
                ) : null}
                {hoverEdge && !selectedEdgeId ? (
                  <p className="muted" style={{ marginTop: 10 }}>
                    Hovering edge: {hoverEdge} — click for details
                  </p>
                ) : null}
                <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <strong>Nodes</strong>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {Object.entries(NODE_COLORS).map(([k, c]) => (
                        <li key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 12, height: 12, background: c, display: 'inline-block', borderRadius: k === 'person' ? '50%' : 3 }} />
                          {k}
                        </li>
                      ))}
                      <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 12, height: 12, background: PATH_COLOR, display: 'inline-block' }} />
                        Path / focus
                      </li>
                    </ul>
                  </div>
                  <div>
                    <strong>Edges</strong>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {Object.entries(EDGE_COLORS).map(([k, c]) => (
                        <li key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 18, height: 3, background: c, display: 'inline-block' }} />
                          {kindLabel(k as any)}
                          {EDGE_DASH[k as keyof typeof EDGE_DASH] ? ' (dashed)' : ''}
                        </li>
                      ))}
                      <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 18, height: 3, background: RISK_COLOR, display: 'inline-block' }} />
                        Risk ≥ {RISK_THRESHOLD} (red)
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 18, height: 3, background: PATH_COLOR, display: 'inline-block' }} />
                        Path edge
                      </li>
                    </ul>
                  </div>
                </div>
                {focus ? (
                  <button onClick={clearFocus} style={{ marginTop: 10 }}>
                    Clear focus (return to broader view)
                  </button>
                ) : null}
                {hasNext && (
                  <button onClick={loadMore} disabled={loadingMore} style={{ marginTop: 10 }}>
                    {loadingMore ? 'Loading…' : 'Load more (next page of organizations)'}
                  </button>
                )}
              </section>

              <section className="card">
                <h2>Organization path</h2>
                <p className="muted">Organization-to-organization pathfinding (organization-level semantics).</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Path from">
                    <option value="">From</option>
                    {orgNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {nodeDisplayName(n)}
                      </option>
                    ))}
                  </select>
                  <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Path to">
                    <option value="">To</option>
                    {orgNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {nodeDisplayName(n)}
                      </option>
                    ))}
                  </select>
                  <select value={mode} onChange={(e) => setMode(e.target.value as any)} aria-label="Path mode">
                    <option value="shortest">Shortest</option>
                    <option value="best">Best</option>
                  </select>
                  <button onClick={runPath}>Find path</button>
                  {path ? (
                    <button onClick={clearPath}>Clear path</button>
                  ) : null}
                </div>
                {path && <p className="muted" style={{ marginTop: 8 }}>{path.found ? `${path.hops} hops · cost ${path.totalCost ?? '—'}` : 'No visible path found'}</p>}
              </section>

              <section className="card">
                <h2>Network analysis</h2>
                <p className="muted">Click a highlighted result to select and highlight that node in the graph.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => runAnalysis('centrality')}>Centrality</button>
                  <button onClick={loadConnectors}>Connectors</button>
                  <button onClick={() => runAnalysis('bridges')}>Bridge people</button>
                  <button onClick={() => runAnalysis('bottlenecks')}>Bottlenecks</button>
                  <button onClick={() => runAnalysis('single-points-of-failure')}>Single points of failure</button>
                </div>
                {analysis ? (
                  <div className="table-wrap" style={{ marginTop: 12 }}>
                    {renderAnalysis(analysisKind || 'centrality', analysisList, selectAnalyticsNode, analysisNodeSet)}
                  </div>
                ) : null}
              </section>
            </>
          )}
        </>
      )}

      {/* Node details side panel */}
      {selectedNode ? (
        <NodeDetails node={selectedNode} onExpand={() => expandNode(selectedNode)} onClose={() => setSelectedNode(null)} />
      ) : null}

      {/* Edge details side panel */}
      {selectedEdge ? (
        <EdgeDetails edge={selectedEdge} onClose={() => setSelectedEdgeId(null)} />
      ) : null}
    </main>
  );
}
