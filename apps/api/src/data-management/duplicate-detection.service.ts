import { Injectable } from '@nestjs/common';
import { ImportEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Candidate = { id: string; score: number; reasons: string[]; entityType: ImportEntityType };
const text = (v: unknown) => String(v ?? '').trim();
const lower = (v: unknown) => text(v).toLowerCase();
const phone = (v: unknown) => text(v).replace(/[^0-9+]/g, '').replace(/^00/, '+');
const domain = (v: unknown) => lower(v).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
const name = (v: unknown) => lower(v).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}

/**
 * Duplicate detection deliberately narrows candidates in PostgreSQL before any
 * CPU-heavy similarity work. It never scans an entire tenant into Node memory.
 */
@Injectable()
export class DuplicateDetectionService {
  private readonly candidateLimit = Math.max(25, Math.min(250, Number(process.env.DUPLICATE_CANDIDATE_LIMIT || 100)));

  constructor(private readonly prisma: PrismaService) {}

  async organizationCandidates(data: Record<string, unknown>, organizationId?: string, organizationScope?: string[] | null): Promise<Candidate[]> {
    const nm = name(data.name), dm = domain(data.website), rg = lower(data.registrationId), ph = phone(data.phone), ct = lower(data.country);
    const prefix = nm.slice(0, Math.min(4, nm.length));
    const where: any = {
      deletedAt: null,
      ...(organizationScope ? { id: { in: organizationScope } } : {}),
      OR: [
        ...(dm ? [{ website: { contains: dm, mode: 'insensitive' } }] : []),
        ...(rg ? [{ registrationId: { equals: rg, mode: 'insensitive' } }] : []),
        ...(ph ? [{ phone: { contains: ph.replace('+', ''), mode: 'insensitive' } }] : []),
        ...(prefix.length >= 3 ? [{ name: { startsWith: prefix, mode: 'insensitive' } }] : []),
        ...(ct ? [{ country: { equals: ct, mode: 'insensitive' } }] : []),
      ],
    };
    if (!where.OR.length) return [];
    const rows = await this.prisma.organization.findMany({ where, take: this.candidateLimit, select: { id: true, name: true, website: true, registrationId: true, phone: true, country: true } });
    return this.scoreOrganizations(rows, nm, dm, rg, ph, ct);
  }

  private scoreOrganizations(rows: Array<{ id: string; name: string; website: string | null; registrationId: string | null; phone: string | null; country: string | null }>, nm: string, dm: string, rg: string, ph: string, ct: string) {
    return rows.map(x => {
      const reasons: string[] = [];
      const ns = similarity(nm, name(x.name));
      const domainMatch = !!dm && domain(x.website) === dm;
      const registrationMatch = !!rg && lower(x.registrationId) === rg;
      const phoneMatch = !!ph && phone(x.phone) === ph;
      const countryMatch = !!ct && lower(x.country) === ct;
      let score = 0;
      if (ns >= 0.72) { score += ns * 0.40; reasons.push(`name_similarity:${ns.toFixed(3)}`); }
      if (domainMatch) { score += 0.25; reasons.push('domain'); }
      if (registrationMatch) { score += 0.25; reasons.push('registration_id'); }
      if (phoneMatch) { score += 0.20; reasons.push('phone'); }
      if (countryMatch) { score += 0.05; reasons.push('country'); }
      return { id: x.id, score: Math.min(1, score), reasons, entityType: ImportEntityType.ORGANIZATION };
    }).filter(x => x.reasons.length > 0 && x.score >= 0.40).sort((a, b) => b.score - a.score).slice(0, 10);
  }

  async personCandidates(data: Record<string, unknown>, organizationId?: string): Promise<Candidate[]> {
    const nm = name(data.displayName || `${text(data.firstName)} ${text(data.lastName)}`), em = lower(data.email), ph = phone(data.phone), org = text(data.organizationId || organizationId);
    const prefix = nm.slice(0, Math.min(4, nm.length));
    const where: any = {
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
      OR: [
        ...(em ? [{ email: { equals: em, mode: 'insensitive' } }] : []),
        ...(ph ? [{ phone: { contains: ph.replace('+', ''), mode: 'insensitive' } }] : []),
        ...(org ? [{ organizationId: org }] : []),
        ...(prefix.length >= 3 ? [{ displayName: { startsWith: prefix, mode: 'insensitive' } }] : []),
      ],
    };
    if (!where.OR.length) return [];
    const rows = await this.prisma.person.findMany({ where, take: this.candidateLimit, select: { id: true, firstName: true, lastName: true, displayName: true, email: true, phone: true, organizationId: true } });
    return rows.map(x => {
      const reasons: string[] = [];
      const ns = similarity(nm, name(x.displayName || `${x.firstName} ${x.lastName}`));
      const emailMatch = !!em && lower(x.email) === em;
      const phoneMatch = !!ph && phone(x.phone) === ph;
      const organizationMatch = !!org && x.organizationId === org;
      let score = 0;
      if (ns >= 0.72) { score += ns * 0.35; reasons.push(`name_similarity:${ns.toFixed(3)}`); }
      if (emailMatch) { score += 0.35; reasons.push('email'); }
      if (organizationMatch) { score += 0.20; reasons.push('organization'); }
      if (phoneMatch) { score += 0.20; reasons.push('phone'); }
      return { id: x.id, score: Math.min(1, score), reasons, entityType: ImportEntityType.PERSON };
    }).filter(x => x.reasons.length > 0 && x.score >= 0.40).sort((a, b) => b.score - a.score).slice(0, 10);
  }

  async detect(entityType: ImportEntityType, data: Record<string, unknown>, organizationId?: string, organizationScope?: string[] | null) {
    return entityType === ImportEntityType.ORGANIZATION ? this.organizationCandidates(data, organizationId, organizationScope) : this.personCandidates(data, organizationId);
  }
}
