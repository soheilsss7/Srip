'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  CircleUserRound,
  Crosshair,
  Expand,
  Filter,
  Heart,
  Info,
  Lightbulb,
  LockKeyhole,
  Minus,
  Plus,
  Scan,
  Search,
  Shield,
  Sparkles,
  Star,
  Target,
  Users,
} from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { EntityPicker } from '../_components/entity-picker';
import { QuickCreate } from '../_components/quick-create';
import { nodeEntityRoute } from './_nodes';
import type { GEdge, GGraph, GNode } from './_nodes';
import './reference-network.css';

type Accent = 'teal' | 'blue' | 'purple' | 'red' | 'gold';
type NodeKind = 'company' | 'person' | 'project';

type GraphNode = {
  id: string;
  label: string;
  sublabel: string;
  kind: NodeKind;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  anchor?: 'start' | 'middle' | 'end';
  sourceNode?: GNode;
};

type GraphEdge = {
  id: string;
  sourceId?: string;
  targetId?: string;
  d: string;
  color: string;
  dash?: string;
  width?: number;
  opacity?: number;
};

const EMPTY_GRAPH: GGraph = {
  nodes: [],
  edges: [],
  meta: { organizationCount: 0, peopleCount: 0, projectCount: 0, relationshipCount: 0, personRelationshipCount: 0 },
  page: { limit: 500, nextCursor: null, bounded: true },
};

const NODE_POSITION_TEMPLATE = [
  { x: 413, y: 224, labelX: 413, labelY: 274, anchor: 'middle' as const },
  { x: 382, y: 43, labelX: 418, labelY: 39, anchor: 'start' as const },
  { x: 174, y: 166, labelX: 139, labelY: 211, anchor: 'end' as const },
  { x: 716, y: 242, labelX: 750, labelY: 236, anchor: 'start' as const },
  { x: 596, y: 82, labelX: 632, labelY: 75, anchor: 'start' as const },
  { x: 233, y: 378, labelX: 233, labelY: 425, anchor: 'middle' as const },
  { x: 425, y: 423, labelX: 425, labelY: 469, anchor: 'middle' as const },
  { x: 614, y: 422, labelX: 650, labelY: 425, anchor: 'start' as const },
];

function liveNodeKind(node: GNode): NodeKind {
  return node.type === 'person' ? 'person' : node.type === 'project' ? 'project' : 'company';
}

function liveEdgeColor(edge: GEdge): string {
  if (Number.isFinite(edge.risk) && edge.risk >= 60) return '#ef4d5c';
  if (edge.kind === 'membership' || edge.kind === 'person_relationship') return '#25cfc3';
  if (edge.kind === 'project') return '#2d9fe5';
  return '#7869ee';
}

function curvedEdgePath(a: GraphNode, b: GraphNode, index: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const bend = (index % 2 === 0 ? 1 : -1) * Math.min(90, Math.max(22, length * 0.16));
  const mx = (a.x + b.x) / 2 - (dy / length) * bend;
  const my = (a.y + b.y) / 2 + (dx / length) * bend;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

function makeGraphView(graph: GGraph): { nodes: GraphNode[]; edges: GraphEdge[]; live: boolean } {
  // An empty authorized graph is a valid product state. Never replace it with
  if (!graph.nodes.length) return { nodes: [], edges: [], live: true };
  const ordered = [...graph.nodes].sort((a, b) => (a.type === 'organization' ? -1 : 1) - (b.type === 'organization' ? -1 : 1)).slice(0, NODE_POSITION_TEMPLATE.length);
  const nodes = ordered.map((node, index) => {
    const position = NODE_POSITION_TEMPLATE[index];
    const center = index === 0;
    return {
      id: node.id,
      label: node.label || 'Unnamed node',
      sublabel: node.type.replace('_', ' '),
      kind: liveNodeKind(node),
      x: position.x,
      y: position.y,
      labelX: center ? position.labelX : position.x + (position.x < 430 ? -34 : 34),
      labelY: center ? position.labelY : position.y + (position.y > 360 ? 46 : -6),
      anchor: center || position.y > 360 ? 'middle' : position.x < 430 ? 'end' : 'start',
      sourceNode: node,
    } satisfies GraphNode;
  });
  const positions = new Map(nodes.map((node) => [node.id, node]));
  const edges = graph.edges
    .filter((edge) => positions.has(edge.source) && positions.has(edge.target))
    .slice(0, 30)
    .map((edge, index) => ({
      id: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      d: curvedEdgePath(positions.get(edge.source)!, positions.get(edge.target)!, index),
      color: liveEdgeColor(edge),
      dash: edge.kind === 'membership' ? '8 6' : undefined,
      width: Math.min(3.4, Math.max(1.2, Number(edge.weight || 1) / 20)),
      opacity: edge.risk >= 60 ? 0.95 : 0.82,
    }));
  return { nodes, edges, live: true };
}

function IconBox({ children, accent }: { children: React.ReactNode; accent: Accent }) {
  return <span className={`reference-icon-box ${accent}`}>{children}</span>;
}

function StatCard({ accent, icon, title, value, delta, detail, down = false }: { accent: Accent; icon: React.ReactNode; title: string; value: string; delta: string; detail: string; down?: boolean }) {
  return (
    <article className="reference-stat-card">
      <div className="reference-stat-top">
        <IconBox accent={accent}>{icon}</IconBox>
        <span className="reference-stat-title">{title}</span>
      </div>
      <div className="reference-stat-value-row">
        <strong>{value}</strong>
        <span className={`reference-stat-delta ${down ? 'down' : ''}`}>{delta}</span>
      </div>
      <span className="reference-stat-period">Authorized scope</span>
      <span className="reference-stat-detail">{detail}</span>
    </article>
  );
}

function NodeGlyph({ kind, color, selected = false }: { kind: NodeKind; color: string; selected?: boolean }) {
  if (kind === 'person') {
    return <><circle r="25" fill="#071a2a" stroke={color} strokeWidth="1.5" /><circle cy="-7" r="6" fill={color} /><path d="M -11 11 C -10 2, 10 2, 11 11 Z" fill={color} /></>;
  }
  if (kind === 'project') {
    return <><path d="M 0 -25 L 25 0 L 0 25 L -25 0 Z" fill="#071525" stroke={color} strokeWidth="1.5" /><path d="M -7 -5 L 0 -12 L 9 -3 L 3 3 L 8 8 L 0 15 L -8 7 L -3 2 Z" fill={color} opacity=".95" /></>;
  }
  return <><circle r={selected ? 39 : 25} fill="#07152a" stroke={color} strokeWidth={selected ? 2 : 1.5} /><rect x="-8" y="-11" width="16" height="21" rx="1.5" fill={color} /><path d="M -5 -7 H -2 M 2 -7 H 5 M -5 -2 H -2 M 2 -2 H 5 M -5 3 H -2 M 2 3 H 5 M -2 10 V 4 H 2 V 10" stroke="#0a1930" strokeWidth="1.5" fill="none" /></>;
}

function ReferenceNetworkGraph({
  nodes,
  edges,
  selectedId,
  loading,
  onSelect,
  highlightedNodeIds,
  highlightedEdgeIds,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string;
  loading: boolean;
  onSelect: (node: GraphNode) => void;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
}) {
  const [zoom, setZoom] = useState(1);
  const [locked, setLocked] = useState(false);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const hasHighlight = highlightedNodeIds.size > 0 || highlightedEdgeIds.size > 0;
  const fit = () => setZoom(1);
  const minimapNodes = nodes.map((node) => ({ ...node, miniX: 10 + (node.x / 880) * 120, miniY: 8 + (node.y / 510) * 84 }));
  const minimapPositions = new Map(minimapNodes.map((node) => [node.id, node]));

  const enterFullscreen = () => {
    const element = graphRef.current;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element.requestFullscreen?.();
  };

  return (
    <div className="reference-graph-canvas" ref={graphRef}>
      <svg
        className="reference-graph-svg"
        viewBox="0 0 880 510"
        role="img"
        aria-label="Relationship network graph"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform .2s ease' }}
      >
        <defs>
          <filter id="ref-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="ref-soft-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <radialGradient id="ref-bg-glow" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#071636" stopOpacity=".75" /><stop offset="100%" stopColor="#020713" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="880" height="510" fill="url(#ref-bg-glow)" />
        <g className="reference-edges">
          {edges.map((edge) => {
            const highlighted = highlightedEdgeIds.has(edge.id) || (edge.sourceId ? highlightedNodeIds.has(edge.sourceId) : false) || (edge.targetId ? highlightedNodeIds.has(edge.targetId) : false);
            return <path key={edge.id} d={edge.d} fill="none" stroke={edge.color} strokeWidth={highlighted ? (edge.width ?? 1.5) + 1 : edge.width ?? 1.5} strokeDasharray={edge.dash} opacity={hasHighlight && !highlighted ? .12 : edge.opacity ?? .9} strokeLinecap="round" />;
          })}
        </g>
        {nodes.map((node) => {
          const color = node.kind === 'person' ? '#25d0c5' : node.kind === 'project' ? '#27c4dc' : node.id === 'global' ? '#f1b23d' : node.id === 'tech' || node.id === 'innovation' ? '#9d6cff' : '#5c76ff';
          const selected = node.id === selectedId;
          const dimmed = hasHighlight && !highlightedNodeIds.has(node.id) && !selected;
          return (
            <g
              key={node.id}
              className={`reference-node ${selected ? 'selected' : ''}`}
              transform={`translate(${node.x} ${node.y})`}
              onClick={() => { if (!locked) onSelect(node); }}
              onKeyDown={(event) => { if (!locked && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(node); } }}
              role="button"
              tabIndex={0}
              aria-label={`Select ${node.label}`}
              style={{ cursor: locked ? 'not-allowed' : 'pointer', opacity: dimmed ? .28 : 1 }}
            >
              {selected && <circle r="48" fill="none" stroke="#4c70ff" strokeWidth="1" opacity=".38" filter="url(#ref-glow)" />}
              <NodeGlyph kind={node.kind} color={color} selected={selected} />
              <text x={node.labelX - node.x} y={node.labelY - node.y} textAnchor={node.anchor ?? 'start'} className="reference-node-label">{node.label}</text>
              <text x={node.labelX - node.x} y={node.labelY - node.y + 16} textAnchor={node.anchor ?? 'start'} className="reference-node-sublabel">{node.sublabel}</text>
            </g>
          );
        })}
      </svg>

      {loading ? <div className="reference-graph-empty" role="status">Loading authorized network data…</div> : !nodes.length && <div className="reference-graph-empty" role="status">No authorized network data is available in this scope.</div>}
      <div className="reference-graph-tools" aria-label="Graph controls">
        <button onClick={() => setZoom((value) => Math.min(1.45, Number((value + .15).toFixed(2))))} aria-label="Zoom in" title="Zoom in"><Plus size={20} /></button>
        <button onClick={() => setZoom((value) => Math.max(.72, Number((value - .15).toFixed(2))))} aria-label="Zoom out" title="Zoom out"><Minus size={20} /></button>
        <button onClick={fit} aria-label="Fit graph" title="Fit graph"><Scan size={18} /></button>
        <button onClick={fit} aria-label="Center graph" title="Center graph"><Crosshair size={18} /></button>
        <button onClick={() => setLocked((value) => !value)} aria-label={locked ? 'Unlock graph' : 'Lock graph'} title={locked ? 'Unlock graph' : 'Lock graph'}><LockKeyhole size={17} /></button>
      </div>

      <div className="reference-legend">
        <strong>Relationship Strength</strong>
        <span><i className="legend-line very-strong" />Very Strong</span>
        <span><i className="legend-line strong" />Strong</span>
        <span><i className="legend-line moderate" />Moderate</span>
        <span><i className="legend-line weak" />Weak</span>
        <span><i className="legend-line risk" />Risk</span>
      </div>

      <button className="reference-fullscreen" onClick={enterFullscreen} aria-label="Expand graph" title="Expand graph"><Expand size={16} /></button>
      {nodes.length > 0 && <div className="reference-minimap" aria-label="Minimap of loaded network">
        <svg viewBox="0 0 140 100" role="img" aria-label="Loaded network minimap">
          {edges.map((edge) => { const source = minimapPositions.get(edge.sourceId ?? ''); const target = minimapPositions.get(edge.targetId ?? ''); return source && target ? <line key={edge.id} x1={source.miniX} y1={source.miniY} x2={target.miniX} y2={target.miniY} stroke={edge.color} strokeWidth=".7" opacity=".65" strokeDasharray={edge.dash} /> : null; })}
          {minimapNodes.map((node) => { const color = node.kind === 'person' ? '#25d0c5' : node.kind === 'project' ? '#27c4dc' : node.id === 'global' ? '#f1b23d' : node.id === 'tech' || node.id === 'innovation' ? '#9d6cff' : '#5c76ff'; return <circle key={node.id} cx={node.miniX} cy={node.miniY} r={node.id === selectedId ? 7 : 4} fill={color} opacity={node.id === selectedId ? .95 : .8} />; })}
        </svg>
      </div>}
    </div>
  );
}
function RailKpi({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="reference-rail-kpi"><span>{label}</span><strong className={danger ? 'danger' : ''}>{value}</strong></div>;
}

export default function NetworkPage() {
  const { scopeId, can } = useWorkspace();
  const canNetworkRead = can('network.read');
  const canRelationshipRead = can('relationship.read');
  const canRelationshipWrite = can('relationship.write');
  const [activeTab, setActiveTab] = useState('All');
  const [filterOpen, setFilterOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [status, setStatus] = useState('');
  const [pathMode, setPathMode] = useState<'shortest' | 'best'>('shortest');
  const [pathSelection, setPathSelection] = useState<string[]>([]);
  const [pathResult, setPathResult] = useState<any>(null);
  const [pathBusy, setPathBusy] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [railTab, setRailTab] = useState<'overview' | 'relationships' | 'insights'>('overview');
  const [liveGraph, setLiveGraph] = useState<GGraph>(EMPTY_GRAPH);
  // The graph is always rendered from the authorized API response. This flag
  // only denotes that the response has been received; it is not a demo mode.
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisKind, setAnalysisKind] = useState('centrality');
  const [analysisRows, setAnalysisRows] = useState<any[]>([]);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [personRows, setPersonRows] = useState<any[]>([]);
  const [personBusy, setPersonBusy] = useState(false);
  const [personManagerOpen, setPersonManagerOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [personForm, setPersonForm] = useState({ sourcePersonId: '', sourcePersonName: '', targetPersonId: '', targetPersonName: '', relationshipType: 'COLLEAGUE', status: 'ACTIVE', strategicScore: '', riskScore: '' });

  const graphView = useMemo(() => makeGraphView(liveGraph), [liveGraph]);
  const selectedViewNode = graphView.nodes.find((node) => node.id === selectedNodeId) ?? graphView.nodes[0];
  const selectedLiveNode = liveGraph.nodes.find((node) => node.id === selectedNodeId) ?? selectedViewNode?.sourceNode;
  const selectedLabel = selectedLiveNode?.label || selectedViewNode?.label || 'Select a network node';
  const selectedKind = selectedLiveNode?.type || (selectedViewNode?.kind === 'person' ? 'person' : selectedViewNode?.kind === 'project' ? 'project' : 'organization');
  const pathNodeSet = useMemo<Set<string>>(() => new Set<string>(pathResult?.found ? (pathResult.nodes ?? []).map((node: GNode) => node.id) : pathSelection), [pathResult, pathSelection]);
  const pathEdgeSet = useMemo<Set<string>>(() => new Set<string>(pathResult?.found ? (pathResult.edges ?? []).map((edge: GEdge) => edge.id) : []), [pathResult]);
  const selectedRelationships = useMemo(() => liveGraph.edges.filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId), [liveGraph.edges, selectedNodeId]);

  const stats = useMemo(() => {
    const edges = liveGraph.edges ?? [];
    const risky = edges.filter((edge) => Number(edge.risk) >= 60).length;
    const opportunities = edges.filter((edge) => Number(edge.strategicImportance) >= 60).length;
    const degree = new Map<string, number>();
    edges.forEach((edge) => { degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1); degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1); });
    const people = liveGraph.nodes.filter((node) => node.type === 'person');
    const influence = Math.max(0, ...people.map((node) => degree.get(node.id) ?? 0));
    return { health: edges.length ? Math.round(((edges.length - risky) / edges.length) * 100) : 0, relationships: liveGraph.meta.relationshipCount ?? edges.length, opportunities, risk: risky, influence };
  }, [liveGraph]);

  const loadGraph = useCallback(async () => {
    if (!canNetworkRead) {
      setLiveGraph(EMPTY_GRAPH);
      setIsLive(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: '500' });
    const typeByTab: Record<string, string> = { Organizations: 'organization', People: 'person', Projects: 'project' };
    if (typeByTab[activeTab]) params.set('type', typeByTab[activeTab]);
    if (appliedQuery) params.set('q', appliedQuery);
    if (status) params.set('status', status);
    if (scopeId !== 'all') params.set('organizationId', scopeId);
    try {
      const data = await apiGet<GGraph>(`/network/graph?${params.toString()}`);
      if (data?.meta && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        setLiveGraph(data);
        setIsLive(true);
        setSelectedNodeId((current) => data.nodes.some((node) => node.id === current) ? current : data.nodes.find((node) => node.type === 'organization')?.id ?? data.nodes[0]?.id ?? current);
      }
    } catch (requestError: any) {
      setIsLive(false);
      setError(requestError?.message || 'Unable to load the network graph');
    } finally {
      setLoading(false);
    }
  }, [activeTab, appliedQuery, canNetworkRead, scopeId, status]);

  useEffect(() => { void loadGraph(); }, [loadGraph]);

  async function runPath(from: string, to: string, mode = pathMode) {
    if (!canNetworkRead || !from || !to || from === to) return;
    setPathBusy(true);
    setError('');
    const params = new URLSearchParams({ from, to, mode });
    if (scopeId !== 'all') params.set('organizationId', scopeId);
    try {
      setPathResult(await apiGet(`/network/path?${params.toString()}`));
    } catch (requestError: any) {
      setError(requestError?.message || 'Unable to calculate the path');
    } finally {
      setPathBusy(false);
    }
  }

  function selectGraphNode(node: GraphNode) {
    setSelectedNodeId(node.id);
    setRailTab('overview');
    const isOrganization = node.sourceNode?.type === 'organization';
    if (!isOrganization) return;
    const next = pathSelection.length >= 2 ? [node.id] : pathSelection.includes(node.id) ? pathSelection : [...pathSelection, node.id];
    setPathSelection(next);
    if (next.length === 2) void runPath(next[0], next[1]);
  }

  async function runAnalysis(kind: string) {
    if (!canNetworkRead) return;
    setAnalysisKind(kind);
    setAnalysisOpen(true);
    setAnalysisBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (scopeId !== 'all') params.set('organizationId', scopeId);
      const result = await apiGet<any>(`/network/${kind}?${params.toString()}`);
      setAnalysisRows(Array.isArray(result) ? result : result?.items ?? result?.data ?? []);
    } catch (requestError: any) {
      setError(requestError?.message || `Unable to load ${kind}`);
      setAnalysisRows([]);
    } finally {
      setAnalysisBusy(false);
    }
  }

  async function loadPersonRelationships() {
    if (!canNetworkRead || !canRelationshipRead) return;
    setPersonBusy(true);
    try {
      const result = await apiGet<any>(`/network/person-relationships?limit=100${scopeId !== 'all' ? `&organizationId=${encodeURIComponent(scopeId)}` : ''}`);
      setPersonRows(Array.isArray(result) ? result : result?.data ?? result?.items ?? []);
      setPersonManagerOpen(true);
    } catch (requestError: any) {
      setError(requestError?.message || 'Unable to load person relationships');
    } finally {
      setPersonBusy(false);
    }
  }

  function editPersonRelationship(row: any) {
    setEditingPersonId(row.id);
    setPersonForm({ sourcePersonId: row.sourcePersonId ?? '', sourcePersonName: row.sourcePerson?.displayName ?? [row.sourcePerson?.firstName, row.sourcePerson?.lastName].filter(Boolean).join(' '), targetPersonId: row.targetPersonId ?? '', targetPersonName: row.targetPerson?.displayName ?? [row.targetPerson?.firstName, row.targetPerson?.lastName].filter(Boolean).join(' '), relationshipType: row.relationshipType ?? 'COLLEAGUE', status: row.status ?? 'ACTIVE', strategicScore: row.strategicScore == null ? '' : String(row.strategicScore), riskScore: row.riskScore == null ? '' : String(row.riskScore) });
    setPersonManagerOpen(true);
  }

  async function savePersonRelationship(event: React.FormEvent) {
    event.preventDefault();
    if (!canRelationshipWrite) return;
    setPersonBusy(true);
    try {
      const payload: Record<string, unknown> = { relationshipType: personForm.relationshipType.trim(), status: personForm.status };
      if (!editingPersonId) { payload.sourcePersonId = personForm.sourcePersonId.trim(); payload.targetPersonId = personForm.targetPersonId.trim(); }
      if (personForm.strategicScore) payload.strategicScore = Number(personForm.strategicScore);
      if (personForm.riskScore) payload.riskScore = Number(personForm.riskScore);
      if (editingPersonId) await apiPatch(`/network/person-relationships/${encodeURIComponent(editingPersonId)}`, payload);
      else await apiPost('/network/person-relationships', payload);
      setEditingPersonId(null);
      setPersonForm({ sourcePersonId: '', sourcePersonName: '', targetPersonId: '', targetPersonName: '', relationshipType: 'COLLEAGUE', status: 'ACTIVE', strategicScore: '', riskScore: '' });
      await loadPersonRelationships();
      await loadGraph();
    } catch (requestError: any) {
      setError(requestError?.message || 'Unable to save the person relationship');
    } finally {
      setPersonBusy(false);
    }
  }

  async function archivePersonRelationship(id: string) {
    if (!canRelationshipWrite) return;
    if (!window.confirm('Archive this person relationship?')) return;
    setPersonBusy(true);
    try {
      await apiDelete(`/network/person-relationships/${encodeURIComponent(id)}`);
      await loadPersonRelationships();
      await loadGraph();
    } catch (requestError: any) {
      setError(requestError?.message || 'Unable to archive the person relationship');
    } finally {
      setPersonBusy(false);
    }
  }

  const selectedSummary = selectedLiveNode
    ? `${selectedKind.charAt(0).toUpperCase()}${selectedKind.slice(1)} · ${selectedRelationships.length} visible connections`
    : 'No node selected in the current authorization scope';
  const selectedRoute = selectedLiveNode ? nodeEntityRoute(selectedLiveNode) : null;
  const selectedProperties = [{ label: 'Type', value: selectedLiveNode ? selectedKind : '—' }, { label: 'Record', value: selectedLiveNode ? selectedLabel : '—' }, { label: 'Connections', value: String(selectedRelationships.length) }, { label: 'Visibility', value: scopeId === 'all' ? 'Global scope' : 'Scoped' }];
  const personName = (row: any, side: 'sourcePerson' | 'targetPerson') => {
    const person = row?.[side];
    return person?.displayName || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || 'شخص بدون نام';
  };
  const selectedContext = selectedLiveNode ? {
    organizationId: selectedLiveNode.type === 'organization' ? selectedLiveNode.id.replace(/^org:/, '') : selectedLiveNode.organizationId,
    personId: selectedLiveNode.type === 'person' ? selectedLiveNode.id.replace(/^person:/, '') : undefined,
  } : undefined;

  if (!canNetworkRead) return <main className="feature-page"><section className="panel"><p className="empty-state">مجوز مشاهده شبکه برای شما فعال نیست.</p></section></main>;

  return (
    <main className="network-reference-page">
      {error && <div className="reference-error" role="alert"><span>{error}</span><button onClick={() => void loadGraph()}>Retry</button></div>}
      <section className="reference-stats" aria-label="Network metrics">
        <StatCard accent="teal" icon={<Heart size={22} />} title="NETWORK HEALTH" value={`${stats.health}%`} delta="Current scope" detail={stats.risk ? 'Needs review' : 'No active risk'} />
        <StatCard accent="blue" icon={<Users size={22} />} title="TOTAL RELATIONSHIPS" value={String(stats.relationships)} delta={`${liveGraph.meta.personRelationshipCount ?? 0} person`} detail="Authorized connections" />
        <StatCard accent="purple" icon={<Target size={22} />} title="OPPORTUNITIES" value={String(stats.opportunities)} delta="Score ≥ 60" detail="High-value connections" />
        <StatCard accent="red" icon={<Shield size={22} />} title="NETWORK RISK" value={String(stats.risk)} delta="Risk ≥ 60" detail="Edges requiring review" down />
        <StatCard accent="gold" icon={<Star size={22} />} title="MAX PERSON DEGREE" value={String(stats.influence)} delta="Visible degree" detail="Highest connected person" />
      </section>

      <section className="reference-layout">
        <div className="reference-main-column">
          <section className="relationship-network-card">
            <header className="reference-card-header">
              <div>
                <h1>Relationship Network</h1>
                <p>Explore connections, identify opportunities and mitigate risks</p>
              </div>
              <div className="reference-tabs" role="tablist" aria-label="Network filters">
                {['All', 'Organizations', 'People', 'Projects'].map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
                <button className={`reference-filter-button ${filterOpen ? 'active' : ''}`} onClick={() => setFilterOpen((open) => !open)}><Filter size={15} /> Filters</button>
              </div>
            </header>
            {filterOpen && <div className="reference-filter-popover"><label><Search size={14} /><input value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setAppliedQuery(queryDraft); setFilterOpen(false); } }} placeholder="Search network" autoFocus /></label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="AT_RISK">At risk</option><option value="DORMANT">Dormant</option></select><span>Type: {activeTab}</span><button onClick={() => { setAppliedQuery(queryDraft); setFilterOpen(false); }}>Apply filters</button></div>}
            <ReferenceNetworkGraph nodes={graphView.nodes} edges={graphView.edges} selectedId={selectedNodeId} loading={loading} onSelect={selectGraphNode} highlightedNodeIds={pathNodeSet} highlightedEdgeIds={pathEdgeSet} />
            <footer className="reference-path-footer">
              <button className={`path-button ${pathMode === 'shortest' ? 'active' : ''}`} onClick={() => { setPathMode('shortest'); if (pathSelection.length === 2) void runPath(pathSelection[0], pathSelection[1], 'shortest'); }}><Sparkles size={15} /> Shortest Path</button>
              <button className={`path-button ${pathMode === 'best' ? 'active' : ''}`} onClick={() => { setPathMode('best'); if (pathSelection.length === 2) void runPath(pathSelection[0], pathSelection[1], 'best'); }}><Star size={15} /> Best Path</button>
              <span className="path-hint"><Info size={14} /> {pathBusy ? 'Calculating path…' : pathResult ? (pathResult.found ? `${pathResult.hops} hops · ${pathResult.totalCost ?? 'optimal path'}` : 'No path found') : pathSelection.length === 1 ? 'Select one more organization' : 'Select two nodes to find the optimal path'}</span>
              {pathSelection.length > 0 && <button className="path-clear" onClick={() => { setPathSelection([]); setPathResult(null); }}>Clear</button>}
            </footer>
          </section>

          <section className="reference-bottom-grid">
            <article className="reference-bottom-card">
              <header><h2>Scope summary</h2><button onClick={() => void loadGraph()}>Refresh</button></header>
              <div className="priority-items">
                <div className="priority-item"><IconBox accent="blue"><Building2 size={18} /></IconBox><span><b>{liveGraph.meta.organizationCount}</b><small>organizations<br />in scope</small></span></div>
                <div className="priority-item"><IconBox accent="teal"><Users size={18} /></IconBox><span><b>{liveGraph.meta.peopleCount}</b><small>people<br />in scope</small></span></div>
                <div className="priority-item"><IconBox accent="purple"><Target size={18} /></IconBox><span><b>{liveGraph.meta.projectCount}</b><small>projects<br />in scope</small></span></div>
              </div>
            </article>
            <article className="reference-bottom-card recommendations-card">
              <header><h2>Network analysis</h2><button onClick={() => void runAnalysis('centrality')}>Open</button></header>
              <div className="recommendation-items">
                <button onClick={() => void runAnalysis('centrality')}><IconBox accent="blue"><Lightbulb size={17} /></IconBox><span>Calculate<br />centrality</span><ChevronRight size={15} /></button>
                <button onClick={() => void runAnalysis('connectors')}><IconBox accent="purple"><CircleUserRound size={17} /></IconBox><span>Find authorized<br />connectors</span><ChevronRight size={15} /></button>
                <button onClick={() => void runAnalysis('bottlenecks')}><IconBox accent="gold"><AlertTriangle size={17} /></IconBox><span>Review network<br />bottlenecks</span><ChevronRight size={15} /></button>
              </div>
            </article>
          </section>
        </div>

        <aside className="reference-detail-rail">
          <article className="holding-detail-card">
            <header className="holding-head">
              <div className="holding-identity"><span className="holding-logo"><Building2 size={27} /></span><span><h2>{selectedLabel}</h2><p>{selectedSummary}</p></span></div>
              <span className="active-pill">{selectedLiveNode ? (scopeId === 'all' ? 'In scope' : 'Scoped') : 'No selection'}</span>
            </header>
            <div className="toolbar reference-rail-actions">
              {selectedRoute && <Link className="secondary-reference-button" href={selectedRoute.href}>Open record</Link>}
              {isLive && <button className="primary-reference-button" onClick={() => setQuickOpen(true)}>Log follow-up</button>}
            </div>
            <nav className="holding-tabs">
              <button className={railTab === 'overview' ? 'active' : ''} onClick={() => setRailTab('overview')}>Overview</button>
              <button className={railTab === 'relationships' ? 'active' : ''} onClick={() => setRailTab('relationships')}>Relationships <b>{selectedRelationships.length}</b></button>
              <button className={railTab === 'insights' ? 'active' : ''} onClick={() => setRailTab('insights')}>Insights</button>
            </nav>
            {railTab === 'overview' && <div className="holding-properties">{selectedProperties.map((property) => <RailKpi key={property.label} label={property.label} value={property.value} />)}</div>}
            {railTab === 'relationships' && <div className="holding-properties reference-relationship-list">{selectedRelationships.length ? selectedRelationships.slice(0, 6).map((edge) => <div className="reference-relationship-row" key={edge.id}><span>{edge.label || edge.kind}</span><strong className={edge.risk >= 60 ? 'danger' : ''}>{edge.risk >= 60 ? `Risk ${edge.risk}` : `Weight ${edge.weight}`}</strong></div>) : <span className="reference-empty-copy">No relationships in the loaded graph.</span>}</div>}
            {railTab === 'insights' && <div className="holding-properties reference-insight-list"><RailKpi label="Connections" value={String(selectedRelationships.length)} /><RailKpi label="Risky edges" value={String(selectedRelationships.filter((edge) => edge.risk >= 60).length)} danger /><button className="rail-action" onClick={() => void runAnalysis('centrality')}>Open centrality analysis <ChevronRight size={14} /></button></div>}
          </article>

          <article className="ai-insight-card">
            <header><Sparkles size={17} /><h2>Network Insight</h2></header>
            <strong>{selectedLiveNode ? 'Selected node overview' : 'No node selected'}</strong>
            <p>{selectedLiveNode ? `${selectedLabel} is connected to ${selectedRelationships.length} visible relationship${selectedRelationships.length === 1 ? '' : 's'} in the current authorization scope.` : 'Select a node to inspect its authorized connections.'}</p>
            <div className="importance-label"><span>Visible degree</span><b>{stats.influence}<span> connections</span></b></div>
            <div className="importance-track"><i style={{ width: `${Math.min(100, Math.max(0, stats.influence * 4))}%` }} /></div>
            <h3>Next step</h3>
            <p>{selectedLiveNode ? 'Open the record or log a follow-up from this context.' : 'Select a node before taking an action.'}</p>
            <button className="analysis-button" onClick={() => void runAnalysis('centrality')}>View Full Analysis <ChevronRight size={15} /></button>
          </article>

          <article className="recent-activities-card">
            <header><h2>Recent Activities</h2><button onClick={() => void loadGraph()}>Refresh</button></header>
            <p className="reference-empty-copy">Activity feed is not included in the network graph response. Open a selected record to view its authorized timeline.</p>
          </article>
        </aside>
      </section>

      {analysisOpen && <section className="reference-analysis-panel">
        <header><div><h2>Network Analysis</h2><p>Each result is calculated by the authorized Backend graph and can be selected in the network.</p></div><button onClick={() => setAnalysisOpen(false)}>Close</button></header>
        <nav className="analysis-tabs">{['centrality', 'connectors', 'bridges', 'bottlenecks', 'single-points-of-failure'].map((kind) => <button key={kind} className={analysisKind === kind ? 'active' : ''} onClick={() => void runAnalysis(kind)}>{kind.replaceAll('-', ' ')}</button>)}</nav>
        {analysisBusy ? <p className="reference-analysis-state">Loading analysis…</p> : analysisRows.length ? <div className="reference-analysis-table"><div className="reference-analysis-row heading"><span>Node</span><span>Score</span><span>Action</span></div>{analysisRows.map((row, index) => { const node = row.node ?? {}; const score = row.degree ?? row.connectorScore ?? row.bridgeScore ?? row.bottleneckScore ?? row.fragmentationIncrease ?? '—'; return <div className="reference-analysis-row" key={node.id ?? index}><span>{node.label ?? node.name ?? node.id ?? 'Unknown node'}</span><strong>{String(score)}</strong><button onClick={() => { if (node.id) { setSelectedNodeId(node.id); setRailTab('overview'); } }}>Highlight</button></div>; })}</div> : <p className="reference-analysis-state">Run an analysis to see Backend-derived results.</p>}
        <div className="reference-manager-header"><div><h3>Person relationships</h3><p>Read, create, update and archive person-to-person relationships under relationship.write authorization.</p></div><button className="secondary-reference-button" onClick={() => void loadPersonRelationships()} disabled={!canNetworkRead||!canRelationshipRead||personBusy}>{!canNetworkRead||!canRelationshipRead ? 'Read access required' : personBusy ? 'Loading…' : 'Load relationships'}</button></div>
        {personManagerOpen && <div className="person-relationship-manager">
          {!canRelationshipWrite && <p className="reference-empty-copy">Relationship records are read-only in the current permission scope.</p>}
          {canRelationshipWrite && <form onSubmit={savePersonRelationship} className="person-relationship-form">
            <EntityPicker label="Source person" endpoint="/people" value={personForm.sourcePersonId} selectedLabel={personForm.sourcePersonName} onChange={value => setPersonForm({ ...personForm, sourcePersonId: value })} onLabelChange={(_, label) => setPersonForm(form => ({ ...form, sourcePersonName: label }))} scopeId={scopeId} disabled={Boolean(editingPersonId) || personBusy} required={!editingPersonId} />
            <EntityPicker label="Target person" endpoint="/people" value={personForm.targetPersonId} selectedLabel={personForm.targetPersonName} onChange={value => setPersonForm({ ...personForm, targetPersonId: value })} onLabelChange={(_, label) => setPersonForm(form => ({ ...form, targetPersonName: label }))} scopeId={scopeId} disabled={Boolean(editingPersonId) || personBusy} required={!editingPersonId} />
            <input placeholder="Relationship type" value={personForm.relationshipType} onChange={(event) => setPersonForm({ ...personForm, relationshipType: event.target.value })} required />
            <select value={personForm.status} onChange={(event) => setPersonForm({ ...personForm, status: event.target.value })}><option value="ACTIVE">ACTIVE</option><option value="DORMANT">DORMANT</option><option value="AT_RISK">AT_RISK</option></select>
            <input type="number" min="0" max="100" placeholder="Strategic score" value={personForm.strategicScore} onChange={(event) => setPersonForm({ ...personForm, strategicScore: event.target.value })} />
            <input type="number" min="0" max="100" placeholder="Risk score" value={personForm.riskScore} onChange={(event) => setPersonForm({ ...personForm, riskScore: event.target.value })} />
            <button className="primary-reference-button" disabled={personBusy}>{editingPersonId ? 'Update relationship' : 'Create relationship'}</button>
            {editingPersonId && <button type="button" onClick={() => setEditingPersonId(null)}>Cancel</button>}
          </form>}
          {personRows.length ? <div className="reference-person-list">{personRows.map((row) => <div className="reference-person-row" key={row.id}><span><b>{row.relationshipType ?? 'Relationship'}</b><small>{personName(row, 'sourcePerson')} → {personName(row, 'targetPerson')}</small></span><span>{canRelationshipWrite && <><button onClick={() => editPersonRelationship(row)}>Edit</button><button onClick={() => void archivePersonRelationship(row.id)}>Archive</button></>}</span></div>)}</div> : <p className="reference-analysis-state">No person relationships loaded.</p>}
        </div>}
      </section>}

      <QuickCreate open={quickOpen} onClose={() => setQuickOpen(false)} context={selectedContext} onCreated={() => { setQuickOpen(false); void loadGraph(); }} />
      <div className="reference-sr-only" aria-live="polite">{loading ? 'Loading authorized network data.' : error ? error : `Network graph loaded. ${stats.relationships} relationships and ${stats.risk} active risks.`}</div>
    </main>
  );
}
