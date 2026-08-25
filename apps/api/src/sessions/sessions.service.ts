import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { AuditService } from '../audit/audit.service';

const ABSOLUTE_TTL_MS = Number(process.env.SESSION_ABSOLUTE_TTL_MS ?? 30 * 24 * 60 * 60 * 1000);
const IDLE_TTL_MS = Number(process.env.SESSION_IDLE_TTL_MS ?? 8 * 60 * 60 * 1000);

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private _lastRevokedUserId?: string;
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  get lastRevokedUserId() { return this._lastRevokedUserId; }
  private hash(token: string) { return crypto.createHash('sha256').update(token).digest('hex'); }
  private expiry(now = Date.now()) { return { idle: new Date(now + IDLE_TTL_MS), absolute: new Date(now + ABSOLUTE_TTL_MS) }; }

  async create(userId: string, meta: { ip?: string; userAgent?: string; device?: string }) {
    const raw = crypto.randomBytes(48).toString('base64url');
    const now = Date.now(); const e = this.expiry(now);
    const session = await this.prisma.session.create({ data: { userId, tokenHash: this.hash(raw), tokenFamilyId: crypto.randomUUID(), ipAddress: meta.ip, userAgent: meta.userAgent, deviceName: meta.device, expiresAt: e.absolute, idleExpiresAt: e.idle, absoluteExpiresAt: e.absolute, lastActivityAt: new Date(now) } });
    await this.audit.logMutation({ userId, action: 'TOKEN_CHANGE', entityType: 'Session', entityId: session.id, after: { created: true, tokenFamilyId: session.tokenFamilyId }, reason: 'session-created' });
    return { refreshToken: raw, sessionId: session.id, userId };
  }

  async rotate(raw: string, meta: { ip?: string; userAgent?: string; device?: string }) {
    const current = await this.prisma.session.findUnique({ where: { tokenHash: this.hash(raw) } });
    const now = new Date();
    if (!current) throw new UnauthorizedException('Invalid refresh token');
    if (current.revokedAt || current.rotatedAt || current.expiresAt <= now || current.idleExpiresAt <= now || current.absoluteExpiresAt <= now) {
      // Refresh Token Rotation Reuse Detection: اگر Token از قبل rotatedAt دارد
      // یعنی این دقیقاً همان توکنی است که قبلاً یک‌بار برای Rotation استفاده
      // شده و توکن جدید صادر شده بود؛ استفاده مجدد از آن نشانه‌ی کلاسیک
      // «Refresh Token Theft» است (سند فنی، بخش 46: Refresh token rotation).
      // در این حالت کل خانواده‌ی Session (tokenFamilyId) فوراً باطل و یک
      // SecurityEvent با شدت HIGH ثبت می‌شود.
      const isReuse = !!current.rotatedAt && !current.revokedAt;
      await this.prisma.session.updateMany({ where: { tokenFamilyId: current.tokenFamilyId, revokedAt: null }, data: { revokedAt: now } });
      if (isReuse) {
        this.logger.warn(`Refresh token reuse detected for userId=${current.userId} tokenFamilyId=${current.tokenFamilyId}`);
        await this.prisma.securityEvent.create({
          data: {
            userId: current.userId,
            type: 'SUSPICIOUS_ACCESS',
            severity: 'HIGH',
            ipAddress: meta.ip,
            userAgent: meta.userAgent,
            metadata: { reason: 'refresh_token_reuse', tokenFamilyId: current.tokenFamilyId },
          },
        }).catch(() => undefined);
        throw new UnauthorizedException('Refresh token reuse detected');
      }
      throw new UnauthorizedException('Refresh token expired or revoked');
    }
    const nextRaw = crypto.randomBytes(48).toString('base64url'); const e = this.expiry(now.getTime());
    const next = await this.prisma.$transaction(async tx => {
      const created = await tx.session.create({ data: { userId: current.userId, tokenHash: this.hash(nextRaw), tokenFamilyId: current.tokenFamilyId, ipAddress: meta.ip, userAgent: meta.userAgent, deviceName: meta.device, expiresAt: e.absolute, idleExpiresAt: e.idle, absoluteExpiresAt: e.absolute, lastActivityAt: now } });
      await tx.session.update({ where: { id: current.id }, data: { rotatedAt: now, revokedAt: now, replacedBySessionId: created.id } });
      return EntityResponseDto.fromUnknown(created);
    });
    await this.audit.logMutation({ userId: current.userId, action: 'TOKEN_CHANGE', entityType: 'Session', entityId: next.id as string, before: { previousSessionId: current.id, rotated: false }, after: { rotated: true, previousSessionId: current.id, tokenFamilyId: current.tokenFamilyId }, reason: 'refresh-token-rotated' });
    return { refreshToken: nextRaw, sessionId: next.id, userId: current.userId };
  }

  async touch(sessionId: string, userId: string, meta?: { ip?: string; userAgent?: string }) {
    const s = await this.prisma.session.findUnique({ where: { id: sessionId } });
    const now = new Date();
    if (!s || s.userId !== userId || s.revokedAt || s.rotatedAt || s.expiresAt <= now || s.idleExpiresAt <= now || s.absoluteExpiresAt <= now) throw new UnauthorizedException('Session is inactive');
    const suspicious = !!(meta?.ip && s.ipAddress && meta.ip !== s.ipAddress) || !!(meta?.userAgent && s.userAgent && meta.userAgent !== s.userAgent);
    if (suspicious) await this.prisma.securityEvent.create({ data: { userId, type: 'SUSPICIOUS_ACCESS', severity: 'WARNING', ipAddress: meta?.ip, userAgent: meta?.userAgent, metadata: { previousIp: s.ipAddress, previousUserAgent: s.userAgent } } });
    const idle = new Date(Math.min(Date.now() + IDLE_TTL_MS, s.absoluteExpiresAt.getTime()));
    await this.prisma.session.update({ where: { id: sessionId }, data: { lastActivityAt: now, idleExpiresAt: idle } });
    return true;
  }

  async revoke(raw: string) { const row=await this.prisma.session.findFirst({where:{tokenHash:this.hash(raw),revokedAt:null},select:{id:true,userId:true}}); const result=EntityResponseDto.fromUnknown(await this.prisma.session.updateMany({ where: { tokenHash: this.hash(raw), revokedAt: null }, data: { revokedAt: new Date() } })); if(row){this._lastRevokedUserId=row.userId; await this.audit.logMutation({userId:row.userId,action:'LOGOUT',entityType:'Session',entityId:row.id,after:{revoked:true},reason:'session-revoked'});} return result; }
  async revokeById(sessionId: string) { const row=await this.prisma.session.findUnique({where:{id:sessionId},select:{id:true,userId:true,revokedAt:true}}); const result=EntityResponseDto.fromUnknown(await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } })); if(row&&!row.revokedAt) await this.audit.logMutation({userId:row.userId,action:'LOGOUT',entityType:'Session',entityId:row.id,after:{revoked:true},reason:'admin-session-revoked'}); return result; }
  async revokeOwned(userId: string, sessionId: string) { return EntityResponseDto.fromUnknown(await this.prisma.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } })); }
  async revokeAll(userId: string) { return EntityResponseDto.fromUnknown(await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })); }
  async revokeAllExcept(userId: string, sessionId: string) { return EntityResponseDto.fromUnknown(await this.prisma.session.updateMany({ where: { userId, id: { not: sessionId }, revokedAt: null }, data: { revokedAt: new Date() } })); }
  async isActive(sessionId: string, userId: string) { const s = await this.prisma.session.findUnique({ where: { id: sessionId } }); return !!s && s.userId === userId && !s.revokedAt && !s.rotatedAt && s.expiresAt > new Date() && s.idleExpiresAt > new Date() && s.absoluteExpiresAt > new Date(); }
  async list(userId: string) { return EntityResponseDto.manyUnknown(await this.prisma.session.findMany({ where: { userId }, select: { id: true, deviceName: true, ipAddress: true, userAgent: true, expiresAt: true, idleExpiresAt: true, absoluteExpiresAt: true, lastActivityAt: true, revokedAt: true, rotatedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 })); }
}
