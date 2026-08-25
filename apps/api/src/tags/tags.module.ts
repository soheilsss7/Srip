import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../prisma/prisma.service';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [PermissionsModule, AuditModule],
  controllers: [TagsController],
  providers: [TagsService, PrismaService],
  exports: [TagsService],
})
export class TagsModule {}
