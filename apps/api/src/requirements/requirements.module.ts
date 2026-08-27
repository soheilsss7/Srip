import { Module } from '@nestjs/common';
import { RequirementMatchingService } from './requirement-matching.service';
@Module({ providers: [
        RequirementMatchingService
    ], exports: [RequirementMatchingService] })
export class RequirementsModule {
}
