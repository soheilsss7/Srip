import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DuplicateStrategy, ImportEntityType, ImportFormat, ImportRowStatus, ImportStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { ApprovalService, APPROVAL_ACTIONS } from '../approvals/approval.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';
import { QueueService } from '../jobs/queue.service';
import { JOB_NAMES } from '../jobs/queue.constants';

type Row = Record<string,string>;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const ORG:Record<string,string[]>={name:['name','organization','organization name','company','company name','نام','نام سازمان','شرکت'],legalName:['legalname','legal name','نام حقوقی'],englishName:['englishname','english name'],displayName:['displayname','display name'],type:['type','organization type','نوع'],industry:['industry','صنعت'],country:['country','کشور'],city:['city','شهر'],address:['address','آدرس'],website:['website','domain','url','وبسایت'],phone:['phone','telephone','mobile','تلفن'],email:['email','e-mail','ایمیل'],registrationId:['registrationid','registration id','registration','شناسه ثبت'],ownerEmail:['owneremail','owner email','مالک'],ownerId:['ownerid','owner id']};
const PERSON:Record<string,string[]>={firstName:['firstname','first name','نام'],lastName:['lastname','last name','نام خانوادگی'],displayName:['displayname','display name','full name','نام کامل'],email:['email','e-mail','ایمیل'],phone:['phone','telephone','mobile','تلفن'],title:['title','job title','سمت'],department:['department','دپارتمان'],country:['country','کشور'],organizationId:['organizationid','organization id','org id'],organizationName:['organization','organization name','company','company name','سازمان','شرکت'],organizationDomain:['organizationdomain','organization domain','domain','دامنه']};
const n=(v:any)=>String(v??'').trim(); const low=(v:any)=>n(v).toLowerCase(); const phone=(v:any)=>n(v).replace(/[^0-9+]/g,'').replace(/^00/,'+');
const domain=(v:any)=>low(v).replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0];
const name=(v:any)=>low(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').replace(/\s+/g,' ').trim();
function sim(a:string,b:string){if(!a||!b)return 0;if(a===b)return 1;const d:number[][]=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=0;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return 1-d[a.length][b.length]/Math.max(a.length,b.length)}
function csv(text:string):Row[]{const rows:string[][]=[];let r:string[]=[],c='',q=false;for(let i=0;i<text.length;i++){const x=text[i];if(q){if(x==='"'){if(text[i+1]==='"'){c+='"';i++}else q=false}else c+=x}else if(x==='"')q=true;else if(x===','){r.push(c);c=''}else if(x==='\n'){r.push(c);rows.push(r);r=[];c=''}else if(x==='\r'){if(text[i+1]!=='\n'){r.push(c);rows.push(r);r=[];c=''}}else c+=x}if(c||r.length){r.push(c);rows.push(r)}if(!rows.length)return[];const h=rows.shift()!.map(n);return rows.filter(x=>x.some(v=>n(v))).map(x=>Object.fromEntries(h.map((k,i)=>[k,n(x[i])]))) }

@Injectable()
export class DataImportService {
 constructor(private readonly prisma:PrismaService,private readonly auth:AuthorizationService,private readonly audit:AuditService,private readonly duplicateDetection:DuplicateDetectionService,private readonly approvals:ApprovalService,private readonly eventBus:EventBusService,private readonly queues:QueueService){}
 private format(file:any):ImportFormat{const fn=low(file?.originalname),m=low(file?.mimetype);if(fn.endsWith('.csv')||m.includes('csv')||m==='text/plain')return ImportFormat.CSV;if(fn.endsWith('.xlsx')||m.includes('spreadsheetml'))return ImportFormat.XLSX;if(fn.endsWith('.xls')||m.includes('ms-excel'))return ImportFormat.XLS;throw new BadRequestException('Only CSV, XLSX and XLS files are supported')}
 private async parse(file:any){if(!file?.buffer?.length)throw new BadRequestException('A non-empty import file is required');const f=this.format(file);if(f===ImportFormat.CSV)return{format:f,rows:csv(file.buffer.toString('utf8').replace(/^\uFEFF/,''))};const wb=XLSX.read(file.buffer,{type:'buffer',cellDates:true});const first=wb.SheetNames[0];if(!first)throw new BadRequestException('Workbook has no worksheet');const ws=wb.Sheets[first];const matrix=XLSX.utils.sheet_to_json<any[]>(ws,{header:1,defval:'',raw:false});if(!matrix.length)throw new BadRequestException('Workbook contains no rows');const h=(matrix[0]||[]).map(n);if(!h.length||h.some(x=>!x))throw new BadRequestException('Excel first row must contain headers');if(new Set(h.map(low)).size!==h.length)throw new BadRequestException('Excel contains duplicate headers');const rows:Row[]=matrix.slice(1).filter(r=>(r||[]).some((v:any)=>n(v))).map(r=>Object.fromEntries(h.map((k:string,j:number)=>[k,n(r?.[j])])));return{format:f,rows}}
 private map(row:Row,mapping:any,aliases:Record<string,string[]>){const keys=Object.keys(row);const out:Row={};for(const k of Object.keys(aliases)){const explicit=typeof mapping?.[k]==='string'?mapping[k]:undefined;const chosen=explicit&&keys.includes(explicit)?explicit:keys.find(x=>aliases[k].includes(low(x)));if(chosen)out[k]=n(row[chosen])}return out}
 private async resolveOwner(data:Row,fallback:string,organizationId?:string){if(data.ownerId){const u=await this.prisma.user.findFirst({where:{id:data.ownerId,isActive:true,deletedAt:null},select:{id:true}});if(!u)throw new BadRequestException(`Owner ${data.ownerId} not found`);return u.id}if(data.ownerEmail){const u=await this.prisma.user.findFirst({where:{email:{equals:data.ownerEmail,mode:'insensitive'},isActive:true,deletedAt:null},select:{id:true}});if(!u)throw new BadRequestException(`Owner ${data.ownerEmail} not found`);return u.id}return fallback}
 private async resolveOrg(data:Row,fallback?:string,organizationScope?:string[]|null){if(data.organizationId){const x=await this.prisma.organization.findFirst({where:{id:data.organizationId,deletedAt:null,...(organizationScope?{id:{in:organizationScope}}:{})},select:{id:true}});if(!x)throw new BadRequestException(`Organization ${data.organizationId} not found`);return x.id}if(fallback)return fallback;if(data.organizationName){const x=await this.prisma.organization.findFirst({where:{deletedAt:null,...(organizationScope?{id:{in:organizationScope}}:{}),name:{equals:data.organizationName,mode:'insensitive'}},select:{id:true}});if(x)return x.id;const d=domain(data.organizationDomain);if(d){const x=await this.prisma.organization.findFirst({where:{deletedAt:null,...(organizationScope?{id:{in:organizationScope}}:{}),website:{contains:d,mode:'insensitive'}},select:{id:true}});return x?.id}}return undefined}
 async preview(userId:string,file:any,body:any){
  const entity=String(body?.entityType||'').toUpperCase() as ImportEntityType;
  if(!Object.values(ImportEntityType).includes(entity)) throw new BadRequestException('entityType must be ORGANIZATION or PERSON');
  const orgId=body?.organizationId?String(body.organizationId):undefined;
  await this.auth.assertPermission(userId, 'data.import', { organizationId: orgId });
  const {format,rows}=await this.parse(file);
  const organizationScope=await this.auth.accessibleOrganizationIds(userId);
  if (orgId && organizationScope && !organizationScope.includes(orgId)) throw new BadRequestException('Organization outside import scope');
  let mapping:any={};
  try { if(body?.mapping) mapping=typeof body.mapping==='string'?JSON.parse(body.mapping):body.mapping; } catch { throw new BadRequestException('mapping must be valid JSON'); }
  const aliases=entity===ImportEntityType.ORGANIZATION?ORG:PERSON;
  if(!rows.length) throw new BadRequestException('Import file contains no data rows');
  const maxRows=Math.max(1000,Math.min(200000,Number(process.env.IMPORT_MAX_ROWS||100000)));
  if(rows.length>maxRows) throw new BadRequestException(`Import contains too many rows; maximum is ${maxRows}`);
  const first=this.map(rows[0],mapping,aliases);
  if(entity===ImportEntityType.ORGANIZATION&&!first.name) throw new BadRequestException('Organization import requires name');
  if(entity===ImportEntityType.PERSON&&!((first.firstName&&first.lastName)||first.displayName)) throw new BadRequestException('Person import requires firstName+lastName or displayName');
  const job=await this.prisma.dataImport.create({data:{organizationId:orgId,requestedById:userId,entityType:entity,format,status:ImportStatus.UPLOADED,pipelineStage:'UPLOAD',sourceFileName:n(file.originalname)||'upload',sourceMimeType:n(file.mimetype)||'application/octet-stream',sourceSizeBytes:Number(file.size||file.buffer.length),mapping,duplicateStrategy:DuplicateStrategy.SKIP}});
  await this.prisma.dataImport.update({where:{id:job.id},data:{pipelineStage:'MAPPING',status:ImportStatus.MAPPED}});
  await this.prisma.dataImport.update({where:{id:job.id},data:{pipelineStage:'VALIDATION',status:ImportStatus.VALIDATING}});
  let valid=0,invalid=0,dupes=0;
  const inFile=new Map<string,string>();
  try {
    await this.prisma.dataImport.update({where:{id:job.id},data:{pipelineStage:'DUPLICATE_DETECTION'}});
    for(let i=0;i<rows.length;i++){
      const raw=rows[i];
      const data=this.map(raw,mapping,aliases);
      const errors:string[]=[];
      try {
        if(entity===ImportEntityType.ORGANIZATION){
          if(!data.name) errors.push('name is required');
          if(data.email&&!EMAIL.test(data.email)) errors.push('invalid email');
        } else {
          if(!(data.firstName&&data.lastName)&&!data.displayName) errors.push('firstName+lastName or displayName is required');
          if(data.email&&!EMAIL.test(data.email)) errors.push('invalid email');
          if(!errors.length){const resolved=await this.resolveOrg(data,orgId,organizationScope);if(!resolved) errors.push('organization is required or resolvable');else data.organizationId=resolved;}
        }
      } catch(e) { errors.push(e instanceof Error?e.message:'Row validation failed'); }
      const candidates=errors.length?[]:await this.duplicateDetection.detect(entity,data,orgId,organizationScope);
      const signature=entity===ImportEntityType.ORGANIZATION?[low(data.name),domain(data.website),low(data.registrationId),phone(data.phone)].filter(Boolean).join('|'):([low(data.email),phone(data.phone),name(data.displayName||`${data.firstName||''} ${data.lastName||''}`),data.organizationId||orgId].filter(Boolean).join('|'));
      const prior=signature?inFile.get(signature):undefined;
      if(prior)candidates.unshift({id:`IMPORT_ROW:${prior}`,score:1,reasons:['in_file_duplicate'],entityType:entity});
      const status=errors.length?ImportRowStatus.INVALID:candidates.length?ImportRowStatus.DUPLICATE:ImportRowStatus.VALID;
      if(status===ImportRowStatus.VALID) valid++; else if(status===ImportRowStatus.INVALID) invalid++; else dupes++;
      const row=await this.prisma.dataImportRow.create({data:{importId:job.id,rowNumber:i+2,rawData:raw,normalizedData:data,status,errors:errors.length?errors:undefined}});
      if(signature&&!inFile.has(signature)) inFile.set(signature,row.id);
      for(const c of candidates) await this.prisma.dataImportDuplicate.create({data:{importId:job.id,rowId:row.id,entityType:c.entityType,candidateId:c.id,score:c.score,reasons:c.reasons}});
    }
  } catch(e) {
    await this.prisma.dataImport.update({where:{id:job.id},data:{status:ImportStatus.FAILED,errorSummary:{message:e instanceof Error?e.message:'Preview failed'}}});
    throw e;
  }
  await this.prisma.dataImport.update({where:{id:job.id},data:{status:ImportStatus.PREVIEWED,pipelineStage:'PREVIEW',summary:{total:rows.length,valid,invalid,duplicates:dupes,pipeline:['UPLOAD','MAPPING','VALIDATION','DUPLICATE_DETECTION','PREVIEW','APPROVAL','IMPORT','REPORT']}}});
  const approval = await this.approvals.request(userId, {
    entityType: 'DataImport', entityId: job.id, actionType: APPROVAL_ACTIONS.DATA_IMPORT,
    organizationId: orgId, reason: 'Data import requires explicit approval before mutation',
    after: { entityType: entity, format, total: rows.length, valid, invalid, duplicates: dupes },
  });
  await this.prisma.dataImport.update({ where: { id: job.id }, data: { approvalRequestId: (approval as any).id } });
  await this.audit.logMutation({userId,action:'CREATE',entityType:'DataImport',entityId:job.id,organizationId:orgId,after:{status:'PREVIEWED',entityType:entity,format,total:rows.length,valid,invalid,duplicates:dupes,approvalRequestId:(approval as any).id}});
  return this.getReport(userId,job.id);
 }
 async getReport(userId:string,id:string,page=1,limit=100){const safePage=Math.max(1,Number(page)||1);const safeLimit=Math.max(1,Math.min(500,Number(limit)||100));const job=await this.prisma.dataImport.findUnique({where:{id}});if(!job)throw new NotFoundException('Import not found');if(job.requestedById!==userId){await this.auth.assertPermission(userId, 'enterprise.admin', { organizationId: job.organizationId??undefined });}else{await this.auth.assertPermission(userId, 'data.import', { organizationId: job.organizationId??undefined });}const [rows,total,duplicates]=await this.prisma.$transaction([this.prisma.dataImportRow.findMany({where:{importId:id},include:{duplicates:true},orderBy:{rowNumber:'asc'},skip:(safePage-1)*safeLimit,take:safeLimit}),this.prisma.dataImportRow.count({where:{importId:id}}),this.prisma.dataImportDuplicate.count({where:{importId:id}})]);return {...job,rows,duplicates,totalRows:total,totalDuplicates:duplicates,page:safePage,limit:safeLimit,totalPages:Math.ceil(total/safeLimit)}}
 async approve(userId:string,id:string,body:any){
  const job=await this.prisma.dataImport.findUnique({where:{id}}); if(!job)throw new NotFoundException('Import not found');
  await this.auth.assertPermission(userId,'data.import.approve',{organizationId:job.organizationId??undefined});
  if(job.status!==ImportStatus.PREVIEWED)throw new BadRequestException('Only PREVIEWED imports can be approved');
  const strategy=String(body?.duplicateStrategy||job.duplicateStrategy).toUpperCase() as DuplicateStrategy;
  if(!Object.values(DuplicateStrategy).includes(strategy))throw new BadRequestException('duplicateStrategy must be SKIP, UPDATE or CREATE');
  if(!job.approvalRequestId)throw new BadRequestException('Import approval request is missing');
  await this.approvals.approve(userId,job.approvalRequestId,'import-approved');
  const approved=await this.prisma.dataImport.update({where:{id},data:{status:ImportStatus.APPROVED,pipelineStage:'APPROVAL',approvedById:userId,approvedAt:new Date(),duplicateStrategy:strategy}});
  const queued=await this.queues.enqueue(JOB_NAMES.dataImportProcess,{importId:id,userId},{jobId:`data-import:${id}`});
  await this.audit.logMutation({userId,action:'UPDATE',entityType:'DataImport',entityId:id,organizationId:job.organizationId??undefined,after:{status:'APPROVED',duplicateStrategy:strategy,queueJobId:queued.id}});
  return {...approved,queueJobId:queued.id,queued:true};
 }
 async processApproved(userId:string,id:string){
  let job=await this.prisma.dataImport.findUnique({where:{id}}); if(!job)throw new NotFoundException('Import not found');
  if(([ImportStatus.COMPLETED,ImportStatus.FAILED] as ImportStatus[]).includes(job.status))return job;
  const leaseId = `queue:${id}`;
  const now = new Date();
  if(job.status===ImportStatus.APPROVED){const claim=await this.prisma.dataImport.updateMany({where:{id,status:ImportStatus.APPROVED},data:{status:ImportStatus.PROCESSING,pipelineStage:'IMPORT',processingLeaseId:leaseId,processingHeartbeatAt:now}});if(!claim.count){job=await this.prisma.dataImport.findUnique({where:{id}});if(!job||job.status!==ImportStatus.PROCESSING)return job;}}
  else if(job.status===ImportStatus.PROCESSING && job.processingLeaseId!==leaseId){const staleAt=new Date(Date.now()-15*60*1000);const takeover=await this.prisma.dataImport.updateMany({where:{id,status:ImportStatus.PROCESSING,processingHeartbeatAt:{lt:staleAt}},data:{processingLeaseId:leaseId,processingHeartbeatAt:now}});if(!takeover.count)return job;}
  const strategy=job.duplicateStrategy; const batchSize=Math.max(50,Math.min(500,Number(process.env.IMPORT_BATCH_SIZE||250))); let imported=0,updated=0,skipped=0,failed=0;
  const totalRows=await this.prisma.dataImportRow.count({where:{importId:id}});
  while(true){
    const rows=await this.prisma.dataImportRow.findMany({where:{importId:id,status:{in:[ImportRowStatus.VALID,ImportRowStatus.DUPLICATE]}},include:{duplicates:true},orderBy:{rowNumber:'asc'},take:batchSize});
    if(!rows.length)break;
    for(const row of rows){const data=(row.normalizedData||{}) as Row;const top=[...row.duplicates].sort((a,b)=>b.score-a.score)[0];try{const result=await this.prisma.$transaction(async tx=>{
      if(top&&strategy===DuplicateStrategy.SKIP){await tx.dataImportRow.update({where:{id:row.id},data:{status:ImportRowStatus.SKIPPED,targetId:top.candidateId}});return'skipped';}
      if(top?.candidateId.startsWith('IMPORT_ROW:')&&strategy!==DuplicateStrategy.CREATE){await tx.dataImportRow.update({where:{id:row.id},data:{status:ImportRowStatus.SKIPPED,targetId:top.candidateId.replace('IMPORT_ROW:','')}});return'skipped';}
      if(job!.entityType===ImportEntityType.ORGANIZATION){const payload:any={name:data.name,legalName:data.legalName||undefined,englishName:data.englishName||undefined,displayName:data.displayName||data.name,type:data.type?n(data.type).toUpperCase():undefined,industry:data.industry||undefined,country:data.country||undefined,city:data.city||undefined,address:data.address||undefined,website:data.website||undefined,phone:data.phone||undefined,email:data.email||undefined,registrationId:data.registrationId||undefined,ownerId:await this.resolveOwner(data,userId,job!.organizationId??undefined)};if(top&&strategy===DuplicateStrategy.UPDATE){await tx.organization.update({where:{id:top.candidateId},data:payload});await tx.dataImportRow.update({where:{id:row.id},data:{status:ImportRowStatus.UPDATED,targetId:top.candidateId}});return'updated';}const created=await tx.organization.create({data:payload});await tx.dataImportRow.update({where:{id:row.id},data:{status:ImportRowStatus.IMPORTED,targetId:created.id}});return'imported';}
      let f=data.firstName,l=data.lastName;if(!f||!l){const p=n(data.displayName).split(/\s+/);f=p.shift()||'Unknown';l=p.join(' ')||'Unknown';}const organizationId=data.organizationId||job!.organizationId;if(!organizationId)throw new BadRequestException('Person organization could not be resolved');const payload:any={firstName:f,lastName:l,displayName:data.displayName||`${f} ${l}`,email:data.email||undefined,phone:data.phone||undefined,title:data.title||undefined,department:data.department||undefined,country:data.country||undefined,organizationId};if(top&&strategy===DuplicateStrategy.UPDATE){await tx.person.update({where:{id:top.candidateId},data:payload});await tx.dataImportRow.update({where:{id:row.id},data:{status:ImportRowStatus.UPDATED,targetId:top.candidateId}});return'updated';}const created=await tx.person.create({data:payload});await tx.dataImportRow.update({where:{id:row.id},data:{status:ImportRowStatus.IMPORTED,targetId:created.id}});return'imported';});if(result==='imported')imported++;else if(result==='updated')updated++;else skipped++;}catch(e){failed++;await this.prisma.dataImportRow.update({where:{id:row.id},data:{status:ImportRowStatus.INVALID,errors:[e instanceof Error?e.message:'Import failed']}});}}
    const processed=await this.prisma.dataImportRow.count({where:{importId:id,status:{in:[ImportRowStatus.IMPORTED,ImportRowStatus.UPDATED,ImportRowStatus.SKIPPED,ImportRowStatus.INVALID]}}});
    await this.prisma.dataImport.update({where:{id},data:{summary:{...((job.summary||{}) as any),imported,updated,skipped,failed,total:totalRows,processed,batchSize,queueProcessed:true,progress:totalRows?Math.round(processed/totalRows*100):100},processingHeartbeatAt:new Date()}});
    if(rows.length<batchSize)break;
  }
  const summary={...((job.summary||{}) as any),imported,updated,skipped,failed,total:totalRows,batchSize,queueProcessed:true,processed:imported+updated+skipped+failed,progress:100};const status=failed===totalRows?ImportStatus.FAILED:ImportStatus.COMPLETED;const done=await this.prisma.dataImport.update({where:{id},data:{status,pipelineStage:'REPORT',summary,completedAt:new Date(),processingLeaseId:null,processingHeartbeatAt:null}});await this.eventBus.publish({eventType:DOMAIN_EVENT_TYPES.DATA_IMPORT_COMPLETED,aggregateType:'DataImport',aggregateId:id,organizationId:job.organizationId??undefined,actorId:userId,payload:{status,summary,entityType:job.entityType}});await this.audit.logMutation({userId,action:'UPDATE',entityType:'DataImport',entityId:id,organizationId:job.organizationId??undefined,after:{status,duplicateStrategy:strategy,summary}});return done;
 }

}
