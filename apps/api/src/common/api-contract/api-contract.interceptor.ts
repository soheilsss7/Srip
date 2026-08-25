import { CallHandler, ExecutionContext, Injectable, NestInterceptor, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, from, of, switchMap, catchError, throwError } from 'rxjs';
import crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const IDEMPOTENCY_TTL_MS = Number(process.env.IDEMPOTENCY_TTL_MS ?? 24 * 60 * 60 * 1000);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PUBLIC_MUTATION_PREFIXES = ['/auth/login', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email'];
// Legacy idempotency aliases are normalized by the error contract: IDEMPOTENCY_KEY_REQUIRED, IDEMPOTENCY_KEY_REUSED, IDEMPOTENCY_REQUEST_IN_PROGRESS.

function hash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

function hashBytes(value: Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sanitize(value: any): any {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  const blocked = new Set(['passwordHash','accessTokenEncrypted','refreshTokenEncrypted','oauthStateHash','clientSecret','secret','apiKey','privateKey','recoveryCodes']);
  return Object.fromEntries(Object.entries(value).filter(([k]) => !blocked.has(k)).map(([k,v]) => [k,sanitize(v)]));
}

function isPublicMutation(path: string): boolean {
  return PUBLIC_MUTATION_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isWebhook(path: string): boolean {
  return path.startsWith('/integrations/webhooks/');
}

function isExport(path: string): boolean {
  return /\/reports\/[^/]+\/export\/[^/]+$/.test(path);
}

@Injectable()
export class ApiContractInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req: any = http.getRequest();
    const res: any = http.getResponse();
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.originalUrl || req.url || '').split('?')[0];

    // Reads remain non-idempotent by design. Report exports are explicitly
    // included because they are sensitive, externally observable operations.
    const requiresIdempotency = MUTATING_METHODS.has(method) || isExport(path);
    if (!requiresIdempotency) {
      return next.handle().pipe(switchMap((value) => of(this.transformReadResponse(req, res, value))));
    }

    const webhook = isWebhook(path);
    const exportRequest = isExport(path);
    const rawKey = req.headers['idempotency-key'];
    const hasBearer = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');

    // Auth flows intentionally remain outside the mutation idempotency contract.
    // Signed webhooks are authenticated by WebhookSignatureGuard instead of JWT.
    if (!hasBearer && !webhook) {
      // Public authentication mutations are intentionally outside the idempotency contract.
      // Protected mutations are expected to be rejected by the route guard before this interceptor.
      if (isPublicMutation(path)) return next.handle().pipe(switchMap((value) => of(sanitize(value))));
    }

    if (typeof rawKey !== 'string' || rawKey.trim().length < 16 || rawKey.trim().length > 255) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key header is required for this retry-sensitive operation.' });
    }

    const trimmedKey = rawKey.trim();
    const principalNamespace = webhook ? `webhook:${req.params?.provider ?? 'unknown'}` : `user:${req.user?.sub ?? 'anonymous'}`;
    const keyHash = hash(`${principalNamespace}:${method}:${path}:${trimmedKey}`);
    if (webhook && !Buffer.isBuffer(req.rawBody)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Raw webhook body is unavailable.' });
    }
    const requestHash = webhook
      ? hashBytes(req.rawBody)
      : hash({ body: req.body, query: req.query, params: req.params });

    return from(this.prisma.idempotencyRecord.findUnique({ where: { keyHash } })).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.expiresAt <= new Date()) {
            return from(this.prisma.idempotencyRecord.delete({ where: { id: existing.id } })).pipe(
              switchMap(() => this.claimAndExecute(req, res, next, keyHash, requestHash, method, path, exportRequest)),
            );
          }
          if (existing.requestHash !== requestHash) {
            throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key was already used with a different request.' });
          }
          return this.replay(existing, res);
        }
        return this.claimAndExecute(req, res, next, keyHash, requestHash, method, path, exportRequest);
      }),
    );
  }

  private claimAndExecute(req: any, res: any, next: CallHandler, keyHash: string, requestHash: string, method: string, path: string, exportRequest: boolean): Observable<any> {
    return from(this.claimIdempotency(keyHash, requestHash, method, path, req.user?.sub)).pipe(
      switchMap((claim: any) => {
        if (!claim.created) return this.replay(claim.record, res);
        return next.handle().pipe(
          switchMap(async (value) => {
            const safe = sanitize(value);
            const statusCode = res.statusCode || 200;
            const headers: Record<string,string> = {};
            for (const h of ['content-type','content-disposition','content-length','location','x-request-id','x-correlation-id']) {
              const v = res.getHeader(h);
              if (v !== undefined) headers[h] = String(v);
            }
            const bodyBase64 = exportRequest && Buffer.isBuffer(safe) ? safe.toString('base64') : null;
            const responseJson = bodyBase64 ? null : (safe === undefined ? undefined : safe);
            await this.prisma.idempotencyRecord.update({
              where: { id: claim.record.id },
              data: { statusCode, responseJson, responseBodyBase64: bodyBase64, responseHeaders: headers },
            });
            return safe;
          }),
          // Never leave a permanent "in progress" record after a failed request.
          catchError((error) => from(this.prisma.idempotencyRecord.delete({ where: { id: claim.record.id } }).catch(() => undefined)).pipe(
            switchMap(() => throwError(() => error)),
          )),
        );
      }),
    );
  }

  private replay(record: any, res: any): Observable<any> {
    res.status(record.statusCode);
    if (record.responseHeaders && typeof record.responseHeaders === 'object') {
      for (const [k,v] of Object.entries(record.responseHeaders as any)) res.setHeader(k, String(v));
    }
    if (record.responseBodyBase64) return of(Buffer.from(record.responseBodyBase64, 'base64'));
    return of(record.responseJson);
  }

  private async claimIdempotency(keyHash: string, requestHash: string, method: string, path: string, userId?: string) {
    try {
      const record = await this.prisma.idempotencyRecord.create({ data: { keyHash, requestHash, method, path, userId, statusCode: 425, responseJson: Prisma.JsonNull, responseBodyBase64: null, responseHeaders: {}, expiresAt: new Date(Date.now()+IDEMPOTENCY_TTL_MS) } });
      return { created: true, record };
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e;
      const record = await this.prisma.idempotencyRecord.findUnique({ where: { keyHash } });
      if (!record) throw e;
      if (record.requestHash !== requestHash) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key was already used with a different request.' });
      if (record.statusCode === 425) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'A request with this Idempotency-Key is already being processed.' });
      return { created: false, record };
    }
  }

  private transformReadResponse(req: any, res: any, value: any) {
    if (!Array.isArray(value)) return sanitize(value);
    const hasPaginationQuery = ['page', 'cursor', 'limit'].some((key) => req.query?.[key] !== undefined);
    if (!hasPaginationQuery) return value.map(sanitize);

    const parsedLimit = Number(req.query?.limit ?? DEFAULT_LIMIT);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : DEFAULT_LIMIT));
    const requestedPage = Math.max(1, Number(req.query?.page ?? 1) || 1);
    const rawCursor = req.query?.cursor;
    const offset = rawCursor !== undefined ? Math.max(0, Number(rawCursor) || 0) : (requestedPage - 1) * limit;
    const items = value.slice(offset, offset + limit).map(sanitize);
    const nextOffset = offset + items.length;
    const nextCursor = nextOffset < value.length ? String(nextOffset) : null;
    res.setHeader('X-Page', String(Math.floor(offset / limit) + 1));
    res.setHeader('X-Limit', String(limit));
    res.setHeader('X-Total-Count', String(value.length));
    return { items, nextCursor, total: value.length };
  }
}
