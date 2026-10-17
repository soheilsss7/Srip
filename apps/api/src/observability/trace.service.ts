import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

export type TraceContext = { traceId: string; spanId: string; traceparent: string; requestId?: string; correlationId?: string; };
export type SpanData = { name: string; kind: string; startTime: number; endTime?: number; attributes?: Record<string, string|number|boolean|null>; status?: 'OK'|'ERROR'; parentSpanId?: string };

function hex(bytes:number){ return crypto.randomBytes(bytes).toString('hex'); }
function validHex(v:string|undefined,len:number){ return !!v && new RegExp(`^[0-9a-f]{${len}}$`).test(v); }

@Injectable()
export class TraceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TraceService.name);
  private readonly storage = new AsyncLocalStorage<TraceContext>();
  private readonly serviceName = process.env.OTEL_SERVICE_NAME ?? 'srip-api';
  private readonly endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '';
  private readonly enabled = process.env.OTEL_TRACING_ENABLED !== 'false';
  private originalFetch?: typeof fetch;

  onModuleInit(){
    if((globalThis as any).__sripTraceFetchInstalled) return;
    this.originalFetch=globalThis.fetch.bind(globalThis);
    const original=this.originalFetch;
    (globalThis as any).__sripTraceFetchInstalled=true;
    const self=this;
    globalThis.fetch=async function(input:any,init:any={}){
      const url=typeof input==='string'?input:(input?.url??String(input));
      if(url.includes('/v1/traces')||url.includes('/store/')) return original(input,init);
      const headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));
      const ctx=self.current(); if(ctx){ headers.set('traceparent',ctx.traceparent); if(ctx.requestId) headers.set('X-Request-ID',ctx.requestId); if(ctx.correlationId) headers.set('X-Correlation-ID',ctx.correlationId); }
      const method=String(init?.method??(input instanceof Request?input.method:'GET')).toUpperCase();
      const span=self.childSpan(`HTTP ${method}`,{httpMethod:method,httpUrl:url},'client');
      try{const response=await original(input,{...init,headers});span.end(response.ok?'OK':'ERROR',{httpStatusCode:response.status});return response;}catch(error){span.end('ERROR',{errorMessage:error instanceof Error?error.message:String(error)});throw error;}
    } as typeof fetch;
  }
  onModuleDestroy(){ if(this.originalFetch) globalThis.fetch=this.originalFetch; }

  parseTraceparent(value?: string): TraceContext | undefined {
    if (!value) return undefined;
    const m = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(value.trim());
    if (!m || !validHex(m[1],32) || !validHex(m[2],16)) return undefined;
    return { traceId:m[1], spanId:m[2], traceparent:value.trim() };
  }

  startRoot(incoming?: string, identifiers?: { requestId?: string; correlationId?: string }): TraceContext {
    const parent = this.parseTraceparent(incoming);
    const traceId = parent?.traceId ?? hex(16);
    const spanId = hex(8);
    return { traceId, spanId, traceparent:`00-${traceId}-${spanId}-01`, requestId: identifiers?.requestId, correlationId: identifiers?.correlationId };
  }

  current(){ return this.storage.getStore(); }

  run<T>(ctx:TraceContext, fn:()=>T):T { return this.storage.run(ctx, fn); }

  childSpan(name:string, attributes:Record<string,string|number|boolean|null> = {}, kind='internal') {
    const parent = this.current();
    const childSpanId = hex(8);
    const ctx = parent ? {traceId:parent.traceId, spanId:childSpanId, traceparent:`00-${parent.traceId}-${childSpanId}-01`, requestId:parent.requestId, correlationId:parent.correlationId} : this.startRoot();
    const spanId = ctx.spanId;
    const start = Date.now();
    return {
      context:ctx,
      end: (status:'OK'|'ERROR'='OK', extra:Record<string,string|number|boolean|null>={}) => {
        const span:SpanData = {name,kind,startTime:start,endTime:Date.now(),parentSpanId:parent?.spanId,attributes:{...attributes,...extra},status};
        void this.exportSpan(span,ctx);
      }
    };
  }

  async withSpan<T>(name:string, attributes:Record<string,string|number|boolean|null>, fn:(ctx:TraceContext)=>Promise<T>, kind='internal'):Promise<T>{
    const span=this.childSpan(name,attributes,kind);
    try { const result=await this.run(span.context,()=>fn(span.context)); span.end('OK'); return result; }
    catch(e){ span.end('ERROR',{errorType:e instanceof Error?e.name:'Error',errorMessage:e instanceof Error?e.message:String(e)}); throw e; }
  }

  headers(ctx?:TraceContext){ const c=ctx??this.current(); return c?{'traceparent':c.traceparent,'X-Request-ID':c.requestId??'', 'X-Correlation-ID':c.correlationId??''}:{}; }

  async exportSpan(span:SpanData, ctx:TraceContext){
    if (!this.enabled) return;
    if (!this.endpoint) return;
    const url=this.endpoint.endsWith('/v1/traces')?this.endpoint:`${this.endpoint.replace(/\/$/,'')}/v1/traces`;
    const payload={resourceSpans:[{resource:{attributes:[{key:'service.name',value:{stringValue:this.serviceName}},{key:'deployment.environment',value:{stringValue:process.env.NODE_ENV??'development'}}]},scopeSpans:[{scope:{name:'srip-observability'},spans:[{traceId:ctx.traceId,spanId:ctx.spanId,parentSpanId:span.parentSpanId,name:span.name,kind:span.kind==='server'?2:span.kind==='client'?3:1,startTimeUnixNano:String(span.startTime*1_000_000),endTimeUnixNano:String((span.endTime??Date.now())*1_000_000),attributes:Object.entries(span.attributes??{}).filter(([,v])=>v!==null).map(([key,value])=>({key,value:typeof value==='number'?{intValue:String(value)}:typeof value==='boolean'?{boolValue:value}:{stringValue:String(value)}})),status:{code:span.status==='ERROR'?2:1}}]}]}]};
    try { await (this.originalFetch??fetch)(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}); } catch(error){ this.logger.debug(`OTLP export failed: ${error instanceof Error?error.message:String(error)}`); }
  }
}
