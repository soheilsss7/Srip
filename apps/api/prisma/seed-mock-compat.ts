/**
 * Mock-compatibility seed: ports the previously validated mock dataset
 * (apps/web/scripts/.data/srip-db.json) into PostgreSQL with the SAME entity
 * ids (org-1..org-8, p-1.., r-1.., rec-1.., …) so the established API
 * contract suite keeps passing unchanged against the real NestJS backend
 * ("direct migration" of the mock contracts).
 *
 * Idempotent: upsert-based. Run after `prisma:seed` (roles/permissions/types).
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as bcrypt from 'bcrypt';
import { makePrisma } from '../src/prisma/prisma-factory';
import {
  DataClassification,
  InteractionKind,
  Priority,
  ProjectStatus,
  RelationshipLifecycleStage,
  RelationshipStatus,
} from '@prisma/client';

const prisma = makePrisma();

const DEMO_ID = 'u-1'; // demo@srip.local — owner (as in the mock dataset)
const CLIENT_ID = 'u-2'; // client@arya-tech.ir — tenant at org-2
const DEMO_PASSWORD = 'ChangeMe!123456';

const dbPath = path.resolve(__dirname, '../../web/scripts/.data/srip-db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

/** Map a mock relationship status onto the real enum. */
function relStatus(status: string | undefined): RelationshipStatus {
  switch (status) {
    case 'ACTIVE': return RelationshipStatus.ACTIVE;
    case 'WATCH': return RelationshipStatus.AT_RISK;
    case 'DORMANT': return RelationshipStatus.DORMANT;
    case 'ARCHIVED': return RelationshipStatus.ARCHIVED;
    default: return RelationshipStatus.ACTIVE;
  }
}

/** Map a mock opportunity status onto the real enum. */
function oppStatus(status: string | undefined): string {
  if (status === 'WON') return 'WON';
  if (status === 'LOST') return 'LOST';
  return 'ACTIVE'; // mock "OPEN" == real "ACTIVE"
}

async function main() {
  // ---- Relationship types used by the mock dataset (base seed adds the rest)
  for (const t of [
    { key: 'CUSTOMER', name: 'Customer' },
    { key: 'STRATEGIC_PARTNERSHIP', name: 'Strategic Partnership' },
    { key: 'BANKING', name: 'Banking' },
    { key: 'SUPPLY', name: 'Supply' },
    { key: 'INVESTMENT', name: 'Investment' },
  ]) {
    await prisma.relationshipType.upsert({ where: { key: t.key }, update: { name: t.name, isActive: true }, create: { key: t.key, name: t.name } });
  }
  const typeIds = new Map<string, string>();
  for (const t of await prisma.relationshipType.findMany()) typeIds.set(t.key, t.id);

  // ---- Users (bcrypt hashes; the mock used scrypt hashes)
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const now = new Date();
  const demo = await prisma.user.upsert({
    where: { email: 'demo@srip.local' },
    update: { name: 'مدیر سامانه (دمو)', passwordHash, isActive: true, emailVerifiedAt: now, deletedAt: null },
    create: { id: DEMO_ID, email: 'demo@srip.local', name: 'مدیر سامانه (دمو)', passwordHash, isActive: true, emailVerifiedAt: now },
  });
  const client = await prisma.user.upsert({
    where: { email: 'client@arya-tech.ir' },
    update: { name: 'مستأجر آریا فناوری', passwordHash, isActive: true, emailVerifiedAt: now, deletedAt: null },
    create: { id: CLIENT_ID, email: 'client@arya-tech.ir', name: 'مستأجر آریا فناوری', passwordHash, isActive: true, emailVerifiedAt: now },
  });
  // ---- Organizations (org-1..org-8) — created BEFORE memberships
  for (const o of (db.orgs ?? [])) {
    if (!String(o.id).startsWith('org-')) continue;
    await prisma.organization.upsert({
      where: { id: o.id },
      update: { name: o.name, type: o.type, industry: o.industry ?? null, country: o.country ?? null, parentOrganizationId: o.parentOrganizationId ?? null, deletedAt: null },
      create: { id: o.id, name: o.name, displayName: o.name, type: o.type, industry: o.industry ?? null, country: o.country ?? null, parentOrganizationId: o.parentOrganizationId ?? null, strategicImportance: 60 },
    });
  }
  // demo = owner (SUPER_ADMIN); client = tenant (STANDARD_USER, no admin access)
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: demo.id, organizationId: 'org-1' } },
    update: { role: 'SUPER_ADMIN', isPrimary: true },
    create: { userId: demo.id, organizationId: 'org-1', role: 'SUPER_ADMIN', isPrimary: true },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: client.id, organizationId: 'org-2' } },
    update: { role: 'STANDARD_USER', isPrimary: true },
    create: { userId: client.id, organizationId: 'org-2', role: 'STANDARD_USER', isPrimary: true },
  });

  // ---- Verified MFA devices for the demo accounts (same AES-256-GCM scheme
  // as MfaService so `verify` works). MFA_DEV_MODE accepts any 6-digit code,
  // so logins keep working with otp=123456 while a wrong/short code still
  // fails the real TOTP check → 401 (this is what the API suite asserts).
  {
    const { createCipheriv, createHash, randomBytes } = await import('node:crypto');
    const key = createHash('sha256').update(process.env.MFA_ENCRYPTION_KEY ?? '').digest();
    const encrypt = (value: string) => {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
    };
    const base32Encode = (input: Buffer) => {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let bits = 0, value = 0, out = '';
      for (const b of input) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
      if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
      return out;
    };
    for (const [userId, label] of [[demo.id, 'دستگاه دمو (seed)'], [client.id, 'دستگاه مستأجر (seed)']] as const) {
      const existing = await prisma.mfaDevice.findFirst({ where: { userId, enabled: true, verifiedAt: { not: null } } });
      if (existing) continue;
      const secret = base32Encode(randomBytes(20));
      await prisma.mfaDevice.create({ data: { userId, label, secretEncrypted: encrypt(secret), enabled: true, verifiedAt: now } });
      console.log(`[mfa] verified device enrolled for ${userId}`);
    }
  }

  // ---- People (p-1..p-8)
  for (const p of (db.people ?? [])) {
    if (!String(p.id).startsWith('p-')) continue;
    await prisma.person.upsert({
      where: { id: p.id },
      update: { firstName: p.firstName, lastName: p.lastName, email: p.email ?? null, phone: p.phone ?? null, title: p.title ?? null, department: p.department ?? null, organizationId: p.organizationId, status: 'ACTIVE', influenceScore: p.influenceScore ?? 50, decisionPower: p.decisionPower ?? 50, accessibilityScore: p.accessibilityScore ?? 50, deletedAt: null },
      create: { id: p.id, firstName: p.firstName, lastName: p.lastName, email: p.email ?? null, phone: p.phone ?? null, title: p.title ?? null, department: p.department ?? null, organizationId: p.organizationId, status: 'ACTIVE', influenceScore: p.influenceScore ?? 50, decisionPower: p.decisionPower ?? 50, accessibilityScore: p.accessibilityScore ?? 50 },
    });
  }

  // ---- Person ↔ organization assignments
  for (const po of (db.personOrgs ?? [])) {
    await prisma.organizationPerson.upsert({
      where: { organizationId_personId: { organizationId: po.organizationId, personId: po.personId } },
      update: { roleTitle: po.roleTitle ?? null, department: po.department ?? null, isPrimary: !!po.isPrimary, status: po.status ?? 'ACTIVE' },
      create: { organizationId: po.organizationId, personId: po.personId, roleTitle: po.roleTitle ?? null, department: po.department ?? null, isPrimary: !!po.isPrimary, status: po.status ?? 'ACTIVE' },
    });
  }

  // ---- Relationships (r-1..)
  const scores = (r: any) => ({
    healthScore: r.healthScore ?? 60,
    strategicScore: r.strategicScore ?? 60,
    riskScore: r.riskScore ?? 20,
    trustScore: r.trustScore ?? 60,
    accessScore: r.accessScore ?? 50,
    influenceScore: r.influenceScore ?? 50,
    opportunityScore: r.opportunityScore ?? 60,
    resilienceScore: r.resilienceScore ?? 60,
    engagementScore: r.engagementScore ?? 60,
  });
  for (const r of (db.rels ?? [])) {
    if (!String(r.id).startsWith('r-')) continue;
    const typeKey = ['CUSTOMER','STRATEGIC_PARTNERSHIP','BANKING','SUPPLY','INVESTMENT'].includes(r.relationshipType) ? r.relationshipType : 'STRATEGIC';
    const data: any = {
      id: r.id,
      sourceOrganizationId: r.sourceOrganizationId,
      targetOrganizationId: r.targetOrganizationId,
      relationshipType: typeKey,
      relationshipTypeId: typeIds.get(typeKey),
      status: relStatus(r.status),
      lifecycleStage: RelationshipLifecycleStage.ACTIVE,
      sensitivity: DataClassification.INTERNAL,
      ownerId: demo.id,
      ...scores(r),
      lastInteractionAt: r.lastInteractionAt ? new Date(r.lastInteractionAt) : null,
      nextReviewAt: r.nextReviewAt ? new Date(r.nextReviewAt) : null,
      nextActionAt: r.nextActionAt ? new Date(r.nextActionAt) : null,
      deletedAt: null,
    };
    await prisma.relationship.upsert({ where: { id: r.id }, update: data, create: data });
  }

  // ---- Meetings (m-1..)
  for (const m of (db.meetings ?? [])) {
    if (!String(m.id).startsWith('m-')) continue;
    const data: any = {
      id: m.id,
      title: m.title,
      objective: m.objective ?? null,
      agenda: m.agenda ?? null,
      status: m.outcome ? 'COMPLETED' : 'SCHEDULED',
      startAt: new Date(m.startAt ?? Date.now()),
      endAt: m.endAt ? new Date(m.endAt) : null,
      notes: m.notes ?? null,
      outcome: m.outcome ?? null,
      preMeetingBrief: m.preMeetingBrief ?? null,
      location: m.location ?? null,
      meetingUrl: m.meetingUrl ?? null,
      organizationId: m.organizationId ?? null,
      relationshipId: m.relationshipId ?? null,
      ownerId: demo.id,
      deletedAt: null,
    };
    await prisma.meeting.upsert({ where: { id: m.id }, update: data, create: data });
    for (const part of (m.participants ?? [])) {
      if (!part?.personId) continue;
      await prisma.meetingParticipant.upsert({
        where: { meetingId_personId: { meetingId: m.id, personId: part.personId } },
        update: {},
        create: { meetingId: m.id, personId: part.personId },
      });
    }
  }

  // ---- Actions (a-1..)
  for (const a of (db.actions ?? [])) {
    if (!String(a.id).startsWith('a-')) continue;
    const data: any = {
      id: a.id,
      title: a.title,
      status: ['OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED'].includes(a.status) ? a.status : 'OPEN',
      priority: ['LOW','MEDIUM','HIGH','CRITICAL'].includes(a.priority) ? a.priority : 'MEDIUM',
      dueAt: a.dueAt ? new Date(a.dueAt) : null,
      ownerId: demo.id, // mock person-owners are ported to the acting user (FK is User)
      relationshipId: a.relationshipId ?? null,
      deletedAt: null,
    };
    await prisma.action.upsert({ where: { id: a.id }, update: data, create: data });
  }

  // ---- Commitments (c-1..)
  for (const c of (db.commitments ?? [])) {
    if (!String(c.id).startsWith('c-')) continue;
    const data: any = {
      id: c.id,
      description: c.description,
      status: 'OPEN',
      dueAt: c.dueAt ? new Date(c.dueAt) : null,
      ownerId: demo.id,
      organizationId: c.organizationId ?? null,
      deletedAt: null,
    };
    await prisma.commitment.upsert({ where: { id: c.id }, update: data, create: data });
  }

  // ---- Projects (pr-1..)
  for (const p of (db.projects ?? [])) {
    if (!String(p.id).startsWith('pr-')) continue;
    const data: any = {
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      status: ['PLANNED','ACTIVE','ON_HOLD','COMPLETED','CANCELLED'].includes(p.status) ? p.status : ProjectStatus.PLANNED,
      priority: Priority.MEDIUM,
      startAt: p.startAt ? new Date(p.startAt) : null,
      targetAt: p.endAt ? new Date(p.endAt) : null,
      organizationId: p.organizationId ?? null,
      ownerId: demo.id,
      deletedAt: null,
    };
    await prisma.project.upsert({ where: { id: p.id }, update: data, create: data });
  }

  // ---- Opportunities (o-1..)
  for (const o of (db.opportunities ?? [])) {
    if (!String(o.id).startsWith('o-')) continue;
    const data: any = {
      id: o.id,
      name: o.name,
      status: oppStatus(o.status),
      probability: o.probability ?? 50,
      organizationId: o.organizationId ?? null,
      deletedAt: null,
    };
    await prisma.opportunity.upsert({ where: { id: o.id }, update: data, create: data });
  }

  // ---- Interactions (i-1..)
  for (const ix of (db.interactions ?? [])) {
    if (!String(ix.id).startsWith('i-')) continue;
    const type = ix.type === 'VISIT' ? InteractionKind.MEETING : (['CALL','EMAIL','MEETING','NOTE','MESSAGE','OTHER'].includes(ix.type) ? ix.type : InteractionKind.OTHER);
    const data: any = {
      id: ix.id,
      type,
      subject: ix.subject,
      summary: ix.summary ?? null,
      outcome: ix.outcome ?? null,
      followUpRequired: false,
      importance: Priority.MEDIUM,
      occurredAt: new Date(ix.occurredAt ?? Date.now()),
      userId: demo.id,
      organizationId: ix.organizationId ?? null,
      relationshipId: ix.relationshipId ?? null,
      deletedAt: null,
    };
    await prisma.interaction.upsert({ where: { id: ix.id }, update: data, create: data });
  }

  // ---- Notifications (n-1..)
  const notifType = (t: string) => (['SUCCESS','WARNING','ALERT'].includes(t) ? t : 'INFO');
  const notifPriority = (p: string) => (p === 'important' ? 'HIGH' : p === 'urgent' ? 'CRITICAL' : 'MEDIUM');
  for (const n of (db.notifications ?? [])) {
    if (!String(n.id).startsWith('n-')) continue;
    const data: any = {
      id: n.id,
      userId: demo.id,
      type: notifType(n.type),
      title: n.title,
      body: n.body ?? n.title,
      channel: 'IN_APP',
      priority: notifPriority(n.priority),
      createdAt: new Date(n.createdAt ?? Date.now()),
      deletedAt: null,
    };
    await prisma.notification.upsert({ where: { id: n.id }, update: data, create: data });
  }

  // ---- Recommendations (rec-1..)
  // rec-1 is seeded PROPOSED so the contract lifecycle (approve → execute)
  // can run; the mock dataset's earlier runs had already executed it.
  const recStatus = (id: string, original: string) => {
    if (id === 'rec-1') return 'PROPOSED';
    return ['PROPOSED','APPROVED','REJECTED','SNOOZED','ASSIGNED','EXECUTED','ARCHIVED'].includes(original) ? original : 'PROPOSED';
  };
  for (const rec of (db.recs ?? [])) {
    if (!String(rec.id).startsWith('rec-')) continue;
    const data: any = {
      id: rec.id,
      userId: rec.userId === 'u-1' ? demo.id : demo.id,
      relationshipId: rec.relationshipId ?? null,
      type: rec.type,
      title: rec.title,
      rationale: rec.rationale ?? 'پیشنهاد مبتنی بر تعاملات و نتایج جلسات ثبتشده',
      confidence: rec.confidence ?? 0.7,
      status: recStatus(rec.id, rec.status),
      evidence: rec.evidence ?? [{ source: 'interaction', excerpt: 'پیگیری در جلسهٔ اخیر', weight: 0.8 }],
      snoozedUntil: rec.snoozedUntil ? new Date(rec.snoozedUntil) : null,
      decisionAt: rec.decisionAt ? new Date(rec.decisionAt) : null,
      deletedAt: null,
    };
    await prisma.recommendation.upsert({ where: { id: rec.id }, update: data, create: data });
  }

  console.log(`Mock-compat seed complete: ${(db.orgs ?? []).filter((o: any) => String(o.id).startsWith('org-')).length} orgs, ${(db.people ?? []).filter((p: any) => String(p.id).startsWith('p-')).length} people, ${(db.rels ?? []).filter((r: any) => String(r.id).startsWith('r-')).length} relationships ported into PostgreSQL (demo=${demo.email}, client=${client.email})`);
}

main().finally(() => prisma.$disconnect());
