import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { makeAdapter } from './prisma-factory';
import { MetricsService } from '../observability/metrics.service';
import { TraceService } from '../observability/trace.service';
import { SensitiveDataSanitizer } from '../common/security/sensitive-data-sanitizer';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  constructor(private readonly metrics:MetricsService, private readonly trace:TraceService, private readonly config: ConfigService){
    super({ adapter: makeAdapter(), log:[{emit:'event',level:'query'}] } as any);
    (this as any).$on('query',(event:any)=>{
      const duration=Number(event.duration??0);
      const slowThreshold=Number(this.config.get('DB_SLOW_QUERY_MS') ?? 250);
      if(duration >= slowThreshold) this.logger.warn(`SLOW_QUERY durationMs=${duration} thresholdMs=${slowThreshold} statement=${SensitiveDataSanitizer.sanitizeSql(event.query)}`);
      this.metrics.observeDb(duration,'prisma.query');
      const span=this.trace.childSpan('db.query',{dbSystem:'postgresql',dbOperation:'query',dbStatement:SensitiveDataSanitizer.sanitizeSql(event.query).slice(0,500)},'internal');
      span.end('OK',{durationMs:duration});
    });
  }
  async onModuleInit(){ await this.$connect(); await this.verifyConnectionPool(); }
  private async verifyConnectionPool(){ const url=this.config.get<string>('DATABASE_URL',''); if(!url)return; try{const parsed=new URL(url); const limit=parsed.searchParams.get('connection_limit'); const timeout=parsed.searchParams.get('pool_timeout'); this.logger.log(`DB_POOL_CONFIG connection_limit=${limit??'default'} pool_timeout=${timeout??'default'}`); if(process.env.DB_POOL_REQUIRE_EXPLICIT==='true'&&(!limit||!timeout)) throw new Error('DATABASE_URL must define connection_limit and pool_timeout'); await this.$queryRaw`SELECT 1`; }catch(error){this.logger.error(`DB_POOL_VERIFY_FAILED: ${error instanceof Error?error.message:String(error)}`); if(process.env.DB_POOL_REQUIRE_EXPLICIT==='true')throw error;} }
  async onModuleDestroy(){ await this.$disconnect(); }
}
