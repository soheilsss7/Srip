import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type RequestContextValue = {
  requestId: string;
  correlationId: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class RequestContext {
  private readonly storage = new AsyncLocalStorage<RequestContextValue>();

  run<T>(initial: Partial<RequestContextValue>, callback: () => T): T {
    const requestId = initial.requestId?.trim() || randomUUID();
    const correlationId = initial.correlationId?.trim() || requestId;
    return this.storage.run({ ...initial, requestId, correlationId }, callback);
  }

  get(): RequestContextValue | undefined { return this.storage.getStore(); }
  setUserId(userId?: string) { const store=this.storage.getStore(); if(store && userId) store.userId=userId; }
  get requestId(): string | undefined { return this.get()?.requestId; }
  get correlationId(): string | undefined { return this.get()?.correlationId; }
  get userId(): string | undefined { return this.get()?.userId; }
  get traceContext(): Pick<RequestContextValue, 'requestId'|'correlationId'> | undefined {
    const ctx = this.get();
    return ctx ? { requestId: ctx.requestId, correlationId: ctx.correlationId } : undefined;
  }
  get ip(): string | undefined { return this.get()?.ip; }
  get userAgent(): string | undefined { return this.get()?.userAgent; }
}

export function requestId(value?: string): string { return value?.trim() || randomUUID(); }
