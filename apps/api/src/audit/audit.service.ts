import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { RequestContext } from '../common/request-context';

const SECRET_KEY = /(password|passwd|token|secret|authorization|cookie|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?state|codeHash|tokenHash)/i;
const SENSITIVE_CONTENT_KEY = /^(content|body|documentContent)$/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[REDACTED_DEPTH]';
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 200).map(v => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key) || SENSITIVE_CONTENT_KEY.test(key)) out[key] = '[REDACTED]';
    else out[key] = redact(child, depth + 1);
  }
  return out;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly requestContext: RequestContext) {}

  async logMutation(input: { userId?: string; action: AuditAction; entityType: string; entityId?: string; organizationId?: string; before?: unknown; after?: unknown; reason?: string; requestId?: string; ipAddress?: string; userAgent?: string }, tx?: Prisma.TransactionClient) {
    const ctx = this.requestContext.get();
    const userId = input.userId ?? ctx?.userId;
    return EntityResponseDto.fromUnknown(await (tx ?? this.prisma).auditLog.create({ data: {
      userId, action: input.action as AuditAction, entityType: input.entityType, entityId: input.entityId, organizationId: input.organizationId,
      before: redact(input.before) as any, after: redact(input.after) as any, reason: input.reason,
      requestId: input.requestId ?? ctx?.requestId, correlationId: ctx?.correlationId,
      ipAddress: input.ipAddress ?? ctx?.ip, userAgent: input.userAgent ?? ctx?.userAgent,
    } }));
  }

  async list(userId:string){
    const ids=await this.authorization.accessibleOrganizationIds(userId);
    return EntityResponseDto.manyUnknown(await this.prisma.auditLog.findMany({where:ids?{OR:[{organizationId:{in:ids}},{organizationId:null,userId}]}:{},orderBy:{createdAt:'desc'},take:200}));
  }
}
