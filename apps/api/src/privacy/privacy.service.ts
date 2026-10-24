import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataClassification, LegalBasis, PrivacyRequestStatus, PrivacyRequestType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { DataLifecycleService } from '../common/data-lifecycle/data-lifecycle.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { JobService } from '../jobs/job.service';
import { JOB_NAMES } from '../jobs/queue.constants';
import { S3Storage } from '../documents/s3.storage';
import { createHash } from 'node:crypto';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthorizationService, private readonly audit: AuditService, private readonly lifecycleService: DataLifecycleService, private readonly jobs: JobService, private readonly storage: S3Storage) {}

  async policies(userId: string) {
    await this.auth.assertPermission(userId, 'privacy.read', {});
    return EntityResponseDto.manyUnknown(await this.prisma.dataProcessingPolicy.findMany({ where: { active: true }, orderBy: { entityType: 'asc' } }));
  }

  async consents(userId: string, page = 1, pageSize = 50) {
    const take = Math.max(1, Math.min(100, Number(pageSize) || 50)); const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const where = { userId }; const [items, total] = await this.prisma.$transaction([this.prisma.consentRecord.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }), this.prisma.consentRecord.count({ where })]);
    return { items: EntityResponseDto.manyUnknown(items), page: Math.max(1, Number(page) || 1), pageSize: take, total, totalPages: Math.ceil(total / take) };
  }

  async grantConsent(userId: string, purpose: string, version: string, source = 'USER') {
    return EntityResponseDto.fromUnknown(await this.prisma.consentRecord.upsert({
      where: { userId_purpose_version: { userId, purpose, version } },
      update: { status: 'GRANTED', grantedAt: new Date(), revokedAt: null, source },
      create: { userId, purpose, version, source, status: 'GRANTED' },
    }));
  }

  async revokeConsent(userId: string, purpose: string, version: string) {
    return EntityResponseDto.fromUnknown(await this.prisma.consentRecord.update({
      where: { userId_purpose_version: { userId, purpose, version } },
      data: { status: 'REVOKED', revokedAt: new Date() },
    }));
  }

  async request(userId: string, type: PrivacyRequestType, reason?: string) {
    if (!Object.values(PrivacyRequestType).includes(type)) throw new BadRequestException('Invalid privacy request type');
    const open = await this.prisma.privacyRequest.findFirst({ where: { userId, type, status: { in: ['PENDING', 'PROCESSING'] } } });
    if (open) return EntityResponseDto.fromUnknown(open);
    const row = await this.prisma.privacyRequest.create({ data: { userId, type, reason } });
    await this.audit.logMutation({ userId, action: 'CREATE', entityType: 'PrivacyRequest', entityId: row.id, reason: `privacy-${type.toLowerCase()}` });
    return EntityResponseDto.fromUnknown(row);
  }

  async listRequests(userId: string, page = 1, pageSize = 50) {
    const take = Math.max(1, Math.min(100, Number(pageSize) || 50)); const currentPage = Math.max(1, Number(page) || 1); const skip = (currentPage - 1) * take;
    const where = { userId }; const [items, total] = await this.prisma.$transaction([this.prisma.privacyRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }), this.prisma.privacyRequest.count({ where })]);
    return { items: EntityResponseDto.manyUnknown(items), page: currentPage, pageSize: take, total, totalPages: Math.ceil(total / take) };
  }

  async exportData(userId: string, requestId?: string) {
    if (requestId) {
      const req = await this.prisma.privacyRequest.findFirst({ where: { id: requestId, userId, type: { in: [PrivacyRequestType.EXPORT, PrivacyRequestType.ACCESS] } } });
      if (!req) throw new NotFoundException('Privacy request not found');
      if (req.status === PrivacyRequestStatus.COMPLETED) return this.exportStatus(userId, requestId);
      const job = await this.jobs.enqueue(JOB_NAMES.privacyExportProcess, { requestId, userId }, { jobId: `privacy-export:${requestId}` } as any);
      if (req.status === PrivacyRequestStatus.PENDING) await this.prisma.privacyRequest.update({ where: { id: requestId }, data: { status: PrivacyRequestStatus.PROCESSING, result: { queuedJobId: job.id } } });
      return { status: 'PROCESSING', requestId, jobId: job.id };
    }
    throw new BadRequestException('A privacy export requestId is required');
  }

  async processExportJob(requestId: string, userId: string) {
    const req = await this.prisma.privacyRequest.findFirst({ where: { id: requestId, userId, type: { in: [PrivacyRequestType.EXPORT, PrivacyRequestType.ACCESS] }, status: { in: [PrivacyRequestStatus.PENDING, PrivacyRequestStatus.PROCESSING] } } });
    if (!req) return { status: 'SKIPPED', reason: 'request-not-pending' };
    const batchSize = 250;
    const exportKind = req.type === PrivacyRequestType.ACCESS ? 'GDPR_ACCESS_REQUEST' : 'GDPR_DATA_EXPORT';
    const prefix = `privacy-exports/${userId}/${requestId}`;
    const parts: Array<{ entityType: string; key: string; count: number; sha256: string }> = [];
    const writePart = async (entityType: string, rows: unknown[], part: number) => {
      if (!rows.length) return;
      const body = Buffer.from(rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
      const key = `${prefix}/${entityType}-${part}.jsonl`;
      await this.storage.put(key, body, 'application/x-ndjson');
      parts.push({ entityType, key, count: rows.length, sha256: createHash('sha256').update(body).digest('hex') });
    };
    const datasets: Array<{ name: string; run: (skip: number) => Promise<unknown[]> }> = [
      { name: 'memberships', run: (skip) => this.prisma.membership.findMany({ where: { userId }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'interactions', run: (skip) => this.prisma.interaction.findMany({ where: { userId, deletedAt: null }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'meetings', run: (skip) => this.prisma.meeting.findMany({ where: { ownerId: userId, deletedAt: null }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'actions', run: (skip) => this.prisma.action.findMany({ where: { ownerId: userId, deletedAt: null }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'commitments', run: (skip) => this.prisma.commitment.findMany({ where: { ownerId: userId, deletedAt: null }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'projects', run: (skip) => this.prisma.project.findMany({ where: { ownerId: userId, deletedAt: null }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'relationships', run: (skip) => this.prisma.relationship.findMany({ where: { OR: [{ ownerId: userId }, { backupOwnerId: userId }], deletedAt: null }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'notes', run: (skip) => this.prisma.note.findMany({ where: { createdById: userId, deletedAt: null }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'documents', run: (skip) => this.prisma.document.findMany({ where: { createdById: userId, deletedAt: null }, select: { id: true, name: true, mimeType: true, sizeBytes: true, classification: true, uploadStatus: true, scanStatus: true, createdAt: true }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'notifications', run: (skip) => this.prisma.notification.findMany({ where: { userId, deletedAt: null }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'recommendations', run: (skip) => this.prisma.recommendation.findMany({ where: { OR: [{ userId }, { assignedToId: userId }], deletedAt: null }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'loginHistory', run: (skip) => this.prisma.loginHistory.findMany({ where: { userId }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'consents', run: (skip) => this.prisma.consentRecord.findMany({ where: { userId }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
      { name: 'privacyRequests', run: (skip) => this.prisma.privacyRequest.findMany({ where: { userId }, orderBy: { id: 'asc' }, skip, take: batchSize }) },
    ];
    for (const dataset of datasets) {
      let skip = 0; let part = 0;
      while (true) { const rows = await dataset.run(skip); if (!rows.length) break; await writePart(dataset.name, rows, part++); if (rows.length < batchSize) break; skip += rows.length; }
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, isActive: true, emailVerifiedAt: true, createdAt: true, updatedAt: true } });
    const manifest = { schemaVersion: '1.1', exportedAt: new Date().toISOString(), user, parts, totalRecords: parts.reduce((n, p) => n + p.count, 0) };
    const manifestKey = `${prefix}/manifest.json`;
    const manifestBody = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
    await this.storage.put(manifestKey, manifestBody, 'application/json');
    await this.prisma.dataExportLog.create({ data: { userId, exportType: exportKind, entityType: 'USER_DATA', recordCount: manifest.totalRecords, classification: DataClassification.CONFIDENTIAL, requestId } });
    await this.audit.logMutation({ userId, action: req.type === PrivacyRequestType.ACCESS ? 'READ' : 'EXPORT', entityType: 'PrivacyData', entityId: userId, reason: req.type === PrivacyRequestType.ACCESS ? 'gdpr-access-request' : 'gdpr-data-export' });
    await this.prisma.privacyRequest.update({ where: { id: requestId }, data: { status: PrivacyRequestStatus.COMPLETED, completedAt: new Date(), result: { manifestKey, totalRecords: manifest.totalRecords, parts: parts.length } } });
    return { status: 'COMPLETED', requestId, manifestKey, totalRecords: manifest.totalRecords, parts: parts.length };
  }

  async exportStatus(userId: string, requestId: string) {
    const req = await this.prisma.privacyRequest.findFirst({ where: { id: requestId, userId, type: { in: [PrivacyRequestType.EXPORT, PrivacyRequestType.ACCESS] } } });
    if (!req) throw new NotFoundException('Privacy request not found');
    const result = (req.result ?? {}) as any;
    const manifestKey = typeof result.manifestKey === 'string' ? result.manifestKey : undefined;
    return { status: req.status, requestId, completedAt: req.completedAt, totalRecords: result.totalRecords ?? null, manifestUrl: manifestKey ? await this.storage.createSignedReadUrl(manifestKey, 900) : null };
  }

  async accessRequest(userId: string, requestId?: string) {
    if (!requestId) throw new BadRequestException('A privacy access requestId is required');
    const req = await this.prisma.privacyRequest.findFirst({ where: { id: requestId, userId, type: PrivacyRequestType.ACCESS } });
    if (!req) throw new NotFoundException('Privacy access request not found');
    if (req.status === PrivacyRequestStatus.COMPLETED) return this.exportStatus(userId, requestId);
    const job = await this.jobs.enqueue(JOB_NAMES.privacyExportProcess, { requestId, userId }, { jobId: `privacy-export:${requestId}` } as any);
    if (req.status === PrivacyRequestStatus.PENDING) await this.prisma.privacyRequest.update({ where: { id: requestId }, data: { status: PrivacyRequestStatus.PROCESSING, result: { queuedJobId: job.id } } });
    return { status: 'PROCESSING', requestId, jobId: job.id };
  }

  async eraseData(userId: string, requestId?: string) {
    if (requestId) { const req = await this.prisma.privacyRequest.findFirst({ where: { id: requestId, userId, type: PrivacyRequestType.ERASURE } }); if (!req) throw new NotFoundException('Privacy request not found'); }
    const policy = await this.prisma.dataProcessingPolicy.findMany({ where: { active: true } });
    const blocked = policy.filter(p => !p.erasable && p.legalBasis === LegalBasis.LEGAL_OBLIGATION);
    const now = new Date();
    await this.prisma.$transaction(async tx => {
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.recoveryCode.deleteMany({ where: { userId } });
      await tx.mfaDevice.updateMany({ where: { userId, enabled: true }, data: { enabled: false } });
      await tx.user.update({ where: { id: userId }, data: { name: `Erased User ${userId.slice(0, 8)}`, email: `erased+${userId}@privacy.invalid`, passwordHash: null, emailVerifiedAt: null, isActive: false, deletedAt: now } });
      await tx.privacyRequest.updateMany({ where: { userId, status: { in: ['PENDING', 'PROCESSING'] } }, data: { status: PrivacyRequestStatus.COMPLETED, completedAt: now, result: { blockedLegalRetention: blocked.map(x => x.entityType) } } });
    });
    await this.audit.logMutation({ userId, action: 'DELETE', entityType: 'UserPrivacyData', entityId: userId, reason: 'gdpr-erasure-anonymization' });
    return { status: 'COMPLETED', anonymized: true, legalRetention: blocked.map(x => x.entityType) };
  }

  async lifecycle(userId: string, entityType: string, entityId: string, state: any, reason?: string) {
    if (!['CREATION', 'ACTIVE', 'ARCHIVED', 'RETENTION', 'DELETION'].includes(state)) throw new BadRequestException('Invalid lifecycle state');
    const row = await this.prisma.dataLifecycleRecord.create({ data: { entityType, entityId, state, actorId: userId, reason } });
    await this.audit.logMutation({ userId, action: 'UPDATE', entityType: 'DataLifecycleRecord', entityId: row.id, reason: reason ?? `lifecycle-${String(state).toLowerCase()}`, after: row });
    return EntityResponseDto.fromUnknown(row);
  }

  private async computeRetentionPreview(userId: string) {
    await this.auth.assertPermission(userId, 'privacy.manage', {});
    const policies = await this.prisma.dataProcessingPolicy.findMany({ where: { active: true, retentionDays: { not: null } } });
    const now = Date.now();
    const result: Array<{ entityType: string; purpose: string | null; retentionDays: number | null; cutoff: Date; erasable: boolean; count: number }> = [];
    for (const p of policies) {
      const cutoff = new Date(now - Number(p.retentionDays) * 86400000);
      let count = 0;
      const config = (() => { try { return (this.lifecycleService as any).config?.(p.entityType); } catch { return null; } })();
      if (config) count = await (this.prisma as any)[config.delegate].count({ where: { createdAt: { lt: cutoff }, deletedAt: null } });
      result.push({ entityType: p.entityType, purpose: p.purpose, retentionDays: p.retentionDays, cutoff, erasable: p.erasable, count });
    }
    return result;
  }

  async retentionPreview(userId: string) {
    await this.auth.assertPermission(userId, 'privacy.manage', {});
    return EntityResponseDto.fromUnknown(await this.computeRetentionPreview(userId));
  }

  async retentionExecute(userId: string) {
    await this.auth.assertPermission(userId, 'privacy.manage', {});
    const preview = await this.computeRetentionPreview(userId);
    const now = new Date();
    const changed: Array<{entityType:string;count:number}> = [];
    for (const item of preview) {
      if (!item.erasable || !item.count) continue;
      const where:any = { createdAt: { lt: item.cutoff }, deletedAt: null };
      const result = await this.lifecycleService.softDeleteMany(userId, item.entityType, where, `retention-policy:${item.purpose}`);
      const count = result.count;
      if (count) changed.push({entityType:item.entityType,count});
    }
    await this.audit.logMutation({userId,action:'SOFT_DELETE',entityType:'RetentionBatch',entityId:now.toISOString(),reason:'retention-policy-execution'});
    return { executedAt: now, changed };
  }

  async privacyAudit(userId: string) {
    await this.auth.assertPermission(userId, 'privacy.audit', {});
    return EntityResponseDto.manyUnknown(await this.prisma.auditLog.findMany({ where: { entityType: { in: ['PrivacyRequest', 'PrivacyData', 'UserPrivacyData'] } }, orderBy: { createdAt: 'desc' }, take: 500 }));
  }
}
