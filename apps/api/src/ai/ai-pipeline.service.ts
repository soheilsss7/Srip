import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { DeterministicAiProvider } from './providers/deterministic.provider';
import { ExternalAiProvider } from './providers/external.provider';

@Injectable()
export class AiPipelineService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly deterministic: DeterministicAiProvider, private readonly external: ExternalAiProvider) {}
  provider(){ return process.env.AI_PROVIDER === 'external' ? this.external : this.deterministic; }
  redact(input:string){ return input.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[REDACTED_EMAIL]').replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g,'[REDACTED_PHONE]'); }
  defend(input:string){ return input.replace(/ignore (all|any|previous) instructions/gi,'[BLOCKED_PROMPT_INJECTION]').replace(/system prompt/gi,'[BLOCKED_SYSTEM_PROMPT_REFERENCE]'); }
  chunk(text:string,size=1200,overlap=150){ const out:string[]=[]; for(let i=0;i<text.length;i+=Math.max(1,size-overlap)) out.push(text.slice(i,i+size)); return out.filter(Boolean); }
  hash(s:string){ return crypto.createHash('sha256').update(s).digest('hex'); }
  embedding(text:string){ const v=Array.from({length:32},(_,i)=>{let h=0; for(let j=i;j<text.length;j+=32) h=(h+text.charCodeAt(j)*(j+1))%1000003; return Number((h/1000003).toFixed(6));}); return v; }
  tokens(q:string){ return q.toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter(x=>x.length>1); }
  score(q:string,text:string){ const a=this.tokens(q), b=this.tokens(text); const set=new Set(b); return a.reduce((n,t)=>n+(set.has(t)?1:0),0)/(a.length||1); }
  async indexDocument(userId:string, documentId:string, text:string){
    const d=await this.prisma.document.findUniqueOrThrow({where:{id:documentId}});
    if(d.organizationId) await this.authorization.assertPermission(userId, 'org.read', { organizationId: d.organizationId });
    const safe=this.defend(this.redact(text)); const chunks=this.chunk(safe);
    await this.prisma.aiDocumentChunk.deleteMany({where:{documentId}});
    for(let i=0;i<chunks.length;i++) await this.prisma.aiDocumentChunk.create({data:{documentId,organizationId:d.organizationId,chunkIndex:i,content:chunks[i],contentHash:this.hash(chunks[i]),embedding:this.embedding(chunks[i]) as any,metadata:{redacted:true}}});
    return {documentId,chunks:chunks.length,redacted:true};
  }
  async retrieve(userId:string, query:string, organizationId?:string){
    const orgs=await this.authorization.accessibleOrganizationIds(userId); if(organizationId) await this.authorization.assertAnyOrganizationAccess(userId,[organizationId]);
    const rows=await this.prisma.aiDocumentChunk.findMany({where:{...(orgs?{organizationId:{in:orgs}}:{}),...(organizationId?{organizationId}: {})},take:200,include:{document:{select:{id:true,name:true,mimeType:true}}}});
    return rows.map(r=>({...r,score:this.score(query,r.content)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,8).map(r=>({id:r.id,documentId:r.documentId,document:r.document,score:r.score,content:r.content,metadata:r.metadata}));
  }
}
