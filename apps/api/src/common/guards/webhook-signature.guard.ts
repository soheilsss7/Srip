import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';

/**
 * Controller-level gate for signed webhooks.
 * Cryptographic verification remains canonical in IntegrationsService.webhook().
 * This guard prevents unsigned/malformed requests from entering the handler.
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const rawBody = req.rawBody;
    const signature = req.headers['x-webhook-signature']
      ?? req.headers['x-signature']
      ?? req.headers['x-hub-signature-256']
      ?? req.query?.signature;
    const timestamp = req.headers['x-webhook-timestamp'];
    if (!Buffer.isBuffer(rawBody)) throw new BadRequestException('Raw webhook body is unavailable');
    if (!signature || typeof signature !== 'string') throw new BadRequestException('Webhook signature is required');
    if (!timestamp || !/^\d+(?:\.\d+)?$/.test(String(timestamp))) throw new BadRequestException('Webhook timestamp is required');
    return true;
  }
}
