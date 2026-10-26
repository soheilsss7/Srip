import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { TraceService } from './trace.service';
import { ErrorTrackingService } from './error-tracking.service';

@Injectable()
export class ObservabilityMiddleware implements NestMiddleware {
  constructor(private readonly metrics:MetricsService, private readonly trace:TraceService, private readonly errors:ErrorTrackingService){}
  use(req:Request&{requestId?:string;correlationId?:string},res:Response,next:NextFunction){
    const ctx=this.trace.startRoot(typeof req.headers.traceparent==='string'?req.headers.traceparent:undefined, { requestId: req.requestId, correlationId: req.correlationId });
    res.setHeader('traceparent',ctx.traceparent);
    res.setHeader('X-Trace-ID', ctx.traceId);
    const started=Date.now();
    this.trace.run(ctx,()=>{
      res.on('finish',()=>{
        const duration=Date.now()-started;const route=(req.route?.path as string|undefined)??req.path??req.url;const userId=(req as any).user?.sub;
        this.metrics.observeRequest(duration,res.statusCode,req.method,route,userId);
        const record={timestamp:new Date().toISOString(),level:res.statusCode>=500?'error':res.statusCode>=400?'warn':'info',service:'srip-api',requestId:req.requestId,correlationId:req.correlationId,traceId:ctx.traceId,spanId:ctx.spanId,method:req.method,path:req.path,statusCode:res.statusCode,durationMs:duration,userId:userId??null};
        process.stdout.write(JSON.stringify(record)+'\n');
        if(res.statusCode>=500) this.errors.captureException(new Error(`HTTP ${res.statusCode} ${req.method} ${req.path}`),{requestId:req.requestId,correlationId:req.correlationId,traceId:ctx.traceId,userId});
        const span=this.trace.childSpan(`HTTP ${req.method} ${route}`,{httpMethod:req.method,httpRoute:route,httpStatusCode:res.statusCode},'server');span.end(res.statusCode>=500?'ERROR':'OK',{durationMs:duration});
      });
      next();
    });
  }
}
