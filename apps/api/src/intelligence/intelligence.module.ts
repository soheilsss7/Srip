import { Module } from '@nestjs/common';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService } from './intelligence.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { NetworkModule } from '../network/network.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({ imports: [NetworkModule, ScoringModule], controllers: [IntelligenceController], providers: [IntelligenceService, PrismaService, AuthorizationService], exports: [IntelligenceService] })
export class IntelligenceModule {}
