import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
@Module({
    imports: [PermissionsModule, AuditModule],
    controllers: [TagsController],
    providers: [
        TagsService
    ],
    exports: [TagsService]
})
export class TagsModule {
}
