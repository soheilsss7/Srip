import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiGatewayService } from './ai.gateway.service';
import { AiPipelineService } from './ai-pipeline.service';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { DeterministicAiProvider } from './providers/deterministic.provider';
import { ExternalAiProvider } from './providers/external.provider';
@Module({ imports: [AuthModule, AuditModule], controllers: [AiController], providers: [
        AiService, AiGatewayService, AiPipelineService, DeterministicAiProvider, ExternalAiProvider
    ], exports: [AiService, AiGatewayService, AiPipelineService] })
export class AiModule {
}
