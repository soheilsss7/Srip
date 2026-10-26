import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EntityScoreService } from './entity-score.service';
import { EntityScoresController } from './entity-scores.controller';

@Module({
  imports: [AuditModule],
  controllers: [EntityScoresController],
  providers: [EntityScoreService],
  exports: [EntityScoreService],
})
export class EntityScoresModule {}
