import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AiPipelineService } from '../ai/ai-pipeline.service';
import { S3Storage } from './s3.storage';
import { FileSecurityService } from './file-security.service';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly ai: AiPipelineService, private readonly storage: S3Storage, private readonly security: FileSecurityService, private readonly audit: AuditService) {}
  status() { return { module:'documents', status:'phase12-ingestion-ready', capabilities:['metadata','permission-aware-indexing','chunking','redaction','prompt-injection-filter','deterministic-embedding'] }; }
  async index(userId:string, documentId:string, text:string){ return this.ai.indexDocument(userId, documentId, text); }
  async upload(userId:string, file:any, organizationId?:string, classification:any='INTERNAL'){ const meta=this.security.validate(file); if(organizationId) await this.authorization.assertPermission(userId, 'document.write', { organizationId: organizationId, classification }); const id=randomUUID(); const quarantine=`quarantine/${id}/${meta.sha256}${meta.ext}`; await this.storage.put(quarantine,file.buffer,meta.mimeType); const doc=await this.prisma.document.create({data:{id,name:file.originalname,mimeType:meta.mimeType,storageKey:quarantine,sizeBytes:file.size,sha256:meta.sha256,classification,uploadStatus:'QUARANTINED',scanStatus:'PENDING',organizationId,createdById:userId}}); try { const scan=await this.security.scan(id,file.buffer,meta.sha256); if(scan.status==='INFECTED') throw new BadRequestException('Malware detected'); const finalKey=`documents/${organizationId||'private'}/${id}/${meta.sha256}${meta.ext}`; await this.storage.put(finalKey,file.buffer,meta.mimeType); await this.storage.delete(quarantine); const out=await this.prisma.document.update({where:{id},data:{storageKey:finalKey,uploadStatus:'READY',scanStatus:scan.status,scannedAt:new Date()}}); await this.audit.logMutation({userId,action:'CREATE',entityType:'Document',entityId:id,organizationId,after:{name:file.originalname,mimeType:meta.mimeType,sizeBytes:file.size,classification,scanStatus:scan.status},reason:'secure-file-upload'}); return {document:out,scan}; } catch(e) { await this.prisma.document.update({where:{id},data:{uploadStatus:'REJECTED',scanStatus:'ERROR'}}); throw e; } }
  private async loadAuthorizedDocument(userId:string,id:string){ const d=await this.prisma.document.findUnique({where:{id}}); if(!d||d.deletedAt) throw new NotFoundException('Document not found'); if(d.organizationId) await this.authorization.assertPermission(userId, 'org.read', { organizationId: d.organizationId }); return d; }
  async signedReadUrl(userId:string,id:string,expiresInSeconds=900){const d=await this.loadAuthorizedDocument(userId,id); if(d.uploadStatus!=='READY'||(d.scanStatus!=='CLEAN'&&d.scanStatus!=='NOT_REQUIRED')) throw new BadRequestException('File is not available for download until security scanning completes'); await this.audit.logMutation({userId,action:'READ',entityType:'FileDownload',entityId:id,organizationId:d.organizationId??undefined,reason:'signed-file-download'}); return {url:await this.storage.createSignedReadUrl(d.storageKey,expiresInSeconds)};}
  async get(userId:string, id:string){ const d=await this.loadAuthorizedDocument(userId,id); return EntityResponseDto.from('Document', d); }
}
