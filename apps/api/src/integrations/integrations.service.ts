import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { GoogleIntegrationProvider } from './google.integration-provider';
import { MicrosoftIntegrationProvider } from './microsoft.integration-provider';
import { IntegrationKind, IntegrationProviderName, TokenSet } from './integration-provider.port';
import { DataLifecycleService } from '../common/data-lifecycle/data-lifecycle.service';
import { IntegrationReconciliationService } from './integration-reconciliation.service';
import { SecretEncryptionService } from '../common/security/secret-encryption.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly p: PrismaService,
    private readonly a: AuthorizationService,
    private readonly audit: AuditService,
    private readonly google: GoogleIntegrationProvider,
    private readonly microsoft: MicrosoftIntegrationProvider,
    private readonly reconcile: IntegrationReconciliationService,
    private readonly lifecycle: DataLifecycleService,
    private readonly encryption: SecretEncryptionService,
    private readonly eventBus: EventBusService,
  ) {}

  private prov(n: IntegrationProviderName) { return n === 'GOOGLE' ? this.google : this.microsoft; }

  /**
   * Phase P contract: provider tokens are plaintext only in memory.
   * Every token crossing the persistence boundary must pass through the
   * canonical SecretEncryptionService first.
   */
  private encryptedTokenSet(t: TokenSet, fallbackRefreshTokenEncrypted?: string | null) {
    const accessTokenEncrypted = this.encryption.encrypt(t.accessToken);
    const refreshTokenEncrypted = t.refreshToken
      ? this.encryption.encrypt(t.refreshToken)
      : (fallbackRefreshTokenEncrypted ?? null);
    return { accessTokenEncrypted, refreshTokenEncrypted };
  }

  async list(userId: string) {
    return this.p.integrationConnection.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, provider: true, kind: true, status: true, organizationId: true, accountLabel: true, scopes: true, expiresAt: true, lastSyncAt: true, lastError: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async authorize(userId: string, provider: IntegrationProviderName, kind: IntegrationKind, organizationId?: string) {
    if (organizationId) await this.a.assertPermission(userId, 'integration.write', { organizationId });
    if (provider === 'GOOGLE' && ['TEAMS', 'SHAREPOINT'].includes(kind)) throw new BadRequestException(`${kind} is not a Google resource`);
    const state = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 600000);
    const redirectUri = process.env.INTEGRATION_REDIRECT_URI || 'http://localhost:4000/api/v1/integrations/oauth/callback';
    const c = await this.p.integrationConnection.create({ data: { userId, organizationId, provider, kind, status: 'PENDING', oauthStateHash: crypto.createHash('sha256').update(state).digest('hex'), oauthStateExpiresAt: expiresAt } });
    return { connectionId: c.id, state, expiresAt, authorizeUrl: this.prov(provider).buildAuthorizeUrl(kind, state, redirectUri) };
  }

  async callback(userId: string, id: string, state: string, code: string) {
    const r = await this.p.integrationConnection.findFirst({ where: { id, userId, deletedAt: null } });
    if (!r) throw new NotFoundException('Integration connection not found');
    const h = crypto.createHash('sha256').update(state).digest('hex');
    if (h !== r.oauthStateHash || !r.oauthStateExpiresAt || r.oauthStateExpiresAt < new Date()) throw new BadRequestException('Invalid or expired OAuth state');
    const t = await this.prov(r.provider as IntegrationProviderName).exchangeCode(r.kind as IntegrationKind, code, process.env.INTEGRATION_REDIRECT_URI || 'http://localhost:4000/api/v1/integrations/oauth/callback');
    const { accessTokenEncrypted, refreshTokenEncrypted } = this.encryptedTokenSet(t);
    return this.p.$transaction(async tx => {
      const out = await tx.integrationConnection.update({ where: { id }, data: { status: 'CONNECTED', accessTokenEncrypted, refreshTokenEncrypted, expiresAt: t.expiresAt, scopes: t.scope, oauthStateHash: null, oauthStateExpiresAt: null, lastError: null } });
      await this.audit.logMutation({ userId, action: 'INTEGRATION_CHANGE', entityType: 'IntegrationConnection', entityId: id, organizationId: r.organizationId ?? undefined, after: { provider: r.provider, kind: r.kind, status: 'CONNECTED', credentialsEncrypted: true } }, tx);
      return { id: out.id, status: out.status, provider: out.provider, kind: out.kind };
    });
  }

  async disconnect(userId: string, id: string) {
    const r = await this.p.integrationConnection.findFirst({ where: { id, userId, deletedAt: null } });
    if (!r) throw new NotFoundException('Integration connection not found');
    if (r.organizationId) await this.a.assertPermission(userId, 'integration.write', { organizationId: r.organizationId });
    await this.p.integrationConnection.update({ where: { id }, data: { status: 'DISCONNECTED', accessTokenEncrypted: null, refreshTokenEncrypted: null } });
    await this.audit.logMutation({ userId, action: 'INTEGRATION_CHANGE', entityType: 'IntegrationConnection', entityId: id, organizationId: r.organizationId ?? undefined, before: { status: r.status, connected: true }, after: { status: 'DISCONNECTED', credentialsRevoked: true }, reason: 'integration-disconnected' });
    return this.lifecycle.softDelete(userId, 'IntegrationConnection', id, 'disconnect');
  }

  private async validToken(r: { id: string; userId: string; provider: IntegrationProviderName; kind: IntegrationKind; organizationId: string | null; accessTokenEncrypted: string | null; refreshTokenEncrypted: string | null; expiresAt: Date | null; scopes: string | null }) {
    if (r.expiresAt && r.expiresAt.getTime() > Date.now() + 60000 && r.accessTokenEncrypted) {
      return this.encryption.decrypt(r.accessTokenEncrypted);
    }

    if (r.refreshTokenEncrypted && this.prov(r.provider).refresh) {
      const refreshToken = this.encryption.decrypt(r.refreshTokenEncrypted);
      const t: TokenSet = await this.prov(r.provider).refresh!(refreshToken);
      const { accessTokenEncrypted, refreshTokenEncrypted } = this.encryptedTokenSet(t, r.refreshTokenEncrypted);
      const updated = await this.p.$transaction(async tx => {
        const out = await tx.integrationConnection.update({ where: { id: r.id }, data: { accessTokenEncrypted, refreshTokenEncrypted, expiresAt: t.expiresAt || r.expiresAt, scopes: t.scope || r.scopes } });
        await this.audit.logMutation({ userId: r.userId, action: 'TOKEN_CHANGE', entityType: 'IntegrationToken', entityId: r.id, organizationId: r.organizationId ?? undefined, after: { provider: r.provider, kind: r.kind, rotated: true, expiresAt: out.expiresAt, credentialsEncrypted: true }, reason: 'integration-token-refreshed' }, tx);
        return out;
      });
      return this.encryption.decrypt(accessTokenEncrypted);
    }

    if (r.accessTokenEncrypted) return this.encryption.decrypt(r.accessTokenEncrypted);
    throw new BadRequestException('Integration has no usable access token');
  }

  async sync(userId: string, id: string) {
    const r = await this.p.integrationConnection.findFirst({ where: { id, userId, deletedAt: null } });
    if (!r) throw new NotFoundException('Integration connection not found');
    if (r.organizationId) await this.a.assertPermission(userId, 'integration.read', { organizationId: r.organizationId });
    if (r.status !== 'CONNECTED') throw new BadRequestException('Integration is not connected');
    const token = await this.validToken(r as any);
    const cur = await this.p.integrationSyncCursor.findUnique({ where: { connectionId: id } });
    const run = await this.p.integrationSyncRun.create({ data: { connectionId: id, kind: r.kind, status: 'RUNNING' } });
    await this.audit.logMutation({ userId, action: 'INTEGRATION_CHANGE', entityType: 'IntegrationSyncRun', entityId: run.id, organizationId: r.organizationId ?? undefined, after: { status: 'RUNNING', provider: r.provider, kind: r.kind }, reason: 'integration-sync-started' });
    try {
      const out = await this.prov(r.provider as IntegrationProviderName).pull(r.kind as IntegrationKind, token, cur?.cursor || undefined);
      const summary = await this.reconcile.reconcile(id, userId, r.organizationId || undefined, out.events, run.id);
      await this.p.integrationSyncCursor.upsert({ where: { connectionId: id }, create: { connectionId: id, kind: r.kind, cursor: out.nextCursor ?? null, lastSuccessfulAt: new Date(), itemsSeen: out.events.length }, update: { kind: r.kind, cursor: out.nextCursor ?? null, lastSuccessfulAt: new Date(), itemsSeen: { increment: out.events.length } } });
      await this.p.integrationConnection.update({ where: { id }, data: { lastSyncAt: new Date(), lastError: summary.errors.length ? JSON.stringify(summary.errors) : null, status: summary.errors.length ? 'ERROR' : 'CONNECTED' } });
      await this.audit.logMutation({ userId, action: 'INTEGRATION_CHANGE', entityType: 'IntegrationSyncRun', entityId: run.id, organizationId: r.organizationId ?? undefined, after: { status: summary.errors.length ? 'PARTIAL' : 'SUCCESS', seen: summary.seen, created: summary.created, updated: summary.updated, matchedPeople: summary.matchedPeople, matchedOrganizations: summary.matchedOrganizations, linkedRelationships: summary.linkedRelationships }, reason: 'integration-sync-completed' });
      await this.eventBus.publish({ eventType: summary.errors.length ? DOMAIN_EVENT_TYPES.INTEGRATION_SYNC_FAILED : DOMAIN_EVENT_TYPES.INTEGRATION_SYNC_COMPLETED, aggregateType: 'IntegrationSyncRun', aggregateId: run.id, organizationId: r.organizationId ?? undefined, actorId: userId, payload: { provider: r.provider, kind: r.kind, ...summary } });
      return { ...summary, nextCursor: out.nextCursor, kind: r.kind, provider: r.provider };
    } catch (e: any) {
      await this.p.integrationSyncRun.update({ where: { id: run.id }, data: { completedAt: new Date(), status: 'ERROR', errors: [String(e?.message || e)] as any } });
      await this.p.integrationConnection.update({ where: { id }, data: { status: 'ERROR', lastError: String(e?.message || e) } });
      await this.audit.logMutation({ userId, action: 'INTEGRATION_CHANGE', entityType: 'IntegrationSyncRun', entityId: run.id, organizationId: r.organizationId ?? undefined, after: { status: 'ERROR', error: String(e?.message || e) }, reason: 'integration-sync-failed' }).catch(() => undefined);
      await this.eventBus.publish({ eventType: DOMAIN_EVENT_TYPES.INTEGRATION_SYNC_FAILED, aggregateType: 'IntegrationSyncRun', aggregateId: run.id, organizationId: r.organizationId ?? undefined, actorId: userId, payload: { provider: r.provider, kind: r.kind, error: String(e?.message || e) } }).catch(() => undefined);
      throw e;
    }
  }

  async listSyncRuns(userId: string, id: string) {
    const r = await this.p.integrationConnection.findFirst({ where: { id, userId, deletedAt: null } });
    if (!r) throw new NotFoundException('Integration connection not found');
    return this.p.integrationSyncRun.findMany({ where: { connectionId: id }, orderBy: { startedAt: 'desc' }, take: 50 });
  }

  async webhook(
    provider: IntegrationProviderName,
    signature: string,
    rawBody: Buffer,
    metadata: { timestamp?: string; eventId?: string; eventType?: string } = {},
  ) {
    if (provider !== 'GOOGLE' && provider !== 'MICROSOFT') throw new BadRequestException('Unsupported integration webhook provider');
    const secret = provider === 'GOOGLE' ? process.env.GOOGLE_WEBHOOK_SECRET : process.env.MICROSOFT_WEBHOOK_SECRET;
    if (!secret) throw new BadRequestException('Webhook secret is not configured');
    if (!signature) throw new BadRequestException('Webhook signature is required');

    const timestampRaw = String(metadata.timestamp || '').trim();
    const timestampSeconds = Number(timestampRaw);
    if (!timestampRaw || !Number.isFinite(timestampSeconds)) throw new BadRequestException('Webhook timestamp is required');
    const maxSkewSeconds = Number(process.env.WEBHOOK_MAX_SKEW_SECONDS || 300);
    if (!Number.isFinite(maxSkewSeconds) || maxSkewSeconds <= 0) throw new BadRequestException('Invalid webhook replay window configuration');
    const age = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
    if (age > maxSkewSeconds) throw new BadRequestException('Webhook timestamp outside replay window');

    const signedPayload = Buffer.concat([Buffer.from(`${timestampSeconds}.`, 'utf8'), rawBody]);
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    const supplied = signature.replace(/^sha256=/i, '').trim();
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let payload: any;
    try { payload = JSON.parse(rawBody.toString('utf8')); }
    catch { throw new BadRequestException('Webhook payload must be valid JSON'); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BadRequestException('Webhook payload must be a JSON object');

    const normalizedEventId = String(metadata.eventId || payload.eventId || payload.id || payload.event_id || '').trim() || null;
    const normalizedEventType = String(metadata.eventType || payload.eventType || payload.type || payload.event_type || 'integration.webhook.received').trim();
    const normalizedPayload = {
      provider,
      eventId: normalizedEventId,
      eventType: normalizedEventType,
      payload,
    };

    try {
      return await this.p.$transaction(async tx => {
      if (normalizedEventId) {
        const existing = await tx.integrationWebhookEvent.findFirst({ where: { provider, eventId: normalizedEventId } });
        if (existing) return { accepted: true, duplicate: true, id: existing.id, provider, eventId: normalizedEventId, processed: existing.processed };
      }

      const event = await tx.integrationWebhookEvent.create({ data: {
        provider, eventId: normalizedEventId, eventType: normalizedEventType, signatureValid: true, payload,
      }});

      await this.eventBus.publishInTransaction(tx, {
        eventType: DOMAIN_EVENT_TYPES.INTEGRATION_WEBHOOK_RECEIVED,
        aggregateType: 'IntegrationWebhookEvent',
        aggregateId: event.id,
        payload: normalizedPayload,
      });

      const processed = await tx.integrationWebhookEvent.update({ where: { id: event.id }, data: { processed: true, processedAt: new Date() } });
      await this.audit.logMutation({ userId: undefined as any, action: 'INTEGRATION_CHANGE', entityType: 'IntegrationWebhookEvent', entityId: processed.id, after: { provider, eventId: normalizedEventId, eventType: normalizedEventType, signatureValid: true, processed: true } }, tx);
      return { accepted: true, duplicate: false, id: processed.id, provider, eventId: normalizedEventId, eventType: normalizedEventType, processed: true };
      });
    } catch (e: any) {
      if (e?.code === 'P2002' && normalizedEventId) {
        const existing = await this.p.integrationWebhookEvent.findFirst({ where: { provider, eventId: normalizedEventId } });
        if (existing) return { accepted: true, duplicate: true, id: existing.id, provider, eventId: normalizedEventId, processed: existing.processed };
      }
      throw e;
    }
  }
}
