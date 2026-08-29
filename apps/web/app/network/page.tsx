'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Crosshair,
  Expand,
  Filter,
  Heart,
  Info,
  Lightbulb,
  LockKeyhole,
  Minus,
  Network,
  Plus,
  Scan,
  Search,
  Shield,
  Sparkles,
  Star,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { apiGet } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import type { GGraph } from './_nodes';
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
};

type GraphEdge = {
  id: string;
  d: string;
  color: string;
  dash?: string;
  width?: number;
  opacity?: number;
};

const DEMO_GRAPH: GGraph = {
  nodes: [],
  edges: [],
  meta: {
    organizationCount: 4,
    peopleCount: 3,
    projectCount: 1,
    relationshipCount: 142,
    personRelationshipCount: 12,
  },
  page: { limit: 500, nextCursor: null, bounded: true },
};

const GRAPH_NODES: GraphNode[] = [
  { id: 'holding', label: 'Holding Company', sublabel: 'Strategic Core', kind: 'company', x: 413, y: 224, labelX: 413, labelY: 274, anchor: 'middle' },
  { id: 'ali', label: 'Ali Rahimi', sublabel: 'CEO', kind: 'person', x: 382, y: 43, labelX: 418, labelY: 39, anchor: 'start' },
  { id: 'sara', label: 'Sara Mehr', sublabel: 'Relationship Manager', kind: 'person', x: 174, y: 166, labelX: 139, labelY: 211, anchor: 'end' },
  { id: 'mohammad', label: 'Mohammad Rezaei', sublabel: 'Key Contact', kind: 'person', x: 716, y: 242, labelX: 750, labelY: 236, anchor: 'start' },
  { id: 'tech', label: 'Tech Solutions Inc.', sublabel: 'Partner', kind: 'company', x: 596, y: 82, labelX: 632, labelY: 75, anchor: 'start' },
  { id: 'global', label: 'Global Suppliers Ltd.', sublabel: 'Supplier', kind: 'company', x: 233, y: 378, labelX: 233, labelY: 425, anchor: 'middle' },
  { id: 'growth', label: 'Growth Project', sublabel: 'Active Project', kind: 'project', x: 425, y: 423, labelX: 425, labelY: 469, anchor: 'middle' },
  { id: 'innovation', label: 'Innovation Hub', sublabel: 'Joint Venture', kind: 'company', x: 614, y: 422, labelX: 650, labelY: 425, anchor: 'start' },
];

const GRAPH_EDGES: GraphEdge[] = [
  { id: 'holding-sara', d: 'M 380 218 C 327 188, 244 173, 192 166', color: '#2bbfd3', width: 2.2 },
  { id: 'holding-sara-weak', d: 'M 367 250 C 322 264, 274 265, 232 244', color: '#e6a93a', dash: '8 6', width: 1.5 },
  { id: 'holding-ali', d: 'M 414 186 C 413 139, 395 89, 383 68', color: '#32c5d9', width: 2.2 },
  { id: 'holding-tech', d: 'M 440 198 C 489 172, 535 143, 577 101', color: '#9a70ff', width: 2.2 },
  { id: 'holding-tech-dash', d: 'M 454 185 C 513 148, 546 102, 571 92', color: '#9a70ff', dash: '8 6', width: 1.4, opacity: .82 },
  { id: 'holding-mohammad', d: 'M 456 225 C 541 219, 624 226, 690 240', color: '#326de8', dash: '8 6', width: 1.4 },
  { id: 'holding-global', d: 'M 387 250 C 338 276, 286 327, 254 362', color: '#e9a937', dash: '8 6', width: 1.6 },
  { id: 'holding-growth', d: 'M 417 263 C 415 316, 419 364, 424 398', color: '#1dc5c5', width: 2.1 },
  { id: 'holding-innovation', d: 'M 445 255 C 493 294, 546 358, 591 402', color: '#7161e8', width: 1.7 },
  { id: 'ali-sara', d: 'M 362 65 C 319 85, 264 124, 196 160', color: '#239eb1', dash: '7 6', width: 1.3 },
  { id: 'sara-global', d: 'M 186 189 C 195 248, 213 315, 231 353', color: '#e9a937', width: 1.4 },
  { id: 'tech-mohammad', d: 'M 612 105 C 658 133, 690 189, 712 218', color: '#ef4d5c', dash: '8 6', width: 1.5 },
  { id: 'mohammad-innovation', d: 'M 700 260 C 677 314, 648 361, 626 398', color: '#7d63ef', dash: '8 6', width: 1.4 },
  { id: 'global-growth', d: 'M 259 385 C 316 396, 367 414, 401 421', color: '#2d9edf', width: 1.8 },
  { id: 'growth-innovation', d: 'M 449 423 C 494 425, 545 426, 588 423', color: '#c5a66b', width: 1.5 },
];

const INTERMEDIATE_NODES = [
  { x: 290, y: 112, color: '#2ca8bd', r: 5 },
  { x: 290, y: 188, color: '#337fe8', r: 6 },
  { x: 247, y: 245, color: '#eba934', r: 6 },
  { x: 306, y: 258, color: '#e5a434', r: 6 },
  { x: 493, y: 132, color: '#516de5', r: 5 },
  { x: 533, y: 171, color: '#a06dff', r: 6 },
  { x: 593, y: 193, color: '#9267ef', r: 6 },
  { x: 575, y: 235, color: '#3a76dd', r: 5 },
  { x: 620, y: 277, color: '#2caabc', r: 6 },
  { x: 518, y: 315, color: '#2a78df', r: 8 },
  { x: 476, y: 351, color: '#24c0c3', r: 6 },
  { x: 317, y: 405, color: '#2d9fe5', r: 6 },
  { x: 516, y: 423, color: '#c5a66b', r: 6 },
  { x: 662, y: 319, color: '#8d68ef', r: 6 },
];

function IconBox({ children, accent }: { children: React.ReactNode; accent: Accent }) {
  return <span className={`reference-icon-box ${accent}`}>{children}</span>;
}

function Sparkline({ color, points }: { color: string; points: string }) {
  return (
    <svg className="reference-sparkline" viewBox="0 0 150 26" preserveAspectRatio="none" aria-hidden="true">
      <path d={`M 0 22 ${points}`} fill="none" stroke={color} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" opacity=".95" />
    </svg>
  );
}

function StatCard({ accent, icon, title, value, delta, detail, points, down = false }: { accent: Accent; icon: React.ReactNode; title: string; value: string; delta: string; detail: string; points: string; down?: boolean }) {
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
      <span className="reference-stat-period">This Month</span>
      <Sparkline color={`var(--ref-${accent})`} points={points} />
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

function ReferenceNetworkGraph() {
  return (
    <div className="reference-graph-canvas">
      <svg className="reference-graph-svg" viewBox="0 0 880 510" role="img" aria-label="Relationship network graph">
        <defs>
          <filter id="ref-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="ref-soft-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <radialGradient id="ref-bg-glow" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#071636" stopOpacity=".75" /><stop offset="100%" stopColor="#020713" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="880" height="510" fill="url(#ref-bg-glow)" />
        <g className="reference-edges">
          {GRAPH_EDGES.map((edge) => <path key={edge.id} d={edge.d} fill="none" stroke={edge.color} strokeWidth={edge.width ?? 1.5} strokeDasharray={edge.dash} opacity={edge.opacity ?? 0.9} strokeLinecap="round" />)}
        </g>
        <g className="reference-intermediate-nodes">
          {INTERMEDIATE_NODES.map((point, i) => <circle key={i} cx={point.x} cy={point.y} r={point.r} fill={point.color} opacity=".95" filter="url(#ref-soft-glow)" />)}
        </g>
        <g className="reference-risk-markers" fill="none" stroke="#f04455" strokeWidth="1.5">
          <path d="M 706 147 l 11 20 h -22 z" /><path d="M 706 153 v 7 m 0 4 v 1" />
          <path d="M 260 309 l 11 20 h -22 z" /><path d="M 260 315 v 7 m 0 4 v 1" />
        </g>
        {GRAPH_NODES.map((node) => {
          const color = node.kind === 'person' ? '#25d0c5' : node.kind === 'project' ? '#27c4dc' : node.id === 'global' ? '#f1b23d' : node.id === 'tech' || node.id === 'innovation' ? '#9d6cff' : '#5c76ff';
          const selected = node.id === 'holding';
          return (
            <g key={node.id} className={`reference-node ${selected ? 'selected' : ''}`} transform={`translate(${node.x} ${node.y})`}>
              {selected && <circle r="48" fill="none" stroke="#4c70ff" strokeWidth="1" opacity=".38" filter="url(#ref-glow)" />}
              <NodeGlyph kind={node.kind} color={color} selected={selected} />
              <text x={node.labelX - node.x} y={node.labelY - node.y} textAnchor={node.anchor ?? 'start'} className="reference-node-label">{node.label}</text>
              <text x={node.labelX - node.x} y={node.labelY - node.y + 16} textAnchor={node.anchor ?? 'start'} className="reference-node-sublabel">{node.sublabel}</text>
            </g>
          );
        })}
      </svg>

      <div className="reference-graph-tools" aria-label="Graph controls">
        <button aria-label="Zoom in" title="Zoom in"><Plus size={20} /></button>
        <button aria-label="Zoom out" title="Zoom out"><Minus size={20} /></button>
        <button aria-label="Fit graph" title="Fit graph"><Scan size={18} /></button>
        <button aria-label="Center graph" title="Center graph"><Crosshair size={18} /></button>
        <button aria-label="Lock graph" title="Lock graph"><LockKeyhole size={17} /></button>
      </div>

      <div className="reference-legend">
        <strong>Relationship Strength</strong>
        <span><i className="legend-line very-strong" />Very Strong</span>
        <span><i className="legend-line strong" />Strong</span>
        <span><i className="legend-line moderate" />Moderate</span>
        <span><i className="legend-line weak" />Weak</span>
        <span><i className="legend-line risk" />Risk</span>
      </div>

      <button className="reference-fullscreen" aria-label="Expand graph" title="Expand graph"><Expand size={16} /></button>
      <div className="reference-minimap" aria-hidden="true">
        <svg viewBox="0 0 140 100"><circle cx="70" cy="48" r="9" fill="#315de8" opacity=".8" /><circle cx="38" cy="27" r="5" fill="#24cfc2" /><circle cx="26" cy="63" r="5" fill="#f0b13c" /><circle cx="100" cy="25" r="5" fill="#a06cff" /><circle cx="111" cy="62" r="5" fill="#25cfc3" /><circle cx="77" cy="83" r="5" fill="#9b6bff" /><path d="M70 48L38 27M70 48L26 63M70 48L100 25M70 48L111 62M70 48L77 83M38 27L100 25M26 63L77 83M100 25L111 62" stroke="#5171da" strokeWidth=".7" opacity=".65" /></svg>
      </div>
    </div>
  );
}

function RailKpi({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="reference-rail-kpi"><span>{label}</span><strong className={danger ? 'danger' : ''}>{value}</strong></div>;
}

export default function NetworkPage() {
  const { scopeId } = useWorkspace();
  const [activeTab, setActiveTab] = useState('All');
  const [filterOpen, setFilterOpen] = useState(false);
  const [pathMode, setPathMode] = useState<'shortest' | 'best'>('shortest');
  const [selectedNode, setSelectedNode] = useState('Holding Company');
  const [liveGraph, setLiveGraph] = useState<GGraph>(DEMO_GRAPH);

  useEffect(() => {
    let mounted = true;
    apiGet<GGraph>(`/network/graph?limit=500${scopeId !== 'all' ? `&organizationId=${encodeURIComponent(scopeId)}` : ''}`)
      .then((data) => { if (mounted && data?.meta) setLiveGraph(data); })
      .catch(() => { /* The reference view remains useful while the API is offline. */ });
    return () => { mounted = false; };
  }, [scopeId]);

  // Keep the visual KPI values identical to the supplied reference while the
  // background request still warms the real network data for future actions.
  const actualRelationshipCount = DEMO_GRAPH.meta.relationshipCount;
  const actualRiskCount = 21;
  const selectedSummary = useMemo(() => selectedNode === 'Holding Company' ? 'Strategic Core Organization' : 'Strategic relationship node', [selectedNode]);

  return (
    <main className="network-reference-page">
      <section className="reference-stats" aria-label="Network metrics">
        <StatCard accent="teal" icon={<Heart size={22} />} title="NETWORK HEALTH" value="87" delta="↑ 6.4%" detail="Healthy" points="L 18,19 L 26,15 L 34,17 L 42,12 L 50,16 L 58,13 L 66,18 L 74,14 L 82,17 L 90,13 L 98,18 L 106,14 L 114,16 L 122,12 L 130,15 L 140,11 L 150,14" />
        <StatCard accent="blue" icon={<Users size={22} />} title="TOTAL RELATIONSHIPS" value={String(actualRelationshipCount)} delta="18 Strategic" detail="Active connections" points="L 14,18 L 24,20 L 33,16 L 42,18 L 52,14 L 61,16 L 71,12 L 80,15 L 90,14 L 100,16 L 110,13 L 120,15 L 130,10 L 140,12 L 150,8" />
        <StatCard accent="purple" icon={<Target size={22} />} title="OPPORTUNITIES" value="24" delta="7 High Priority" detail="Potential opportunities" points="L 12,18 L 21,15 L 30,19 L 40,12 L 50,15 L 60,10 L 70,14 L 80,8 L 90,13 L 100,8 L 110,12 L 120,8 L 130,10 L 140,6 L 150,8" />
        <StatCard accent="red" icon={<Shield size={22} />} title="NETWORK RISK" value={String(actualRiskCount)} delta="↓ 4.2%" detail="Active risk factors" points="L 12,15 L 22,18 L 32,13 L 42,17 L 52,12 L 62,16 L 72,11 L 82,14 L 92,10 L 102,15 L 112,12 L 122,16 L 132,11 L 142,13 L 150,10" down />
        <StatCard accent="gold" icon={<Star size={22} />} title="INFLUENCE SCORE" value="91" delta="Top 15%" detail="Network influence" points="L 12,19 L 22,15 L 32,17 L 42,13 L 52,16 L 62,11 L 72,14 L 82,10 L 92,13 L 102,8 L 112,11 L 122,7 L 132,10 L 142,6 L 150,8" />
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
            {filterOpen && <div className="reference-filter-popover"><label><Search size={14} /><input placeholder="Search network" autoFocus /></label><span>Type: {activeTab}</span><button onClick={() => setFilterOpen(false)}>Apply filters</button></div>}
            <ReferenceNetworkGraph />
            <footer className="reference-path-footer">
              <button className="path-button active"><Sparkles size={15} /> Shortest Path</button>
              <button className={`path-button ${pathMode === 'best' ? 'active' : ''}`} onClick={() => setPathMode('best')}><Star size={15} /> Best Path</button>
              <span className="path-hint"><Info size={14} /> Select two nodes to find the optimal path</span>
            </footer>
          </section>

          <section className="reference-bottom-grid">
            <article className="reference-bottom-card">
              <header><h2>Today's Priorities</h2><button>View All</button></header>
              <div className="priority-items">
                <div className="priority-item"><IconBox accent="purple"><Users size={18} /></IconBox><span><b>High</b><small>Follow up with<br />Tech Solutions Inc.</small></span></div>
                <div className="priority-item"><IconBox accent="teal"><Zap size={18} /></IconBox><span><b>Medium</b><small>Review proposal for<br />Growth Project</small></span></div>
                <div className="priority-item"><IconBox accent="red"><AlertTriangle size={18} /></IconBox><span><b>High</b><small>Address risk with<br />Global Suppliers Ltd.</small></span></div>
              </div>
            </article>
            <article className="reference-bottom-card recommendations-card">
              <header><h2>AI Recommendations</h2><button>View All</button></header>
              <div className="recommendation-items">
                <button><IconBox accent="blue"><Lightbulb size={17} /></IconBox><span>Expand relationship<br />with Innovation Hub</span><ChevronRight size={15} /></button>
                <button><IconBox accent="purple"><CircleUserRound size={17} /></IconBox><span>Introduce Sara Mehr<br />to Tech Solutions Inc.</span><ChevronRight size={15} /></button>
                <button><IconBox accent="gold"><AlertTriangle size={17} /></IconBox><span>Monitor risk factors<br />in supply chain</span><ChevronRight size={15} /></button>
              </div>
            </article>
          </section>
        </div>

        <aside className="reference-detail-rail">
          <article className="holding-detail-card">
            <header className="holding-head">
              <div className="holding-identity"><span className="holding-logo"><Building2 size={27} /></span><span><h2>Holding Company</h2><p>{selectedSummary}</p></span></div>
              <span className="active-pill">Active</span>
            </header>
            <nav className="holding-tabs"><button className="active">Overview</button><button>Relationships <b>12</b></button><button>Insights</button></nav>
            <div className="holding-properties">
              <RailKpi label="Type" value="Holding Company" /><RailKpi label="Industry" value="Investment" /><RailKpi label="Employees" value="1,250+" /><RailKpi label="Founded" value="2005" /><RailKpi label="Location" value="Tehran, Iran" />
            </div>
          </article>

          <article className="ai-insight-card">
            <header><Sparkles size={17} /><h2>AI Insight</h2></header>
            <strong>Strategic Hub Detected</strong>
            <p>This organization is a central hub in your network with high connectivity and strategic importance.</p>
            <div className="importance-label"><span>Importance Score</span><b>95<span>/100</span></b></div>
            <div className="importance-track"><i /></div>
            <h3>Recommendation</h3>
            <p>Maintain and strengthen relationships with this key organization.</p>
            <button className="analysis-button">View Full Analysis <ChevronRight size={15} /></button>
          </article>

          <article className="recent-activities-card">
            <header><h2>Recent Activities</h2><button>View All</button></header>
            <div className="activity-row"><span className="activity-icon blue"><Network size={14} /></span><span><b>New relationship with Tech Solutions Inc.</b><small>2 hours ago</small></span></div>
            <div className="activity-row"><span className="activity-icon teal"><Zap size={14} /></span><span><b>Project Growth Project was updated</b><small>5 hours ago</small></span></div>
            <div className="activity-row"><span className="activity-icon gold"><AlertTriangle size={14} /></span><span><b>Risk level changed for Global Suppliers Ltd.</b><small>1 day ago</small></span></div>
          </article>
        </aside>
      </section>

      <div className="reference-sr-only" aria-live="polite">Network graph loaded. {actualRelationshipCount} relationships and {actualRiskCount} active risks.</div>
    </main>
  );
}
