import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 2));
}

function overlap(a: string, b: string): number {
  const A = tokens(a); const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hits = 0;
  for (const token of A) if (B.has(token)) hits++;
  return clamp((2 * hits / (A.size + B.size)) * 100);
}

function typeKeywords(type: string): string {
  const map: Record<string, string> = {
    BANK: 'bank banking financial finance',
    INVESTOR: 'investor investment capital fund',
    GOVERNMENT: 'government regulator regulatory authority ministry',
    PARTNER: 'partner partnership strategic',
    SUPPLIER: 'supplier vendor supply',
    CUSTOMER: 'customer client',
    HOLDING: 'holding group',
    SUBSIDIARY: 'subsidiary company',
  };
  return map[type] ?? type;
}

type Org = { id: string; name: string; industry: string | null; type: string; parentOrganizationId: string | null };
type Edge = {
  id: string;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  relationshipType: string;
  status: string;
  healthScore: number;
  trustScore: number;
  engagementScore: number;
  strategicScore: number;
  riskScore: number;
};

type Path = { relationshipIds: string[]; organizationIds: string[]; connectorOrganizationId?: string; hopCount: number; strength: number; health: number; trust: number; engagement: number };

@Injectable()
export class RequirementMatchingService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService) {}

  private async holdingRoot(orgId: string, cache: Map<string, string>): Promise<string> {
    const cached = cache.get(orgId); if (cached) return cached;
    let current = orgId;
    const seen = new Set<string>();
    while (!seen.has(current)) {
      seen.add(current);
      const row = await this.prisma.organization.findUnique({ where: { id: current }, select: { id: true, parentOrganizationId: true } });
      if (!row?.parentOrganizationId) { cache.set(orgId, row?.id ?? orgId); return row?.id ?? orgId; }
      current = row.parentOrganizationId;
    }
    cache.set(orgId, current);
    return current;
  }

  private async sameHoldingGroup(a: string, b: string, cache: Map<string, string>): Promise<boolean> {
    return (await this.holdingRoot(a, cache)) === (await this.holdingRoot(b, cache));
  }

  private edgeStrength(edge: Edge): number {
    const base = edge.healthScore * 0.30 + edge.trustScore * 0.30 + edge.engagementScore * 0.20 + edge.strategicScore * 0.15 + (100 - edge.riskScore) * 0.05;
    const statusBonus = edge.status === 'ACTIVE' ? 5 : edge.status === 'AT_RISK' ? -10 : edge.status === 'DORMANT' ? -15 : 0;
    return clamp(base + statusBonus);
  }

  private findPath(source: string, target: string, adjacency: Map<string, Array<{ to: string; edge: Edge }>>, maxEdges: number): Path | null {
    if (source === target) return null;
    const queue: Array<{ node: string; edges: Edge[]; nodes: string[] }> = [{ node: source, edges: [], nodes: [source] }];
    const visited = new Set<string>([source]);
    while (queue.length) {
      const current = queue.shift()!;
      if (current.edges.length >= maxEdges) continue;
      for (const next of adjacency.get(current.node) ?? []) {
        if (current.nodes.includes(next.to)) continue;
        const edges = [...current.edges, next.edge];
        const nodes = [...current.nodes, next.to];
        if (next.to === target) {
          const strengths = edges.map((e) => this.edgeStrength(e));
          const strength = strengths.length === 1 ? strengths[0] : clamp(strengths.reduce((a, b) => a * b, 100) / Math.pow(100, strengths.length - 1));
          return { relationshipIds: edges.map((e) => e.id), organizationIds: nodes, connectorOrganizationId: nodes.length > 2 ? nodes[1] : undefined, hopCount: edges.length, strength, health: Math.round(edges.reduce((s, e) => s + e.healthScore, 0) / edges.length), trust: Math.round(edges.reduce((s, e) => s + e.trustScore, 0) / edges.length), engagement: Math.round(edges.reduce((s, e) => s + e.engagementScore, 0) / edges.length) };
        }
        if (!visited.has(next.to)) { visited.add(next.to); queue.push({ node: next.to, edges, nodes }); }
      }
    }
    return null;
  }

  private async connectorPerson(organizationId: string) {
    return this.prisma.person.findFirst({
      where: { organizationId, deletedAt: null },
      select: { id: true, displayName: true, firstName: true, lastName: true, title: true, influenceScore: true, decisionPower: true, accessibilityScore: true },
      orderBy: [{ influenceScore: 'desc' }, { decisionPower: 'desc' }, { accessibilityScore: 'desc' }],
    });
  }


  private async holdingRoots(ids: string[]): Promise<Map<string,string>> {
    const unique=[...new Set(ids)].slice(0, 1000);
    if(!unique.length) return new Map();
    const rows=await this.prisma.$queryRaw<Array<{id:string; rootId:string}>>(Prisma.sql`
      WITH RECURSIVE chain AS (
        SELECT id, id AS root_id, "parentOrganizationId" AS parent_id FROM "Organization" WHERE id IN (${Prisma.join(unique)}) AND "deletedAt" IS NULL
        UNION ALL
        SELECT c.id, p.id AS root_id, p."parentOrganizationId" AS parent_id
        FROM chain c JOIN "Organization" p ON p.id=c.parent_id WHERE c.parent_id IS NOT NULL
      )
      SELECT DISTINCT ON (id) id, root_id AS "rootId" FROM chain WHERE parent_id IS NULL ORDER BY id
    `);
    const out=new Map<string,string>(); for(const r of rows) out.set(r.id,r.rootId);
    for(const id of unique) if(!out.has(id)) out.set(id,id);
    return out;
  }
  async match(userId: string, requirementId: string, limit = 20) {
    const req = await this.prisma.projectRequirement.findUnique({ where: { id: requirementId }, include: { project: true } });
    if (!req || req.deletedAt) throw new NotFoundException('Requirement not found');
    const sourceOrganizationId = req.organizationId ?? req.project.organizationId ?? undefined;
    if (sourceOrganizationId) await this.authorization.assertPermission(userId, 'project.read', { organizationId: sourceOrganizationId, entityType: 'ProjectRequirement', entityId: requirementId });

    const accessible = await this.authorization.accessibleOrganizationIds(userId);
    const orgWhere = accessible ? { id: { in: accessible }, deletedAt: null } : { deletedAt: null };
    // Scalable candidate generation: never materialize the entire organization/relationship graph.
    const candidateTake = Math.max(300, Math.min(1000, limit * 20));
    const requirementTerms = Array.from(new Set(
        Array.from(tokens(`${req.title} ${req.category ?? ''} ${req.description ?? ''}`)).map((term: string) => term.trim()).filter((term: string) => term.length >= 3)
      )).slice(0, 12);
    const candidateWhere: Prisma.OrganizationWhereInput = requirementTerms.length
      ? {
          ...orgWhere,
          OR: requirementTerms.flatMap((term) => [
            { name: { contains: term, mode: 'insensitive' as const } },
            { displayName: { contains: term, mode: 'insensitive' as const } },
            { industry: { contains: term, mode: 'insensitive' as const } },
          ]),
        }
      : orgWhere;
    const organizations = await this.prisma.organization.findMany({
      where: candidateWhere,
      select: { id: true, name: true, industry: true, type: true, parentOrganizationId: true },
      orderBy: { id: 'asc' },
      take: candidateTake,
    }) as Org[];
    const orgMap = new Map(organizations.map(o => [o.id, o]));
    if (sourceOrganizationId && !orgMap.has(sourceOrganizationId)) {
      const source = await this.prisma.organization.findUnique({ where: { id: sourceOrganizationId }, select: { id: true, name: true, industry: true, type: true, parentOrganizationId: true } });
      if (source) { organizations.push(source as Org); orgMap.set(source.id, source as Org); }
    }

    const requirementText = `${req.title} ${req.description ?? ''} ${req.category ?? ''}`;
    const keywordText = `${req.title} ${req.category ?? ''} ${req.description ?? ''}`;
    const rootCache = new Map<string, string>();
    const targetCandidates = organizations
      .filter((o) => o.id !== sourceOrganizationId)
      .map((o) => ({ org: o, targetScore: clamp(overlap(keywordText, `${o.name} ${o.industry ?? ''} ${o.type} ${typeKeywords(o.type)}`)) }))
      .filter((x) => x.targetScore > 0)
      .sort((a, b) => b.targetScore - a.targetScore)
      .slice(0, Math.max(50, Math.min(300, limit * 10)));

    const candidateIds = targetCandidates.map(x => x.org.id);
    const rootIds = await this.holdingRoots([...(sourceOrganizationId ? [sourceOrganizationId] : []), ...candidateIds]);
    const frontierIds = [...new Set([...(sourceOrganizationId ? [sourceOrganizationId] : []), ...candidateIds])];
    const relWhere: any = { deletedAt: null, OR: [{ sourceOrganizationId: { in: frontierIds } }, { targetOrganizationId: { in: frontierIds } }] };
    const initialEdges = await this.prisma.relationship.findMany({
      where: relWhere,
      select: { id: true, sourceOrganizationId: true, targetOrganizationId: true, relationshipType: true, status: true, healthScore: true, trustScore: true, engagementScore: true, strategicScore: true, riskScore: true },
      orderBy: [{ healthScore: 'desc' }, { id: 'asc' }],
      take: Math.max(1000, Math.min(5000, limit * 100)),
    }) as Edge[];
    // Build only a bounded local graph. Per-node fanout prevents a high-degree organization from exploding memory.
    const adjacency = new Map<string, Array<{ to: string; edge: Edge }>>();
    const addEdge = (edge: Edge) => {
      for (const [from, to] of [[edge.sourceOrganizationId, edge.targetOrganizationId], [edge.targetOrganizationId, edge.sourceOrganizationId]] as const) {
        const a = adjacency.get(from) ?? [];
        if (a.length < 100) { a.push({ to, edge }); adjacency.set(from, a); }
      }
    };
    for (const edge of initialEdges) addEdge(edge);
    const firstHopTargets = new Set<string>();
    if (sourceOrganizationId) for (const x of adjacency.get(sourceOrganizationId) ?? []) firstHopTargets.add(x.to);
    const secondHopIds = [...firstHopTargets].filter(id => !frontierIds.includes(id));
    if (secondHopIds.length) {
      const secondEdges = await this.prisma.relationship.findMany({
        where: { deletedAt: null, OR: [{ sourceOrganizationId: { in: secondHopIds } }, { targetOrganizationId: { in: secondHopIds } }] },
        select: { id: true, sourceOrganizationId: true, targetOrganizationId: true, relationshipType: true, status: true, healthScore: true, trustScore: true, engagementScore: true, strategicScore: true, riskScore: true },
        orderBy: [{ healthScore: 'desc' }, { id: 'asc' }],
        take: Math.max(1000, Math.min(5000, limit * 100)),
      }) as Edge[];
      for (const edge of secondEdges) addEdge(edge);
    }

    const matches: any[] = [];
    const gaps: any[] = [];
    const source = sourceOrganizationId;
    for (const candidate of targetCandidates) {
      if (!source) continue;
      const path = this.findPath(source, candidate.org.id, adjacency, 2);
      const internal = !!source && rootIds.get(source) === rootIds.get(candidate.org.id);
      const classification = path?.hopCount === 1 ? 'DIRECT' : path?.hopCount === 2 ? 'INDIRECT' : 'GAP';
      const externalInternal = internal ? 'INTERNAL' : 'EXTERNAL';
      const targetFit = candidate.targetScore;
      const pathStrength = path?.strength ?? 0;
      const proximityBonus = path?.hopCount === 1 ? 20 : path?.hopCount === 2 ? 12 : 0;
      const successProbability = clamp(targetFit * 0.30 + pathStrength * 0.35 + (path?.health ?? 0) * 0.12 + (path?.trust ?? 0) * 0.12 + (path?.engagement ?? 0) * 0.06 + proximityBonus);
      const connector = path?.connectorOrganizationId ? await this.connectorPerson(path.connectorOrganizationId) : null;
      const evidence = { requirementKeywords: [...tokens(requirementText)], targetOrganizationFit: targetFit, relationshipIds: path?.relationshipIds ?? [], pathOrganizationIds: path?.organizationIds ?? [], pathStrength, health: path?.health ?? 0, trust: path?.trust ?? 0, engagement: path?.engagement ?? 0, internal: internal, group: rootIds.get(candidate.org.id) ?? candidate.org.id };
      const item = { targetOrganization: candidate.org, connectionType: classification, scope: externalInternal, targetFit, pathStrength, successProbability, path: path ? { hopCount: path.hopCount, organizationIds: path.organizationIds, relationshipIds: path.relationshipIds } : null, connectorPerson: connector, evidence, recommendation: path ? `Use the ${path.hopCount === 1 ? 'direct relationship' : `${path.hopCount - 1}-hop connector path`} to ${candidate.org.name}${connector ? ` via ${connector.displayName ?? `${connector.firstName} ${connector.lastName}`}` : ''}.` : `Relationship gap: no direct or <=2-hop connection to ${candidate.org.name}.` };
      if (path) matches.push(item); else gaps.push(item);
    }

    matches.sort((a, b) => b.successProbability - a.successProbability || b.pathStrength - a.pathStrength);
    gaps.sort((a, b) => b.targetFit - a.targetFit);
    const best = matches[0] ?? null;
    const recommendations = matches.slice(0, 5).map((m, index) => ({ rank: index + 1, targetOrganizationId: m.targetOrganization.id, type: m.connectionType === 'DIRECT' ? 'DIRECT_CONNECTION' : 'INTRODUCTION', title: `Best connection to ${m.targetOrganization.name}`, rationale: m.recommendation, successProbability: m.successProbability, connectorPerson: m.connectorPerson, path: m.path }));

    return {
      requirement: { id: req.id, title: req.title, description: req.description, category: req.category },
      sourceOrganizationId: sourceOrganizationId ?? null,
      pipeline: ['Requirement', 'Requirement Keywords', 'Target Organizations', 'Direct Relationship', '1-Hop', '2-Hop', 'Connector Person', 'Path Strength', 'Relationship Health', 'Trust', 'Engagement', 'Success Probability', 'Rank'],
      summary: { direct: matches.filter((x) => x.connectionType === 'DIRECT').length, indirect: matches.filter((x) => x.connectionType === 'INDIRECT' || x.connectionType === 'TWO_HOP').length, internal: matches.filter((x) => x.scope === 'INTERNAL').length, external: matches.filter((x) => x.scope === 'EXTERNAL').length, gaps: gaps.length },
      bestConnection: best,
      directConnections: matches.filter((x) => x.connectionType === 'DIRECT').slice(0, limit),
      indirectConnections: matches.filter((x) => x.connectionType !== 'DIRECT').slice(0, limit),
      internalConnections: matches.filter((x) => x.scope === 'INTERNAL').slice(0, limit),
      externalConnections: matches.filter((x) => x.scope === 'EXTERNAL').slice(0, limit),
      relationshipGaps: gaps.slice(0, limit),
      recommendations,
      matches: matches.slice(0, Math.max(1, Math.min(limit, 50))),
    };
  }
}
