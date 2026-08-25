import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
@Module({imports:[AuditModule, PermissionsModule],controllers:[RecommendationsController],providers:[RecommendationsService],exports:[RecommendationsService]}) export class RecommendationsModule {}
