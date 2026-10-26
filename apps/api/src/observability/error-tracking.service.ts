import { Injectable, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import { TraceService } from './trace.service';
import { SensitiveDataSanitizer } from '../common/security/sensitive-data-sanitizer';

@Injectable()
export class ErrorTrackingService {
  private readonly logger=new Logger(ErrorTrackingService.name);
  private readonly dsn=process.env.SENTRY_DSN ?? '';
  private readonly environment=process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
  private readonly release=process.env.SENTRY_RELEASE ?? process.env.APP_VERSION ?? 'unknown';

  constructor(private readonly trace:TraceService){}

  enabled(){ return Boolean(this.dsn); }

  captureException(error:unknown, context:Record<string,unknown>={}){
    if(!this.dsn) return;
    const parsed=this.parseDsn(this.dsn); if(!parsed) return;
    const eventId=crypto.randomUUID().replace(/-/g,'');
    const current=this.trace.current();
    const err=error instanceof Error?error:new Error(String(error));
    const safeContext=SensitiveDataSanitizer.sanitize(context) as Record<string,unknown>;
    const safeMessage=err.message.length>2000?'Unhandled application error':err.message;
    const event:any={event_id:eventId,timestamp:Date.now()/1000,platform:'node',environment:this.environment,release:this.release,exception:{values:[{type:err.name,value:safeMessage,stacktrace:{frames:(err.stack??'').split('\n').slice(1).map((line)=>({filename:line.trim()}))}}]},tags:{trace_id:current?.traceId??'none'},extra:{...safeContext,requestId:context.requestId??undefined,correlationId:context.correlationId??undefined}};
    if(context.userId) event.user={id:String(context.userId)};
    const envelope=`${JSON.stringify({event_id:eventId,sdk:{name:'srip-sentry-compatible',version:'1.0.0'}})}\n${JSON.stringify({type:'event',length:Buffer.byteLength(JSON.stringify(event))})}\n${JSON.stringify(event)}\n`;
    void fetch(`${parsed.storeUrl}/api/${parsed.projectId}/store/`,{method:'POST',headers:{'content-type':'application/x-sentry-envelope',Authorization:`DSN ${this.dsn}`},body:envelope}).catch(e=>this.logger.debug(`Sentry delivery failed: ${e instanceof Error?e.message:String(e)}`));
  }

  private parseDsn(dsn:string){
    try{const u=new URL(dsn);const projectId=u.pathname.split('/').filter(Boolean).pop();const publicKey=u.username;if(!projectId||!publicKey)return undefined;const host=`${u.protocol}//${u.host}`;return {projectId,storeUrl:host,publicKey};}catch{return undefined;}
  }
}
