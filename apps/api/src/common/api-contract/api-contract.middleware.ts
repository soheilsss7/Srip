import crypto from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { RequestContext } from '../request-context';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class ApiContractContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContext) {}
  use(req: Request & { requestId?: string; correlationId?: string }, res: Response, next: NextFunction) {
    const requestId = typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].trim() ? req.headers['x-request-id'].trim() : crypto.randomUUID();
    const correlationId = typeof req.headers['x-correlation-id'] === 'string' && req.headers['x-correlation-id'].trim() ? req.headers['x-correlation-id'].trim() : requestId;
    req.requestId = requestId;
    req.correlationId = correlationId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Correlation-Id', correlationId);
    this.requestContext.run({ requestId, correlationId, ip: req.ip, userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined }, next);
  }
}
