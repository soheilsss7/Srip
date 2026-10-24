import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type GovernanceCheck = { key: string; status: 'PASS' | 'WARN' | 'FAIL'; detail: string };

const PLACEHOLDER = /^(?:|change[-_]?me|replace[-_]?me|replace[-_].*|secret[-_]?here|your[-_].*)$/i;

@Injectable()
export class SecurityGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  private envSecret(name: string): GovernanceCheck {
    const value = process.env[name];
    if (!value || PLACEHOLDER.test(value)) return { key: `secret:${name}`, status: 'FAIL', detail: `${name} is not configured with a non-placeholder value` };
    return { key: `secret:${name}`, status: 'PASS', detail: `${name} is configured` };
  }

  async preflight() {
    const checks: GovernanceCheck[] = [
      this.envSecret('JWT_SECRET'),
      this.envSecret('SECRET_ENCRYPTION_KEY'),
      { key: 'origin-check', status: process.env.ORIGIN_CHECK_ENFORCED === 'false' ? 'FAIL' : 'PASS', detail: 'State-changing cross-origin protection must remain enabled' },
      { key: 'rate-limit-fail-open', status: process.env.RATE_LIMIT_FAIL_OPEN === 'true' ? 'FAIL' : 'PASS', detail: 'Security-sensitive rate limiting must fail closed' },
      { key: 'file-scan', status: process.env.FILE_SCAN_REQUIRED === 'true' ? 'PASS' : 'WARN', detail: 'Production file uploads should require malware scanning' },
      { key: 'secret-manager', status: process.env.NODE_ENV === 'production' && process.env.SECRET_ENCRYPTION_KEY ? 'WARN' : 'PASS', detail: 'Production secrets should be injected by a secret manager rather than source control' },
    ];

    const policies = await this.prisma.dataProcessingPolicy.findMany({ where: { active: true }, select: { entityType: true, purpose: true, legalBasis: true, classification: true, retentionDays: true, exportable: true, erasable: true } });
    const withoutRetention = policies.filter(p => p.retentionDays == null && p.erasable).length;
    checks.push({ key: 'data-policy-coverage', status: policies.length ? (withoutRetention ? 'WARN' : 'PASS') : 'FAIL', detail: policies.length ? `${policies.length} active data-processing policies; ${withoutRetention} erasable policies have no retention period` : 'No active data-processing policies configured' });

    return { generatedAt: new Date().toISOString(), checks, overall: checks.some(c => c.status === 'FAIL') ? 'FAIL' : checks.some(c => c.status === 'WARN') ? 'WARN' : 'PASS' };
  }
}
