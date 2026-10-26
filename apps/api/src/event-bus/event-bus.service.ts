import { Global, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../jobs/queue.service';
import { DOMAIN_EVENT_QUEUE_JOB, DomainEventType, isDomainEventType } from './event-bus.constants';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { Prisma } from '@prisma/client';
import { RequestContext } from '../common/request-context';
import { TraceService } from '../observability/trace.service';

export type DomainEvent = {
  id: string; eventType: DomainEventType; aggregateType: string; aggregateId: string;
  organizationId?: string; actorId?: string; version: number; payload: Record<string, unknown>; occurredAt: string; requestId?: string; correlationId?: string;
};

@Injectable()
export class EventBusService implements OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private readonly subscribers = new Set<(event: DomainEvent) => void | Promise<void>>();
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService, private readonly queues: QueueService, private readonly requestContext: RequestContext, private readonly trace: TraceService) {
    this.timer = setInterval(() => void this.flushPending(), 5000);
  }

  async publish(input: Omit<DomainEvent, 'id'|'version'|'occurredAt'> & { version?: number }) {
    const result = await this.publishInTransaction(this.prisma, input);
    // Queue delivery is deliberately outside the DB transaction. If Redis/queue is unavailable,
    // the committed PENDING outbox row remains durable and flushPending() retries it.
    await this.enqueue(result.id);
    return result;
  }

  async publishInTransaction(tx: Prisma.TransactionClient, input: Omit<DomainEvent, 'id'|'version'|'occurredAt'> & { version?: number }) {
    if (!isDomainEventType(input.eventType)) throw new Error(`Unsupported domain event type: ${String(input.eventType)}`);
    const row = await tx.domainEventOutbox.create({ data: {
      eventType: input.eventType, aggregateType: input.aggregateType, aggregateId: input.aggregateId,
      organizationId: input.organizationId, actorId: input.actorId, version: input.version ?? 1,
      payload: input.payload === undefined ? Prisma.JsonNull : input.payload as Prisma.InputJsonValue,
      requestId: this.requestContext.requestId,
      correlationId: this.requestContext.correlationId,
    }});
    return { id: row.id, eventType: row.eventType as DomainEventType, aggregateType: row.aggregateType,
      aggregateId: row.aggregateId, organizationId: row.organizationId ?? undefined, actorId: row.actorId ?? undefined,
      version: row.version, payload: row.payload as Record<string, unknown>, occurredAt: row.occurredAt.toISOString(), requestId: row.requestId ?? undefined, correlationId: row.correlationId ?? undefined };
  }

  async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  subscribe(handler: (event: DomainEvent) => void | Promise<void>) { this.subscribers.add(handler); return () => this.subscribers.delete(handler); }

  private async emit(event: DomainEvent) { for (const handler of this.subscribers) await handler(event); }

  async dispatch(id: string) {
    const row = await this.prisma.domainEventOutbox.findUnique({ where: { id } });
    if (!row || row.status === 'DISPATCHED') return EntityResponseDto.fromUnknown(row as any);
    const eventSpan = this.trace.childSpan('domain-event.dispatch', { domainEventId: id });
    try {
      const event: DomainEvent = { id: row.id, eventType: row.eventType as DomainEventType, aggregateType: row.aggregateType, aggregateId: row.aggregateId,
        organizationId: row.organizationId ?? undefined, actorId: row.actorId ?? undefined, version: row.version, requestId: row.requestId ?? undefined, correlationId: row.correlationId ?? undefined,
        payload: row.payload as Record<string, unknown>, occurredAt: row.occurredAt.toISOString() };
      await this.emit(event);
      eventSpan.end('OK',{domainEventId:id,requestId:event.requestId??null,correlationId:event.correlationId??null});
      return EntityResponseDto.fromUnknown(await this.prisma.domainEventOutbox.update({ where: { id }, data: { status: 'DISPATCHED', dispatchedAt: new Date(), lastError: null } }));
    } catch (e: any) {
      eventSpan.end('ERROR',{domainEventId:id,errorMessage:String(e?.message??e)});
      await this.prisma.domainEventOutbox.update({ where: { id }, data: { status: 'FAILED', attempts: { increment: 1 }, lastError: String(e?.message ?? e) } });
      throw e;
    }
  }

  async pending(limit = 100) { return await this.prisma.domainEventOutbox.findMany({ where: { status: { in: ['PENDING','FAILED'] } }, orderBy: { createdAt: 'asc' }, take: Math.min(500, limit) }); }
  private async enqueue(id: string) { try { const row = await this.prisma.domainEventOutbox.findUnique({ where: { id }, select: { requestId: true, correlationId: true } }); await this.queues.enqueue(DOMAIN_EVENT_QUEUE_JOB as any, { eventId: id, ...(row?.requestId ? {_requestId: row.requestId} : {}), ...(row?.correlationId ? {_correlationId: row.correlationId} : {}) },       { jobId: id }); } catch (e: any) { this.logger.warn(`domain event enqueue deferred: ${e?.message ?? e}`); } }
  private async enqueueRetry(id: string) { try { const row = await this.prisma.domainEventOutbox.findUnique({ where: { id }, select: { requestId: true, correlationId: true } }); await this.queues.enqueue(DOMAIN_EVENT_QUEUE_JOB as any, { eventId: id, ...(row?.requestId ? {_requestId: row.requestId} : {}), ...(row?.correlationId ? {_correlationId: row.correlationId} : {}) }); } catch (e: any) { this.logger.warn(`domain event retry enqueue deferred: ${e?.message ?? e}`); } }
  private async flushPending() { try { const rows = await this.pending(50); for (const row of rows) await this.enqueueRetry(row.id); } catch (e: any) { this.logger.debug(`domain event flush unavailable: ${e?.message ?? e}`); } }
  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); this.subscribers.clear(); }
}
