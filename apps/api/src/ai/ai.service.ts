import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiPipelineService } from './ai-pipeline.service';
@Injectable()
export class AiService {
 constructor(private readonly prisma:PrismaService, private readonly pipeline:AiPipelineService){}
 async status(){ return { module:'ai', status:'phase12-rag-gateway-ready', provider:process.env.AI_PROVIDER ?? 'deterministic', capabilities:['smart-search','meeting-brief','meeting-summary','action-extraction','commitment-extraction','risk-detection','opportunity-detection','next-best-action','document-ingestion','chunking','redaction','retrieval','reranking','evidence'], safeguards:['authentication','permission-aware-retrieval','audit','human-confirmation','prompt-injection-defense','no-direct-database-access-by-model'] }; }
 async providerHealth(){ return this.pipeline.provider().health(); }
 async usage(){ return this.prisma.aiUsageEvent.aggregate({ _count:{_all:true}, _sum:{estimatedCost:true,inputTokens:true,outputTokens:true} }); }
}
