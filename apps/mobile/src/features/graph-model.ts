// Portable graph semantics for the mobile network graph.
// Mirrors the web encoding in apps/web/app/network/_nodes.ts but without any
// browser/Canvas-specific types so it is safe for React Native + react-native-web.
// Kept independent of the web module on purpose (no shared dependency between shells).

export type GNodeType = 'organization' | 'person' | 'project';
export type GEdgeKind = 'membership' | 'project' | 'relationship' | 'person_relationship';

export interface GNode {
  id: string;
  label: string;
  type: GNodeType;
  organizationId?: string;
}

export interface GEdge {
  id: string;
  source: string;
  target: string;
  kind: GEdgeKind;
  weight: number;
  risk: number;
  strategicImportance: number;
  label?: string;
}

export interface GGraph {
  nodes: GNode[];
  edges: GEdge[];
  meta: {
    organizationCount: number;
    peopleCount: number;
    projectCount: number;
    relationshipCount: number;
    personRelationshipCount: number;
  };
  page: { limit: number; nextCursor: string | null; bounded: true };
}

export interface GLayoutPoint {
  x: number;
  y: number;
}

export const NODE_COLORS: Record<GNodeType, string> = {
  organization: '#2457D6',
  person: '#027A48',
  project: '#7A5AF8',
};

export const EDGE_COLORS: Record<GEdgeKind, string> = {
  membership: '#94A3B8',
  project: '#7A5AF8',
  relationship: '#2457D6',
  person_relationship: '#027A48',
};

export const EDGE_DASH: Partial<Record<GEdgeKind, number[] | null>> = {
  membership: [4, 3],
  project: null,
  relationship: null,
  person_relationship: null,
};

export const RISK_COLOR = '#B42318';
export const RISK_THRESHOLD = 60;
export const WIDTH_MIN = 1;
export const WIDTH_MAX = 6;

export const PATH_COLOR = '#B45309';

export function nodeBareId(n: GNode): string {
  const p = n.type === 'organization' ? 'org:' : n.type === 'person' ? 'person:' : 'project:';
  return n.id.startsWith(p) ? n.id.slice(p.length) : n.id;
}

// Mobile detail routes expect the bare UUID (graph IDs are prefixed org:/person:/project:).
export function nodeEntityRoute(n: GNode): { path: string } | null {
  switch (n.type) {
    case 'organization':
      return { path: `/organization/${nodeBareId(n)}` };
    case 'person':
      return { path: `/person/${nodeBareId(n)}` };
    case 'project':
      return { path: `/project/${nodeBareId(n)}` };
    default:
      return null;
  }
}

export function nodeColor(n: GNode): string {
  return NODE_COLORS[n.type] ?? '#94A3B8';
}

// Coerce to a finite number or a safe fallback. Protects the graph transforms
// from NaN/Infinity coming from malformed or partial payloads.
function toFinite(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function edgeStrokeColor(e: GEdge): string {
  if (Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD) return RISK_COLOR;
  return EDGE_COLORS[e.kind] ?? '#94A3B8';
}

export function edgeStrokeWidth(e: GEdge): number {
  const weight = toFinite(e.weight, 0);
  const base = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(weight / 20)));
  const risk = toFinite(e.risk, 0);
  return risk >= RISK_THRESHOLD ? base + 1 : base;
}

export function kindLabel(kind: GEdgeKind): string {
  switch (kind) {
    case 'membership':
      return 'Membership (person→org)';
    case 'project':
      return 'Project (project→org)';
    case 'relationship':
      return 'Organization relationship';
    case 'person_relationship':
      return 'Person relationship';
    default:
      return kind;
  }
}

export function edgeDisplayLabel(e: GEdge): string {
  const rel = e.label ? `${e.label}` : kindLabel(e.kind);
  const weight = Number.isFinite(e.weight) ? String(e.weight) : '—';
  const risk = Number.isFinite(e.risk) ? String(e.risk) : '—';
  return `${rel} · wt ${weight} · risk ${risk}`;
}

export function nodeDisplayName(n: GNode): string {
  return n.label || n.id;
}

// Deterministic circular layout (no force simulation — lightweight and predictable).
// Returns a world-space position per node id (origin at 0,0; radius ~1).
// A single node is placed at the origin; with 2+ nodes every node sits on the
// unit circle (no node is forced to the center, which would overlap its edges).
export function layoutNodes(nodes: GNode[]): Map<string, GLayoutPoint> {
  const positions = new Map<string, GLayoutPoint>();
  const unique = nodes.filter((n, i) => nodes.findIndex((m) => m.id === n.id) === i);
  const n = unique.length;
  if (n === 1 && unique[0]) {
    positions.set(unique[0].id, { x: 0, y: 0 });
    return positions;
  }
  unique.forEach((node, i) => {
    const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
    positions.set(node.id, { x: Math.cos(angle), y: Math.sin(angle) });
  });
  return positions;
}
