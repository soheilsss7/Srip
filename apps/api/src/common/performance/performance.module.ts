import { Global, Module } from '@nestjs/common';
import { PerformanceCacheService } from './performance-cache.service';

@Global()
@Module({ providers: [PerformanceCacheService], exports: [PerformanceCacheService] })
export class PerformanceModule {}
