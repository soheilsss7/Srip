import { Module } from '@nestjs/common';
import { RequirementMatchingService } from './requirement-matching.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
@Module({ providers:[RequirementMatchingService,PrismaService,AuthorizationService], exports:[RequirementMatchingService] })
export class RequirementsModule {}
