import { Module } from '@nestjs/common'; import { PermissionsModule } from '../permissions/permissions.module'; import { AuditModule } from '../audit/audit.module'; import { ScoringModule } from '../scoring/scoring.module'; import { DataLifecycleModule } from '../common/data-lifecycle/data-lifecycle.module'; import { ApprovalModule } from '../approvals/approval.module';
import { RelationshipsController } from './relationships.controller';
import { RelationshipsService } from './relationships.service';
import { RelationshipScoreService } from './relationship-score.service';
import { RelationshipScoreController } from './relationship-score.controller';
import { PrismaService } from '../prisma/prisma.service'; import { FieldSecurityService } from '../common/authorization/field-security.service'; import { RelationshipPresenter } from '../common/authorization/relationship-presenter';
@Module({imports:[PermissionsModule, AuditModule, ScoringModule, DataLifecycleModule, ApprovalModule], controllers:[RelationshipsController,RelationshipScoreController], providers:[RelationshipsService,RelationshipScoreService,PrismaService,FieldSecurityService,RelationshipPresenter], exports:[RelationshipScoreService] })
export class RelationshipsModule {}
