import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { EventBusModule } from '../event-bus/event-bus.module';
import { AuditModule } from '../audit/audit.module';
import { ScoringBaseService } from './scoring-base.service';
import { CanonicalRelationshipScoreService } from './relationship-score.service';
import { OpportunityScoreService } from './opportunity-score.service';
import { RiskScoreService } from './risk-score.service';
import { ConnectorScoreService } from './connector-score.service';
import { NetworkScoreService } from './network-score.service';
import { ScoringController } from './scoring.controller';
import { ScoreVersioningService } from './score-versioning.service';

@Module({
  imports: [EventBusModule, AuditModule],
  controllers: [ScoringController],
  providers: [PrismaService, AuthorizationService, ScoringBaseService, ScoreVersioningService, CanonicalRelationshipScoreService, OpportunityScoreService, RiskScoreService, ConnectorScoreService, NetworkScoreService],
  exports: [CanonicalRelationshipScoreService, OpportunityScoreService, RiskScoreService, ConnectorScoreService, NetworkScoreService],
})
export class ScoringModule {}
