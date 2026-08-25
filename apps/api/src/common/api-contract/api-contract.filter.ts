import crypto from 'node:crypto';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ErrorTrackingService } from '../../observability/error-tracking.service';
import { API_ERROR_CODES, normalizeApiErrorCode, normalizeApiErrorDetails, normalizeApiErrorMessage } from './error-contract';

@Catch()
export class ApiContractExceptionFilter implements ExceptionFilter {
  constructor(private readonly errors: ErrorTrackingService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req: any = ctx.getRequest();
    const res: any = ctx.getResponse();
    const requestId = String(req.requestId || req.headers?.['x-request-id'] || crypto.randomUUID());
    const correlationId = String(req.correlationId || req.headers?.['x-correlation-id'] || requestId).slice(0, 255);
    const isHttpException = exception instanceof HttpException;
    const httpException: HttpException | undefined = isHttpException ? (exception as HttpException) : undefined;
    const status = httpException ? httpException.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw: unknown = httpException ? httpException.getResponse() : undefined;
    const message = normalizeApiErrorMessage(status, raw);
    const code = normalizeApiErrorCode(status, raw, message);
    const details = normalizeApiErrorDetails(raw);

    if (status >= 500) {
      this.errors.captureException(exception, {
        requestId,
        correlationId,
        userId: req.user?.sub,
        method: req.method,
        path: req.path,
        statusCode: status,
      });
    }

    const body = {
      error: {
        code,
        message,
        requestId,
        details,
      },
    };

    res.status(status).json(body);
  }
}

export { API_ERROR_CODES };
