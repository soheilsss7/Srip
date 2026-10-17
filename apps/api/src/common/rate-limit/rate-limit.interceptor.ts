import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { RateLimitCategory, RateLimitService } from './rate-limit.service';

export const RATE_LIMIT_CATEGORY_KEY = 'srip:rate-limit-category';
export const RateLimit = (category: RateLimitCategory) => SetMetadata(RATE_LIMIT_CATEGORY_KEY, category);

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly service: RateLimitService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<any>();
    const explicit = this.reflector.getAllAndOverride<RateLimitCategory>(RATE_LIMIT_CATEGORY_KEY, [context.getHandler(), context.getClass()]);
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    const category = explicit ?? this.classify(req, permission);
    const endpoint = this.endpoint(req);
    return from(this.service.consume({ ip: req.ip ?? req.socket?.remoteAddress, userId: req.user?.sub, endpoint, category })).pipe(
      mergeMap(results => {
        const response = context.switchToHttp().getResponse<any>();
        const strictest = results.reduce((a,b) => a.remaining <= b.remaining ? a : b);
        response.setHeader('RateLimit-Limit', String(strictest.limit));
        response.setHeader('RateLimit-Remaining', String(strictest.remaining));
        response.setHeader('RateLimit-Reset', String(Math.ceil(strictest.resetAt / 1000)));
        return next.handle();
      }),
      catchError(error => {
        const response = context.switchToHttp().getResponse<any>();
        const retryAfter = error?.response?.details?.retryAfterSeconds;
        if (retryAfter) response.setHeader('Retry-After', String(retryAfter));
        throw error;
      }),
    );
  }

  private endpoint(req:any):string { return `${req.method}:${req.baseUrl ?? ''}${req.route?.path ?? req.path ?? 'unknown'}`; }

  private classify(req:any, permission?:string):RateLimitCategory {
    const path = String(req.originalUrl ?? req.url ?? '').split('?')[0].toLowerCase();
    if (path === '/api/v1/auth/login' || path.endsWith('/auth/login')) return 'login';
    if (path.includes('forgot-password') || path.includes('reset-password')) return 'password-reset';
    if (path.includes('/mfa') || path.includes('/totp')) return 'mfa';
    if (path.includes('/export') || path.includes('/reports/') && path.includes('/export')) return 'export';
    if (path === '/api/v1/search' || path.includes('/search/')) return 'search';
    if (path.includes('/data/import')) return 'bulk-import';
    if (path.includes('/integrations/webhooks')) return 'webhook';
    if (['POST','PUT','PATCH','DELETE'].includes(req.method) && this.isSensitiveMutation(path, permission)) return 'sensitive';
    return 'default';
  }

  private isSensitiveMutation(path:string, permission?:string):boolean {
    if (permission && (/^permission\./.test(permission) || permission === 'data.permanent_delete' || permission === 'integration.write' || permission === 'relationship.write')) return true;
    return /\/((admin|permissions?|roles|approvals?|restore|permanent-delete|lifecycle|recalculate-score|integrations)(\/|$))/.test(path)
      || path.includes('/enterprise/exports')
      || path.includes('/privacy/requests/');
  }
}
