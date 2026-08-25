import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { TooManyRequestsException } from '../common/exceptions';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { MfaService } from '../common/mfa/mfa.service';
import { AuditService } from '../audit/audit.service';

const ACCESS_TTL = '15m';
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionsService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
  ) {}

  private tokenHash(value: string) { return crypto.createHash('sha256').update(value).digest('hex'); }

  private passwordOk(password: string) {
    return password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
  }

  private normalizeEmail(email: string) { return email.trim().toLowerCase(); }

  private async createVerificationToken(userId: string) {
    await this.prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    const raw = crypto.randomBytes(32).toString('base64url');
    const row = await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash: this.tokenHash(raw), expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS) },
    });
    await this.audit.logMutation({ userId, action: 'TOKEN_CHANGE', entityType: 'EmailVerificationToken', entityId: row.id, after: { issued: true, expiresAt: row.expiresAt }, reason: 'email-verification-token-issued' });
    return raw;
  }

  async register(email: string, password: string, name: string) {
    if (!this.passwordOk(password)) throw new BadRequestException('Password must be 12+ chars and include upper, lower and number');
    const normalizedEmail = this.normalizeEmail(email);
    const exists = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) throw new BadRequestException('Account already exists');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: { email: normalizedEmail, name: name.trim(), passwordHash, passwordChangedAt: new Date() },
    });
    const verificationToken = await this.createVerificationToken(user.id);
    return {
      user: { id: user.id, email: user.email, name: user.name, emailVerified: false },
      ...(process.env.NODE_ENV === 'production' ? {} : { developmentVerificationToken: verificationToken }),
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
      select: { id: true, email: true, name: true, memberships: { select: { id: true, organizationId: true, role: true, department: true, dataScope: true, accessScope: true, scope: true, isPrimary: true, organization: { select: { name: true } } } } },
    });
    if (!user) throw new UnauthorizedException('User is inactive');
    const roles = [...new Set(user.memberships.map(m => m.role))];
    const permissions = await this.prisma.rolePermission.findMany({ where: { role: { in: roles } }, select: { permission: { select: { key: true } } } });
    const accessibleOrganizationIds = [...new Set(user.memberships.map(m => m.organizationId))];
    return {
      id: user.id, email: user.email, name: user.name,
      memberships: user.memberships.map(m => ({ id:m.id, organizationId:m.organizationId, organizationName:m.organization.name, role:m.role, department:m.department, dataScope:m.dataScope, accessScope:m.accessScope, scope:m.scope, isPrimary:m.isPrimary })),
      permissions: [...new Set(permissions.map(p => p.permission.key))],
      accessibleOrganizationIds,
    };
  }

  async isAdministrator(userId: string) { const memberships = await this.prisma.membership.findMany({ where: { userId }, select: { role: true } }); return memberships.some(m => ['SUPER_ADMIN','HOLDING_ADMIN','SUBSIDIARY_ADMIN'].includes(m.role)); }
  async isMfaEnabled(userId: string) { return this.mfa.required(userId); }
  async verifyMfa(userId: string, otp: string) { return this.mfa.verify(userId, otp); }

  private async mfaRequiredForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({ where: { userId }, select: { role: true } });
    const adminRoles = new Set(['SUPER_ADMIN','HOLDING_ADMIN','SUBSIDIARY_ADMIN']);
    return memberships.some(m => adminRoles.has(m.role));
  }

  async login(email: string, password: string, meta: { ip?: string; userAgent?: string; otp?: string } = {}) {
    if ((process.env.AUTH_MODE ?? 'local') === 'oidc') throw new UnauthorizedException('Password login is disabled; use the configured Identity Provider');
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    const now = new Date();
    if (user?.lockedUntil && user.lockedUntil > now) {
      await this.recordLogin(user.id, false, meta, 'ACCOUNT_LOCKED');
      await this.audit.logMutation({ userId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, after: { success: false, reason: 'ACCOUNT_LOCKED' }, reason: 'failed-login' });
      throw new TooManyRequestsException('Account temporarily locked');
    }

    const ok = !!user && !!user.passwordHash && user.isActive && !user.deletedAt && await bcrypt.compare(password, user.passwordHash);
    if (!ok || !user) {
      if (user) {
        const failed = user.failedLoginCount + 1;
        await new Promise(resolve => setTimeout(resolve, Math.min(5000, 250 * Math.pow(2, Math.min(failed - 1, 5)))));
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: failed, lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MS) : null },
        });
        const loginReason = failed >= MAX_FAILED_LOGINS ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS';
        await this.recordLogin(user.id, false, meta, loginReason);
        await this.audit.logMutation({ userId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, after: { success: false, reason: loginReason }, reason: 'failed-login' });
      }
      if (!user) await this.audit.logMutation({ action: 'LOGIN', entityType: 'AuthAttempt', after: { success: false, reason: 'INVALID_CREDENTIALS' }, reason: 'failed-login' });
      throw new UnauthorizedException('Invalid credentials');
    }

    if ((process.env.AUTH_REQUIRE_EMAIL_VERIFICATION ?? 'true') === 'true' && !user.emailVerifiedAt) throw new UnauthorizedException('Email verification required');
    const previous = await this.prisma.loginHistory.findFirst({ where: { userId:user.id, success:true }, orderBy:{ createdAt:'desc' } });
    if (previous && ((meta.ip && previous.ipAddress && meta.ip !== previous.ipAddress) || (meta.userAgent && previous.userAgent && meta.userAgent !== previous.userAgent))) await this.prisma.securityEvent.create({ data:{ userId:user.id, type:'SUSPICIOUS_ACCESS', severity:'WARNING', ipAddress:meta.ip, userAgent:meta.userAgent, metadata:{ previousIp:previous.ipAddress, previousUserAgent:previous.userAgent } } });
    const mfaRequired = await this.mfa.required(user.id);
    const adminMfaRequired = await this.mfaRequiredForUser(user.id);
    if (adminMfaRequired && !mfaRequired) throw new UnauthorizedException('MFA enrollment is required for administrator accounts');
    if (mfaRequired) {
      if (!meta.otp) throw new UnauthorizedException('MFA code required');
      await this.mfa.verify(user.id, meta.otp);
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now, failedLoginCount: 0, lockedUntil: null } });
    await this.recordLogin(user.id, true, meta, undefined);
    await this.audit.logMutation({ userId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, after: { success: true }, reason: 'successful-login' });
    return this.issue(user.id, user.email, meta);
  }

  private async recordLogin(userId: string, success: boolean, meta: { ip?: string; userAgent?: string }, reason?: string) {
    await this.prisma.loginHistory.create({ data: { userId, success, ipAddress: meta.ip, userAgent: meta.userAgent, reason } }).catch(() => undefined);
  }

  async issue(userId: string, email: string, meta: { ip?: string; userAgent?: string } = {}) {
    const refresh = await this.sessions.create(userId, meta);
    const accessToken = this.jwt.sign({ sub: userId, email, sid: refresh.sessionId });
    return { accessToken, refreshToken: refresh.refreshToken, tokenType: 'Bearer', expiresIn: ACCESS_TTL };
  }

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string } = {}) {
    const rotated = await this.sessions.rotate(refreshToken, meta);
    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user?.isActive || user.deletedAt) throw new UnauthorizedException('User is inactive');
    return { accessToken: this.jwt.sign({ sub: user.id, email: user.email, sid: rotated.sessionId }), refreshToken: rotated.refreshToken, tokenType: 'Bearer', expiresIn: ACCESS_TTL };
  }

  async logout(refreshToken: string) { await this.sessions.revoke(refreshToken); return { success: true }; }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: this.normalizeEmail(email) } });
    if (!user || !user.isActive || user.deletedAt) return { accepted: true };
    await this.prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    const raw = crypto.randomBytes(32).toString('base64url');
    const tokenRow = await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: this.tokenHash(raw), expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) } });
    await this.audit.logMutation({ userId: user.id, action: 'TOKEN_CHANGE', entityType: 'PasswordResetToken', entityId: tokenRow.id, after: { issued: true, expiresAt: tokenRow.expiresAt }, reason: 'password-reset-token-issued' });
    return { accepted: true, ...(process.env.NODE_ENV === 'production' ? {} : { developmentToken: raw }) };
  }

  async resetPassword(token: string, password: string) {
    if (!this.passwordOk(password)) throw new BadRequestException('Password policy failed');
    const row = await this.prisma.passwordResetToken.findFirst({ where: { tokenHash: this.tokenHash(token), usedAt: null, expiresAt: { gt: new Date() } } });
    if (!row) throw new BadRequestException('Invalid or expired reset token');
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } }),
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.session.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.logMutation({ userId: row.userId, action: 'TOKEN_CHANGE', entityType: 'PasswordResetToken', entityId: row.id, before: { used: false }, after: { used: true }, reason: 'password-reset-token-consumed' });
    return { success: true };
  }

  async verifyEmail(token: string) {
    const row = await this.prisma.emailVerificationToken.findFirst({ where: { tokenHash: this.tokenHash(token), usedAt: null, expiresAt: { gt: new Date() } } });
    if (!row) throw new BadRequestException('Invalid or expired verification token');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
      this.prisma.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.emailVerificationToken.updateMany({ where: { userId: row.userId, id: { not: row.id }, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
    await this.audit.logMutation({ userId: row.userId, action: 'TOKEN_CHANGE', entityType: 'EmailVerificationToken', entityId: row.id, before: { used: false }, after: { used: true }, reason: 'email-verification-token-consumed' });
    return { success: true };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.emailVerifiedAt) return { accepted: true };
    const token = await this.createVerificationToken(user.id);
    return { accepted: true, ...(process.env.NODE_ENV === 'production' ? {} : { developmentVerificationToken: token }) };
  }
}
