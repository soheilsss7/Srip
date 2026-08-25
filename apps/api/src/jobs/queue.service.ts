import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { Job, JobsOptions, Queue } from 'bullmq';
import { JOB_NAMES, JOB_QUEUE, JobName, QUEUE_NAMES, QueueName } from './queue.constants';
import { MetricsService } from '../observability/metrics.service';
import { TraceService } from '../observability/trace.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  private readonly queues = new Map<QueueName, Queue>();
  private readonly defaultOptions: JobsOptions;

  constructor(private readonly config: ConfigService, private readonly metrics:MetricsService, private readonly trace:TraceService) {
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
    this.defaultOptions = {
      attempts: Math.max(1, Number(this.config.get('QUEUE_MAX_ATTEMPTS', '5'))),
      backoff: { type: 'exponential', delay: Math.max(1000, Number(this.config.get('QUEUE_BACKOFF_MS', '2000'))) },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800, count: 5000 },
    };
  }

  private queue(name: QueueName) {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection, defaultJobOptions: this.defaultOptions });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async enqueue<T extends Record<string, unknown>>(name: JobName, payload: T, options: JobsOptions = {}) {
    const queueName = JOB_QUEUE[name];
    const started=Date.now();
    const currentTrace=this.trace.current();
    const data:any={...payload, ...(currentTrace?.traceparent ? {_traceparent:currentTrace.traceparent} : {}), ...(currentTrace?.requestId ? {_requestId:currentTrace.requestId} : {}), ...(currentTrace?.correlationId ? {_correlationId:currentTrace.correlationId} : {})};
    const job = await this.queue(queueName).add(name, data, { ...this.defaultOptions, ...options });
    this.metrics.observeQueue(queueName, await this.queue(queueName).getJobCounts('waiting','active','completed','failed','delayed','paused'));
    void this.trace.exportSpan({name:`queue.enqueue ${name}`,kind:'producer',startTime:started,endTime:Date.now(),attributes:{queue:queueName,jobName:name,requestId:currentTrace?.requestId??null,correlationId:currentTrace?.correlationId??null,jobId:String(job.id)},status:'OK'}, this.trace.current()??this.trace.startRoot());
    return this.serialize(job);
  }

  async get(name: JobName, id: string) {
    const job = await this.queue(JOB_QUEUE[name]).getJob(id);
    return job ? this.serialize(job) : undefined;
  }

  async list(queueName: QueueName = QUEUE_NAMES.default) {
    const jobs = await this.queue(queueName).getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'], 0, 99, true);
    return jobs.map((job) => this.serialize(job));
  }

  async counts(queueName: QueueName) {
    return this.queue(queueName).getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
  }

  async pause(queueName: QueueName) {
    await this.queue(queueName).pause();
    return { queue: queueName, paused: true };
  }

  async resume(queueName: QueueName) {
    await this.queue(queueName).resume();
    return { queue: queueName, paused: false };
  }

  async deadLetter(data: Record<string, unknown>) {
    const currentTrace = this.trace.current();
    const enriched = { ...data, ...(currentTrace?.traceparent ? {_traceparent: currentTrace.traceparent} : {}), ...(currentTrace?.requestId ? {_requestId: currentTrace.requestId} : {}), ...(currentTrace?.correlationId ? {_correlationId: currentTrace.correlationId} : {}) };
    return this.queue(QUEUE_NAMES.deadLetter).add('dead-letter', enriched, { attempts: 1, removeOnComplete: { age: 604800, count: 10000 } });
  }

  async ping() {
    return this.connection.ping();
  }

  private serialize(job: Job) {
    return {
      id: String(job.id),
      name: job.name,
      queue: job.queueName,
      status: job.finishedOn ? (job.failedReason ? 'FAILED' : 'SUCCEEDED') : job.processedOn ? 'RUNNING' : 'QUEUED',
      attemptsMade: job.attemptsMade,
      attempts: job.opts.attempts ?? this.defaultOptions.attempts,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      failedReason: job.failedReason ?? null,
      data: job.data,
    };
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    await this.connection.quit();
  }
}
