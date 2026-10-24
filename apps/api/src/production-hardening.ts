import crypto from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class ProductionHardeningMiddleware implements NestMiddleware {
  private readonly maxBodyBytes = Number(process.env.MAX_REQUEST_BODY_BYTES ?? 1_048_576);

  use(req: Request & { requestId?: string; correlationId?: string }, res: Response, next: NextFunction) {
    const requestId = req.requestId ?? crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');

    const contentLength = Number(req.headers['content-length'] ?? 0);
    if (Number.isFinite(contentLength) && contentLength > this.maxBodyBytes) {
      res.status(413).json({ code: 'REQUEST_BODY_TOO_LARGE', message: 'request body too large', requestId, details: { maxBytes: this.maxBodyBytes } });
      return;
    }
    next();
  }
}

/**
 * Rate limiting is intentionally NOT implemented here. PHASE AA moved it to
 * the Redis-backed RateLimitInterceptor so all application instances share
 * the same counters. Keeping the old process-local Map would make limits
 * inconsistent across replicas and would violate the distributed contract.
 */

@Injectable()
export class OriginVerificationMiddleware implements NestMiddleware {
  private readonly trustedOrigins = (process.env.TRUSTED_ORIGINS ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim()).filter(Boolean);
  private readonly enforce = process.env.ORIGIN_CHECK_ENFORCED !== 'false';

  use(req: Request & { requestId?: string; correlationId?: string }, res: Response, next: NextFunction) {
    if (!this.enforce) return next();
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (!mutating) return next();
    const origin = (req.headers.origin as string | undefined) ?? (req.headers.referer ? new URL(req.headers.referer as string).origin : undefined);
    // بدون Origin/Referer (مثل فراخوانی server-to-server با Bearer Token
    // معتبر، یا ابزارهایی مثل curl/Postman/CI) رد نمی‌شود — چون این‌ها اصلاً
    // بردار حمله CSRF نیستند (کاربر مرورگری قربانی وجود ندارد).
    if (!origin) return next();
    if (this.trustedOrigins.includes(origin)) return next();
    res.status(403).json({ code: 'ORIGIN_NOT_ALLOWED', message: 'Origin not allowed', requestId: req.requestId, details: { correlationId: req.correlationId } });
  }
}
