import { Module } from '@nestjs/common'; import { PermissionsModule } from '../permissions/permissions.module'; import { SearchService } from './search.service'; import { SearchController } from './search.controller';
@Module({imports:[PermissionsModule],providers:[SearchService],controllers:[SearchController],exports:[SearchService]}) export class SearchModule {}
