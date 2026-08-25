import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports:[AuditModule],
  providers: [SessionsService, PrismaService, AuthGuard],
  controllers: [SessionsController],
  exports: [SessionsService],
})
export class SessionsModule {}
