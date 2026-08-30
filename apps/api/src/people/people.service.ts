import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DataLifecycleService } from '../common/data-lifecycle/data-lifecycle.service';
import { EntityResponseDto, PersonResponseDto } from '../common/dto/entity-response.dto';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';

@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly eventBus: EventBusService,
    private readonly lifecycle: DataLifecycleService,
  ) {}

  private async getRaw(id: string, includeDeleted = false) {
    const person = await this.prisma.person.findFirst({
      where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
      include: {
        organization: { select: { id: true, name: true, type: true, status: true } },
        organizationPeople: {
          where: { status: 'ACTIVE' },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: { organization: { select: { id: true, name: true, type: true, status: true } } },
        },
        notes: { where: { deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 50, select: { id: true, title: true, body: true, organizationId: true, createdAt: true, updatedAt: true } },
      },
    });
    if (!person) throw new NotFoundException('Person not found');
    return person;
  }

  async list(userId: string, q?: string, organizationId?: string, page = 1, pageSize = 50) {
    page = Math.max(1, Math.min(Number(page) || 1, 10000));
    pageSize = Math.max(1, Math.min(Number(pageSize) || 50, 100));
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    if (organizationId) await this.authorization.assertPermission(userId, 'person.read', { organizationId });
    const where: any = {
      deletedAt: null,
      ...(ids ? { organizationId: { in: ids } } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(q ? { OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
      ] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.person.findMany({
        where,
        include: { organization: { select: { id: true, name: true, type: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.person.count({ where }),
    ]);
    return { data: rows.map(row => PersonResponseDto.from('Person', row)), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  async get(userId: string, id: string) {
    const person = await this.getRaw(id);
    await this.authorization.assertPermission(userId, 'person.read', { organizationId: person.organizationId, entityType: 'Person', entityId: id });
    return PersonResponseDto.from('Person', person);
  }

  async timeline(userId: string, id: string) {
    const person = await this.getRaw(id);
    await this.authorization.assertPermission(userId, 'person.read', { organizationId: person.organizationId, entityType: 'Person', entityId: id });
    const [interactions, meetings, actions, commitments, notes] = await Promise.all([
      this.prisma.interaction.findMany({ where: { personId: id, deletedAt: null }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 50, select: { id: true, type: true, subject: true, summary: true, occurredAt: true } }),
      this.prisma.meetingParticipant.findMany({ where: { personId: id, meeting: { deletedAt: null } }, orderBy: { meeting: { startAt: 'desc' } }, take: 50, include: { meeting: { select: { id: true, title: true, startAt: true, outcome: true } } } }),
      this.prisma.action.findMany({ where: { personId: id, deletedAt: null }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50, select: { id: true, title: true, status: true, dueAt: true, createdAt: true } }),
      this.prisma.commitment.findMany({ where: { personId: id, deletedAt: null }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50, select: { id: true, description: true, status: true, dueAt: true, createdAt: true } }),
      this.prisma.note.findMany({ where: { personId: id, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 50, select: { id: true, title: true, body: true, organizationId: true, createdAt: true, updatedAt: true } }),
    ]);
    return { person: { id: person.id, displayName: person.displayName || `${person.firstName} ${person.lastName}` }, items: [
      ...interactions.map(x => ({ kind: 'interaction', date: x.occurredAt, ...x })),
      ...meetings.map(x => ({ kind: 'meeting', date: x.meeting.startAt, ...x.meeting })),
      ...actions.map(x => ({ kind: 'action', date: x.createdAt, ...x })),
      ...commitments.map(x => ({ kind: 'commitment', date: x.createdAt, ...x })),
      ...notes.map(x => ({ kind: 'note', date: x.updatedAt, ...x })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 100) };
  }

  async create(userId: string, data: { firstName: string; lastName: string; organizationId: string; email?: string; phone?: string; title?: string; department?: string; country?: string; notes?: string; status?: string; influenceScore?: number; decisionPower?: number; accessibilityScore?: number }) {
    await this.authorization.assertPermission(userId, 'person.write', { organizationId: data.organizationId });
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const email = data.email?.trim().toLowerCase();
    const org = await this.prisma.organization.findFirst({ where: { id: data.organizationId, deletedAt: null }, select: { id: true } });
    if (!org) throw new NotFoundException('Organization not found');
    const duplicate = await this.prisma.person.findFirst({ where: { organizationId: data.organizationId, deletedAt: null, OR: [
      ...(email ? [{ email }] : []),
      { firstName, lastName },
    ] } });
    if (duplicate) throw new ConflictException('A matching person already exists in this organization');
    const created = await this.eventBus.transaction(async tx => {
      const row = await tx.person.create({ data: { ...data, notes: undefined, notesText: data.notes, firstName, lastName, displayName: `${firstName} ${lastName}`, email } });
      await tx.organizationPerson.create({ data: { organizationId: data.organizationId, personId: row.id, roleTitle: data.title, department: data.department, isPrimary: true } });
      await this.audit.logMutation({ userId, action: 'CREATE', entityType: 'Person', entityId: row.id, organizationId: row.organizationId, after: row }, tx);
      await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.PERSON_CREATED, aggregateType: 'Person', aggregateId: row.id, organizationId: row.organizationId, actorId: userId, payload: row as any });
      return row;
    });
    return PersonResponseDto.from('Person', created);
  }

  async update(userId: string, id: string, data: Record<string, unknown>) {
    const existing = await this.prisma.person.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Person not found');
    await this.authorization.assertPermission(userId, 'person.write', { organizationId: existing.organizationId, entityType: 'Person', entityId: id });
    const targetOrganizationId = typeof data.organizationId === 'string' ? data.organizationId : existing.organizationId;
    if (targetOrganizationId !== existing.organizationId) await this.authorization.assertPermission(userId, 'person.write', { organizationId: targetOrganizationId });
    const firstName = typeof data.firstName === 'string' ? data.firstName.trim() : existing.firstName;
    const lastName = typeof data.lastName === 'string' ? data.lastName.trim() : existing.lastName;
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : existing.email;
    const duplicate = await this.prisma.person.findFirst({ where: { id: { not: id }, organizationId: targetOrganizationId, deletedAt: null, OR: [
      ...(email ? [{ email }] : []),
      { firstName, lastName },
    ] } });
    if (duplicate) throw new ConflictException('A matching person already exists in this organization');
    const updated = await this.eventBus.transaction(async tx => {
      const safeData: any = { ...data, organizationId: targetOrganizationId, firstName, lastName, displayName: `${firstName} ${lastName}`, email };
      const row = await tx.person.update({ where: { id }, data: safeData });
      if (targetOrganizationId !== existing.organizationId) {
        await tx.organizationPerson.updateMany({ where: { personId: id, organizationId: existing.organizationId, isPrimary: true }, data: { isPrimary: false } });
        await tx.organizationPerson.upsert({ where: { organizationId_personId: { organizationId: targetOrganizationId, personId: id } }, update: { isPrimary: true, roleTitle: typeof data.title === 'string' ? data.title : undefined, department: typeof data.department === 'string' ? data.department : undefined, status: 'ACTIVE' }, create: { organizationId: targetOrganizationId, personId: id, isPrimary: true, roleTitle: typeof data.title === 'string' ? data.title : undefined, department: typeof data.department === 'string' ? data.department : undefined } });
      } else {
        await tx.organizationPerson.upsert({ where: { organizationId_personId: { organizationId: targetOrganizationId, personId: id } }, update: { isPrimary: true, roleTitle: typeof data.title === 'string' ? data.title : undefined, department: typeof data.department === 'string' ? data.department : undefined, status: 'ACTIVE' }, create: { organizationId: targetOrganizationId, personId: id, isPrimary: true, roleTitle: typeof data.title === 'string' ? data.title : undefined, department: typeof data.department === 'string' ? data.department : undefined } });
      }
      await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'Person', entityId: id, organizationId: existing.organizationId, before: existing, after: row }, tx);
      await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.PERSON_UPDATED, aggregateType: 'Person', aggregateId: row.id, organizationId: row.organizationId, actorId: userId, payload: row as any });
      return row;
    });
    return PersonResponseDto.from('Person', updated);
  }

  async addOrganization(userId: string, personId: string, organizationId: string, roleTitle?: string, department?: string, isPrimary = false) {
    const person = await this.prisma.person.findFirst({ where: { id: personId, deletedAt: null }, select: { id: true, organizationId: true } });
    if (!person) throw new NotFoundException('Person not found');
    await this.authorization.assertPermission(userId, 'person.write', { organizationId: person.organizationId, entityType: 'Person', entityId: personId });
    await this.authorization.assertPermission(userId, 'person.write', { organizationId });
    const organization = await this.prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null }, select: { id: true } });
    if (!organization) throw new NotFoundException('Organization not found');
    const affiliation = await this.eventBus.transaction(async tx => {
      if (isPrimary) {
        await tx.organizationPerson.updateMany({ where: { personId, isPrimary: true }, data: { isPrimary: false } });
        await tx.person.update({ where: { id: personId }, data: { organizationId } });
      }
      const row = await tx.organizationPerson.upsert({ where: { organizationId_personId: { organizationId, personId } }, update: { roleTitle, department, isPrimary, status: 'ACTIVE' }, create: { organizationId, personId, roleTitle, department, isPrimary } });
      await this.audit.logMutation({ userId, action: 'CREATE', entityType: 'OrganizationPerson', entityId: row.id, organizationId, after: row }, tx);
      return row;
    });
    return EntityResponseDto.from('OrganizationPerson', affiliation);
  }

  async removeOrganization(userId: string, personId: string, organizationId: string) {
    const person = await this.prisma.person.findFirst({ where: { id: personId, deletedAt: null }, select: { id: true, organizationId: true } });
    if (!person) throw new NotFoundException('Person not found');
    await this.authorization.assertPermission(userId, 'person.write', { organizationId: person.organizationId, entityType: 'Person', entityId: personId });
    await this.authorization.assertPermission(userId, 'person.write', { organizationId });
    const affiliation = await this.prisma.organizationPerson.findUnique({ where: { organizationId_personId: { organizationId, personId } } });
    if (!affiliation) throw new NotFoundException('Organization affiliation not found');
    if (affiliation.isPrimary) throw new ConflictException('Primary organization cannot be removed; assign another organization first');
    const deleted = await this.eventBus.transaction(async tx => {
      const row = await tx.organizationPerson.delete({ where: { id: affiliation.id } });
      await this.audit.logMutation({ userId, action: 'DELETE', entityType: 'OrganizationPerson', entityId: row.id, organizationId, before: row }, tx);
      return row;
    });
    return EntityResponseDto.from('OrganizationPerson', deleted);
  }

  async listOrganizations(userId: string, personId: string) {
    const person = await this.prisma.person.findFirst({ where: { id: personId, deletedAt: null }, select: { organizationId: true } });
    if (!person) throw new NotFoundException('Person not found');
    await this.authorization.assertPermission(userId, 'person.read', { organizationId: person.organizationId, entityType: 'Person', entityId: personId });
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    const rows = await this.prisma.organizationPerson.findMany({ where: { personId, status: 'ACTIVE', ...(ids ? { organizationId: { in: ids } } : {}) }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], include: { organization: { select: { id: true, name: true, type: true, status: true } } } });
    return EntityResponseDto.many('OrganizationPerson', rows);
  }

  async archive(userId: string, id: string) {
    const existing = await this.prisma.person.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Person not found');
    await this.authorization.assertPermission(userId, 'person.write', { organizationId: existing.organizationId, entityType: 'Person', entityId: id });
    const archived = await this.eventBus.transaction(async tx => {
      const next = await this.lifecycle.softDelete(userId, 'Person', id, 'archive', tx);
      await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.PERSON_DELETED, aggregateType: 'Person', aggregateId: next.id, organizationId: next.organizationId ?? undefined, actorId: userId, payload: next as any });
      return next;
    });
    return PersonResponseDto.from('Person', archived);
  }

  async restore(userId: string, id: string) {
    const restored = await this.eventBus.transaction(async tx => {
      const row = await this.lifecycle.restore(userId, 'Person', id, 'restore', tx);
      await this.eventBus.publishInTransaction(tx, { eventType: DOMAIN_EVENT_TYPES.PERSON_UPDATED, aggregateType: 'Person', aggregateId: id, organizationId: (row as any).organizationId ?? undefined, actorId: userId, payload: { lifecycle: 'RESTORED' } });
      return row;
    });
    return PersonResponseDto.from('Person', restored);
  }
}
