import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { QueueMonitoringService } from '../observability/queue-monitoring.service';
import { MetricsService } from '../observability/metrics.service';
import { S3Storage } from '../documents/s3.storage';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queues: QueueMonitoringService,
    private readonly metrics: MetricsService,
    private readonly storageClient: S3Storage,
  ) {}

  liveness() {
    return { status: 'ok', service: 'srip-api', timestamp: new Date().toISOString() };
  }

  async status() {
    const dependencies = await this.checkDependencies();
    const ok=Object.values(dependencies).every((x:any)=>x.status==='ok');
    this.metrics.observeAvailability(ok);
    return {
      status: ok ? 'ok' : 'degraded',
      service: 'srip-api',
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }

  async readiness() {
    const dependencies = await this.checkDependencies();
    const ok=Object.values(dependencies).every((x:any)=>x.status==='ok');
    this.metrics.observeAvailability(ok);
    return {
      status: ok ? 'ready' : 'not_ready',
      dependencies,
    };
  }

  private async checkDependencies() {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();
    const queue = await this.checkQueue();
    const storage = await this.checkStorage();
    return { database, redis, queue, storage };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' as const };
    } catch (error) {
      return { status: 'error' as const, error: 'dependency unavailable' };
    }
  }

  private async checkQueue(){try{const snapshot=await this.queues.snapshot();const values=Object.values(snapshot as any);const ok=values.length>0&&values.every((x:any)=>Object.values(x).some((v:any)=>v>=0));return ok?{status:'ok' as const}:{status:'error' as const,error:'queue metrics unavailable'};}catch(error){return {status:'error' as const,error:'dependency unavailable'};}}

  private async checkStorage() {
    const configured = Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
    const required = process.env.S3_REQUIRED === 'true';
    if (!configured) {
      if (required) return { status: 'error' as const, configured: false, optional: false, error: 'storage unavailable' };
      return { status: 'ok' as const, configured: false, optional: true };
    }
    const probe = await this.storageClient.healthCheck();
    return probe.status === 'ok' ? { status: 'ok' as const, configured: true } : { status: 'error' as const, configured: true, error: 'storage unavailable' };
  }

  private async checkRedis(): Promise<{ status: 'ok' | 'error'; error?: string }> {
    try {
      await this.queues.ping();
      return { status: 'ok' };
    } catch {
      return { status: 'error', error: 'redis unavailable' };
    }
  }
}
