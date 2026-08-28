import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { Job, Worker } from 'bullmq';
import { AiPipelineService } from '../ai/ai-pipeline.service';
import { DocumentsService } from '../documents/documents.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { MeetingsService } from '../meetings/meetings.service';
import { SearchService } from '../search/search.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CommitmentsService } from '../commitments/commitments.service';
import { JOB_NAMES, QUEUE_NAMES } from './queue.constants';
import { QueueService } from './queue.service';
import { TraceService } from '../observability/trace.service';
import { MetricsService } from '../observability/metrics.service';
import { RequestContext } from '../common/request-context';
import { PrivacyService } from '../privacy/privacy.service';

type Payload = Record<string, any>;

@Injectable()
export class JobWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobWorker.name);
  private readonly workers: Worker[] = [];
  private connection?: IORedis;

  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly ai: AiPipelineService,
    private readonly documents: DocumentsService,
    private readonly integrations: IntegrationsService,
    private readonly recommendations: RecommendationsService,
    private readonly meetings: MeetingsService,
    private readonly search: SearchService,
    private readonly analytics: AnalyticsService,
    private readonly commitments: CommitmentsService,
    private readonly queues: QueueService,
    private readonly trace: TraceService,
    private readonly metrics: MetricsService,
    private readonly requestContext: RequestContext,
    private readonly privacy: PrivacyService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('QUEUE_WORKER_ENABLED', 'false') !== 'true') return;
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
    for (const queue of Object.values(QUEUE_NAMES)) {
      if (queue === QUEUE_NAMES.deadLetter) continue;
      if (queue === QUEUE_NAMES.default) continue;
      if (queue === QUEUE_NAMES.dataImports) continue;
      const worker = new Worker(queue, (job) => this.process(job), {
        connection: this.connection,
        concurrency: Math.max(1, Number(this.config.get('QUEUE_CONCURRENCY', '5'))),
        limiter: { max: Math.max(1, Number(this.config.get('QUEUE_RATE_LIMIT_MAX', '100'))), duration: Math.max(1000, Number(this.config.get('QUEUE_RATE_LIMIT_DURATION_MS', '1000'))) },
      });
      worker.on('completed', (job) => this.logger.log(`job completed queue=${queue} id=${job.id} name=${job.name}`));
      worker.on('failed', (job, error) => {
        this.logger.error(`job failed queue=${queue} id=${job?.id} name=${job?.name}: ${error.message}`);
        if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
          void this.queues.deadLetter({ queue, jobId: String(job.id), name: job.name, data: job.data, attemptsMade: job.attemptsMade, failedReason: error.message, failedAt: new Date().toISOString() });
        }
      });
      worker.on('error', (error) => this.logger.error(`worker error queue=${queue}: ${error.message}`));
      this.workers.push(worker);
    }
    this.scheduleMaintenance();
    this.logger.log(`Background workers enabled: ${this.workers.length} queues`);
  }

  /**
   * Job‌های تعمیر و نگهداری زمان‌بندی‌شده (بدون هیچ سرویس بیرونی):
   *  - جاروب تعهدات عقب‌افتاده هر ۱۵ دقیقه (Follow-up خودکار)
   *  - محاسبه Snapshot تحلیلی هر ساعت
   *  - نگهداری Search Index هر ۶ ساعت
   * از BullMQ Repeatable Jobs استفاده می‌کند تا با Redis موجود هماهنگ بماند
   * و در محیط چند-Instance هم تکراری اجرا نشود (BullMQ خودش این را تضمین
   * می‌کند).
   */
  private async scheduleMaintenance() {
    try {
      await this.queues.enqueue(JOB_NAMES.analyticsRecompute, {}, { repeat: { every: 60 * 60 * 1000 } } as any);
    } catch (error: any) {
      this.logger.warn(`Could not schedule analytics recompute: ${error?.message ?? error}`);
    }
    try {
      await this.queues.enqueue(JOB_NAMES.searchReindex, {}, { repeat: { every: 6 * 60 * 60 * 1000 } } as any);
    } catch (error: any) {
      this.logger.warn(`Could not schedule search reindex: ${error?.message ?? error}`);
    }
    try {
      await this.queues.enqueue(JOB_NAMES.overdueSweep, {}, { repeat: { every: 15 * 60 * 1000 } } as any);
    } catch (error: any) {
      this.logger.warn(`Could not schedule overdue sweep: ${error?.message ?? error}`);
    }
  }

  private async process(job: Job<Payload>) {
    const traceparent=typeof job.data?._traceparent === 'string' ? job.data._traceparent : undefined;
    const parent=this.trace.parseTraceparent(traceparent);
    const ctx=this.trace.startRoot(parent?.traceparent, { requestId: typeof job.data?._requestId === 'string' ? job.data._requestId : undefined, correlationId: typeof job.data?._correlationId === 'string' ? job.data._correlationId : undefined });
    const started=Date.now();
    return this.trace.run(ctx,async()=>this.requestContext.run({ requestId: ctx.requestId, correlationId: ctx.correlationId, userId: typeof job.data?.userId === 'string' ? job.data.userId : undefined }, async()=>{
      const span=this.trace.childSpan(`queue.process ${job.name}`,{queue:job.queueName,jobName:job.name,jobId:String(job.id)},'consumer');
      try {
        const result=await this.processJob(job);
        const duration=Date.now()-started;this.metrics.observeQueue(job.queueName,await this.queues.counts(job.queueName as any));
        span.end('OK',{durationMs:duration});
        return result;
      } catch(error){span.end('ERROR',{durationMs:Date.now()-started});throw error;}
    }));
  }

  private async processJob(job: Job<Payload>) {
    switch (job.name) {
      case JOB_NAMES.notificationDispatch:
        return this.notifications.create(job.data.userId, job.data.notification);
      case JOB_NAMES.aiProcess:
        if (job.data.operation === 'indexDocument') return this.ai.indexDocument(job.data.userId, job.data.documentId, job.data.text);
        throw new Error(`Unsupported AI job operation: ${job.data.operation}`);
      case JOB_NAMES.documentProcess:
        return this.documents.index(job.data.userId, job.data.documentId, job.data.text);
      case JOB_NAMES.integrationSync:
        return this.integrations.sync(job.data.userId, job.data.connectionId);
      case JOB_NAMES.recommendationGenerate:
        return this.recommendations.generate(job.data.userId, job.data.organizationId);
      case JOB_NAMES.meetingTranscribe:
        // نام Job تاریخی است ("transcribe") ولی این پروژه به عمد به هیچ
        // سرویس ASR/AI بیرونی وصل نمی‌شود. آنچه واقعاً اجرا می‌شود: پردازش
        // قطعی (deterministic) متن notes/transcript موجودِ همان Meeting و
        // به‌روزرسانی کاندیدهای Follow-up آن — دقیقاً همان قابلیتی که برای
        // «ثبت خروجی جلسه و آماده‌سازی برای پیگیری» لازم است.
        if (!job.data.meetingId) throw new Error('meetingId is required for meetings.transcribe job');
        return this.meetings.regenerateFollowUpCandidates(job.data.meetingId);
      case JOB_NAMES.searchReindex:
        return this.search.reindex();
      case JOB_NAMES.analyticsRecompute:
        return this.analytics.recompute();
      case JOB_NAMES.overdueSweep:
        return this.commitments.sweepOverdue();
      case JOB_NAMES.privacyExportProcess:
        return this.privacy.processExportJob(job.data.requestId, job.data.userId);
      case JOB_NAMES.reminderDispatch:
        return this.notifications.create(job.data.userId, job.data.notification);
      default:
        throw new Error(`Unsupported job name: ${job.name}`);
    }
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((worker) => worker.close()));
    if (this.connection) await this.connection.quit();
  }
}
