import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async record(input: {
    userId?: string; organizationId?: string; type: any; severity?: any;
    requestId?: string; ipAddress?: string; userAgent?: string;
    entityType?: string; entityId?: string; metadata?: unknown;
  }) {
    return EntityResponseDto.fromUnknown(await this.prisma.securityEvent.create({ data: input as any }));
  }

  async list(userId: string, organizationIds: string[] | null, take = 200) {
    const where = organizationIds === null
      ? { userId }
      : { OR: [{ userId }, { organizationId: { in: organizationIds } }] };
    return EntityResponseDto.manyUnknown(await this.prisma.securityEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(take, 500) }));
  }

  async exportLog(input: { userId: string; organizationId?: string; exportType: string; entityType?: string; recordCount?: number; classification?: any; requestId?: string; ipAddress?: string; }) {
    await this.record({ userId: input.userId, organizationId: input.organizationId, type: 'EXPORT_CREATED', severity: 'INFO', requestId: input.requestId, ipAddress: input.ipAddress, entityType: input.entityType, metadata: { exportType: input.exportType, recordCount: input.recordCount ?? 0 } });
    const row=await this.prisma.dataExportLog.create({ data: input as any }); await this.audit.logMutation({userId:input.userId,action:'EXPORT',entityType:'SecurityLog',entityId:row.id,organizationId:input.organizationId,after:{exportType:input.exportType,recordCount:input.recordCount??0},reason:'security-log-export'}); return EntityResponseDto.fromUnknown(row);
  }

  async exportHistory(userId: string, organizationIds: string[] | null, take = 200) {
    const where = organizationIds === null ? { userId } : { OR: [{ userId }, { organizationId: { in: organizationIds } }] };
    return EntityResponseDto.manyUnknown(await this.prisma.dataExportLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(take, 500) }));
  }
}
