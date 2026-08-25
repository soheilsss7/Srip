import { Global, Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { ConfigModule } from '@nestjs/config';
import { EventBusService } from './event-bus.service';
import { EventBusWorker } from './event-bus.worker';

@Global()
@Module({ imports: [JobsModule, ConfigModule], providers: [EventBusService, EventBusWorker], exports: [EventBusService] })
export class EventBusModule {}
