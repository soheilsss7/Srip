import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { ScoreResult, ScoreSubjectType } from './score-types';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { AuditService } from '../audit/audit.service';

export const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

@Injectable()
export class ScoringBaseService {
  constructor(protected readonly prisma: PrismaService, protected readonly eventBus: EventBusService, protected readonly audit: AuditService) {}

  protected async activeVersion(type: ScoreSubjectType) {
    const name = `${type.toLowerCase()}-default`;
    const version = await this.prisma.scoreVersion.findFirst({ where: { name, status: 'ACTIVE' }, orderBy: { version: 'desc' } });
    return { version, weights: (version?.weights ?? {}) as Record<string, number> };
  }

  protected async persist(userId: string, result: ScoreResult, organizationId?: string) {
    const canonicalId = `${result.type.toLowerCase()}:${result.subjectType.toLowerCase()}:${result.subjectId}`;
    const persisted = await this.eventBus.transaction(async tx => {
      const score = await tx.score.upsert({
        where: { id: canonicalId },
        update: { type: result.type, subjectType: result.subjectType, subjectId: result.subjectId, value: result.score, version: result.version, explanation: result.explanation, metadata: { factors: result.factors, versionId: result.versionId ?? null } },
        create: { id: canonicalId, type: result.type, subjectType: result.subjectType, subjectId: result.subjectId, value: result.score, version: result.version, explanation: result.explanation, metadata: { factors: result.factors, versionId: result.versionId ?? null } },
      });
      await tx.scoreSnapshot.create({ data: { scoreId: score.id, value: result.score, version: result.version, explanation: result.explanation, metadata: { factors: result.factors, versionId: result.versionId ?? null } } });
      await this.audit.logMutation({userId,action:'UPDATE',entityType:'Score',entityId:score.id,organizationId,before:{score:undefined},after:{score:result.score,version:result.version,subjectType:result.subjectType,subjectId:result.subjectId},reason:'score-persisted'},tx);
      await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.SCORE_UPDATED,aggregateType:'Score',aggregateId:score.id,organizationId,actorId:userId,payload:{score,result}});
      return score;
    });
    return { ...result, scoreId: persisted.id, persistedAt: new Date().toISOString() };
  }
}
