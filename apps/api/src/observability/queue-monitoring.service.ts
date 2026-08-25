import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../jobs/queue.constants';
import { MetricsService } from './metrics.service';

@Injectable()
export class QueueMonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly connection:IORedis; private readonly queues=new Map<string,Queue>(); private timer?:NodeJS.Timeout;
  constructor(private readonly config:ConfigService,private readonly metrics:MetricsService){
    const redisUrl=this.config.get<string>('REDIS_URL','redis://localhost:6379');
    this.connection=new IORedis(redisUrl,{maxRetriesPerRequest:null,enableReadyCheck:true});
    for(const name of Object.values(QUEUE_NAMES)) this.queues.set(name,new Queue(name,{connection:this.connection}));
  }
  onModuleInit(){void this.refresh();this.timer=setInterval(()=>void this.refresh(),Math.max(5000,Number(process.env.QUEUE_METRICS_INTERVAL_MS??15000)));this.timer.unref();}
  async refresh(){for(const [name,q] of this.queues){try{this.metrics.observeQueue(name,await q.getJobCounts('waiting','active','completed','failed','delayed','paused'));}catch{this.metrics.observeQueue(name,{waiting:-1,active:-1,completed:-1,failed:-1,delayed:-1,paused:-1});}}}
  async ping(){ return this.connection.ping(); }

  async snapshot(){await this.refresh();return this.metrics.snapshot().queue;}
  async onModuleDestroy(){if(this.timer)clearInterval(this.timer);await Promise.all([...this.queues.values()].map(q=>q.close()));await this.connection.quit();}
}
