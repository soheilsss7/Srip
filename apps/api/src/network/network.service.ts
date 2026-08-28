import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { RelationshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { DataLifecycleService } from '../common/data-lifecycle/data-lifecycle.service';
import { ConnectorScoreService } from '../scoring/connector-score.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

type NodeType = 'organization' | 'person' | 'project';
type Node = { id: string; label: string; type: NodeType; organizationId?: string };
type Edge = { id: string; source: string; target: string; kind: string; weight: number; risk: number; strategicImportance: number; label?: string };
type RelationshipEdge = { id: string; sourceOrganizationId: string; targetOrganizationId: string; relationshipType: string; healthScore: number; trustScore: number; accessScore: number; influenceScore: number; riskScore: number; strategicScore: number };

type Graph = { nodes: Node[]; edges: Edge[]; meta: { organizationCount: number; peopleCount: number; projectCount: number; relationshipCount: number; personRelationshipCount: number } };

@Injectable()
export class NetworkService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService, private readonly connectorScore: ConnectorScoreService, private readonly lifecycle: DataLifecycleService) {}

  private async allowed(userId: string, organizationId?: string) {
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    if (organizationId) {
      if (ids && !ids.includes(organizationId)) throw new ForbiddenException('Organization is outside your scope');
      await this.authorization.assertPermission(userId, 'network.read', { organizationId: organizationId });
      return [organizationId];
    }
    return ids;
  }

  private relationshipStatus(value?: string): RelationshipStatus | undefined {
    if (!value) return undefined;
    const candidate = String(value).trim().toUpperCase();
    if (!['PROSPECTIVE', 'ACTIVE', 'AT_RISK', 'DORMANT', 'ARCHIVED'].includes(candidate)) {
      throw new BadRequestException(`Invalid relationship status '${value}'. Allowed: PROSPECTIVE, ACTIVE, AT_RISK, DORMANT, ARCHIVED`);
    }
    return candidate as RelationshipStatus;
  }

  async graph(userId: string, organizationId?: string, type?: string, status?: string, query?: string, focus?: string, limit = 250, cursor?: string): Promise<Graph & { page: { limit: number; nextCursor: string | null; bounded: true } }> {
    const allowed = await this.allowed(userId, organizationId);
    const pageSize = Math.max(25, Math.min(Number(limit) || 250, 500));
    const q = query?.trim();
    const baseOrgScope: any = { deletedAt: null, ...(allowed ? { id: { in: allowed } } : {}) };

    // Search each node type independently. Searching people/projects only inside the
    // first organization page could miss valid matches later in the tenant. Every
    // candidate query is bounded; only matched organization IDs feed graph expansion.
    const [orgMatches, people, projects] = await Promise.all([
      this.prisma.organization.findMany({
        where: { ...baseOrgScope, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] } : {}) },
        select: { id: true, name: true, displayName: true }, orderBy: { id: 'asc' },
        ...(cursor && !q ? { skip: 1, cursor: { id: cursor } } : {}), take: pageSize + 1,
      }),
      this.prisma.person.findMany({
        where: { deletedAt: null, ...(allowed ? { organizationId: { in: allowed } } : {}), ...(q ? { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] } : {}) },
        select: { id: true, firstName: true, lastName: true, displayName: true, organizationId: true }, orderBy: { id: 'asc' }, take: Math.min(pageSize * 2, 500),
      }),
      this.prisma.project.findMany({
        where: { deletedAt: null, ...(allowed ? { organizationId: { in: allowed } } : {}), ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
        select: { id: true, name: true, organizationId: true }, orderBy: { id: 'asc' }, take: Math.min(pageSize * 2, 500),
      }),
    ]);

    const hasNext = orgMatches.length > pageSize && !q;
    const pageOrganizations = hasNext ? orgMatches.slice(0, pageSize) : orgMatches;
    const matchedOrgIds = new Set<string>(pageOrganizations.map(o => o.id));
    people.forEach(p => matchedOrgIds.add(p.organizationId));
    projects.forEach(p => { if (p.organizationId) matchedOrgIds.add(p.organizationId); });
    const orgIds = [...matchedOrgIds].slice(0, pageSize);
    const visibleOrganizations = q
      ? await this.prisma.organization.findMany({ where: { ...baseOrgScope, id: { in: orgIds } }, select: { id: true, name: true, displayName: true }, orderBy: { id: 'asc' }, take: pageSize })
      : pageOrganizations;
    const visibleOrgIds = visibleOrganizations.map(o => o.id);
    const scopedPeople = people.filter(p => visibleOrgIds.includes(p.organizationId)).slice(0, Math.min(pageSize * 2, 500));
    const scopedProjects = projects.filter(p => !p.organizationId || visibleOrgIds.includes(p.organizationId)).slice(0, Math.min(pageSize * 2, 500));

    const relationships = await this.prisma.relationship.findMany({
      where: { deletedAt: null, ...(status ? { status: this.relationshipStatus(status) } : {}), OR: [{ sourceOrganizationId: { in: visibleOrgIds } }, { targetOrganizationId: { in: visibleOrgIds } }] },
      select: { id: true, sourceOrganizationId: true, targetOrganizationId: true, relationshipType: true, healthScore: true, trustScore: true, accessScore: true, influenceScore: true, riskScore: true, strategicScore: true },
      orderBy: { id: 'asc' }, take: Math.min(pageSize * 4, 1000),
    });
    const visiblePersonIds = scopedPeople.map(p => p.id);
    const personRelationships = visiblePersonIds.length ? await this.prisma.personRelationship.findMany({
      where: { deletedAt: null, ...(status ? { status: this.relationshipStatus(status) } : {}), OR: [{ sourcePersonId: { in: visiblePersonIds } }, { targetPersonId: { in: visiblePersonIds } }] },
      select: { id: true, sourcePersonId: true, targetPersonId: true, relationshipType: true, healthScore: true, trustScore: true, accessScore: true, influenceScore: true, riskScore: true, strategicScore: true },
      orderBy: { id: 'asc' }, take: Math.min(pageSize * 4, 1000),
    }) : [];
    const nodes: Node[] = []; const edges: Edge[] = [];
    const want = (t: string) => !type || type === 'all' || type === t;
    if (want('organization')) for (const o of visibleOrganizations) nodes.push({ id: `org:${o.id}`, label: o.displayName || o.name, type: 'organization', organizationId: o.id });
    if (want('person')) for (const p of scopedPeople) { nodes.push({ id: `person:${p.id}`, label: p.displayName || `${p.firstName} ${p.lastName}`.trim(), type: 'person', organizationId: p.organizationId }); if (want('organization')) edges.push({ id: `membership:${p.id}`, source: `person:${p.id}`, target: `org:${p.organizationId}`, kind: 'membership', weight: 60, risk: 0, strategicImportance: 0 }); }
    if (want('project')) for (const p of scopedProjects) { nodes.push({ id: `project:${p.id}`, label: p.name, type: 'project', organizationId: p.organizationId ?? undefined }); if (p.organizationId && want('organization')) edges.push({ id: `project-org:${p.id}`, source: `project:${p.id}`, target: `org:${p.organizationId}`, kind: 'project', weight: 70, risk: 0, strategicImportance: 0 }); }
    if (want('organization')) for (const r of relationships) { const source=`org:${r.sourceOrganizationId}`, target=`org:${r.targetOrganizationId}`; if (nodes.some(n=>n.id===source)&&nodes.some(n=>n.id===target)) edges.push({ id:r.id, source, target, kind:'relationship', weight:Math.max(1,Math.round((r.healthScore+r.trustScore+r.accessScore+r.influenceScore)/4)), risk:r.riskScore, strategicImportance:r.strategicScore, label:r.relationshipType }); }
    if (want('person')) for (const r of personRelationships) { const source=`person:${r.sourcePersonId}`, target=`person:${r.targetPersonId}`; if (nodes.some(n=>n.id===source)&&nodes.some(n=>n.id===target)) edges.push({ id:r.id, source, target, kind:'person_relationship', weight:Math.max(1,Math.round((r.healthScore+r.trustScore+r.accessScore+r.influenceScore)/4)), risk:r.riskScore, strategicImportance:r.strategicScore, label:r.relationshipType }); }
    if (focus) { const focusNode=nodes.find(n=>n.id===focus); if(!focusNode) throw new NotFoundException('Focus node is not visible in your network scope'); const adjacent=new Set([focus]); for(const e of edges) if(e.source===focus||e.target===focus){adjacent.add(e.source);adjacent.add(e.target);} return {nodes:nodes.filter(n=>adjacent.has(n.id)),edges:edges.filter(e=>adjacent.has(e.source)&&adjacent.has(e.target)),meta:{organizationCount:visibleOrganizations.length,peopleCount:scopedPeople.length,projectCount:scopedProjects.length,relationshipCount:relationships.length,personRelationshipCount:personRelationships.length},page:{limit:pageSize,nextCursor:null,bounded:true}}; }
    return { nodes, edges, meta:{organizationCount:visibleOrganizations.length,peopleCount:scopedPeople.length,projectCount:scopedProjects.length,relationshipCount:relationships.length,personRelationshipCount:personRelationships.length}, page:{limit:pageSize,nextCursor:hasNext?pageOrganizations[pageOrganizations.length-1]?.id??null:null,bounded:true} };
  }

  async listPersonRelationships(userId: string, organizationId?: string, status?: string, limit = 100, cursor?: string) {
    const allowed = await this.allowed(userId, organizationId);
    const where: any = { deletedAt: null, ...(status ? { status: this.relationshipStatus(status) } : {}) };
    if (allowed) where.OR = [{ sourceOrganizationId: { in: allowed } }, { targetOrganizationId: { in: allowed } }];
    if (organizationId) where.AND = [{ OR: [{ sourceOrganizationId: organizationId }, { targetOrganizationId: organizationId }] }];
    const take = Math.max(25, Math.min(Number(limit) || 100, 200));
    const rows = await this.prisma.personRelationship.findMany({
      where,
      include: {
        sourcePerson: { select: { id: true, displayName: true, firstName: true, lastName: true, organizationId: true } },
        targetPerson: { select: { id: true, displayName: true, firstName: true, lastName: true, organizationId: true } },
        sourceOrganization: { select: { id: true, name: true } },
        targetOrganization: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { id: 'asc' }, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), take: take + 1,
    });
    const hasNext = rows.length > take;
    return { data: EntityResponseDto.manyUnknown(hasNext ? rows.slice(0, take) : rows), nextCursor: hasNext ? rows[take - 1]?.id ?? null : null, limit: take };
  }

  async createPersonRelationship(userId: string, data: { sourcePersonId: string; targetPersonId: string; relationshipType: string; status?: any; healthScore?: number; strategicScore?: number; riskScore?: number; trustScore?: number; accessScore?: number; influenceScore?: number; opportunityScore?: number; resilienceScore?: number; sensitivity?: any; engagementScore?: number; ownerId?: string; backupOwnerId?: string }) {
    if (!data.sourcePersonId || !data.targetPersonId || data.sourcePersonId === data.targetPersonId) throw new ForbiddenException('A person relationship requires two distinct people');
    const [source, target] = await Promise.all([
      this.prisma.person.findFirst({ where: { id: data.sourcePersonId, deletedAt: null } }),
      this.prisma.person.findFirst({ where: { id: data.targetPersonId, deletedAt: null } }),
    ]);
    if (!source || !target) throw new NotFoundException('Source or target person not found');
    await this.authorization.assertPermission(userId, 'relationship.write', { organizationId: source.organizationId });
    await this.authorization.assertPermission(userId, 'relationship.write', { organizationId: target.organizationId });
    const relationshipType = await this.prisma.relationshipType.findUnique({ where: { key: data.relationshipType.trim() } });
    if (!relationshipType || !relationshipType.isActive) throw new ForbiddenException('Unknown or inactive relationship type');
    const duplicate = await this.prisma.personRelationship.findFirst({ where: { sourcePersonId: source.id, targetPersonId: target.id, relationshipType: relationshipType.key, deletedAt: null } });
    if (duplicate) throw new ForbiddenException('This person relationship already exists');
    const created = await this.prisma.personRelationship.create({ data: {
      ...data, relationshipType: relationshipType.key, relationshipTypeId: relationshipType.id,
      sourceOrganizationId: source.organizationId, targetOrganizationId: target.organizationId,
      ownerId: data.ownerId ?? userId,
    } });
    await this.audit.logMutation({ userId, action: 'CREATE', entityType: 'PersonRelationship', entityId: created.id, organizationId: source.organizationId, after: created });
    return EntityResponseDto.fromUnknown(created);
  }

  async updatePersonRelationship(userId: string, id: string, data: Record<string, unknown>) {
    const existing = await this.prisma.personRelationship.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Person relationship not found');
    await this.authorization.assertPermission(userId, 'relationship.write', { organizationId: existing.sourceOrganizationId });
    await this.authorization.assertPermission(userId, 'relationship.write', { organizationId: existing.targetOrganizationId });
    if (data.sourcePersonId || data.targetPersonId) throw new ForbiddenException('Changing relationship endpoints requires archive and recreate');
    const nextType = typeof data.relationshipType === 'string' ? await this.prisma.relationshipType.findUnique({ where: { key: String(data.relationshipType).trim() } }) : null;
    if (typeof data.relationshipType === 'string' && (!nextType || !nextType.isActive)) throw new ForbiddenException('Unknown or inactive relationship type');
    const updated = await this.prisma.personRelationship.update({ where: { id }, data: { ...data, ...(nextType ? { relationshipType: nextType.key, relationshipTypeId: nextType.id } : {}) } });
    await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'PersonRelationship', entityId: id, organizationId: existing.sourceOrganizationId, before: existing, after: updated });
    return EntityResponseDto.fromUnknown(updated);
  }

  async archivePersonRelationship(userId: string, id: string) {
    const existing = await this.prisma.personRelationship.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Person relationship not found');
    await this.authorization.assertPermission(userId, 'relationship.write', { organizationId: existing.sourceOrganizationId });
    await this.authorization.assertPermission(userId, 'relationship.write', { organizationId: existing.targetOrganizationId });
    const archived = await this.lifecycle.softDelete(userId, 'PersonRelationship', id, 'archive');
    return EntityResponseDto.fromUnknown(archived);
  }

  private async graphForPath(userId: string, organizationId?: string) { return this.graph(userId, organizationId, 'organization', undefined, undefined, undefined, 500); }

  async path(userId: string, from: string, to: string, organizationId?: string, mode: 'shortest'|'best' = 'shortest') {
    if (!from || !to) throw new ForbiddenException('from and to are required');
    const allowed = await this.allowed(userId, organizationId);
    const fromId = from.startsWith('org:') ? from.slice(4) : from;
    const toId = to.startsWith('org:') ? to.slice(4) : to;
    if (allowed && (!allowed.includes(fromId) || !allowed.includes(toId))) throw new NotFoundException('Path endpoint is not visible in your network scope');
    const maxHops = Math.max(1, Math.min(Number(process.env.NETWORK_MAX_PATH_HOPS || 8), 12));
    const maxFrontier = Math.max(50, Math.min(Number(process.env.NETWORK_PATH_FRONTIER || 250), 500));
    const scopeIds = allowed;
    if (scopeIds && (!scopeIds.includes(fromId) || !scopeIds.includes(toId))) throw new NotFoundException('Path endpoint is not visible in your network scope');
    const endpointWhere = scopeIds ? { sourceOrganizationId: { in: scopeIds }, targetOrganizationId: { in: scopeIds } } : {};
    const visited = new Set<string>([fromId]);
    const previous = new Map<string, { node: string; edge: RelationshipEdge }>();
    let frontier = [fromId];
    for (let depth = 0; depth < maxHops && frontier.length; depth++) {
      const rows = await this.prisma.relationship.findMany({
        where: { deletedAt: null, ...endpointWhere, OR: [{ sourceOrganizationId: { in: frontier } }, { targetOrganizationId: { in: frontier } }] },
        select: { id:true, sourceOrganizationId:true, targetOrganizationId:true, relationshipType:true, healthScore:true, trustScore:true, accessScore:true, influenceScore:true, riskScore:true, strategicScore:true },
        orderBy: [{ healthScore:'desc' }, { id:'asc' }],
        take: Math.min(maxFrontier * 20, 5000),
      });
      const next = new Set<string>();
      for (const edge of rows as RelationshipEdge[]) {
        const pairs = [[edge.sourceOrganizationId, edge.targetOrganizationId],[edge.targetOrganizationId, edge.sourceOrganizationId]] as const;
        for (const [node, neighbor] of pairs) {
          if (!frontier.includes(node) || visited.has(neighbor)) continue;
          visited.add(neighbor); previous.set(neighbor,{node,edge}); next.add(neighbor);
          if (neighbor === toId) { next.clear(); break; }
          if (next.size >= maxFrontier) break;
        }
        if (previous.has(toId) || next.size >= maxFrontier) break;
      }
      if (previous.has(toId)) break;
      frontier=[...next];
    }
    if (!previous.has(toId) && fromId !== toId) return { found:false, mode, nodes:[], edges:[], totalCost:null, bounded:true, maxHops };
    const edgePath: RelationshipEdge[]=[]; const nodePath:string[]=[toId]; let cur=toId;
    while(cur!==fromId){const p=previous.get(cur); if(!p) break; edgePath.unshift(p.edge); cur=p.node; nodePath.unshift(cur);}
    const ids=[...new Set(nodePath)];
    const orgs=await this.prisma.organization.findMany({where:{id:{in:ids},deletedAt:null},select:{id:true,name:true,displayName:true}});
    const nodeMap=new Map(orgs.map(o=>[o.id,{id:`org:${o.id}`,label:o.displayName||o.name,type:'organization' as const,organizationId:o.id}]));
    return {found:true,mode,nodes:nodePath.map(id=>nodeMap.get(id)).filter(Boolean),edges:edgePath.map(e=>({id:e.id,source:`org:${e.sourceOrganizationId}`,target:`org:${e.targetOrganizationId}`,kind:'relationship',weight:Math.max(1,Math.round((e.healthScore+e.trustScore+e.accessScore+e.influenceScore)/4)),risk:e.riskScore,strategicImportance:e.strategicScore,label:e.relationshipType})),hops:edgePath.length,totalCost:edgePath.reduce((sum,e)=>sum+(mode==='shortest'?1:Math.max(1,101-Math.min(100,Math.max(1,Math.round((e.healthScore+e.trustScore+e.accessScore+e.influenceScore)/4)))+e.riskScore*.5)),0),bounded:true,maxHops};
  }

  async connectors(userId: string, organizationId?: string, limit = 10) {
    const graph = await this.graph(userId, organizationId);
    const people = graph.nodes.filter(n => n.type === 'person');
    const scored = await Promise.all(people.map(async n => {
      const personId = n.id.startsWith('person:') ? n.id.slice('person:'.length) : n.id;
      return { node: n, canonical: await this.connectorScore.calculate(userId, personId, false) };
    }));
    return scored.map(x => ({ node: x.node, connectorScore: x.canonical.score, scoreVersion: x.canonical.version, factors: x.canonical.factors }))
      .sort((a,b) => b.connectorScore - a.connectorScore).slice(0, Math.max(1, Math.min(100, limit)));
  }

  async centrality(userId: string, organizationId?: string, limit = 20) {
    const graph = await this.graph(userId, organizationId);
    const degree = new Map<string, number>(); for (const n of graph.nodes) degree.set(n.id, 0);
    for (const e of graph.edges) { degree.set(e.source, (degree.get(e.source) ?? 0) + 1); degree.set(e.target, (degree.get(e.target) ?? 0) + 1); }
    return graph.nodes.map(node => ({ node, degree: degree.get(node.id) ?? 0 })).sort((a,b) => b.degree - a.degree).slice(0, Math.max(1, Math.min(100, limit)));
  }

  async bridgePeople(userId: string, organizationId?: string, limit = 20) {
    const graph = await this.graph(userId, organizationId);
    const personEdges = graph.edges.filter(e => e.kind === 'membership');
    const orgAdj = new Map<string, Set<string>>(); for (const n of graph.nodes.filter(n => n.type === 'organization')) orgAdj.set(n.id, new Set());
    for (const e of graph.edges.filter(e => e.kind === 'relationship')) { orgAdj.get(e.source)?.add(e.target); orgAdj.get(e.target)?.add(e.source); }
    const results = graph.nodes.filter(n => n.type === 'person').map(person => {
      const org = personEdges.find(e => e.source === person.id || e.target === person.id);
      const orgId = org?.source === person.id ? org.target : org?.source;
      const reach = orgId ? (orgAdj.get(orgId)?.size ?? 0) : 0;
      return { node: person, bridgeScore: reach };
    }).sort((a,b) => b.bridgeScore - a.bridgeScore);
    return results.slice(0, Math.max(1, Math.min(100, limit)));
  }

  async bottlenecks(userId: string, organizationId?: string, limit = 20) {
    const graph = await this.graph(userId, organizationId);
    const adjacency = new Map<string, Set<string>>(); for (const n of graph.nodes) adjacency.set(n.id, new Set());
    for (const e of graph.edges) { adjacency.get(e.source)?.add(e.target); adjacency.get(e.target)?.add(e.source); }
    const results = graph.nodes.map(node => {
      const neighbors = adjacency.get(node.id)?.size ?? 0;
      const risky = graph.edges.filter(e => (e.source === node.id || e.target === node.id) && e.risk >= 60).length;
      return { node, bottleneckScore: neighbors + risky * 2, riskyConnections: risky };
    }).sort((a,b) => b.bottleneckScore - a.bottleneckScore);
    return results.slice(0, Math.max(1, Math.min(100, limit)));
  }

  async singlePointsOfFailure(userId: string, organizationId?: string, limit = 20) {
    const graph = await this.graph(userId, organizationId);
    const baseline = this.componentCount(graph.nodes.map(n => n.id), graph.edges);
    const results = graph.nodes.map(node => {
      const remaining = graph.nodes.filter(n => n.id !== node.id).map(n => n.id);
      const edges = graph.edges.filter(e => e.source !== node.id && e.target !== node.id);
      const componentsAfter = this.componentCount(remaining, edges);
      return { node, fragmentationIncrease: Math.max(0, componentsAfter - baseline) };
    }).filter(x => x.fragmentationIncrease > 0).sort((a,b) => b.fragmentationIncrease - a.fragmentationIncrease);
    return results.slice(0, Math.max(1, Math.min(100, limit)));
  }

  private componentCount(nodeIds: string[], edges: Edge[]) {
    const set = new Set(nodeIds); const adjacency = new Map<string, string[]>(); for (const id of nodeIds) adjacency.set(id, []);
    for (const e of edges) { if (set.has(e.source) && set.has(e.target)) { adjacency.get(e.source)!.push(e.target); adjacency.get(e.target)!.push(e.source); } }
    const seen = new Set<string>(); let count = 0;
    for (const id of nodeIds) if (!seen.has(id)) { count++; const stack = [id]; seen.add(id); while (stack.length) { const cur = stack.pop()!; for (const next of adjacency.get(cur) ?? []) if (!seen.has(next)) { seen.add(next); stack.push(next); } } }
    return count;
  }
}
