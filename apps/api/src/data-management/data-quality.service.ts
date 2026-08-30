import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const configuredMaxIds = Number(process.env.DATA_QUALITY_MAX_IDS ?? 500);
const MAX_IDS = Number.isFinite(configuredMaxIds) ? Math.max(100, Math.min(1000, Math.trunc(configuredMaxIds))) : 500;
const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();

@Injectable()
export class DataQualityService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthorizationService, private readonly audit: AuditService) {}

  private async scope(userId: string, organizationId?: string): Promise<{ organizationIds: string[] | null }> {
    await this.auth.assertPermission(userId, 'data.quality.read', { organizationId });
    const ids = await this.auth.accessibleOrganizationIds(userId);
    // Super-admin scope is intentionally represented as null. Materializing every
    // organization id just to rebuild an IN(...) filter would defeat bounded-query
    // behavior at enterprise scale. Individual queries can omit the scope predicate.
    if (organizationId) {
      if (ids && !ids.includes(organizationId)) throw new ForbiddenException('Organization outside scope');
      return { organizationIds: [organizationId] };
    }
    return { organizationIds: ids };
  }

  private cap<T>(values: T[]) { return { values: values.slice(0, MAX_IDS), truncated: values.length > MAX_IDS, total: values.length }; }

  private async duplicateOrganizations(organizationIds: string[] | null) {
    const base: any = { deletedAt: null, ...(organizationIds ? { id: { in: organizationIds } } : {}) };
    const fields = [
      ['name', 'name', 'name'],
      ['registrationId', 'registration_id', 'registrationId'],
      ['phone', 'phone', 'phone'],
      ['website', 'domain', 'website'],
    ] as const;
    const out = new Map<string, { ids: string[]; reasons: string[] }>();
    for (const [field, reason, column] of fields) {
      const col = Prisma.raw(`\"${column}\"`);
      const normalized = organizationIds
        ? await this.prisma.$queryRaw<Array<{ value: string; ids: string[]; count: number }>>(Prisma.sql`WITH normalized AS (SELECT \"id\", LOWER(TRIM(${col})) AS value FROM \"Organization\" WHERE \"deletedAt\" IS NULL AND \"id\" IN (${Prisma.join(organizationIds)}) AND ${col} IS NOT NULL AND TRIM(${col}) <> ''), ranked AS (SELECT \"id\", value, COUNT(*) OVER (PARTITION BY value)::int AS count, ROW_NUMBER() OVER (PARTITION BY value ORDER BY \"id\") AS rn FROM normalized) SELECT value, ARRAY_AGG(\"id\" ORDER BY \"id\") AS ids, MAX(count)::int AS count FROM ranked WHERE count > 1 AND rn <= 20 GROUP BY value ORDER BY MAX(count) DESC LIMIT ${MAX_IDS}`)
        : await this.prisma.$queryRaw<Array<{ value: string; ids: string[]; count: number }>>(Prisma.sql`WITH normalized AS (SELECT \"id\", LOWER(TRIM(${col})) AS value FROM \"Organization\" WHERE \"deletedAt\" IS NULL AND ${col} IS NOT NULL AND TRIM(${col}) <> ''), ranked AS (SELECT \"id\", value, COUNT(*) OVER (PARTITION BY value)::int AS count, ROW_NUMBER() OVER (PARTITION BY value ORDER BY \"id\") AS rn FROM normalized) SELECT value, ARRAY_AGG(\"id\" ORDER BY \"id\") AS ids, MAX(count)::int AS count FROM ranked WHERE count > 1 AND rn <= 20 GROUP BY value ORDER BY MAX(count) DESC LIMIT ${MAX_IDS}`);
      const groups = normalized;
      for (const group of groups) {
        const ids = (group.ids ?? []).filter(Boolean).slice(0, 20);
        if (ids.length < 2) continue;
        const key = ids.slice().sort().join('|');
        const current = out.get(key) ?? { ids, reasons: [] };
        if (!current.reasons.includes(reason)) current.reasons.push(reason);
        out.set(key, current);
      }
      if (out.size >= MAX_IDS) break;
    }
    return [...out.values()].slice(0, MAX_IDS);
  }


  async execute(userId: string, organizationId?: string) {
    await this.auth.assertPermission(userId, 'data.quality.execute', { organizationId });
    const { organizationIds } = await this.scope(userId, organizationId);
    if (organizationIds && !organizationIds.length) return this.createSnapshot(userId, organizationId, this.emptyMetrics());

    const orgWhere: any = { deletedAt: null, ...(organizationIds ? { id: { in: organizationIds } } : {}) };
    const personWhere: any = { deletedAt: null, ...(organizationIds ? { organizationId: { in: organizationIds } } : {}) };
    const relationshipWhere: any = { deletedAt: null, ...(organizationIds ? { OR: [{ sourceOrganizationId: { in: organizationIds } }, { targetOrganizationId: { in: organizationIds } }] } : {}) };
    const interactionWhere: any = { deletedAt: null, ...(organizationIds ? { organizationId: { in: organizationIds } } : {}) };
    const meetingWhere: any = { deletedAt: null, ...(organizationIds ? { organizationId: { in: organizationIds } } : {}) };
    const actionWhere: any = { deletedAt: null, ...(organizationIds ? { organizationId: { in: organizationIds } } : {}) };

    const [organizationCount, personCount, relationshipCount, organizations, people, relationships, interactions, meetings, actions, duplicateOrganizations,
      missingOwners, missingOwnerCount, missingOrgContacts, missingOrgContactsCount, missingPersonContacts, missingPersonContactsCount,
      staleRelationships, staleRelationshipCount, invalidOrgEmails, invalidPersonEmails, invalidOrgEmailCount, invalidPersonEmailCount,
      missingReviewDates, missingReviewDateCount, missingMeetingDates, missingMeetingDateCount, missingActionDates, missingActionDateCount,
      incompleteOrganizationCount, incompletePersonCount] = await Promise.all([
      this.prisma.organization.count({ where: orgWhere }),
      this.prisma.person.count({ where: personWhere }),
      this.prisma.relationship.count({ where: relationshipWhere }),
      this.prisma.organization.findMany({ where: orgWhere, select: { id: true, name: true, email: true, phone: true, website: true, country: true, ownerId: true }, take: MAX_IDS }),
      this.prisma.person.findMany({ where: personWhere, select: { id: true, firstName: true, lastName: true, email: true, phone: true, title: true }, take: MAX_IDS }),
      this.prisma.relationship.findMany({ where: relationshipWhere, select: { id: true, lastInteractionAt: true, nextReviewAt: true, reviewCadenceDays: true }, take: MAX_IDS }),
      this.prisma.interaction.count({ where: interactionWhere }),
      this.prisma.meeting.count({ where: meetingWhere }),
      this.prisma.action.count({ where: actionWhere }),
      this.duplicateOrganizations(organizationIds),
      this.prisma.organization.findMany({ where: { ...orgWhere, ownerId: null }, select: { id: true, name: true }, take: MAX_IDS }),
      this.prisma.organization.count({ where: { ...orgWhere, ownerId: null } }),
      this.prisma.organization.findMany({ where: { ...orgWhere, contacts: { none: {} } }, select: { id: true, name: true }, take: MAX_IDS }),
      this.prisma.organization.count({ where: { ...orgWhere, contacts: { none: {} } } }),
      this.prisma.person.findMany({ where: { ...personWhere, contacts: { none: {} } }, select: { id: true, firstName: true, lastName: true, displayName: true }, take: MAX_IDS }),
      this.prisma.person.count({ where: { ...personWhere, contacts: { none: {} } } }),
      this.prisma.relationship.findMany({ where: { deletedAt: null, ...(organizationIds ? { AND: [{ OR: [{ sourceOrganizationId: { in: organizationIds } }, { targetOrganizationId: { in: organizationIds } }] }, { OR: [{ lastInteractionAt: null }, { nextReviewAt: { lt: new Date() } }] }] } : { OR: [{ lastInteractionAt: null }, { nextReviewAt: { lt: new Date() } }] }) }, select: { id: true, lastInteractionAt: true, nextReviewAt: true, reviewCadenceDays: true, sourceOrganization: { select: { id: true, name: true } }, targetOrganization: { select: { id: true, name: true } } }, take: MAX_IDS }),
      this.prisma.relationship.count({ where: { deletedAt: null, ...(organizationIds ? { AND: [{ OR: [{ sourceOrganizationId: { in: organizationIds } }, { targetOrganizationId: { in: organizationIds } }] }, { OR: [{ lastInteractionAt: null }, { nextReviewAt: { lt: new Date() } }] }] } : { OR: [{ lastInteractionAt: null }, { nextReviewAt: { lt: new Date() } }] }) } }),
      this.prisma.organization.findMany({ where: { ...orgWhere, email: { not: null } }, select: { id: true, name: true, email: true }, take: MAX_IDS }),
      this.prisma.person.findMany({ where: { ...personWhere, email: { not: null } }, select: { id: true, firstName: true, lastName: true, displayName: true, email: true }, take: MAX_IDS }),
      this.prisma.$queryRaw<Array<{count:number}>>(organizationIds ? Prisma.sql`SELECT COUNT(*)::int AS count FROM "Organization" WHERE "deletedAt" IS NULL AND "id" IN (${Prisma.join(organizationIds)}) AND "email" IS NOT NULL AND "email" !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'` : Prisma.sql`SELECT COUNT(*)::int AS count FROM "Organization" WHERE "deletedAt" IS NULL AND "email" IS NOT NULL AND "email" !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'`),
      this.prisma.$queryRaw<Array<{count:number}>>(organizationIds ? Prisma.sql`SELECT COUNT(*)::int AS count FROM "Person" WHERE "deletedAt" IS NULL AND "organizationId" IN (${Prisma.join(organizationIds)}) AND "email" IS NOT NULL AND "email" !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'` : Prisma.sql`SELECT COUNT(*)::int AS count FROM "Person" WHERE "deletedAt" IS NULL AND "email" IS NOT NULL AND "email" !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'`),
      this.prisma.relationship.findMany({ where: { ...relationshipWhere, nextReviewAt: null }, select: { id: true, sourceOrganization: { select: { id: true, name: true } }, targetOrganization: { select: { id: true, name: true } } }, take: MAX_IDS }),
      this.prisma.relationship.count({ where: { ...relationshipWhere, nextReviewAt: null } }),
      this.prisma.meeting.findMany({ where: { ...meetingWhere, startAt: null }, select: { id: true, title: true }, take: MAX_IDS }),
      this.prisma.meeting.count({ where: { ...meetingWhere, startAt: null } }),
      this.prisma.action.findMany({ where: { ...actionWhere, dueAt: null }, select: { id: true, title: true, organizationId: true, personId: true }, take: MAX_IDS }),
      this.prisma.action.count({ where: { ...actionWhere, dueAt: null } }),
      this.prisma.organization.count({ where: { ...orgWhere, OR: [{ name: null }, { country: null }, { website: null }, { phone: null }, { email: null }] } }),
      this.prisma.person.count({ where: { ...personWhere, OR: [{ firstName: '' }, { lastName: '' }, { title: null }, { email: null }, { phone: null }] } }),
    ]);

    const orgWithContacts = new Set(missingOrgContacts.map(x => x.id).filter(Boolean) as string[]);
    const personWithContacts = new Set(missingPersonContacts.map(x => x.id).filter(Boolean) as string[]);
    const invalidEmails = [
      ...invalidOrgEmails.filter(x => x.email && !EMAIL.test(x.email)).map(x => ({ entityType: 'Organization', id: x.id, name: x.name, field: 'email' })),
      ...invalidPersonEmails.filter(x => x.email && !EMAIL.test(x.email)).map(x => ({ entityType: 'Person', id: x.id, name: x.displayName || `${x.firstName} ${x.lastName}`, field: 'email' })),
    ];
    const stale = staleRelationships.map(r => ({ id: r.id, sourceOrganization: r.sourceOrganization, targetOrganization: r.targetOrganization, lastInteractionAt: r.lastInteractionAt, nextReviewAt: r.nextReviewAt, reviewCadenceDays: r.reviewCadenceDays }));
    const missingDates = {
      relationships: missingReviewDates.map(x => ({ id: x.id, sourceOrganization: x.sourceOrganization, targetOrganization: x.targetOrganization })),
      meetings: missingMeetingDates.map(x => ({ id: x.id, title: x.title })),
      actions: missingActionDates.map(x => ({ id: x.id, title: x.title })),
    };
    const incomplete = {
      organizations: organizations.filter(x => !x.name || !x.country || !x.website || !x.phone || !x.email).map(x => x.id),
      people: people.filter(x => !x.firstName || !x.lastName || !x.title || !x.email || !x.phone).map(x => x.id),
    };
    const missingContacts = {
      organizations: organizations.filter(x => !orgWithContacts.has(x.id)).map(x => x.id),
      people: people.filter(x => !personWithContacts.has(x.id)).map(x => x.id),
    };
    const metrics = {
      generatedAt: new Date().toISOString(),
      checks: ['Duplicate Organizations','Missing Owners','Missing Contacts','Stale Relationships','Invalid Emails','Missing Organizations','Missing Dates','Incomplete Profiles'],
      duplicateOrganizations,
      missingOwners: { values: missingOwners.map(x => ({ id: x.id, name: x.name })), truncated: missingOwnerCount > MAX_IDS, total: missingOwnerCount },
      missingContacts: {
        organizations: { values: missingOrgContacts.map(x => ({ id: x.id, name: x.name })), truncated: missingOrgContactsCount > MAX_IDS, total: missingOrgContactsCount },
        people: { values: missingPersonContacts.map(x => ({ id: x.id, name: x.displayName || `${x.firstName} ${x.lastName}`.trim() })), truncated: missingPersonContactsCount > MAX_IDS, total: missingPersonContactsCount },
      },
      staleRelationships: { values: stale, truncated: staleRelationshipCount > MAX_IDS, total: staleRelationshipCount },
      invalidEmails: { values: invalidEmails, truncated: (Number(invalidOrgEmailCount[0]?.count ?? 0) + Number(invalidPersonEmailCount[0]?.count ?? 0)) > MAX_IDS, total: Number(invalidOrgEmailCount[0]?.count ?? 0) + Number(invalidPersonEmailCount[0]?.count ?? 0) },
      missingOrganizations: { people: { values: [], truncated: false, total: 0 }, contacts: { values: [], truncated: false, total: 0 } },
      missingDates: {
        relationships: { values: missingDates.relationships, truncated: missingReviewDateCount > MAX_IDS, total: missingReviewDateCount },
        meetings: { values: missingDates.meetings, truncated: missingMeetingDateCount > MAX_IDS, total: missingMeetingDateCount },
        actions: { values: missingDates.actions, truncated: missingActionDateCount > MAX_IDS, total: missingActionDateCount },
        interactions: { values: [], truncated: false, total: 0 },
      },
      incompleteProfiles: {
        organizations: { values: incomplete.organizations, truncated: incompleteOrganizationCount > MAX_IDS, total: incompleteOrganizationCount },
        people: { values: incomplete.people, truncated: incompletePersonCount > MAX_IDS, total: incompletePersonCount },
      },
      coverage: { organizations: organizationCount, people: personCount, relationships: relationshipCount, interactions, meetings, actions },
      bounded: true,
      maxReturnedIds: MAX_IDS,
    };
    return this.createSnapshot(userId, organizationId, metrics);
  }

  private emptyMetrics() { return { generatedAt: new Date().toISOString(), checks: [], duplicateOrganizations: [], missingOwners: this.cap([]), missingContacts: { organizations: this.cap([]), people: this.cap([]) }, staleRelationships: this.cap([]), invalidEmails: this.cap([]), missingOrganizations: { people: this.cap([]), contacts: this.cap([]) }, missingDates: { relationships: this.cap([]), meetings: this.cap([]), actions: this.cap([]), interactions: this.cap([]) }, incompleteProfiles: { organizations: this.cap([]), people: this.cap([]) }, coverage: { organizations: 0, people: 0, relationships: 0, interactions: 0, meetings: 0, actions: 0 }, bounded: true, maxReturnedIds: MAX_IDS }; }

  private async createSnapshot(userId: string, organizationId: string | undefined, metrics: any) {
    const snapshot = await this.prisma.dataQualitySnapshot.create({ data: { organizationId: organizationId || undefined, createdById: userId, metrics } });
    await this.audit.logMutation({ userId, action: 'CREATE', entityType: 'DataQualitySnapshot', entityId: snapshot.id, organizationId, after: metrics });
    return EntityResponseDto.fromUnknown(snapshot);
  }

  async get(userId: string, organizationId?: string) { await this.auth.assertPermission(userId, 'data.quality.read', { organizationId }); const ids = await this.auth.accessibleOrganizationIds(userId); if (!organizationId && ids !== null) return this.execute(userId, organizationId); const latest = await this.prisma.dataQualitySnapshot.findFirst({ where: { organizationId: organizationId || undefined }, orderBy: { scannedAt: 'desc' } }); return latest ? EntityResponseDto.fromUnknown(latest) : this.execute(userId, organizationId); }
  async duplicates(userId: string, organizationId?: string) {
    const report = await this.execute(userId, organizationId);
    const groups = ((report.metrics as any).duplicateOrganizations ?? []) as Array<{ ids: string[]; reasons: string[] }>;
    const ids = [...new Set(groups.flatMap(group => group.ids ?? []))];
    const records = ids.length ? await this.prisma.organization.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, name: true, type: true } }) : [];
    const byId = new Map(records.map(record => [record.id, record]));
    return {
      snapshotId: report.id,
      duplicateOrganizations: groups.map(group => ({
        ids: group.ids,
        reasons: group.reasons,
        records: (group.ids ?? []).map(id => byId.get(id)).filter(Boolean),
      })),
    };
  }
}
