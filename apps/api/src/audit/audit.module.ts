import {Module} from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import {AuditController} from './audit.controller';
import {AuditService} from './audit.service';
import {PrismaService} from '../prisma/prisma.service';
import {AuthGuard} from '../common/guards/auth.guard';
@Module({imports:[PermissionsModule],controllers:[AuditController],providers:[AuditService,PrismaService,AuthGuard],exports:[AuditService]})
export class AuditModule{}
