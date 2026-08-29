import 'dotenv/config';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaClient, AuditAction, DataClassification, InteractionKind, NotificationType, OpportunityStatus, OrganizationStatus, OrganizationType, Priority, ProjectStatus, RelationshipLifecycleStage, RelationshipStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_ROOT = '20000000-0000-0000-0000-000000000001';
const DEMO_USER = '20000000-0000-0000-0000-000000000002';
const DEMO_SECRET = 'VEDETXJXC6U63QHDRC2Y3LPGS4';
const DEMO_EMAIL = 'demo@srip.local';
const DEMO_PASSWORD = 'ChangeMe!123456';

function mfaKey() {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw) throw new Error('MFA_ENCRYPTION_KEY is required');
  return createHash('sha256').update(raw).digest();
}
function encryptSecret(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', mfaKey(), iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
}

const org = (id: string, name: string, type: OrganizationType, parent: string | null, extra: Partial<Record<string, unknown>> = {}) =>
  prisma.organization.upsert({
    where: { id },
    update: { name, type, parentOrganizationId: parent, ...extra },
    create: { id, name, displayName: name, type, parentOrganizationId: parent, strategicImportance: 60, ...extra },
  });

const person = (id: string, data: { firstName: string; lastName: string; organizationId: string; title: string; department: string; country: string; influenceScore: number; decisionPower: number; accessibilityScore: number; email: string }) =>
  prisma.person.upsert({
    where: { id },
    update: { ...data, status: 'ACTIVE' },
    create: { ...data, id, status: 'ACTIVE' },
  });

const rel = async (id: string, sourceOrganizationId: string, targetOrganizationId: string, type: string, status: RelationshipStatus, scores: Partial<Record<string, number>>, lifecycle: RelationshipLifecycleStage, sensitivity: DataClassification = DataClassification.INTERNAL) => {
  const typeId = await prisma.relationshipType.findUniqueOrThrow({ where: { key: type } });
  const data: any = {
    id,
    sourceOrganizationId,
    targetOrganizationId,
    relationshipType: type,
    relationshipTypeId: typeId.id,
    status,
    lifecycleStage: lifecycle,
    sensitivity,
    ownerId: DEMO_USER,
    healthScore: scores.health ?? 60,
    strategicScore: scores.strategic ?? 60,
    riskScore: scores.risk ?? 20,
    trustScore: scores.trust ?? 60,
    accessScore: scores.access ?? 50,
    influenceScore: scores.influence ?? 50,
    opportunityScore: scores.opportunity ?? 60,
    resilienceScore: scores.resilience ?? 60,
    engagementScore: scores.engagement ?? 60,
    lastInteractionAt: new Date('2026-08-20T09:00:00Z'),
    nextReviewAt: new Date('2026-10-15T00:00:00Z'),
  };
  return prisma.relationship.upsert({ where: { id }, update: data, create: data });
};

async function main() {
  // --- Organizations (25, all under DEMO_ROOT) ---
  await org(DEMO_ROOT, 'دمو هلدینگ (Demo Holding)', OrganizationType.HOLDING, null, { englishName: 'Demo Holding', industry: 'Holding & Investment', country: 'IR', strategicImportance: 95, website: 'https://demo.example.local' });

  await org('20000000-0000-0000-0000-000000000101', 'دمو سرمایه‌گذاری صنعتی', OrganizationType.SUBSIDIARY, DEMO_ROOT, { industry: 'Manufacturing', country: 'IR', strategicImportance: 88 });
  await org('20000000-0000-0000-0000-000000000111', 'فولاد آرین', OrganizationType.SUBSIDIARY, '20000000-0000-0000-0000-000000000101', { industry: 'Steel', country: 'IR', strategicImportance: 82 });
  await org('20000000-0000-0000-0000-000000000112', 'گروه خودروی پارس', OrganizationType.CUSTOMER, '20000000-0000-0000-0000-000000000111', { industry: 'Automotive', country: 'IR', strategicImportance: 74 });
  await org('20000000-0000-0000-0000-000000000121', 'تأمین نهاده‌های نوین', OrganizationType.SUPPLIER, '20000000-0000-0000-0000-000000000101', { industry: 'Raw Materials', country: 'IR', strategicImportance: 45 });
  await org('20000000-0000-0000-0000-000000000131', 'کارخانه رنگ و پوشش سپهر', OrganizationType.SUBSIDIARY, '20000000-0000-0000-0000-000000000101', { industry: 'Coating', country: 'IR', strategicImportance: 58 });

  await org('20000000-0000-0000-0000-000000000201', 'دمو انرژی', OrganizationType.SUBSIDIARY, DEMO_ROOT, { industry: 'Energy', country: 'IR', strategicImportance: 90 });
  await org('20000000-0000-0000-0000-000000000211', 'نیروگاه برق هامون', OrganizationType.SUBSIDIARY, '20000000-0000-0000-0000-000000000201', { industry: 'Power Generation', country: 'IR', strategicImportance: 80 });
  await org('20000000-0000-0000-0000-000000000221', 'پالایش پارسا', OrganizationType.CUSTOMER, '20000000-0000-0000-0000-000000000201', { industry: 'Refining', country: 'IR', strategicImportance: 86 });
  await org('20000000-0000-0000-0000-000000000231', 'تجهیزات نیروگاه همراه', OrganizationType.SUPPLIER, '20000000-0000-0000-0000-000000000201', { industry: 'Turbine Equipment', country: 'IR', strategicImportance: 50 });

  await org('20000000-0000-0000-0000-000000000301', 'دمو ساختمان و زیرساخت', OrganizationType.SUBSIDIARY, DEMO_ROOT, { industry: 'Construction', country: 'IR', strategicImportance: 72 });
  await org('20000000-0000-0000-0000-000000000311', 'مسکن نیکان', OrganizationType.SUBSIDIARY, '20000000-0000-0000-0000-000000000301', { industry: 'Real Estate', country: 'IR', strategicImportance: 64 });
  await org('20000000-0000-0000-0000-000000000321', 'پیمانکار پارسه', OrganizationType.PARTNER, '20000000-0000-0000-0000-000000000301', { industry: 'Contracting', country: 'IR', strategicImportance: 55 });
  await org('20000000-0000-0000-0000-000000000331', 'سیمان آذر', OrganizationType.SUPPLIER, '20000000-0000-0000-0000-000000000301', { industry: 'Cement', country: 'IR', strategicImportance: 40 });

  await org('20000000-0000-0000-0000-000000000401', 'دمو ترابری و لجستیک', OrganizationType.SUBSIDIARY, DEMO_ROOT, { industry: 'Logistics', country: 'IR', strategicImportance: 68 });
  await org('20000000-0000-0000-0000-000000000411', 'بنادر آفتاب', OrganizationType.CUSTOMER, '20000000-0000-0000-0000-000000000401', { industry: 'Ports', country: 'IR', strategicImportance: 66 });
  await org('20000000-0000-0000-0000-000000000421', 'کشتیرانی گلف‌لاین', OrganizationType.PARTNER, '20000000-0000-0000-0000-000000000401', { industry: 'Shipping', country: 'AE', strategicImportance: 61 });

  await org('20000000-0000-0000-0000-000000000501', 'دمو سلامت', OrganizationType.SUBSIDIARY, DEMO_ROOT, { industry: 'Healthcare', country: 'IR', strategicImportance: 76 });
  await org('20000000-0000-0000-0000-000000000511', 'بیمارستان مهر ایرانیان', OrganizationType.SUBSIDIARY, '20000000-0000-0000-0000-000000000501', { industry: 'Hospital', country: 'IR', strategicImportance: 70 });
  await org('20000000-0000-0000-0000-000000000521', 'داروسازی آرین سلامت', OrganizationType.CUSTOMER, '20000000-0000-0000-0000-000000000501', { industry: 'Pharmaceutical', country: 'IR', strategicImportance: 63 });

  await org('20000000-0000-0000-0000-000000000601', 'دمو دیجیتال و فناوری', OrganizationType.SUBSIDIARY, DEMO_ROOT, { industry: 'Technology', country: 'IR', strategicImportance: 65 });
  await org('20000000-0000-0000-0000-000000000611', 'استارتاپ نوا', OrganizationType.SUBSIDIARY, '20000000-0000-0000-0000-000000000601', { industry: 'SaaS', country: 'IR', strategicImportance: 52 });
  await org('20000000-0000-0000-0000-000000000621', 'مشتری پلتفرم موج', OrganizationType.CUSTOMER, '20000000-0000-0000-0000-000000000601', { industry: 'Fintech', country: 'IR', strategicImportance: 49 });

  await org('20000000-0000-0000-0000-000000000701', 'دمو بین‌الملل', OrganizationType.SUBSIDIARY, DEMO_ROOT, { industry: 'Export & Trade', country: 'IR', strategicImportance: 71 });
  await org('20000000-0000-0000-0000-000000000711', 'مشتری منطقهٔ خلیج', OrganizationType.CUSTOMER, '20000000-0000-0000-0000-000000000701', { industry: 'Trading', country: 'AE', strategicImportance: 59 });

  // --- Demo user + membership (HOLDING_ADMIN at demo root = isolated scope) + MFA device ---
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER },
    update: { email: DEMO_EMAIL, name: 'Demo User', passwordHash: hash, passwordChangedAt: new Date('2026-08-25T00:00:00Z'), emailVerifiedAt: new Date('2026-08-25T00:00:00Z'), isActive: true, deletedAt: null, deletedById: null, failedLoginCount: 0, lockedUntil: null },
    create: { id: DEMO_USER, email: DEMO_EMAIL, name: 'Demo User', passwordHash: hash, passwordChangedAt: new Date('2026-08-25T00:00:00Z'), emailVerifiedAt: new Date('2026-08-25T00:00:00Z') },
  });
  await prisma.account.upsert({ where: { provider_providerAccountId: { provider: 'LOCAL', providerAccountId: user.id } }, update: {}, create: { userId: user.id, provider: 'LOCAL', providerAccountId: user.id } });
  await prisma.membership.upsert({ where: { userId_organizationId: { userId: DEMO_USER, organizationId: DEMO_ROOT } }, update: { role: 'HOLDING_ADMIN', isPrimary: true }, create: { userId: DEMO_USER, organizationId: DEMO_ROOT, role: 'HOLDING_ADMIN', isPrimary: true } });
  await prisma.membership.upsert({ where: { userId_organizationId: { userId: DEMO_USER, organizationId: '20000000-0000-0000-0000-000000000201' } }, update: { role: 'RELATIONSHIP_MANAGER' }, create: { userId: DEMO_USER, organizationId: '20000000-0000-0000-0000-000000000201', role: 'RELATIONSHIP_MANAGER' } });
  const device = await prisma.mfaDevice.upsert({
    where: { id: '20000000-0000-0000-0000-000000000003' },
    update: { userId: DEMO_USER, label: 'Demo Authenticator', secretEncrypted: encryptSecret(DEMO_SECRET), enabled: true, verifiedAt: new Date('2026-08-25T00:00:00Z') },
    create: { id: '20000000-0000-0000-0000-000000000003', userId: DEMO_USER, label: 'Demo Authenticator', secretEncrypted: encryptSecret(DEMO_SECRET), enabled: true, verifiedAt: new Date('2026-08-25T00:00:00Z') },
  });

  // --- Persons (26) ---
  const R = '20000000-0000-0000-0000-00000000';
  const persons: any[] = [
    ['003100', 'محمدرضا', 'کاظمی', R + '0001', 'مدیرعامل هلدینگ', 'Executive', 'IR', 90, 85, 88, 'm.kazemi@demo.local'],
    ['003101', 'سارا', 'احمدی', R + '0001', 'مدیر روابط راهبردی', 'Relationships', 'IR', 72, 60, 82, 's.ahmadi@demo.local'],
    ['003102', 'علی', 'رضایی', R + '0001', 'مدیر مالی هلدینگ', 'Finance', 'IR', 60, 55, 60, 'a.rezaei@demo.local'],
    ['003103', 'مریم', 'حسینی', R + '0101', 'مدیرعامل صنعتی', 'Executive', 'IR', 85, 80, 78, 'm.hosseini@demo.local'],
    ['003104', 'حسین', 'نادری', R + '0111', 'مدیرعامل فولاد آرین', 'Executive', 'IR', 88, 82, 85, 'h.naderi@demo.local'],
    ['003105', 'زهرا', 'کریمی', R + '0111', 'مدیر روابط فولاد', 'Relationships', 'IR', 66, 52, 74, 'z.karimi@demo.local'],
    ['003106', 'رضا', 'موسوی', R + '0112', 'مدیر قراردادهای خودرو پارس', 'Procurement', 'IR', 64, 58, 70, 'r.mousavi@demo.local'],
    ['003107', 'فاطمه', 'عبادی', R + '0121', 'مدیر خرید تأمین نهاده‌ها', 'Sourcing', 'IR', 55, 48, 62, 'f.ebadi@demo.local'],
    ['003108', 'امیر', 'محمدی', R + '0201', 'مدیرعامل انرژی', 'Executive', 'IR', 87, 81, 80, 'a.mohammadi@demo.local'],
    ['003109', 'نگار', 'صادقی', R + '0201', 'مدیر روابط انرژی', 'Relationships', 'IR', 68, 54, 76, 'n.sadeghi@demo.local'],
    ['003110', 'محمد', 'قاسمی', R + '0211', 'مدیر مالی نیروگاه هامون', 'Finance', 'IR', 58, 50, 64, 'm.ghasemi@demo.local'],
    ['003111', 'شادی', 'رحیمی', R + '0221', 'مدیرعامل پالایش پارسا', 'Executive', 'IR', 80, 76, 72, 'sh.rahimi@demo.local'],
    ['003112', 'سعید', 'مرادی', R + '0231', 'مدیر تأمین تجهیزات', 'Sourcing', 'IR', 57, 49, 60, 's.moradi@demo.local'],
    ['003113', 'لیلا', 'شریفی', R + '0301', 'مدیرعامل ساختمان', 'Executive', 'IR', 79, 74, 78, 'l.sharifi@demo.local'],
    ['003114', 'پویا', 'رستمی', R + '0311', 'مدیر پروژه مسکن نیکان', 'Projects', 'IR', 62, 56, 68, 'p.rostami@demo.local'],
    ['003115', 'الهام', 'توکلی', R + '0321', 'مدیرکل پیمانکار پارسه', 'Operations', 'IR', 65, 54, 71, 'e.tavakoli@demo.local'],
    ['003116', 'کامران', 'یوسفی', R + '0331', 'مدیر تدارکات سیمان', 'Logistics', 'IR', 52, 46, 58, 'k.yousefi@demo.local'],
    ['003117', 'نازنین', 'فرهادی', R + '0401', 'مدیرعامل ترابری', 'Executive', 'IR', 77, 71, 75, 'n.farhadi@demo.local'],
    ['003118', 'بهنام', 'اکبری', R + '0411', 'مدیر بندری بنادر آفتاب', 'Operations', 'IR', 61, 53, 66, 'b.akbari@demo.local'],
    ['003119', 'سمینا', 'عزیزی', R + '0501', 'مدیرعامل سلامت', 'Executive', 'IR', 82, 78, 80, 's.azizi@demo.local'],
    ['003120', 'وحید', 'سلیمی', R + '0511', 'مدیر ارشد بیمارستان مهر', 'Administration', 'IR', 63, 55, 70, 'v.salimi@demo.local'],
    ['003121', 'روشنا', 'جعفری', R + '0521', 'مدیرعامل داروسازی آرین', 'Executive', 'IR', 74, 66, 72, 'r.jafari@demo.local'],
    ['003122', 'کیان', 'رهنما', R + '0601', 'مدیرعامل دیجیتال', 'Executive', 'IR', 76, 72, 79, 'k.rahnam@demo.local'],
    ['003123', 'تارا', 'امینی', R + '0611', 'مدیر نوآوری استارتاپ نوا', 'Product', 'IR', 60, 58, 74, 't.amini@demo.local'],
    ['003124', 'پارسا', 'بهرامی', R + '0701', 'مدیرعامل بین‌الملل', 'Executive', 'IR', 78, 74, 76, 'p.bahrami@demo.local'],
    ['003125', 'نرگس', 'کاویانی', R + '0711', 'مدیر مشتری خلیج', 'Relationships', 'AE', 59, 50, 66, 'n.kaviani@demo.local'],
  ];
  for (const [id, firstName, lastName, organizationId, title, department, country, influenceScore, decisionPower, accessibilityScore, email] of persons) {
    await person(R + id, { firstName, lastName, organizationId, title, department, country, influenceScore, decisionPower, accessibilityScore, email });
  }

  // --- Organizations Relationships (25) ---
  const active: RelationshipStatus = 'ACTIVE', prospective: RelationshipStatus = 'PROSPECTIVE', atRisk: RelationshipStatus = 'AT_RISK', dormant: RelationshipStatus = 'DORMANT';
  const strategic = 'STRATEGIC', commercial = 'COMMERCIAL', partner = 'PARTNER', supplier = 'SUPPLIER', investment = 'INVESTMENT';
  const S = (id: number, a: string, b: string, type: string, status: RelationshipStatus, scores: Partial<Record<string, number>>, lifecycle: RelationshipLifecycleStage, sensitivity: DataClassification = DataClassification.INTERNAL) =>
    rel(`${R}${String(id).padStart(4, '0')}0`, R + a, R + b, type, status, scores, lifecycle, sensitivity) as Promise<any>;
  await S(1, '0001', '0101', strategic, active, { health: 84, strategic: 90, risk: 8, trust: 82, access: 70, influence: 78, opportunity: 88, resilience: 72, engagement: 85 }, 'STRATEGIC');
  await S(2, '0001', '0201', strategic, active, { health: 80, strategic: 88, risk: 10, trust: 78, access: 68, influence: 74, opportunity: 86, resilience: 75, engagement: 82 }, 'STRATEGIC');
  await S(3, '0001', '0301', strategic, active, { health: 74, strategic: 78, risk: 14, trust: 72, access: 66, influence: 70, opportunity: 74, resilience: 76, engagement: 70 }, 'STRATEGIC');
  await S(4, '0001', '0401', strategic, active, { health: 76, strategic: 80, risk: 12, trust: 74, access: 62, influence: 66, opportunity: 78, resilience: 70, engagement: 74 }, 'STRATEGIC');
  await S(5, '0001', '0501', strategic, active, { health: 82, strategic: 84, risk: 9, trust: 80, access: 70, influence: 76, opportunity: 80, resilience: 74, engagement: 80 }, 'STRATEGIC');
  await S(6, '0001', '0601', strategic, prospective, { health: 66, strategic: 82, risk: 16, trust: 68, access: 52, influence: 62, opportunity: 84, resilience: 60, engagement: 56 }, 'DEVELOPING');
  await S(7, '0001', '0701', strategic, active, { health: 78, strategic: 86, risk: 16, trust: 76, access: 74, influence: 72, opportunity: 88, resilience: 68, engagement: 78 }, 'ACTIVE');
  await S(8, '0101', '0111', commercial, active, { health: 82, strategic: 76, risk: 10, trust: 78, access: 66, influence: 68, opportunity: 72, resilience: 74, engagement: 78 }, 'ACTIVE');
  await S(9, '0101', '0112', commercial, active, { health: 70, strategic: 64, risk: 18, trust: 66, access: 58, influence: 60, opportunity: 76, resilience: 60, engagement: 66 }, 'ACTIVE');
  await S(10, '0101', '0121', supplier, active, { health: 74, strategic: 56, risk: 22, trust: 70, access: 62, influence: 54, opportunity: 50, resilience: 68, engagement: 64 }, 'ACTIVE');
  await S(11, '0101', '0131', commercial, active, { health: 78, strategic: 64, risk: 14, trust: 72, access: 60, influence: 62, opportunity: 68, resilience: 70, engagement: 72 }, 'ACTIVE');
  await S(12, '0201', '0211', commercial, active, { health: 80, strategic: 72, risk: 12, trust: 76, access: 64, influence: 66, opportunity: 74, resilience: 72, engagement: 76 }, 'ACTIVE');
  await S(13, '0201', '0221', strategic, active, { health: 76, strategic: 86, risk: 20, trust: 74, access: 70, influence: 72, opportunity: 84, resilience: 62, engagement: 74 }, 'STRATEGIC');
  await S(14, '0201', '0231', supplier, atRisk, { health: 52, strategic: 54, risk: 48, trust: 48, access: 56, influence: 50, opportunity: 44, resilience: 42, engagement: 40 }, 'AT_RISK');
  await S(15, '0301', '0311', commercial, active, { health: 72, strategic: 62, risk: 16, trust: 66, access: 58, influence: 56, opportunity: 66, resilience: 64, engagement: 60 }, 'ACTIVE');
  await S(16, '0301', '0321', partner, active, { health: 76, strategic: 66, risk: 18, trust: 72, access: 70, influence: 64, opportunity: 70, resilience: 68, engagement: 66 }, 'ACTIVE');
  await S(17, '0301', '0331', supplier, prospective, { health: 58, strategic: 48, risk: 26, trust: 54, access: 50, influence: 46, opportunity: 52, resilience: 56, engagement: 44 }, 'INITIAL_CONTACT');
  await S(18, '0401', '0411', commercial, active, { health: 70, strategic: 60, risk: 20, trust: 66, access: 60, influence: 58, opportunity: 62, resilience: 62, engagement: 64 }, 'ACTIVE');
  await S(19, '0401', '0421', partner, prospective, { health: 60, strategic: 56, risk: 24, trust: 58, access: 48, influence: 54, opportunity: 66, resilience: 58, engagement: 48 }, 'INTRODUCED');
  await S(20, '0501', '0511', commercial, active, { health: 78, strategic: 68, risk: 12, trust: 74, access: 62, influence: 64, opportunity: 72, resilience: 70, engagement: 74 }, 'ACTIVE');
  await S(21, '0501', '0521', commercial, active, { health: 74, strategic: 66, risk: 14, trust: 70, access: 60, influence: 62, opportunity: 68, resilience: 66, engagement: 70 }, 'ACTIVE');
  await S(22, '0601', '0611', commercial, active, { health: 68, strategic: 60, risk: 18, trust: 64, access: 58, influence: 60, opportunity: 74, resilience: 64, engagement: 66 }, 'DEVELOPING');
  await S(23, '0601', '0621', commercial, dormant, { health: 46, strategic: 52, risk: 34, trust: 48, access: 42, influence: 46, opportunity: 56, resilience: 44, engagement: 30 }, 'DORMANT');
  await S(24, '0701', '0711', commercial, prospective, { health: 56, strategic: 58, risk: 22, trust: 54, access: 52, influence: 50, opportunity: 70, resilience: 60, engagement: 50 }, 'INTRODUCED');
  await S(25, '0111', '0112', commercial, active, { health: 74, strategic: 68, risk: 16, trust: 70, access: 64, influence: 62, opportunity: 76, resilience: 66, engagement: 72 }, 'ACTIVE');

  // --- Person relationships (12) ---
  const PR = (id: number, a: string, b: string, orgA: string, orgB: string, type: string, status: RelationshipStatus, scores: Partial<Record<string, number>>) =>
    prisma.personRelationship.upsert({
      where: { id: `${R}${String(id).padStart(4, '0')}0` },
      update: { sourcePersonId: R + a, targetPersonId: R + b, sourceOrganizationId: R + orgA, targetOrganizationId: R + orgB, relationshipType: type, status, ownerId: DEMO_USER, healthScore: scores.health ?? 60, strategicScore: scores.strategic ?? 60, riskScore: scores.risk ?? 20, trustScore: scores.trust ?? 60, accessScore: scores.access ?? 50, influenceScore: scores.influence ?? 50, opportunityScore: scores.opportunity ?? 60, resilienceScore: scores.resilience ?? 60, engagementScore: scores.engagement ?? 60 },
      create: { id: `${R}${String(id).padStart(4, '0')}0`, sourcePersonId: R + a, targetPersonId: R + b, sourceOrganizationId: R + orgA, targetOrganizationId: R + orgB, relationshipType: type, status, ownerId: DEMO_USER, healthScore: scores.health ?? 60, strategicScore: scores.strategic ?? 60, riskScore: scores.risk ?? 20, trustScore: scores.trust ?? 60, accessScore: scores.access ?? 50, influenceScore: scores.influence ?? 50, opportunityScore: scores.opportunity ?? 60, resilienceScore: scores.resilience ?? 60, engagementScore: scores.engagement ?? 60 },
    });
  await PR(1, '003100', '003103', '0001', '0101', strategic, active, { health: 82, strategic: 78, trust: 80, influence: 76 });
  await PR(2, '003103', '003104', '0101', '0111', commercial, active, { health: 76, strategic: 70, trust: 74, influence: 70 });
  await PR(3, '003104', '003106', '0111', '0112', commercial, active, { health: 70, strategic: 64, trust: 68, influence: 62 });
  await PR(4, '003101', '003108', '0001', '0201', strategic, active, { health: 78, strategic: 76, trust: 76, influence: 72 });
  await PR(5, '003108', '003111', '0201', '0221', strategic, active, { health: 72, strategic: 74, trust: 70, influence: 68 });
  await PR(6, '003102', '003110', '0001', '0211', commercial, active, { health: 64, strategic: 56, trust: 62, influence: 54 });
  await PR(7, '003114', '003115', '0311', '0321', partner, active, { health: 68, strategic: 58, trust: 64, influence: 56 });
  await PR(8, '003117', '003118', '0401', '0411', commercial, active, { health: 66, strategic: 58, trust: 62, influence: 54 });
  await PR(9, '003119', '003121', '0501', '0521', commercial, active, { health: 74, strategic: 66, trust: 72, influence: 62 });
  await PR(10, '003122', '003123', '0601', '0611', commercial, active, { health: 70, strategic: 64, trust: 68, influence: 60 });
  await PR(11, '003124', '003125', '0701', '0711', commercial, prospective, { health: 56, strategic: 52, trust: 54, influence: 50 });
  await PR(12, '003100', '003113', '0001', '0301', strategic, active, { health: 72, strategic: 68, trust: 70, influence: 66 });

  // --- Projects (12) ---
  const project = (id: number, name: string, description: string, organizationId: string, status: ProjectStatus, priority: Priority, startAt: string, targetAt: string) =>
    prisma.project.upsert({
      where: { id: `${R}${String(id).padStart(4, '0')}0` },
      update: { name, description, organizationId, ownerId: DEMO_USER, status, priority, startAt: new Date(startAt), targetAt: new Date(targetAt) },
      create: { id: `${R}${String(id).padStart(4, '0')}0`, name, description, organizationId, ownerId: DEMO_USER, status, priority, startAt: new Date(startAt), targetAt: new Date(targetAt) },
    });
  await project(1, 'برنامه تحول دیجیتال هلدینگ', 'یکپارچه‌سازی سامانه‌های اطلاعاتی گروه و داشبورد هوش تجاری', R + '0001', ProjectStatus.ACTIVE, Priority.HIGH, '2026-03-01T00:00:00Z', '2027-02-28T00:00:00Z');
  await project(2, 'توسعه خط تولید فولاد آرین', 'افزایش ظرفیت تولید ورق به ۱.۲ میلیون تن', R + '0111', ProjectStatus.ACTIVE, Priority.HIGH, '2026-05-10T00:00:00Z', '2027-08-30T00:00:00Z');
  await project(3, 'اصلاح کیفیت رنگ سپهر', 'اجرای خط رنگ الکترواستاتیک مطابق استاندارد اروپا', R + '0131', ProjectStatus.ACTIVE, Priority.MEDIUM, '2026-06-01T00:00:00Z', '2026-12-31T00:00:00Z');
  await project(4, 'برق اضطراری نیروگاه هامون', 'نصب واحد توربین گازی ۸۰ مگاواتی پشتیبان', R + '0211', ProjectStatus.ACTIVE, Priority.CRITICAL, '2026-04-15T00:00:00Z', '2027-01-31T00:00:00Z');
  await project(5, 'قرارداد بلندمدت پالایش پارسا', 'تأمین پایدار نفت‌خام و مشتقات چندساله', R + '0221', ProjectStatus.PLANNED, Priority.HIGH, '2026-09-01T00:00:00Z', '2026-12-31T00:00:00Z');
  await project(6, 'برج مسکونی نیکان', 'ساخت ۲۴۰ واحد مسکونی متعارف', R + '0311', ProjectStatus.ACTIVE, Priority.MEDIUM, '2026-02-20T00:00:00Z', '2028-06-30T00:00:00Z');
  await project(7, 'نوسازی ناوگان ترابری', 'خرید ۳۰ کامیون گازسوز و توسعه سردخانه', R + '0401', ProjectStatus.ON_HOLD, Priority.MEDIUM, '2026-01-10T00:00:00Z', '2027-05-30T00:00:00Z');
  await project(8, 'توسعه زیرساخت بنادر آفتاب', 'بهسازی پایانهٔ کانتینری و اپراتور کرین‌ها', R + '0411', ProjectStatus.ACTIVE, Priority.HIGH, '2026-03-20T00:00:00Z', '2027-03-31T00:00:00Z');
  await project(9, 'زنجیره سرد دارویی آرین', 'اجرای لجستیک سرددار از تولید تا داروخانه', R + '0521', ProjectStatus.ACTIVE, Priority.CRITICAL, '2026-05-01T00:00:00Z', '2026-11-30T00:00:00Z');
  await project(10, 'پلتفرم مشتری موج', 'اپلیکیشن بانکداری دیجیتال سازمانی', R + '0621', ProjectStatus.PLANNED, Priority.HIGH, '2026-10-01T00:00:00Z', '2027-04-30T00:00:00Z');
  await project(11, 'کارخانه مستقل استارتاپ نوا', 'جذب سرمایه برای توسعه زیرساخت تحلیلی', R + '0611', ProjectStatus.ACTIVE, Priority.HIGH, '2026-07-01T00:00:00Z', '2026-12-31T00:00:00Z');
  await project(12, 'خط صادرات گلف‌لاین', 'عملیات‌سازی کریدور صادراتی خلیج', R + '0421', ProjectStatus.PLANNED, Priority.MEDIUM, '2026-11-01T00:00:00Z', '2027-06-30T00:00:00Z');

  const demoRelationships = await prisma.relationship.findMany({ where: { ownerId: DEMO_USER, deletedAt: null }, select: { id: true, sourceOrganizationId: true, targetOrganizationId: true }, orderBy: { createdAt: 'asc' }, take: 30 });

  // --- Interactions (15) ---
  const interaction = (id: number, kind: InteractionKind, subject: string, summary: string, organizationId: string, personId: string, relationshipId: string, importance: Priority, occurredAt: string, sentiment: number) =>
    prisma.interaction.upsert({
      where: { id: `${R}${String(id).padStart(4, '0')}0` },
      update: { type: kind, subject, summary, organizationId, personId, relationshipId, importance, occurredAt: new Date(occurredAt), sentiment },
      create: { id: `${R}${String(id).padStart(4, '0')}0`, type: kind, subject, summary, organizationId, personId, relationshipId, importance, occurredAt: new Date(occurredAt), sentiment, userId: DEMO_USER },
    });
  const I = demoRelationships;
  await interaction(1, InteractionKind.MEETING, 'جلسه توجیهی برنامه تحول دیجیتال', 'بررسی نقشه راه یکپارچه‌سازی و تخصیص بودجه', R + '0001', R + '003100', I[0].id, Priority.HIGH, '2026-08-01T10:00:00Z', 4);
  await interaction(2, InteractionKind.EMAIL, 'هماهنگی قرارداد پالایش پارسا', 'ارسال پیش‌نویس توافقنامه‌ٔ تأمین بلندمدت', R + '0221', R + '003111', I[1].id, Priority.HIGH, '2026-08-05T09:30:00Z', 4);
  await interaction(3, InteractionKind.CALL, 'تماس پیگیری خرید تجهیزات', 'تأخیر ۲ هفته‌ای تأمین توربین', R + '0231', R + '003112', I[2].id, Priority.CRITICAL, '2026-08-07T14:00:00Z', 1);
  await interaction(4, InteractionKind.NOTE, 'ثبت گزارش تحلیلی', 'مؤلفه‌های ریسک رابطه با تجهیزات نیروگاه', R + '0201', R + '003109', I[2].id, Priority.MEDIUM, '2026-08-08T11:00:00Z', 2);
  await interaction(5, InteractionKind.MEETING, 'بازدید میدانی فولاد آرین', 'بازدید از خط تولید جدید و مذاکره تأمین کک', R + '0111', R + '003104', I[3].id, Priority.HIGH, '2026-08-10T08:00:00Z', 5);
  await interaction(6, InteractionKind.MESSAGE, 'پیام برنامه‌ریزی مذاکره گلف‌لاین', 'پیشنهاد زمان نشست هیئت تجاری دبی', R + '0421', R + '003124', I[4].id, Priority.MEDIUM, '2026-08-12T16:20:00Z', 3);
  await interaction(7, InteractionKind.EMAIL, 'گزارش پیشرفت برج نیکان', 'پیشرفت ۶۵٪ اسکلت بتن‌آرمه', R + '0311', R + '003114', I[5].id, Priority.MEDIUM, '2026-08-14T10:00:00Z', 4);
  await interaction(8, InteractionKind.CALL, 'تماس با مدیر بندری آفتاب', 'اعطای جایگاه ترجیحی تخلیه به ناوگان گروه', R + '0411', R + '003118', I[6].id, Priority.HIGH, '2026-08-15T12:00:00Z', 4);
  await interaction(9, InteractionKind.MEETING, 'کمیته سلامت و زنجیره سرد', 'جلسه راهبردی هلدینگ با مدیرعامل داروسازی', R + '0521', R + '003121', I[7].id, Priority.CRITICAL, '2026-08-18T09:00:00Z', 4);
  await interaction(10, InteractionKind.EMAIL, 'مکاتبه با پیمانکار پارسه', 'الحاقیه پرداخت مرحله دوم', R + '0321', R + '003115', I[8].id, Priority.MEDIUM, '2026-08-19T13:30:00Z', 3);
  await interaction(11, InteractionKind.CALL, 'تماس با مشتری موج', 'رزرو وبینار معرفی پلتفرم', R + '0621', R + '003122', I[9].id, Priority.LOW, '2026-08-20T15:00:00Z', 2);
  await interaction(12, InteractionKind.NOTE, 'ثبت ملاحظات سرمایه‌گذاری نوا', 'ارزیابی ادواری جذب سرمایه سری A', R + '0611', R + '003123', I[10].id, Priority.MEDIUM, '2026-08-21T11:45:00Z', 4);
  await interaction(13, InteractionKind.MEETING, 'نشست انرژی با پالایش پارسا', 'توافق سقف ظرفیت تحویل سه ماهه', R + '0221', R + '003111', I[1].id, Priority.HIGH, '2026-08-22T10:00:00Z', 5);
  await interaction(14, InteractionKind.EMAIL, 'مکاتبه با مشتری خلیج', 'ارسال پروفرم کشتیرانی و بیمه', R + '0711', R + '003125', I[11].id, Priority.MEDIUM, '2026-08-24T09:00:00Z', 3);
  await interaction(15, InteractionKind.CALL, 'تماس فعال‌سازی رابطه سیمان آذر', 'معرفی توان تولید و ثبت درخواست قرارداد', R + '0331', R + '003116', I[12].id, Priority.MEDIUM, '2026-08-25T14:30:00Z', 3);

  // --- Meetings (8) + participants ---
  const meeting = (id: number, title: string, objective: string, organizationId: string, relationshipId: string, startAt: string, participants: string[]) =>
    prisma.meeting.upsert({ where: { id: `${R}${String(id).padStart(4, '0')}0` }, update: { title, objective, organizationId, relationshipId, startAt: new Date(startAt) }, create: { id: `${R}${String(id).padStart(4, '0')}0`, title, objective, organizationId, relationshipId, startAt: new Date(startAt), ownerId: DEMO_USER } }).then(async (m) => { for (const pid of participants) await prisma.meetingParticipant.upsert({ where: { meetingId_personId: { meetingId: m.id, personId: R + pid } }, update: {}, create: { meetingId: m.id, personId: R + pid } }); });
  await meeting(1, 'نشست راهبردی هلدینگ', 'بررسی عملکرد سبد روابط و تصویب بودجه', R + '0001', I[0].id, '2026-08-01T10:00:00Z', ['003100', '003101', '003103']);
  await meeting(2, 'مذاکره تأمین بلندمدت', 'نهایی‌سازی قرارداد پالایش پارسا', R + '0221', I[1].id, '2026-08-20T09:30:00Z', ['003111', '003108', '003101']);
  await meeting(3, 'کمیته مدیریت ریسک تجهیزات', 'طرح جبران تأخیر و جایگزینی تأمین‌کننده', R + '0201', I[2].id, '2026-08-25T14:00:00Z', ['003112', '003109', '003108']);
  await meeting(4, 'بازدید خط تولید فولاد', 'معاینه خط نو و تعیین ظرفیت قراردادی', R + '0111', I[3].id, '2026-08-10T08:00:00Z', ['003104', '003103', '003105']);
  await meeting(5, 'هیئت تجاری گلف‌لاین', 'مذاکره کریدور صادراتی خلیج', R + '0421', I[4].id, '2026-09-02T11:00:00Z', ['003124', '003125']);
  await meeting(6, 'گزارش پیشرفت برج نیکان', 'کنترل هزینه و زمان اجرا', R + '0311', I[5].id, '2026-08-14T10:00:00Z', ['003114', '003115']);
  await meeting(7, 'کمیته سلامت', 'تصویب برنامه زنجیره سرد دارویی', R + '0521', I[7].id, '2026-08-18T09:00:00Z', ['003121', '003119', '003120']);
  await meeting(8, 'ارزیابی سرمایه‌گذاری نوا', 'ملاقات با تیم استارتاپ و خرید نمونه', R + '0611', I[10].id, '2026-08-21T11:00:00Z', ['003123', '003122']);

  // --- Actions (10), Commitments (10), Opportunities (10) ---
  for (let k = 0; k < 10; k++) {
    const relId = I[k % I.length].id, orgId = demoRelationships[k % I.length].sourceOrganizationId;
    await prisma.action.upsert({ where: { id: `${R}${String(9_00000 + k)}0` }, update: { title: `اقدام پیگیری — رابطهٔ ${k + 1}`, status: ['OPEN', 'IN_PROGRESS', 'OPEN', 'DONE'][k % 4] as any, priority: (['HIGH', 'MEDIUM', 'CRITICAL', 'LOW'] as Priority[])[k % 4], dueAt: new Date(`2026-09-${10 + k}T10:00:00Z`), ownerId: DEMO_USER, relationshipId: relId, organizationId: orgId }, create: { id: `${R}${String(9_00000 + k)}0`, title: `اقدام پیگیری — رابطهٔ ${k + 1}`, status: ['OPEN', 'IN_PROGRESS', 'OPEN', 'DONE'][k % 4] as any, priority: (['HIGH', 'MEDIUM', 'CRITICAL', 'LOW'] as Priority[])[k % 4], dueAt: new Date(`2026-09-${10 + k}T10:00:00Z`), ownerId: DEMO_USER, relationshipId: relId, organizationId: orgId }});
    await prisma.commitment.upsert({ where: { id: `${R}${String(10_00000 + k)}0` }, update: { description: `تعهد دوجانبه — تحویل ${['گزارش فنی', 'پروفرم', 'مستندات قرارداد', 'برنامه زمان‌بندی'][k % 4]}`, source: 'دمو هلدینگ', receiver: `طرفِ رابطهٔ ${k + 1}`, ownerId: DEMO_USER, relationshipId: relId, organizationId: orgId, dueAt: new Date(`2026-09-${15 + k}T12:00:00Z`) }, create: { id: `${R}${String(10_00000 + k)}0`, description: `تعهد دوجانبه — تحویل ${['گزارش فنی', 'پروفرم', 'مستندات قرارداد', 'برنامه زمان‌بندی'][k % 4]}`, source: 'دمو هلدینگ', receiver: `طرفِ رابطهٔ ${k + 1}`, ownerId: DEMO_USER, relationshipId: relId, organizationId: orgId, dueAt: new Date(`2026-09-${15 + k}T12:00:00Z`) }});
    await prisma.opportunity.upsert({ where: { id: `${R}${String(11_00000 + k)}0` }, update: { name: `فرصت ${k + 1} — توسعه همکاری`, description: 'گسترش دامنه تعاملات با افزایش سهم خدمت', value: `${2_000_000 + k * 400_000}`, probability: 30 + (k * 5) % 60, status: (['IDENTIFIED', 'QUALIFYING', 'ACTIVE', 'WON'] as OpportunityStatus[])[k % 4], organizationId: orgId, relationshipId: relId }, create: { id: `${R}${String(11_00000 + k)}0`, name: `فرصت ${k + 1} — توسعه همکاری`, description: 'گسترش دامنه تعاملات با افزایش سهم خدمت', value: `${2_000_000 + k * 400_000}`, probability: 30 + (k * 5) % 60, status: (['IDENTIFIED', 'QUALIFYING', 'ACTIVE', 'WON'] as OpportunityStatus[])[k % 4], organizationId: orgId, relationshipId: relId }});
  }

  // --- Notes (8) & Documents (4) ---
  for (let k = 0; k < 8; k++) {
    await prisma.note.upsert({ where: { id: `${R}${String(12_00000 + k)}0` }, update: { title: `یادداشت تحلیلی ${k + 1}`, body: `خلاصه مباحث و روند روابط ${k + 1}: پیشنهاد افزایش سطح همکاری و رصد شاخص‌های کلیدی.`, organizationId: I[k % I.length].sourceOrganizationId, createdById: DEMO_USER }, create: { id: `${R}${String(12_00000 + k)}0`, title: `یادداشت تحلیلی ${k + 1}`, body: `خلاصه مباحث و روند روابط ${k + 1}: پیشنهاد افزایش سطح همکاری و رصد شاخص‌های کلیدی.`, organizationId: I[k % I.length].sourceOrganizationId, createdById: DEMO_USER } });
  }
  for (let k = 0; k < 4; k++) {
    await prisma.document.upsert({ where: { id: `${R}${String(12_01000 + k)}0` }, update: { name: `demo-brief-${k + 1}.pdf`, mimeType: 'application/pdf', storageKey: `demo/brief-${k + 1}.pdf`, sizeBytes: 1200 + k * 300, organizationId: I[k % I.length].sourceOrganizationId, createdById: DEMO_USER }, create: { id: `${R}${String(12_01000 + k)}0`, name: `demo-brief-${k + 1}.pdf`, mimeType: 'application/pdf', storageKey: `demo/brief-${k + 1}.pdf`, sizeBytes: 1200 + k * 300, organizationId: I[k % I.length].sourceOrganizationId, createdById: DEMO_USER } });
  }

  // --- Tags (demo) + assignments ---
  const demoTagNames = ['دمو-راهبردی', 'دمو-نوآوری', 'دمو-پرریسک'];
  const tags: any[] = [];
  for (const name of demoTagNames) tags.push(await prisma.tag.upsert({ where: { name }, update: {}, create: { name } }));
  await prisma.relationshipTag.upsert({ where: { relationshipId_tagId: { relationshipId: I[0].id, tagId: tags[0].id } }, update: {}, create: { relationshipId: I[0].id, tagId: tags[0].id } });
  await prisma.relationshipTag.upsert({ where: { relationshipId_tagId: { relationshipId: I[13].id, tagId: tags[2].id } }, update: {}, create: { relationshipId: I[13].id, tagId: tags[2].id } });
  await prisma.relationshipTag.upsert({ where: { relationshipId_tagId: { relationshipId: I[11].id, tagId: tags[1].id } }, update: {}, create: { relationshipId: I[11].id, tagId: tags[1].id } });

  // --- Notifications (5) & Recommendations (5) ---
  const notificationTypes: NotificationType[] = [NotificationType.SUCCESS, NotificationType.WARNING, NotificationType.INFO, NotificationType.ALERT, NotificationType.INFO];
  for (let k = 0; k < 5; k++) {
    await prisma.notification.upsert({ where: { id: `${R}${String(13_00000 + k)}0` }, update: { userId: DEMO_USER, type: notificationTypes[k], title: ['امتیاز رابطه به‌روزرسانی شد', 'ریسک تأمین شناسایی شد', 'مذاکرهٔ جدید برنامه‌ریزی شد', 'بازهٔ بررسی روابط نزدیک است', 'گزارش ماهانه آماده است'][k], body: `محتوای اطلاع‌رسانی دمو #${k + 1}` }, create: { id: `${R}${String(13_00000 + k)}0`, userId: DEMO_USER, type: notificationTypes[k], title: ['امتیاز رابطه به‌روزرسانی شد', 'ریسک تأمین شناسایی شد', 'مذاکرهٔ جدید برنامه‌ریزی شد', 'بازهٔ بررسی روابط نزدیک است', 'گزارش ماهانه آماده است'][k], body: `محتوای اطلاع‌رسانی دمو #${k + 1}` } });
    await prisma.recommendation.upsert({ where: { id: `${R}${String(13_01000 + k)}0` }, update: { userId: DEMO_USER, relationshipId: I[k % I.length].id, type: ['GUIDANCE', 'RISK', 'ENGAGEMENT', 'SEED', 'GUIDANCE'][k], title: ['برگزاری نشست فصلی با هلدینگ', 'بازنگری برنامه جبرانی تأمین‌کننده', 'افزایش تعداد تماس‌های راهبردی', 'بررسی رابطهٔ راکد', 'به‌روزرسانی نقشه سهام‌گذاران'][k], rationale: 'پیشنهاد مبتنی بر داده‌های دمو برای بهبود شاخص‌های رابطه', confidence: 40 + k * 10 }, create: { id: `${R}${String(13_01000 + k)}0`, userId: DEMO_USER, relationshipId: I[k % I.length].id, type: ['GUIDANCE', 'RISK', 'ENGAGEMENT', 'SEED', 'GUIDANCE'][k], title: ['برگزاری نشست فصلی با هلدینگ', 'بازنگری برنامه جبرانی تأمین‌کننده', 'افزایش تعداد تماس‌های راهبردی', 'بررسی رابطهٔ راکد', 'به‌روزرسانی نقشه سهام‌گذاران'][k], rationale: 'پیشنهاد مبتنی بر داده‌های دمو برای بهبود شاخص‌های رابطه', confidence: 40 + k * 10 } });
  }

  // --- Workflow + executions ---
  const workflow = await prisma.workflow.upsert({ where: { id: `${R}${String(14_00000)}0` }, update: { name: 'دمو روال بازنگری رابطه', entityType: 'Relationship', organizationId: DEMO_ROOT, definition: { version: 1, trigger: 'MANUAL', steps: [{ name: 'جمع‌آوری امتیازات', type: 'SCORE' }, { name: 'بررسی تحلیلی', type: 'REVIEW' }, { name: 'تصویب اقدامات', type: 'APPROVE' }] } }, create: { id: `${R}${String(14_00000)}0`, name: 'دمو روال بازنگری رابطه', entityType: 'Relationship', organizationId: DEMO_ROOT, definition: { version: 1, trigger: 'MANUAL', steps: [{ name: 'جمع‌آوری امتیازات', type: 'SCORE' }, { name: 'بررسی تحلیلی', type: 'REVIEW' }, { name: 'تصویب اقدامات', type: 'APPROVE' }] } } });
  for (let k = 0; k < 2; k++) {
    await prisma.workflowExecution.upsert({ where: { id: `${R}${String(14_00002 + k)}0` }, update: { workflowId: workflow.id, entityType: 'Relationship', entityId: I[k].id, status: 'COMPLETED' }, create: { id: `${R}${String(14_00002 + k)}0`, workflowId: workflow.id, entityType: 'Relationship', entityId: I[k].id, status: 'COMPLETED', finishedAt: new Date('2026-08-23T10:00:00Z') } });
  }

  // --- Score snapshots & scores for flagship relationships ---
  for (let k = 0; k < 6; k++) {
    const relId = I[k].id;
    const snapshot = await prisma.relationshipScoreSnapshot.upsert({ where: { id: `${R}${String(15_00000 + k)}0` }, update: { relationshipId: relId, healthScore: 60 + (k * 4) % 35, strategicScore: 60 + (k * 5) % 35, riskScore: (k * 7) % 40, trustScore: 58 + (k * 3) % 30, accessScore: 50 + (k * 2) % 30, influenceScore: 52 + (k * 2) % 30, opportunityScore: 60 + (k * 6) % 35, resilienceScore: 55 + (k * 2) % 30, engagementScore: 56 + (k * 3) % 30, reason: 'Demo baseline snapshot' }, create: { id: `${R}${String(15_00000 + k)}0`, relationshipId: relId, healthScore: 60 + (k * 4) % 35, strategicScore: 60 + (k * 5) % 35, riskScore: (k * 7) % 40, trustScore: 58 + (k * 3) % 30, accessScore: 50 + (k * 2) % 30, influenceScore: 52 + (k * 2) % 30, opportunityScore: 60 + (k * 6) % 35, resilienceScore: 55 + (k * 2) % 30, engagementScore: 56 + (k * 3) % 30, reason: 'Demo baseline snapshot' }});
    await prisma.score.upsert({ where: { id: `${R}${String(15_01000 + k)}0` }, update: { type: 'RELATIONSHIP', subjectType: 'RELATIONSHIP', subjectId: relId, value: 60 + (k * 4) % 35, version: 1, explanation: 'Demo Score entity' }, create: { id: `${R}${String(15_01000 + k)}0`, type: 'RELATIONSHIP', subjectType: 'RELATIONSHIP', subjectId: relId, value: 60 + (k * 4) % 35, version: 1, explanation: 'Demo Score entity' } });
    await prisma.scoreSnapshot.upsert({ where: { id: `${R}${String(15_02000 + k)}0` }, update: { scoreId: `${R}${String(15_01000 + k)}0`, value: 60 + (k * 4) % 35, version: 1, explanation: 'Demo ScoreSnapshot' }, create: { id: `${R}${String(15_02000 + k)}0`, scoreId: `${R}${String(15_01000 + k)}0`, value: 60 + (k * 4) % 35, version: 1, explanation: 'Demo ScoreSnapshot' } });
  }

  // --- Audit log marker ---
  await prisma.auditLog.upsert({ where: { id: `${R}${String(16_00000)}0` }, update: { userId: DEMO_USER, organizationId: DEMO_ROOT, action: AuditAction.CREATE, entityType: 'DemoSeed', entityId: DEMO_ROOT, reason: 'Demo world seed' }, create: { id: `${R}${String(16_00000)}0`, userId: DEMO_USER, organizationId: DEMO_ROOT, action: AuditAction.CREATE, entityType: 'DemoSeed', entityId: DEMO_ROOT, reason: 'Demo world seed' } });

  console.log(`Demo seed complete: ${user.email} | mfaDevice=${device.id}`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());