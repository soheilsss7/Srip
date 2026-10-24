/* ==========================================================================
   SRIP Connection-Intelligence engine — fully deterministic, NO LLM.
   Suggests NEW relationships based on:
     · mutual connections (shared neighbors in the relationship graph)
     · industry/type affinity with the center entity
     · "orbit" signals — orgs present in recent interactions/meetings but
       without a formal relationship record
     · strategic/opportunity scores of existing neighbors
   ========================================================================== */

export type Kind = 'organization' | 'person';

export interface BasicOrg { id:string; name:string; type?:string|null; industry?:string|null }
export interface BasicPerson { id:string; firstName:string; lastName:string; title?:string|null; department?:string|null; organizationId?:string|null; influenceScore?:number }
export interface BasicRel { id:string; sourceOrganizationId?:string|null; targetOrganizationId?:string|null; status?:string|null; riskScore?:number|null; healthScore?:number|null; strategicScore?:number|null; opportunityScore?:number|null; relationshipType?:string|null }
export interface BasicInteraction { id:string; organizationId?:string|null; subject?:string; occurredAt?:string|null }

export interface Suggestion {
  id: string;
  name: string;
  kind: Kind;
  href: string;
  score: number;          // 0..100
  reasons: string[];      // human-readable Persian reasons
  via: string[];          // names of mutual contacts
  sub?: string;
}

export interface GraphData {
  orgs: BasicOrg[];
  people: BasicPerson[];
  rels: BasicRel[];
  interactions: BasicInteraction[];
}

const norm = (s?: string|null) => (s ?? '').trim().toLowerCase();

/** Neighbor org ids of a given org in the relationship graph */
export function neighborsOf(orgId: string, rels: BasicRel[]): Set<string> {
  const out = new Set<string>();
  for (const r of rels) {
    if (r.sourceOrganizationId === orgId && r.targetOrganizationId) out.add(r.targetOrganizationId);
    if (r.targetOrganizationId === orgId && r.sourceOrganizationId) out.add(r.sourceOrganizationId);
  }
  return out;
}

/** Suggest NEW connections for one organization (excludes existing neighbors).
 *  `center` may be the org id or the org object itself. */
export function suggestConnections(
  center: string | BasicOrg,
  data: GraphData,
  excludeIds: Set<string> = new Set(),
): Suggestion[] {
  const { orgs, rels, interactions } = data;
  const centerOrg = typeof center === 'string' ? orgs.find(o => o.id === center) : center;
  if (!centerOrg) return [];
  const centerId = centerOrg.id;
  const neighbors = neighborsOf(centerId, rels);

  // mutual connections: orgs sharing >=1 neighbor with the center
  const mutual = new Map<string, string[]>();
  for (const o of orgs) {
    if (o.id === centerId || neighbors.has(o.id)) continue;
    const shared: string[] = [];
    for (const n of neighborsOf(o.id, rels)) if (neighbors.has(n)) shared.push(n);
    if (shared.length) mutual.set(o.id, shared);
  }

  // orbit: orgs appearing in recent interactions but not formally linked
  const orbit = new Set<string>();
  for (const x of interactions) {
    if (x.organizationId && x.organizationId !== centerId) orbit.add(x.organizationId);
  }

  // quality signal of existing neighbors (strategic + opportunity - risk)
  const neighborQuality: Record<string, number> = {};
  for (const r of rels) {
    const other = r.sourceOrganizationId === centerId ? r.targetOrganizationId : r.sourceOrganizationId;
    if (!other) continue;
    neighborQuality[other] = Math.max(neighborQuality[other] ?? 0,
      (r.strategicScore ?? 50) * 0.5 + (r.opportunityScore ?? 50) * 0.3 + (100 - (r.riskScore ?? 50)) * 0.2);
  }

  const candidates = new Set<string>([...mutual.keys(), ...orbit]);
  const out: Suggestion[] = [];

  for (const id of candidates) {
    if (id === centerId || neighbors.has(id) || excludeIds.has(id)) continue;
    const o = orgs.find(x => x.id === id);
    if (!o) continue;

    const reasons: string[] = [];
    const via: string[] = [];
    let score = 10;

    const shared = mutual.get(id) ?? [];
    if (shared.length) {
      score += shared.length * 14;
      via.push(...shared);
      reasons.push(`${shared.length} ارتباط مشترک`);
    }
    if (orbit.has(id) && !mutual.has(id)) {
      score += 20;
      reasons.push('در تعاملات اخیر — بدون رابطهٔ رسمی');
    }
    if (centerOrg.industry && norm(o.industry) === norm(centerOrg.industry)) { score += 10; reasons.push('همصنعت'); }
    if (centerOrg.type && norm(o.type) === norm(centerOrg.type)) { score += 6; reasons.push('همنوع'); }
    if (neighborQuality[id]) score += neighborQuality[id] * 0.15;

    score = Math.round(Math.max(0, Math.min(100, score)));
    const orgById = (v: string) => orgs.find(x => x.id === v)?.name ?? v;
    out.push({
      id: o.id, name: o.name, kind: 'organization', href: `/organizations/${o.id}`,
      score, reasons, via: via.map(orgById).slice(0, 3),
      sub: [o.type, o.industry].filter(Boolean).join(' · ') || undefined,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Owner-level: merge per-org suggestions into a global ranked list. */
export function suggestGlobal(data: GraphData, limit = 8): Suggestion[] {
  const map = new Map<string, Suggestion>();
  for (const o of data.orgs) {
    for (const s of suggestConnections(o, data)) {
      const prev = map.get(s.id);
      if (!prev || s.score > prev.score) map.set(s.id, s);
    }
  }
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Colleague list of an org (for ego graphs) */
export function peopleOf(orgId: string, people: BasicPerson[]): BasicPerson[] {
  return people.filter(p => p.organizationId === orgId);
}

export function displayName(p: BasicPerson): string {
  return `${p.firstName} ${p.lastName}`.trim();
}
