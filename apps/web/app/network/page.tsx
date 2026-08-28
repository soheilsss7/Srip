'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { apiGet } from '../_lib/api';
import { DataTable, Empty, ErrorCard, Loading } from '../_components/page-ui';
import {
  GGraph,
  GNode,
  EDGE_COLORS,
  EDGE_DASH,
  NODE_COLORS,
  RISK_COLOR,
  RISK_THRESHOLD,
  kindLabel,
  nodeDisplayName,
} from './_nodes';
import type { NetworkGraphHandle } from './_graph';

// Browser-only graph (canvas + d3-zoom); safe for SWC/WASM build via lazy ssr:false.
const NetworkGraph = dynamic(() => import('./_graph'), { ssr: false, loading: () => <Loading /> });

const STATUSES = ['PROSPECTIVE', 'ACTIVE', 'AT_RISK', 'DORMANT', 'ARCHIVED'];
const PAGE_LIMIT = 500;

function renderAnalysis(kind: string, rows: any[]) {
  if (!rows.length) return <Empty>داده‌ای برای این تحلیل یافت نشد.</Empty>;
  const nodeName = (x: any) => x?.node?.name ?? x?.node?.displayName ?? x?.node?.label ?? (typeof x?.node === 'string' ? x.node : '—');
  const metric = (x: any) =>
    kind === 'centrality' ? ('degree' in x ? x.degree : x.degreeScore)
      : kind === 'bridges' ? ('bridgeScore' in x ? x.bridgeScore : '—')
        : kind === 'bottlenecks' ? ('bottleneckScore' in x ? x.bottleneckScore : '—')
          : ('fragmentationIncrease' in x ? x.fragmentationIncrease : '—');
  const cols = kind === 'bottlenecks'
    ? [{ key: 'node', label: 'گره' }, { key: 'score', label: 'Bottleneck' }, { key: 'risky', label: 'Risky' }]
    : kind === 'connectors'
      ? [{ key: 'node', label: 'گره' }, { key: 'score', label: 'Connector' }, { key: 'version', label: 'Version' }]
      : [{ key: 'node', label: 'گره' }, { key: 'score', label: 'امتیاز' }];
  const mapped = rows.map((x) => {
    if (kind === 'connectors') return { node: nodeName(x), score: Number(x.connectorScore).toFixed(2), version: x.scoreVersion ?? '—' };
    if (kind === 'bottlenecks') return { node: nodeName(x), score: Number(x.bottleneckScore).toFixed(2), risky: x.riskyConnections ?? '—' };
    return { node: nodeName(x), score: String(metric(x)) };
  });
  return <DataTable columns={cols} rows={mapped} />;
}

export default function Page() {
  const [connectors, setConnectors] = useState<any[]>([]);
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
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
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
      if (cursor && !append) params.set('cursor', cursor);
      const data = await apiGet<GGraph>(`/network/graph?${params.toString()}`);
      setGraph((prev) => {
        if (append && prev) {
          const seenNodes = new Set(prev.nodes.map((n) => n.id));
          const newNodes = data.nodes.filter((n) => !seenNodes.has(n.id));
          return { ...data, nodes: [...prev.nodes, ...newNodes], meta: data.meta, page: data.page };
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

  const runPath = async () => {
    if (!from || !to) return;
    setError('');
    try {
      setPath(await apiGet(`/network/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${mode}`));
    } catch (e: any) {
      setError(e?.message || 'Unable to calculate path');
    }
  };
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

  const orgNodes = graph ? graph.nodes.filter((n) => n.type === 'organization') : [];
  const selected = selectedNode ?? hoverNode;

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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                <div style={{ border: '1px solid #e5eaf2', borderRadius: 8, overflow: 'hidden', minHeight: 360 }}>
                  <NetworkGraph
                    ref={graphHandle}
                    graph={graph}
                    selectedNodeId={selected?.id ?? null}
                    dimOthers={Boolean(selectedNode)}
                    onNodeSelect={(n) => setSelectedNode(n ?? null)}
                    onNodeHover={(n) => setHoverNode(n ?? null)}
                    onEdgeSelect={(id) => setSelectedEdge(id)}
                    onEdgeHover={(label) => setHoverEdge(label)}
                    onRendered={onRendered}
                  />
                </div>
                {(selected || hoverEdge || selectedEdge) && (
                  <div style={{ marginTop: 10, padding: 10, background: '#f6f7f9', borderRadius: 6 }}>
                    {selected && (
                      <p>
                        <strong>Node:</strong> {nodeDisplayName(selected)} <small>({selected.type})</small> · id {selected.id}
                      </p>
                    )}
                    {(hoverEdge || selectedEdge) && (
                      <p>
                        <strong>Edge:</strong> {selectedEdge ? `selected ${selectedEdge}` : hoverEdge}
                      </p>
                    )}
                  </div>
                )}
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
                    </ul>
                  </div>
                </div>
                {hasNext && (
                  <button onClick={loadMore} disabled={loadingMore} style={{ marginTop: 10 }}>
                    {loadingMore ? 'Loading…' : 'Load more (next page of organizations)'}
                  </button>
                )}
              </section>

              <section className="card">
                <h2>Connection path (organization nodes — organization-level semantics)</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select value={from} onChange={(e) => setFrom(e.target.value)}>
                    <option value="">From</option>
                    {orgNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {nodeDisplayName(n)}
                      </option>
                    ))}
                  </select>
                  <select value={to} onChange={(e) => setTo(e.target.value)}>
                    <option value="">To</option>
                    {orgNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {nodeDisplayName(n)}
                      </option>
                    ))}
                  </select>
                  <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
                    <option value="shortest">Shortest</option>
                    <option value="best">Best</option>
                  </select>
                  <button onClick={runPath}>Find path</button>
                </div>
                {path && <p>{path.found ? `${path.hops} hops · cost ${path.totalCost ?? '—'}` : 'No visible path found'}</p>}
              </section>

              <section className="card">
                <h2>Network analysis</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => runAnalysis('centrality')}>Centrality</button>
                  <button onClick={loadConnectors}>Connectors</button>
                  <button onClick={() => runAnalysis('bridges')}>Bridge people</button>
                  <button onClick={() => runAnalysis('bottlenecks')}>Bottlenecks</button>
                  <button onClick={() => runAnalysis('single-points-of-failure')}>Single points of failure</button>
                </div>
                {analysis && (
                  <div className="table-wrap" style={{ marginTop: 12 }}>
                    {renderAnalysis(analysisKind || 'centrality', Array.isArray(analysis) ? analysis : analysis?.items ?? [])}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
