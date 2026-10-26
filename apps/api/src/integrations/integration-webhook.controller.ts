import { BadRequestException, Controller, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { WebhookSignatureGuard } from '../common/guards/webhook-signature.guard';

@Controller('integrations/webhooks')
@UseGuards(WebhookSignatureGuard)
export class IntegrationWebhookController {
  constructor(private readonly service: IntegrationsService) {}

  @Post(':provider')
  webhook(
    @Param('provider') provider: string,
    @Headers('x-webhook-signature') headerSignature: string | undefined,
    @Headers('x-signature') alternateSignature: string | undefined,
    @Headers('x-hub-signature-256') githubStyleSignature: string | undefined,
    @Headers('x-webhook-timestamp') timestamp: string | undefined,
    @Headers('x-event-id') eventId: string | undefined,
    @Headers('x-event-type') eventType: string | undefined,
    @Query('signature') legacySignature: string | undefined,
    @Req() req: any,
  ) {
    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : null;
    if (!rawBody) throw new BadRequestException('Raw webhook body is unavailable');
    const signature = headerSignature || githubStyleSignature || alternateSignature || legacySignature || '';
    return this.service.webhook(provider as any, signature, rawBody, { timestamp, eventId, eventType });
  }
}
