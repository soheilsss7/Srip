import { Global, Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { FieldSecurityService } from './field-security.service';

@Global()
@Module({
  providers: [AuthorizationService, FieldSecurityService],
  exports: [AuthorizationService, FieldSecurityService],
})
export class AuthorizationModule {}
