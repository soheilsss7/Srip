import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

export type SearchResult = { type: string; id: string; title: string; subtitle?: string; score: number; organizationId?: string | null };

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService) {}

  private score(q: string, ...parts: Array<string | null | undefined>) {
    const needle = q.trim().toLowerCase(); if (!needle) return 0;
    const text = parts.filter(Boolean).join(' ').toLowerCase();
    if (!text) return 0;
    let s = text === needle ? 100 : text.startsWith(needle) ? 90 : text.includes(needle) ? 70 : 0;
    if (!s) { const compact = text.replace(/[^a-z0-9\p{L}\p{N}]/gu,''); const qcompact=needle.replace(/[^a-z0-9\p{L}\p{N}]/gu,''); if(qcompact.length>=4){ let best=0; for(let i=0;i<=Math.max(0,compact.length-qcompact.length);i++){let d=0; for(let j=0;j<qcompact.length;j++) if(compact[i+j]!==qcompact[j]) d++; best=Math.max(best,Math.round((1-d/qcompact.length)*60));} s=best; }}
    for (const token of needle.split(/\s+/)) if (text.includes(token)) s += 10;
    return Math.min(s, 100);
  }

  private async ftsIds(table: string, q: string, organizationId?: string, organizationIds?: string[] | null): Promise<string[]> {
    if (!q.trim()) return [];
    const scopedIds = organizationId ? [organizationId] : (organizationIds ?? null);
    const org = scopedIds ? Prisma.sql` AND "organizationId" = ANY(${scopedIds}::text[])` : Prisma.empty;
    const rel = scopedIds ? Prisma.sql` AND ("sourceOrganizationId" = ANY(${scopedIds}::text[]) OR "targetOrganizationId" = ANY(${scopedIds}::text[]))` : Prisma.empty;
    const orgExpr = Prisma.sql`to_tsvector('simple', coalesce("name",'') || ' ' || coalesce("legalName",'') || ' ' || coalesce("englishName",'') || ' ' || coalesce("displayName",''))`;
    const queries: Record<string, any> = {
      Organization: this.prisma.$queryRaw`SELECT id FROM "Organization" WHERE "deletedAt" IS NULL ${scopedIds ? Prisma.sql`AND "id" = ANY(${scopedIds}::text[])` : Prisma.empty} AND ${orgExpr} @@ plainto_tsquery('simple', ${q}) ORDER BY "id" LIMIT 100`,
      Person: this.prisma.$queryRaw`SELECT id FROM "Person" WHERE "deletedAt" IS NULL ${org} AND to_tsvector('simple', coalesce("firstName",'') || ' ' || coalesce("lastName",'') || ' ' || coalesce("email",'')) @@ plainto_tsquery('simple', ${q}) ORDER BY "id" LIMIT 100`,
      Relationship: this.prisma.$queryRaw`SELECT id FROM "Relationship" WHERE "deletedAt" IS NULL ${rel} AND to_tsvector('simple', coalesce("relationshipType",'') || ' ' || coalesce("status",'')) @@ plainto_tsquery('simple', ${q}) ORDER BY "id" LIMIT 100`,
      Meeting: this.prisma.$queryRaw`SELECT id FROM "Meeting" WHERE "deletedAt" IS NULL ${org} AND to_tsvector('simple', coalesce("title",'') || ' ' || coalesce("objective",'') || ' ' || coalesce("agenda",'') || ' ' || coalesce("notes",'') || ' ' || coalesce("outcome",'') || ' ' || coalesce("transcript",'')) @@ plainto_tsquery('simple', ${q}) ORDER BY "id" LIMIT 100`,
      Interaction: this.prisma.$queryRaw`SELECT id FROM "Interaction" WHERE "deletedAt" IS NULL ${org} AND to_tsvector('simple', coalesce("subject",'') || ' ' || coalesce("summary",'') || ' ' || coalesce("outcome",'')) @@ plainto_tsquery('simple', ${q}) ORDER BY "id" LIMIT 100`,
      Project: this.prisma.$queryRaw`SELECT id FROM "Project" WHERE "deletedAt" IS NULL ${org} AND to_tsvector('simple', coalesce("name",'') || ' ' || coalesce("description",'') || ' ' || coalesce("objective",'')) @@ plainto_tsquery('simple', ${q}) ORDER BY "id" LIMIT 100`,
      Opportunity: this.prisma.$queryRaw`SELECT id FROM "Opportunity" WHERE "deletedAt" IS NULL ${org} AND to_tsvector('simple', coalesce("name",'') || ' ' || coalesce("description",'') || ' ' || coalesce("status",'')) @@ plainto_tsquery('simple', ${q}) ORDER BY "id" LIMIT 100`,
      Document: this.prisma.$queryRaw`SELECT id FROM "Document" WHERE "deletedAt" IS NULL ${org} AND to_tsvector('simple', coalesce("name",'') || ' ' || coalesce("mimeType",'') || ' ' || coalesce("storageKey",'')) @@ plainto_tsquery('simple', ${q}) ORDER BY "id" LIMIT 100`,
      Note: this.prisma.$queryRaw`SELECT id FROM "Note" WHERE "deletedAt" IS NULL ${org} AND to_tsvector('simple', coalesce("title",'') || ' ' || coalesce("body",'')) @@ plainto_tsquery('simple', ${q}) ORDER BY "id" LIMIT 100`,
    };
    if (!(table in queries)) throw new Error(`Unsupported search table: ${table}`);
    const rows = await queries[table] as Array<{id:string}>;
    return rows.map(r => r.id);
  }



  async all(userId: string, q: string, limit = 20, filters: any = {}) {
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    const orgIds = ids ?? undefined;
    const organizationId = filters.organizationId;
    if (organizationId) await this.authorization.assertAnyOrganizationAccess(userId, [organizationId]);
    const take = Math.max(1, Math.min(limit, 100)); // bounded fan-out: 9 entity types × 2×take, never whole-table materialization
    const commonOrg = organizationId ? [organizationId] : orgIds;
    const results: SearchResult[] = [];
    const fts = q.trim() ? await Promise.all([
      this.ftsIds('Organization',q,organizationId,orgIds),
      this.ftsIds('Person',q,organizationId,orgIds),
      this.ftsIds('Relationship',q,organizationId,orgIds),
      this.ftsIds('Meeting',q,organizationId,orgIds),
      this.ftsIds('Interaction',q,organizationId,orgIds),
      this.ftsIds('Project',q,organizationId,orgIds),
      this.ftsIds('Opportunity',q,organizationId,orgIds),
      this.ftsIds('Document',q,organizationId,orgIds),
      this.ftsIds('Note',q,organizationId,orgIds),
    ]) : [[],[],[],[],[],[],[],[],[]];
    const [organizationIds, personIds, relationshipIds, meetingIds, interactionIds, projectIds, opportunityIds, documentIds, noteIds] = fts;
    const [organizations, people, relationships, meetings, interactions, projects, opportunities, documents, notes] = await Promise.all([
      this.prisma.organization.findMany({ where: { deletedAt: null, ...(commonOrg ? { id: { in: commonOrg } } : {}), ...(q ? { id: { in: organizationIds } } : {}), ...(filters.status ? { status: filters.status } : {}) }, take: take * 2 }),
      this.prisma.person.findMany({ where: { deletedAt: null, ...(commonOrg ? { organizationId: { in: commonOrg } } : {}), ...(q ? { id: { in: personIds } } : {}), ...(filters.status ? { status: filters.status } : {}) }, take: take * 2 }),
      this.prisma.relationship.findMany({ where: { deletedAt: null, ...(commonOrg ? { OR: [{ sourceOrganizationId: { in: commonOrg } }, { targetOrganizationId: { in: commonOrg } }] } : {}), ...(q ? { id: { in: relationshipIds } } : {}), ...(filters.status ? { status: filters.status } : {}) }, take: take * 2 }),
      this.prisma.meeting.findMany({ where: { deletedAt: null, ...(commonOrg ? { organizationId: { in: commonOrg } } : {}), ...(q ? { id: { in: meetingIds } } : {}) }, take: take * 2 }),
      this.prisma.interaction.findMany({ where: { deletedAt: null, ...(commonOrg ? { organizationId: { in: commonOrg } } : {}), ...(q ? { id: { in: interactionIds } } : {}) }, take: take * 2 }),
      this.prisma.project.findMany({ where: { deletedAt: null, ...(commonOrg ? { organizationId: { in: commonOrg } } : {}), ...(q ? { id: { in: projectIds } } : {}), ...(filters.status ? { status: filters.status } : {}) }, take: take * 2 }),
      this.prisma.opportunity.findMany({ where: { deletedAt: null, ...(commonOrg ? { organizationId: { in: commonOrg } } : {}), ...(q ? { id: { in: opportunityIds } } : {}), ...(filters.status ? { status: filters.status } : {}) }, take: take * 2 }),
      this.prisma.document.findMany({ where: { deletedAt: null, ...(commonOrg ? { organizationId: { in: commonOrg } } : {}), ...(q ? { id: { in: documentIds } } : {}) }, take: take * 2 }),
      this.prisma.note.findMany({ where: { deletedAt: null, ...(commonOrg ? { organizationId: { in: commonOrg } } : {}), ...(q ? { id: { in: noteIds } } : {}) }, take: take * 2 }),
    ]);
    const matches = <T extends { id: string }>(type: string, rows: T[], mapper: (row: T) => [string, string | undefined, string | null | undefined, string | null | undefined]) => {
      for (const row of rows) { const [title, subtitle, org, extra] = mapper(row); const score = this.score(q, title, subtitle, extra); if (!q || score > 0) results.push({ type, id: row.id, title, subtitle, score, organizationId: org }); }
    };
    matches('organization', organizations, r => [r.name, (r as any).legalName, r.id, (r as any).displayName]);
    matches('person', people, r => [`${(r as any).firstName} ${(r as any).lastName}`, (r as any).title, (r as any).organizationId, (r as any).email]);
    matches('relationship', relationships, r => [(r as any).relationshipType, (r as any).status, (r as any).sourceOrganizationId, (r as any).targetOrganizationId]);
    matches('meeting', meetings, r => [(r as any).title, (r as any).objective, (r as any).organizationId, (r as any).notes]);
    matches('interaction', interactions, r => [(r as any).subject, (r as any).summary, (r as any).organizationId, (r as any).outcome]);
    matches('project', projects, r => [(r as any).name, (r as any).description, (r as any).organizationId, (r as any).objective]);
    matches('opportunity', opportunities, r => [(r as any).name, (r as any).description, (r as any).organizationId, (r as any).relationshipId]);
    matches('document', documents, r => [(r as any).name, (r as any).mimeType, (r as any).organizationId, (r as any).storageKey]);
    matches('note', notes, r => [(r as any).title || 'Note', (r as any).body, (r as any).organizationId, (r as any).personId]);
    const typeFilter = filters.type ? new Set(String(filters.type).split(',')) : null;
    const sorted = results.filter(r => !typeFilter || typeFilter.has(r.type)).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    await this.prisma.analyticsEvent.create({ data: { userId, type: 'SEARCH_EXECUTED', feature: 'global_search', metadata: { queryLength: q.length, resultCount: Math.min(sorted.length, take) } } }).catch(() => undefined);
    return { q, filters, total: sorted.length, results: sorted.slice(0, take) };
  }
  async saved(userId:string){return EntityResponseDto.manyUnknown(await this.prisma.savedSearch.findMany({where:{userId},orderBy:{updatedAt:'desc'},take:200}))}
  async createSaved(userId:string,b:any){return EntityResponseDto.fromUnknown(await this.prisma.savedSearch.create({data:{userId,name:b.name,query:b.query||'',filters:b.filters||{}}}))}
  async updateSaved(userId:string,id:string,b:any){const found=await this.prisma.savedSearch.findFirst({where:{id,userId}});if(!found)throw new NotFoundException('Saved search not found');return EntityResponseDto.fromUnknown(await this.prisma.savedSearch.update({where:{id},data:{name:b.name,query:b.query,filters:b.filters,enabled:b.enabled}}))}
  async deleteSaved(userId:string,id:string){const found=await this.prisma.savedSearch.findFirst({where:{id,userId}});if(!found)throw new NotFoundException('Saved search not found');await this.prisma.savedSearch.delete({where:{id}});return {deleted:true,id}}
  async runSaved(userId:string,id:string,limit=20){const found=await this.prisma.savedSearch.findFirst({where:{id,userId,enabled:true}});if(!found)throw new NotFoundException('Saved search not found');await this.prisma.savedSearch.update({where:{id},data:{lastUsedAt:new Date()}});return this.all(userId,found.query,limit,found.filters||{})}

  /**
   * نگهداری واقعی ایندکس جست‌وجو. چون این پروژه از PostgreSQL Full Text
   * Search محاسبه‌شده در زمان Query استفاده می‌کند (نه یک جدول ایندکس مجزا)،
   * «Reindex» در این معماری معادل به‌روزرسانی آمار Query Planner برای
   * جدول‌های قابل‌جست‌وجو است تا PostgreSQL بهترین Plan را برای
   * to_tsvector/plainto_tsquery انتخاب کند. این یک عملیات واقعی و بی‌خطر
   * دیتابیسی است، نه یک Placeholder.
   */
  private static readonly SEARCHABLE_TABLES = ['Organization', 'Person', 'Relationship', 'Meeting', 'Interaction', 'Project', 'Opportunity', 'Document', 'Note'] as const;

  async reindex() {
    const analyzed: string[] = [];
    const errors: Array<{ table: string; error: string }> = [];
    for (const table of SearchService.SEARCHABLE_TABLES) {
      try {
        const identifier = Prisma.raw(`"${table}"`);
        await this.prisma.$executeRaw(Prisma.sql`ANALYZE ${identifier}`);
        analyzed.push(table);
      } catch (error: any) {
        errors.push({ table, error: error?.message ?? String(error) });
      }
    }
    return { analyzedTables: analyzed, errors, completedAt: new Date().toISOString() };
  }
}
