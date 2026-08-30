import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService) {}

  status() { return { module: 'users', status: 'foundation-ready' }; }

  async picker(userId: string, organizationId?: string, search?: string) {
    if (organizationId) await this.authorization.assertPermission(userId, 'entity.read', { organizationId });
    const accessibleIds = organizationId ? [organizationId] : await this.authorization.accessibleOrganizationIds(userId);
    const where: Prisma.UserWhereInput = { isActive: true, deletedAt: null };
    if (accessibleIds) where.memberships = { some: { organizationId: { in: accessibleIds } } };
    if (search?.trim()) where.OR = [{ name: { contains: search.trim(), mode: 'insensitive' } }, { email: { contains: search.trim(), mode: 'insensitive' } }];
    const users = await this.prisma.user.findMany({ where, orderBy: { name: 'asc' }, take: 100, select: { id: true, name: true, email: true } });
    return { data: EntityResponseDto.manyUnknown(users) };
  }
}
