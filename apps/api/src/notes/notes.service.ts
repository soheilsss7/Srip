import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { DataLifecycleService } from '../common/data-lifecycle/data-lifecycle.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { parsePagination } from '../common/pagination';

export type NoteListQuery = {
  organizationId?: string;
  personId?: string;
  query?: string;
  page?: string;
  pageSize?: string;
};

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly lifecycle: DataLifecycleService,
  ) {}

  private async organizationIdsForPerson(personId?: string): Promise<string[]> {
    if (!personId) return [];
    const person = await this.prisma.person.findUnique({ where: { id: personId }, select: { organizationId: true, deletedAt: true } });
    if (!person || person.deletedAt) throw new NotFoundException('Person not found');
    return person.organizationId ? [person.organizationId] : [];
  }

  private async resolveContext(userId: string, data: { organizationId?: string; personId?: string }) {
    const personOrganizationIds = await this.organizationIdsForPerson(data.personId);
    const organizationIds = [...new Set([data.organizationId, ...personOrganizationIds].filter(Boolean) as string[])];
    if (organizationIds.length) await this.authorization.assertAnyOrganizationAccess(userId, organizationIds);
    return organizationIds;
  }

  private async assertReadable(userId: string, row: any) {
    const personOrganizationIds = row.person?.organizationId ? [row.person.organizationId] : [];
    const organizationIds = [...new Set([row.organizationId, ...personOrganizationIds].filter(Boolean) as string[])];
    if (organizationIds.length) {
      await this.authorization.assertAnyOrganizationAccess(userId, organizationIds);
      return;
    }
    if (row.createdById !== userId) throw new NotFoundException('Note not found');
  }

  private include() {
    return {
      organization: { select: { id: true, name: true, type: true } },
      person: { select: { id: true, displayName: true, firstName: true, lastName: true, organizationId: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    };
  }

  async list(userId: string, query: NoteListQuery = {}) {
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    if (query.organizationId) await this.authorization.assertAnyOrganizationAccess(userId, [query.organizationId]);
    const p = parsePagination(query.page, query.pageSize, { page: 1, pageSize: 50 });
    const search = query.query?.trim();
    const scopeWhere: any = ids === null
      ? {}
      : { OR: [{ organizationId: { in: ids } }, { person: { organizationId: { in: ids } } }, { createdById: userId }] };
    const filters: any[] = [
      { deletedAt: null },
      scopeWhere,
      ...(query.organizationId ? [{ organizationId: query.organizationId }] : []),
      ...(query.personId ? [{ personId: query.personId }] : []),
      ...(search ? [{ OR: [{ title: { contains: search, mode: 'insensitive' } }, { body: { contains: search, mode: 'insensitive' } }] }] : []),
    ];
    const where: any = { AND: filters };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.note.findMany({ where, include: this.include(), orderBy: { updatedAt: 'desc' }, skip: p.skip, take: p.pageSize }),
      this.prisma.note.count({ where }),
    ]);
    return {
      items: EntityResponseDto.many('Note', items),
      page: p.page,
      pageSize: p.pageSize,
      total,
      totalPages: Math.ceil(total / p.pageSize),
    };
  }

  async get(userId: string, id: string) {
    const row = await this.prisma.note.findUnique({ where: { id }, include: this.include() });
    if (!row || row.deletedAt) throw new NotFoundException('Note not found');
    await this.assertReadable(userId, row);
    return EntityResponseDto.from('Note', row);
  }

  async create(userId: string, data: { title?: string; body: string; organizationId?: string; personId?: string }) {
    const body = data.body?.trim();
    if (!body) throw new BadRequestException('Note body is required');
    await this.resolveContext(userId, data);
    if (!data.organizationId && !data.personId) {
      // Personal notes are allowed, but they remain visible only to their creator.
      const created = await this.prisma.note.create({ data: { title: data.title?.trim() || null, body, createdById: userId } });
      await this.audit.logMutation({ userId, action: 'CREATE', entityType: 'Note', entityId: created.id, after: created });
      return EntityResponseDto.from('Note', created);
    }
    const duplicate = await this.prisma.note.findFirst({ where: { title: data.title?.trim() || null, body, organizationId: data.organizationId ?? null, personId: data.personId ?? null, createdById: userId, deletedAt: null } });
    if (duplicate) throw new ConflictException('An identical note already exists in this context');
    const created = await this.prisma.note.create({ data: { title: data.title?.trim() || null, body, organizationId: data.organizationId, personId: data.personId, createdById: userId }, include: this.include() });
    await this.audit.logMutation({ userId, action: 'CREATE', entityType: 'Note', entityId: created.id, organizationId: created.organizationId ?? undefined, after: created });
    return EntityResponseDto.from('Note', created);
  }

  async update(userId: string, id: string, data: { title?: string; body?: string; organizationId?: string | null; personId?: string | null }) {
    const current = await this.prisma.note.findUnique({ where: { id }, include: this.include() });
    if (!current || current.deletedAt) throw new NotFoundException('Note not found');
    await this.assertReadable(userId, current);
    const next = { ...current, ...data };
    await this.resolveContext(userId, { organizationId: next.organizationId ?? undefined, personId: next.personId ?? undefined });
    const body = data.body === undefined ? current.body : typeof data.body === 'string' ? data.body.trim() : '';
    if (!body) throw new BadRequestException('Note body is required');
    const updated = await this.prisma.note.update({ where: { id }, data: { title: data.title === undefined ? undefined : typeof data.title === 'string' ? data.title.trim() || null : null, body, organizationId: data.organizationId === undefined ? undefined : data.organizationId || null, personId: data.personId === undefined ? undefined : data.personId || null }, include: this.include() });
    await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'Note', entityId: id, organizationId: updated.organizationId ?? undefined, before: current, after: updated });
    return EntityResponseDto.from('Note', updated);
  }

  async remove(userId: string, id: string) {
    const current = await this.prisma.note.findUnique({ where: { id }, include: this.include() });
    if (!current || current.deletedAt) throw new NotFoundException('Note not found');
    await this.assertReadable(userId, current);
    const removed = await this.lifecycle.softDelete(userId, 'Note', id, 'user-requested-delete');
    return EntityResponseDto.fromUnknown(removed);
  }
}
