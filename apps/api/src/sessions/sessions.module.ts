import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuditModule } from '../audit/audit.module';
@Module({
    imports: [AuditModule],
    providers: [
        SessionsService, AuthGuard
    ],
    controllers: [SessionsController],
    exports: [SessionsService]
})
export class SessionsModule {
}
