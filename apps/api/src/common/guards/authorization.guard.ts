import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { AuthorizationService } from '../authorization/authorization.service';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly authorization: AuthorizationService) {}
  async canActivate(context: ExecutionContext) {
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!permission) return true;
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.sub;
    if (!userId) throw new ForbiddenException('Missing authenticated principal');
    const organizationId = req.body?.organizationId ?? req.query?.organizationId ?? req.params?.organizationId;
    await this.authorization.assertPermission(userId, permission, { organizationId: organizationId });
    req.authorization = { permission, organizationId };
    return true;
  }
}
