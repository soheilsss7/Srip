import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiProviderPort, AiProviderRequest, AiProviderResponse } from './ai-provider.port';
import { MetricsService } from '../../observability/metrics.service';
import { TraceService } from '../../observability/trace.service';

@Injectable()
export class ExternalAiProvider implements AiProviderPort {
  constructor(private readonly metrics:MetricsService,private readonly trace:TraceService){}
  private config(){const key=process.env.AI_API_KEY,base=(process.env.AI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');if(!key)throw new ServiceUnavailableException('AI_API_KEY is required for external AI');return {key,base,model:process.env.AI_MODEL||'gpt-4o-mini'};}
  async generate(request:AiProviderRequest):Promise<AiProviderResponse>{ const started=Date.now();const {key,base,model}=this.config();const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),request.timeoutMs||30000);const span=this.trace.childSpan('ai.generate',{aiProvider:'external',aiModel:request.model||model},'client');try{
  const r=await fetch(`${base}/chat/completions`,{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model:request.model||model,messages:[{role:'system',content:request.system},{role:'user',content:request.prompt}],temperature:0.1}),signal:controller.signal});const d:any=await r.json();if(!r.ok)throw new ServiceUnavailableException(`AI provider failed: ${d?.error?.message||r.status}`);const input=d.usage?.prompt_tokens||0,output=d.usage?.completion_tokens||0;this.metrics.observeAi('external',Date.now()-started,input,output,0,false);span.end('OK',{inputTokens:input,outputTokens:output});return {text:d.choices?.[0]?.message?.content||'',provider:'external',model:d.model||request.model||model,inputTokens:input,outputTokens:output};}catch(e:any){this.metrics.observeAi('external',Date.now()-started,0,0,0,true);span.end('ERROR');if(e instanceof ServiceUnavailableException)throw e;throw new ServiceUnavailableException(`AI provider request failed: ${e?.message||e}`);}finally{clearTimeout(timeout);}}
  async health(){try{this.config();return {ok:true,provider:'external'}}catch{return {ok:false,provider:'external-not-configured'}}}
}
