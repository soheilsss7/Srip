import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';

interface OidcProviderConfig { key: string; issuer: string; clientId: string; clientSecret: string; authorizationEndpoint?: string; tokenEndpoint?: string; jwksUri?: string; scopes: string[]; }

@Injectable()
export class OidcService {
  private readonly redis: Redis;
  private readonly providers = new Map<string, OidcProviderConfig>();
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly audit: AuditService) {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 2, lazyConnect: true });
    for (const p of ['OIDC_PRIMARY', 'OIDC_GOOGLE', 'OIDC_MICROSOFT']) this.loadProvider(p);
  }
  private async readyRedis() { if (this.redis.status === 'wait') await this.redis.connect(); }
  private loadProvider(prefix: string) { const issuer = process.env[`${prefix}_ISSUER`], clientId = process.env[`${prefix}_CLIENT_ID`], clientSecret = process.env[`${prefix}_CLIENT_SECRET`]; if (!issuer || !clientId || !clientSecret) return; const key = prefix.replace(/^OIDC_/, '').toLowerCase(); this.providers.set(key, { key, issuer: issuer.replace(/\/$/, ''), clientId, clientSecret, scopes: (process.env[`${prefix}_SCOPES`] ?? 'openid profile email').split(/\s+/).filter(Boolean), authorizationEndpoint: process.env[`${prefix}_AUTHORIZATION_ENDPOINT`], tokenEndpoint: process.env[`${prefix}_TOKEN_ENDPOINT`], jwksUri: process.env[`${prefix}_JWKS_URI`] }); }
  private async discovery(provider: OidcProviderConfig) { const res = await fetch(`${provider.issuer}/.well-known/openid-configuration`); if (!res.ok) throw new BadRequestException('OIDC discovery failed'); const d = await res.json() as any; return { authorizationEndpoint: provider.authorizationEndpoint ?? d.authorization_endpoint, tokenEndpoint: provider.tokenEndpoint ?? d.token_endpoint, jwksUri: provider.jwksUri ?? d.jwks_uri }; }
  private b64(input: Buffer) { return input.toString('base64url'); }
  private async stateSet(key: string, value: any, ttl=600) { await this.readyRedis(); await this.redis.set(key, JSON.stringify(value), 'EX', ttl); }
  private async stateTake(key: string) { await this.readyRedis(); const raw = await this.redis.get(key); if (raw) await this.redis.del(key); return raw ? JSON.parse(raw) : null; }

  async authorize(providerKey: string, redirectUri: string) {
    const allowed = (process.env.OIDC_ALLOWED_REDIRECT_URIS ?? process.env.OIDC_DEFAULT_REDIRECT_URI ?? '').split(',').map(x => x.trim()).filter(Boolean);
    if (!allowed.includes(redirectUri)) throw new BadRequestException('OIDC redirect URI is not allowlisted');
    const provider = this.providers.get(providerKey); if (!provider) throw new BadRequestException('OIDC provider is not configured');
    const d = await this.discovery(provider); const state = this.b64(randomBytes(32)); const verifier = this.b64(randomBytes(48)); const challenge = this.b64(createHash('sha256').update(verifier).digest()); const nonce = this.b64(randomBytes(32));
    await this.stateSet(`srip:oidc:state:${state}`, { providerKey, redirectUri, verifier, nonce });
    const url = new URL(d.authorizationEndpoint); url.searchParams.set('client_id', provider.clientId); url.searchParams.set('response_type', 'code'); url.searchParams.set('redirect_uri', redirectUri); url.searchParams.set('scope', provider.scopes.join(' ')); url.searchParams.set('state', state); url.searchParams.set('code_challenge', challenge); url.searchParams.set('code_challenge_method', 'S256'); url.searchParams.set('nonce', nonce);
    return { authorizationUrl: url.toString(), stateExpiresIn: 600 };
  }

  async callback(providerKey: string, code: string, state: string, meta: { ip?: string; userAgent?: string }) {
    const saved = await this.stateTake(`srip:oidc:state:${state}`); if (!saved || saved.providerKey !== providerKey) throw new UnauthorizedException('Invalid or expired OIDC state');
    const provider = this.providers.get(providerKey); if (!provider) throw new BadRequestException('OIDC provider is not configured'); const d = await this.discovery(provider);
    const body = new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri:saved.redirectUri, client_id:provider.clientId, client_secret:provider.clientSecret, code_verifier:saved.verifier });
    const tokenResponse = await fetch(d.tokenEndpoint, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body }); if (!tokenResponse.ok) throw new UnauthorizedException('OIDC token exchange failed');
    const tokens = await tokenResponse.json() as any; if (!tokens.id_token) throw new UnauthorizedException('OIDC provider did not return an ID token');
    const verified = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(d.jwksUri)), { issuer:provider.issuer, audience:provider.clientId }); const claims = verified.payload as any;
    if (claims.nonce !== saved.nonce) throw new UnauthorizedException('OIDC nonce validation failed');
    const email = String(claims.email ?? '').trim().toLowerCase(); const subject = String(claims.sub ?? ''); if (!email || !subject) throw new UnauthorizedException('OIDC identity is missing required claims');
    if (claims.email_verified !== true) throw new UnauthorizedException('OIDC email must be verified');
    let user = await this.prisma.user.findUnique({ where:{ email } });
    if (!user) user = await this.prisma.user.create({ data:{ email, name:String(claims.name ?? claims.preferred_username ?? email.split('@')[0]), emailVerifiedAt:new Date() } });
    if (!user.isActive || user.deletedAt) throw new UnauthorizedException('User is inactive');
    await this.prisma.account.upsert({ where:{ provider_providerAccountId:{ provider:'OIDC', providerAccountId:`${provider.issuer}|${subject}` } }, update:{ userId:user.id }, create:{ userId:user.id, provider:'OIDC', providerAccountId:`${provider.issuer}|${subject}` } });
    const admin = await this.auth.isAdministrator(user.id); const mfa = await this.auth.isMfaEnabled(user.id);
    if (admin && !mfa) throw new UnauthorizedException('MFA enrollment is required for administrator accounts');
    if (mfa) { const ticket = this.b64(randomBytes(32)); await this.stateSet(`srip:oidc:mfa:${ticket}`, { userId:user.id, email:user.email, ip:meta.ip, userAgent:meta.userAgent, providerKey }, 300); return { mfaRequired:true, ticket, expiresIn:300 }; }
    await this.prisma.loginHistory.create({ data:{ userId:user.id, success:true, ipAddress:meta.ip, userAgent:meta.userAgent, reason:`OIDC:${providerKey}` } });
    await this.audit.logMutation({userId:user.id,action:'LOGIN',entityType:'User',entityId:user.id,after:{success:true,provider:'OIDC',providerKey},reason:'oidc-login'});
    return this.auth.issue(user.id, user.email, meta);
  }

  async complete(ticket: string, otp: string) {
    const data = await this.stateTake(`srip:oidc:mfa:${ticket}`); if (!data) throw new UnauthorizedException('Invalid or expired MFA ticket');
    await this.auth.verifyMfa(data.userId, otp); await this.prisma.loginHistory.create({ data:{ userId:data.userId, success:true, ipAddress:data.ip, userAgent:data.userAgent, reason:`OIDC:${data.providerKey}:MFA` } });
    await this.audit.logMutation({userId:data.userId,action:'LOGIN',entityType:'User',entityId:data.userId,after:{success:true,provider:'OIDC',mfa:true,providerKey:data.providerKey},reason:'oidc-login-mfa-complete'});
    return this.auth.issue(data.userId, data.email, { ip:data.ip, userAgent:data.userAgent });
  }
}
