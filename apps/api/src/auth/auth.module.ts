import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { SessionsModule } from '../sessions/sessions.module';
import { MfaModule } from '../common/mfa/mfa.module';
import { OidcService } from './oidc.service';
import { AuditModule } from '../audit/audit.module';
@Global()
@Module({
  imports:[SessionsModule,MfaModule,AuditModule, JwtModule.register({secret:process.env.JWT_SECRET ?? 'dev-only-change-me', signOptions:{expiresIn:'15m'}})],
  controllers:[AuthController],
  providers:[AuthService,PrismaService,AuthGuard,OidcService],
  exports:[AuthService,JwtModule,AuthGuard]
}) export class AuthModule {}
