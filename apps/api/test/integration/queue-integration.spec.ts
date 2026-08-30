import IORedis from 'ioredis';
import { Queue, Worker, QueueEvents, Job } from 'bullmq';

/**
 * PHASE AG — real Redis/BullMQ integration.
 *
 * This is intentionally opt-in: it MUST execute against a real Redis instance
 * and a real BullMQ Worker. No in-memory queue, mock Redis, or fake processor
 * is accepted as a runtime PASS.
 *
 * Run:
 *   RUN_QUEUE_INTEGRATION=1 REDIS_URL=redis://127.0.0.1:6379 \
 *     pnpm --filter @srip/api test -- test/integration/queue-integration.spec.ts
 */
const enabled = process.env.RUN_QUEUE_INTEGRATION === '1';
const describeIntegration = enabled ? describe : describe.skip;

describeIntegration('PHASE AG queue integration: Create Job → Redis → Worker → Process → Success', () => {
  let connection: IORedis;
  let probe: IORedis;
  let queue: Queue;
  let worker: Worker;
  let events: QueueEvents;
  const queueName = `srip-ag-queue-${process.pid}-${Date.now()}`;

  beforeAll(async () => {
    try {
      const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
      // Probe with finite command retries first. BullMQ workers require a
      // separate connection with maxRetriesPerRequest=null, which otherwise
      // makes a missing Redis instance retry a health check forever.
      probe = new IORedis(redisUrl, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        lazyConnect: false,
      });
      probe.on('error', () => undefined);
      await probe.ping();
      probe.disconnect();

      connection = new IORedis(redisUrl, {
        connectTimeout: 2000,
        maxRetriesPerRequest: null,
        retryStrategy: (attempts) => Math.min(attempts * 100, 1000),
        lazyConnect: false,
      });
      connection.on('error', () => undefined);

      queue = new Queue(queueName, {
        connection,
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: { age: 300, count: 100 },
          removeOnFail: { age: 300, count: 100 },
        },
      });
      events = new QueueEvents(queueName, { connection });
      await events.waitUntilReady();

      worker = new Worker(
        queueName,
        async (job: Job<{ value: string }>) => {
          if (job.name !== 'phase-ag.queue.smoke') throw new Error(`Unexpected job: ${job.name}`);
          if (job.data.value !== 'phase-ag') throw new Error('Unexpected job payload');
          return { processed: true, value: job.data.value };
        },
        { connection, concurrency: 1 },
      );
      await worker.waitUntilReady();
    } catch (error) {
      probe?.disconnect();
      connection?.disconnect();
      throw error;
    }
  }, 15_000);

  afterAll(async () => {
    await worker?.close().catch(() => undefined);
    await events?.close().catch(() => undefined);
    await queue?.obliterate({ force: true }).catch(() => undefined);
    await queue?.close().catch(() => undefined);
    probe?.disconnect();
    connection?.disconnect();
  }, 15_000);

  it('creates a job, persists it in Redis, processes it with a real Worker, and reaches completed state', async () => {
    const job = await queue.add('phase-ag.queue.smoke', { value: 'phase-ag' });
    expect(job.id).toBeTruthy();

    const persisted = await queue.getJob(job.id!);
    expect(persisted).toBeTruthy();
    expect(persisted?.data).toEqual({ value: 'phase-ag' });

    const completed = await job.waitUntilFinished(events, 15_000);
    expect(completed).toEqual({ processed: true, value: 'phase-ag' });

    const finalJob = await queue.getJob(job.id!);
    expect(finalJob).toBeTruthy();
    expect(finalJob?.finishedOn).toBeTruthy();
    expect(finalJob?.failedReason).toBeUndefined();
    expect(finalJob?.returnvalue).toEqual({ processed: true, value: 'phase-ag' });
  });
});
