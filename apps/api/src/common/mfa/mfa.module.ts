import { Module } from '@nestjs/common'; import { MfaService } from './mfa.service'; import { MfaController } from './mfa.controller'; import { PrismaService } from '../../prisma/prisma.service'; import { AuditModule } from '../../audit/audit.module';
@Module({imports:[AuditModule],controllers:[MfaController],providers:[MfaService,PrismaService],exports:[MfaService]}) export class MfaModule {}
