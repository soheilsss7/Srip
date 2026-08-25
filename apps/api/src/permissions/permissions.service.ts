import { Injectable } from '@nestjs/common';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly authorization: AuthorizationService) {}
  ensure(userId: string, permission: string, organizationId?: string) { return this.authorization.assertPermission(userId, permission, { organizationId: organizationId }); }
  accessibleOrganizations(userId: string) { return this.authorization.accessibleOrganizationIds(userId); }
}
