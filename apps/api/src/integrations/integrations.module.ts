import { Module } from '@nestjs/common';
import { DataLifecycleModule } from '../common/data-lifecycle/data-lifecycle.module';
import { SecretEncryptionModule } from '../common/security/secret-encryption.module';
import { IntegrationWebhookController } from './integration-webhook.controller';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationReconciliationService } from './integration-reconciliation.service';
import { GoogleIntegrationProvider } from './google.integration-provider';
import { MicrosoftIntegrationProvider } from './microsoft.integration-provider';
import { AuditService } from '../audit/audit.service';
import { EventBusModule } from '../event-bus/event-bus.module';
@Module({ imports: [DataLifecycleModule, SecretEncryptionModule, EventBusModule], controllers: [IntegrationsController, IntegrationWebhookController], providers: [
        IntegrationsService, IntegrationReconciliationService, GoogleIntegrationProvider, MicrosoftIntegrationProvider, AuditService
    ], exports: [IntegrationsService] })
export class IntegrationsModule {
}
