import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { Worker } from 'bullmq';
import { EventBusService } from './event-bus.service';
import { DOMAIN_EVENT_QUEUE_JOB } from './event-bus.constants';

@Injectable()
export class EventBusWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker; private connection?: IORedis;
  constructor(private readonly config: ConfigService, private readonly bus: EventBusService) {}
  onModuleInit() {
    if (this.config.get<string>('QUEUE_WORKER_ENABLED','false') !== 'true') return;
    this.connection = new IORedis(this.config.get<string>('REDIS_URL','redis://localhost:6379'), { maxRetriesPerRequest: null, enableReadyCheck: true });
    this.worker = new Worker('srip-default', async job => { if (job.name === DOMAIN_EVENT_QUEUE_JOB) return this.bus.dispatch(String(job.data.eventId)); throw new Error(`Unsupported event bus job: ${job.name}`); }, { connection: this.connection, concurrency: Math.max(1, Number(this.config.get('QUEUE_CONCURRENCY','5'))) });
  }
  async onModuleDestroy() { await this.worker?.close(); if (this.connection) await this.connection.quit(); }
}
