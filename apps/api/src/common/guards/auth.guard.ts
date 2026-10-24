import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'node:crypto';
import { RequestContext } from '../request-context';

const IDLE_TTL_MS = Number(process.env.SESSION_IDLE_TTL_MS ?? 8 * 60 * 60 * 1000);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService, private readonly requestContext: RequestContext) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest(); const header = req.headers.authorization as string | undefined;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const payload = this.jwt.verify<{ sub: string; sid?: string }>(header.slice(7));
      if (!payload.sid) throw new UnauthorizedException('Session is inactive');
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, isActive: true, deletedAt: true } });
      if (!user?.isActive || user.deletedAt) throw new UnauthorizedException('User is inactive');
      const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
      const now = new Date();
      if (!session || session.userId !== payload.sub || session.revokedAt || session.rotatedAt || session.expiresAt <= now || session.absoluteExpiresAt <= now || session.idleExpiresAt <= now) throw new UnauthorizedException('Session is inactive');
      const suspicious = (!!req.ip && !!session.ipAddress && req.ip !== session.ipAddress) || (!!req.headers['user-agent'] && !!session.userAgent && req.headers['user-agent'] !== session.userAgent);
      if (suspicious) await this.prisma.securityEvent.create({ data: { userId: payload.sub, type: 'SUSPICIOUS_ACCESS', severity: 'WARNING', ipAddress: req.ip, userAgent: req.headers['user-agent'], metadata: { previousIp: session.ipAddress, previousUserAgent: session.userAgent } } }).catch(() => undefined);
      await this.prisma.session.update({ where: { id: session.id }, data: { lastActivityAt: now, idleExpiresAt: new Date(Math.min(Date.now() + IDLE_TTL_MS, session.absoluteExpiresAt.getTime())) } });
      req.user = payload; this.requestContext.setUserId(payload.sub); return true;
    } catch (error) { if (error instanceof UnauthorizedException) throw error; throw new UnauthorizedException('Invalid or expired token'); }
  }
}
