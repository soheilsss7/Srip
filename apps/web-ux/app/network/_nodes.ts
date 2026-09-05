// Shared visual encoding + shape drawing for the network graph (Web).
// Single source of truth for node/edge colors, shapes, risk and weight styling.

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

// Highlight color used for path (organization path) and focused/analytics emphasis.
export const PATH_COLOR = '#B45309';

/* -------------------- relationship status visual encoding -------------------- */
// The status of a relationship is encoded directly on its edge:
// color + line pattern + a small icon pill at the midpoint of the line.
export type StatusIcon = 'check' | 'alert' | 'pause' | 'x' | 'plus';

export interface StatusMeta {
  label: string;
  color: string;
  dash: number[] | null;
  icon: StatusIcon;
  width: number;
}

export const STATUS_META: Record<string, StatusMeta> = {
  ACTIVE:      { label: 'فعال',     color: '#0E9F6E', dash: null,    icon: 'check',  width: 2.4 },
  AT_RISK:     { label: 'در ریسک',  color: '#D97706', dash: [7, 4],  icon: 'alert',  width: 2.6 },
  WATCH:       { label: 'در ریسک',  color: '#D97706', dash: [7, 4],  icon: 'alert',  width: 2.6 },
  DORMANT:     { label: 'خواب',     color: '#8A94A6', dash: [2, 4],  icon: 'pause',  width: 2.0 },
  ARCHIVED:    { label: 'بایگانی',  color: '#DC2626', dash: [4, 3],  icon: 'x',      width: 1.8 },
  PROSPECTIVE: { label: 'آینده',    color: '#2563EB', dash: [5, 3],  icon: 'plus',   width: 2.2 },
};

export const DEFAULT_STATUS: StatusMeta = {
  label: 'نامشخص', color: '#94A3B8', dash: null, icon: 'pause', width: 1.8,
};

/** Effective status of an edge — explicit status, else derived from risk. */
export function edgeStatus(e: GEdge): string {
  const s = (e as any)?.status;
  if (s && STATUS_META[s]) return s;
  if (Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD) return 'AT_RISK';
  return 'ACTIVE';
}

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? DEFAULT_STATUS;
}

// Nodes are prefixed by the backend graph engine: org:/person:/project:<uuid>.
// The entity detail routes (/organizations/[id], /people/[id], /projects/[id])
// expect the bare UUID, so strip the prefix when navigating.
export function nodeEntityRoute(n: GNode): { href: string } | null {
  switch (n.type) {
    case 'organization':
      return n.id.startsWith('org:') ? { href: `/organizations/${n.id.slice(4)}` } : null;
    case 'person':
      return n.id.startsWith('person:') ? { href: `/people/${n.id.slice(7)}` } : null;
    case 'project':
      return n.id.startsWith('project:') ? { href: `/projects/${n.id.slice(8)}` } : null;
    default:
      return null;
  }
}

export function edgeStrokeColor(e: GEdge): string {
  if (Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD) return RISK_COLOR;
  return EDGE_COLORS[e.kind] ?? '#94A3B8';
}

function toFinite(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function edgeStrokeWidth(e: GEdge): number {
  const weight = toFinite(e.weight, 0);
  const base = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(weight / 20)));
  const risk = toFinite(e.risk, 0);
  return risk >= RISK_THRESHOLD ? base + 1 : base;
}

export function nodeColor(n: GNode): string {
  return NODE_COLORS[n.type] ?? '#94A3B8';
}

// Draw a node shape (square/circle/triangle) onto the 2D canvas context.
export function drawNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  type: GNodeType,
  selected = false,
  hovered = false,
): void {
  const r = size / 2;
  const base = hovered ? 1.25 : 1;
  ctx.save();
  ctx.translate(x, y);
  const s = r * base;
  ctx.beginPath();
  if (type === 'organization') {
    ctx.rect(-s, -s, s * 2, s * 2);
  } else if (type === 'project') {
    ctx.moveTo(0, -s * 1.2);
    ctx.lineTo(s * 1.15, s * 0.8);
    ctx.lineTo(-s * 1.15, s * 0.8);
    ctx.closePath();
  } else {
    ctx.arc(0, 0, s, 0, Math.PI * 2);
  }
  ctx.fillStyle = color;
  ctx.fill();
  if (selected || hovered) {
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = selected ? '#111827' : '#94A3B8';
    ctx.stroke();
  }
  ctx.restore();
}

export function kindLabel(kind: GEdgeKind): string {
  switch (kind) {
    case 'membership':
      return 'عضویت (شخص→سازمان)';
    case 'project':
      return 'پروژه (پروژه→سازمان)';
    case 'relationship':
      return 'رابطهٔ سازمانی';
    case 'person_relationship':
      return 'رابطهٔ شخصی';
    default:
      return kind;
  }
}

export function edgeDisplayLabel(e: GEdge): string {
  const rel = e.label ? `${e.label}` : kindLabel(e.kind);
  const weight = Number.isFinite(e.weight) ? String(e.weight) : '—';
  const risk = Number.isFinite(e.risk) ? String(e.risk) : '—';
  return `${rel} · وزن ${weight} · ریسک ${risk}`;
}

export function nodeDisplayName(n: GNode): string {
  return n.label || n.id;
}
