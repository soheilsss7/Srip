import { Injectable } from '@nestjs/common';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
@Injectable()
export class UsersService {
  status() { return { module: 'users', status: 'foundation-ready' }; }
}
