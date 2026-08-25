import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

@Module({
  imports: [CustomFieldsModule],
  controllers: [AdminController],
  providers: [AdminService, PrismaService, AuthorizationService, AuditService],
})
export class AdminModule {}
