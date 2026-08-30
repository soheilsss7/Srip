import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, DataLifecycleState, ImportEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';

type Candidate = { id: string; score: number; reasons: string[]; entityType: ImportEntityType };
const text = (v: unknown) => String(v ?? '').trim();
const lower = (v: unknown) => text(v).toLowerCase();
const phone = (v: unknown) => text(v).replace(/[^0-9+]/g, '').replace(/^00/, '+');
const domain = (v: unknown) => lower(v).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
const name = (v: unknown) => lower(v).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}

/**
 * Duplicate detection deliberately narrows candidates in PostgreSQL before any
 * CPU-heavy similarity work. It never scans an entire tenant into Node memory.
 */
@Injectable()
export class DuplicateDetectionService {
  private readonly candidateLimit = Math.max(25, Math.min(250, Number(process.env.DUPLICATE_CANDIDATE_LIMIT || 100)));

  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService) {}

  async organizationCandidates(data: Record<string, unknown>, organizationId?: string, organizationScope?: string[] | null): Promise<Candidate[]> {
    const nm = name(data.name), dm = domain(data.website), rg = lower(data.registrationId), ph = phone(data.phone), ct = lower(data.country);
    const prefix = nm.slice(0, Math.min(4, nm.length));
    const where: any = {
      deletedAt: null,
      ...(organizationScope ? { id: { in: organizationScope } } : {}),
      OR: [
        ...(dm ? [{ website: { contains: dm, mode: 'insensitive' } }] : []),
        ...(rg ? [{ registrationId: { equals: rg, mode: 'insensitive' } }] : []),
        ...(ph ? [{ phone: { contains: ph.replace('+', ''), mode: 'insensitive' } }] : []),
        ...(prefix.length >= 3 ? [{ name: { startsWith: prefix, mode: 'insensitive' } }] : []),
        ...(ct ? [{ country: { equals: ct, mode: 'insensitive' } }] : []),
      ],
    };
    if (!where.OR.length) return [];
    const rows = await this.prisma.organization.findMany({ where, take: this.candidateLimit, select: { id: true, name: true, website: true, registrationId: true, phone: true, country: true } });
    return this.scoreOrganizations(rows, nm, dm, rg, ph, ct);
  }

  private scoreOrganizations(rows: Array<{ id: string; name: string; website: string | null; registrationId: string | null; phone: string | null; country: string | null }>, nm: string, dm: string, rg: string, ph: string, ct: string) {
    return rows.map(x => {
      const reasons: string[] = [];
      const ns = similarity(nm, name(x.name));
      const domainMatch = !!dm && domain(x.website) === dm;
      const registrationMatch = !!rg && lower(x.registrationId) === rg;
      const phoneMatch = !!ph && phone(x.phone) === ph;
      const countryMatch = !!ct && lower(x.country) === ct;
      let score = 0;
      if (ns >= 0.72) { score += ns * 0.40; reasons.push(`name_similarity:${ns.toFixed(3)}`); }
      if (domainMatch) { score += 0.25; reasons.push('domain'); }
      if (registrationMatch) { score += 0.25; reasons.push('registration_id'); }
      if (phoneMatch) { score += 0.20; reasons.push('phone'); }
      if (countryMatch) { score += 0.05; reasons.push('country'); }
      return { id: x.id, score: Math.min(1, score), reasons, entityType: ImportEntityType.ORGANIZATION };
    }).filter(x => x.reasons.length > 0 && x.score >= 0.40).sort((a, b) => b.score - a.score).slice(0, 10);
  }

  async personCandidates(data: Record<string, unknown>, organizationId?: string): Promise<Candidate[]> {
    const nm = name(data.displayName || `${text(data.firstName)} ${text(data.lastName)}`), em = lower(data.email), ph = phone(data.phone), org = text(data.organizationId || organizationId);
    const prefix = nm.slice(0, Math.min(4, nm.length));
    const where: any = {
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
      OR: [
        ...(em ? [{ email: { equals: em, mode: 'insensitive' } }] : []),
        ...(ph ? [{ phone: { contains: ph.replace('+', ''), mode: 'insensitive' } }] : []),
        ...(org ? [{ organizationId: org }] : []),
        ...(prefix.length >= 3 ? [{ displayName: { startsWith: prefix, mode: 'insensitive' } }] : []),
      ],
    };
    if (!where.OR.length) return [];
    const rows = await this.prisma.person.findMany({ where, take: this.candidateLimit, select: { id: true, firstName: true, lastName: true, displayName: true, email: true, phone: true, organizationId: true } });
    return rows.map(x => {
      const reasons: string[] = [];
      const ns = similarity(nm, name(x.displayName || `${x.firstName} ${x.lastName}`));
      const emailMatch = !!em && lower(x.email) === em;
      const phoneMatch = !!ph && phone(x.phone) === ph;
      const organizationMatch = !!org && x.organizationId === org;
      let score = 0;
      if (ns >= 0.72) { score += ns * 0.35; reasons.push(`name_similarity:${ns.toFixed(3)}`); }
      if (emailMatch) { score += 0.35; reasons.push('email'); }
      if (organizationMatch) { score += 0.20; reasons.push('organization'); }
      if (phoneMatch) { score += 0.20; reasons.push('phone'); }
      return { id: x.id, score: Math.min(1, score), reasons, entityType: ImportEntityType.PERSON };
    }).filter(x => x.reasons.length > 0 && x.score >= 0.40).sort((a, b) => b.score - a.score).slice(0, 10);
  }

  async detect(entityType: ImportEntityType, data: Record<string, unknown>, organizationId?: string, organizationScope?: string[] | null) {
    return entityType === ImportEntityType.ORGANIZATION ? this.organizationCandidates(data, organizationId, organizationScope) : this.personCandidates(data, organizationId);
  }

  async mergePreview(userId: string, entityType: string, primaryId: string, duplicateId: string, organizationId?: string) {
    const normalizedType = entityType.toUpperCase();
    if (!['ORGANIZATION', 'PERSON'].includes(normalizedType)) throw new BadRequestException('entityType must be ORGANIZATION or PERSON');
    if (!primaryId || !duplicateId || primaryId === duplicateId) throw new BadRequestException('primaryId and duplicateId must be different');
    const accessibleIds = await this.authorization.accessibleOrganizationIds(userId);
    // The controller permission is necessary but not sufficient: a caller must
    // also be able to read both records that are being compared.
    const allowed = (id: string) => accessibleIds === null || accessibleIds.includes(id);
    if (organizationId && (accessibleIds !== null && !accessibleIds.includes(organizationId))) throw new ForbiddenException('Organization outside scope');
    if (normalizedType === 'ORGANIZATION') {
      const [primary, duplicate] = await Promise.all([
        this.prisma.organization.findFirst({ where: { id: primaryId, deletedAt: null, ...(organizationId ? { id: primaryId } : {}) }, include: { _count: { select: { people: true, sourceRelationships: true, targetRelationships: true, projects: true, opportunities: true, notes: true } } } }),
        this.prisma.organization.findFirst({ where: { id: duplicateId, deletedAt: null }, include: { _count: { select: { people: true, sourceRelationships: true, targetRelationships: true, projects: true, opportunities: true, notes: true } } } }),
      ]);
      if (!primary || !duplicate || !allowed(primary.id) || !allowed(duplicate.id)) throw new NotFoundException('Duplicate organization candidate not found');
      return { entityType: normalizedType, primary: { id: primary.id, name: primary.name, type: primary.type, counts: primary._count }, duplicate: { id: duplicate.id, name: duplicate.name, type: duplicate.type, counts: duplicate._count }, proposedChanges: ['Keep the primary record', 'Repoint compatible relationships and activity to the primary record', 'Preserve the duplicate as an auditable archived record'], requiresExplicitConfirmation: true, writePerformed: false };
    }
    const [primary, duplicate] = await Promise.all([
      this.prisma.person.findFirst({ where: { id: primaryId, deletedAt: null }, include: { _count: { select: { contacts: true, interactions: true, actions: true, commitments: true, notes: true } } } }),
      this.prisma.person.findFirst({ where: { id: duplicateId, deletedAt: null }, include: { _count: { select: { contacts: true, interactions: true, actions: true, commitments: true, notes: true } } } }),
    ]);
    if (!primary || !duplicate) throw new NotFoundException('Duplicate person candidate not found');
    if ((accessibleIds !== null && (!allowed(primary.organizationId) || !allowed(duplicate.organizationId))) || (organizationId && (primary.organizationId !== organizationId || duplicate.organizationId !== organizationId))) throw new ForbiddenException('Person outside organization scope');
    return { entityType: normalizedType, primary: { id: primary.id, name: primary.displayName || `${primary.firstName} ${primary.lastName}`.trim(), organizationId: primary.organizationId, counts: primary._count }, duplicate: { id: duplicate.id, name: duplicate.displayName || `${duplicate.firstName} ${duplicate.lastName}`.trim(), organizationId: duplicate.organizationId, counts: duplicate._count }, proposedChanges: ['Keep the primary record', 'Repoint compatible contacts and activity to the primary record', 'Preserve the duplicate as an auditable archived record'], requiresExplicitConfirmation: true, writePerformed: false };
  }

  /**
   * Merge is intentionally separate from preview and requires the literal
   * confirmation phrase. All foreign-key moves and the duplicate archive run
   * in one transaction so a partial merge can never be exposed as success.
   */
  async merge(userId: string, entityType: string, primaryId: string, duplicateId: string, organizationId?: string, confirmation?: string) {
    if (confirmation !== 'MERGE') throw new BadRequestException('Explicit confirmation phrase MERGE is required');
    const preview = await this.mergePreview(userId, entityType, primaryId, duplicateId, organizationId);
    const now = new Date();
    const type = String(entityType).toUpperCase();

    return this.prisma.$transaction(async tx => {
      const db: any = tx;
      if (type === 'ORGANIZATION') {
        const [primary, duplicate] = await Promise.all([
          db.organization.findFirst({ where: { id: primaryId, deletedAt: null } }),
          db.organization.findFirst({ where: { id: duplicateId, deletedAt: null } }),
        ]);
        if (!primary || !duplicate) throw new NotFoundException('Duplicate organization candidate is no longer available');
        await this.mergeOrganizationRelations(db, userId, primary.id, duplicate.id, now);
        await db.organization.updateMany({ where: { parentOrganizationId: duplicate.id }, data: { parentOrganizationId: primary.id } });
        await this.archiveMergeRecord(db, userId, 'Organization', duplicate, primary.id, now, 'duplicate-merged');
        await this.audit.logMutation({ userId, action: AuditAction.UPDATE, entityType: 'Organization', entityId: primary.id, organizationId: primary.id, before: { id: primary.id }, after: { mergedDuplicateId: duplicate.id, duplicateArchived: true }, reason: 'duplicate-merged' }, tx);
        return { ...preview, writePerformed: true, mergedAt: now.toISOString(), archivedDuplicateId: duplicate.id, reassignedToId: primary.id };
      }

      const [primary, duplicate] = await Promise.all([
        db.person.findFirst({ where: { id: primaryId, deletedAt: null } }),
        db.person.findFirst({ where: { id: duplicateId, deletedAt: null } }),
      ]);
      if (!primary || !duplicate) throw new NotFoundException('Duplicate person candidate is no longer available');
      await this.mergePersonRelations(db, userId, primary.id, duplicate.id, now);
      await this.archiveMergeRecord(db, userId, 'Person', duplicate, primary.organizationId, now, 'duplicate-merged', primary.id);
      await this.audit.logMutation({ userId, action: AuditAction.UPDATE, entityType: 'Person', entityId: primary.id, organizationId: primary.organizationId, before: { id: primary.id }, after: { mergedDuplicateId: duplicate.id, duplicateArchived: true }, reason: 'duplicate-merged' }, tx);
      return { ...preview, writePerformed: true, mergedAt: now.toISOString(), archivedDuplicateId: duplicate.id, reassignedToId: primary.id };
    }, { timeout: 30000 });
  }

  private async archiveMergeRecord(db: any, userId: string, entityType: 'Organization' | 'Person' | 'Relationship' | 'PersonRelationship', row: any, organizationId: string | undefined, now: Date, reason: string, mergedIntoId?: string | null) {
    const delegate = entityType === 'Organization' ? 'organization' : entityType === 'Person' ? 'person' : entityType === 'PersonRelationship' ? 'personRelationship' : 'relationship';
    const changed = await db[delegate].updateMany({ where: { id: row.id, deletedAt: null }, data: { deletedAt: now, deletedById: userId } });
    if (changed.count !== 1) throw new ConflictException('Duplicate record was already merged or archived');
    const archived = await db[delegate].findUnique({ where: { id: row.id } });
    await db.dataLifecycleRecord.create({ data: { entityType, entityId: row.id, state: DataLifecycleState.DELETION, actorId: userId, reason, metadata: { mergedIntoId: mergedIntoId ?? null, mergeReason: reason, mergedAt: now.toISOString() } } });
    await this.audit.logMutation({ userId, action: AuditAction.SOFT_DELETE, entityType, entityId: row.id, organizationId, before: row, after: archived, reason }, db);
    return archived;
  }

  private async clearRelationshipLinks(db: any, relationshipId: string) {
    await Promise.all([
      db.interaction.updateMany({ where: { relationshipId }, data: { relationshipId: null } }),
      db.meeting.updateMany({ where: { relationshipId }, data: { relationshipId: null } }),
      db.action.updateMany({ where: { relationshipId }, data: { relationshipId: null } }),
      db.commitment.updateMany({ where: { relationshipId }, data: { relationshipId: null } }),
      db.opportunity.updateMany({ where: { relationshipId }, data: { relationshipId: null } }),
      db.recommendation.updateMany({ where: { relationshipId }, data: { relationshipId: null } }),
    ]);
    await db.projectRelationship.deleteMany({ where: { relationshipId } });
  }

  private async moveRelationshipLinks(db: any, oldId: string, newId: string) {
    await Promise.all([
      db.interaction.updateMany({ where: { relationshipId: oldId }, data: { relationshipId: newId } }),
      db.meeting.updateMany({ where: { relationshipId: oldId }, data: { relationshipId: newId } }),
      db.action.updateMany({ where: { relationshipId: oldId }, data: { relationshipId: newId } }),
      db.commitment.updateMany({ where: { relationshipId: oldId }, data: { relationshipId: newId } }),
      db.opportunity.updateMany({ where: { relationshipId: oldId }, data: { relationshipId: newId } }),
      db.recommendation.updateMany({ where: { relationshipId: oldId }, data: { relationshipId: newId } }),
    ]);
    const projectLinks = await db.projectRelationship.findMany({ where: { relationshipId: oldId }, select: { projectId: true } });
    for (const link of projectLinks) {
      const existing = await db.projectRelationship.findUnique({ where: { projectId_relationshipId: { projectId: link.projectId, relationshipId: newId } } });
      if (existing) await db.projectRelationship.delete({ where: { projectId_relationshipId: { projectId: link.projectId, relationshipId: oldId } } });
      else await db.projectRelationship.update({ where: { projectId_relationshipId: { projectId: link.projectId, relationshipId: oldId } }, data: { relationshipId: newId } });
    }
  }

  private async mergeOrganizationRelations(db: any, userId: string, primaryId: string, duplicateId: string, now: Date) {
    await Promise.all([
      db.person.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.contactInformation.updateMany({ where: { organizationId: duplicateId }, data: { organizationId: primaryId } }),
      db.interaction.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.meeting.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.action.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.project.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.opportunity.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.commitment.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.note.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.integrationConnection.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.integrationExternalRecord.updateMany({ where: { organizationId: duplicateId }, data: { organizationId: primaryId } }),
      db.workflow.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.organizationUnit.updateMany({ where: { organizationId: duplicateId }, data: { organizationId: primaryId } }),
      db.document.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.aiDocumentChunk.updateMany({ where: { organizationId: duplicateId }, data: { organizationId: primaryId } }),
      db.projectRequirement.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.projectRisk.updateMany({ where: { organizationId: duplicateId, deletedAt: null }, data: { organizationId: primaryId } }),
      db.dataImport.updateMany({ where: { organizationId: duplicateId }, data: { organizationId: primaryId } }),
      db.dataQualitySnapshot.updateMany({ where: { organizationId: duplicateId }, data: { organizationId: primaryId } }),
      db.referral.updateMany({ where: { sourceOrganizationId: duplicateId }, data: { sourceOrganizationId: primaryId } }),
      db.referral.updateMany({ where: { targetOrganizationId: duplicateId }, data: { targetOrganizationId: primaryId } }),
      db.tagAssignment.updateMany({ where: { organizationId: duplicateId }, data: { organizationId: primaryId } }),
      db.connectionPath.updateMany({ where: { sourceOrganizationId: duplicateId }, data: { sourceOrganizationId: primaryId } }),
      db.connectionPath.updateMany({ where: { targetOrganizationId: duplicateId }, data: { targetOrganizationId: primaryId } }),
      db.connectionPath.updateMany({ where: { bestConnectorOrganizationId: duplicateId }, data: { bestConnectorOrganizationId: primaryId } }),
      db.personRelationship.updateMany({ where: { sourceOrganizationId: duplicateId }, data: { sourceOrganizationId: primaryId } }),
      db.personRelationship.updateMany({ where: { targetOrganizationId: duplicateId }, data: { targetOrganizationId: primaryId } }),
    ]);

    const memberships = await db.organizationPerson.findMany({ where: { organizationId: duplicateId } });
    for (const membership of memberships) {
      const existing = await db.organizationPerson.findUnique({ where: { organizationId_personId: { organizationId: primaryId, personId: membership.personId } } });
      if (existing) await db.organizationPerson.delete({ where: { id: membership.id } });
      else await db.organizationPerson.update({ where: { id: membership.id }, data: { organizationId: primaryId } });
    }

    const relationships = await db.relationship.findMany({ where: { deletedAt: null, OR: [{ sourceOrganizationId: duplicateId }, { targetOrganizationId: duplicateId }] } });
    for (const relationship of relationships) {
      const sourceOrganizationId = relationship.sourceOrganizationId === duplicateId ? primaryId : relationship.sourceOrganizationId;
      const targetOrganizationId = relationship.targetOrganizationId === duplicateId ? primaryId : relationship.targetOrganizationId;
      if (sourceOrganizationId === targetOrganizationId) {
        await this.clearRelationshipLinks(db, relationship.id);
        await this.archiveMergeRecord(db, userId, 'Relationship', relationship, primaryId, now, 'duplicate-merge-self-relationship', null);
        continue;
      }
      const conflict = await db.relationship.findFirst({ where: { id: { not: relationship.id }, sourceOrganizationId, targetOrganizationId, relationshipType: relationship.relationshipType, deletedAt: null } });
      if (conflict) {
        await this.moveRelationshipLinks(db, relationship.id, conflict.id);
        await this.archiveMergeRecord(db, userId, 'Relationship', relationship, primaryId, now, 'duplicate-merge-relationship-conflict', conflict.id);
      } else {
        await db.relationship.update({ where: { id: relationship.id }, data: { sourceOrganizationId, targetOrganizationId } });
      }
    }
  }

  private async mergePersonRelations(db: any, userId: string, primaryId: string, duplicateId: string, now: Date) {
    await db.contactInformation.updateMany({ where: { personId: duplicateId }, data: { personId: primaryId } });
    await Promise.all([
      db.interaction.updateMany({ where: { personId: duplicateId, deletedAt: null }, data: { personId: primaryId } }),
      db.action.updateMany({ where: { personId: duplicateId, deletedAt: null }, data: { personId: primaryId } }),
      db.commitment.updateMany({ where: { personId: duplicateId, deletedAt: null }, data: { personId: primaryId } }),
      db.note.updateMany({ where: { personId: duplicateId, deletedAt: null }, data: { personId: primaryId } }),
      db.integrationExternalRecord.updateMany({ where: { personId: duplicateId }, data: { personId: primaryId } }),
      db.connectionPath.updateMany({ where: { bestConnectorPersonId: duplicateId }, data: { bestConnectorPersonId: primaryId } }),
      db.referral.updateMany({ where: { sourcePersonId: duplicateId }, data: { sourcePersonId: primaryId } }),
      db.referral.updateMany({ where: { targetPersonId: duplicateId }, data: { targetPersonId: primaryId } }),
    ]);

    const participants = await db.meetingParticipant.findMany({ where: { personId: duplicateId } });
    for (const participant of participants) {
      const existing = await db.meetingParticipant.findUnique({ where: { meetingId_personId: { meetingId: participant.meetingId, personId: primaryId } } });
      if (existing) await db.meetingParticipant.delete({ where: { meetingId_personId: { meetingId: participant.meetingId, personId: duplicateId } } });
      else await db.meetingParticipant.update({ where: { meetingId_personId: { meetingId: participant.meetingId, personId: duplicateId } }, data: { personId: primaryId } });
    }

    const memberships = await db.organizationPerson.findMany({ where: { personId: duplicateId } });
    for (const membership of memberships) {
      const existing = await db.organizationPerson.findUnique({ where: { organizationId_personId: { organizationId: membership.organizationId, personId: primaryId } } });
      if (existing) await db.organizationPerson.delete({ where: { id: membership.id } });
      else await db.organizationPerson.update({ where: { id: membership.id }, data: { personId: primaryId } });
    }

    const relationships = await db.personRelationship.findMany({ where: { deletedAt: null, OR: [{ sourcePersonId: duplicateId }, { targetPersonId: duplicateId }] } });
    for (const relationship of relationships) {
      const sourcePersonId = relationship.sourcePersonId === duplicateId ? primaryId : relationship.sourcePersonId;
      const targetPersonId = relationship.targetPersonId === duplicateId ? primaryId : relationship.targetPersonId;
      if (sourcePersonId === targetPersonId) {
        await this.archiveMergeRecord(db, userId, 'PersonRelationship', relationship, relationship.sourceOrganizationId, now, 'duplicate-merge-self-person-relationship', null);
        continue;
      }
      const conflict = await db.personRelationship.findFirst({ where: { id: { not: relationship.id }, sourcePersonId, targetPersonId, relationshipType: relationship.relationshipType, deletedAt: null } });
      if (conflict) await this.archiveMergeRecord(db, userId, 'PersonRelationship', relationship, relationship.sourceOrganizationId, now, 'duplicate-merge-person-relationship-conflict', conflict.id);
      else await db.personRelationship.update({ where: { id: relationship.id }, data: { sourcePersonId, targetPersonId } });
    }
  }
}
