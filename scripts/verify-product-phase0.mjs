#!/usr/bin/env node
/**
 * Phase 0 — Product Contract and Release Baseline.
 *
 * The generated JSON is deliberately a product contract, not only an API
 * inventory. Every endpoint receives an explicit product surface, persona,
 * permission policy, workflow action, state matrix and test plan. This keeps a
 * large backend from becoming a collection of unowned routes.
 *
 * Usage:
 *   node scripts/verify-product-phase0.mjs          # generate contract
 *   node scripts/verify-product-phase0.mjs --check  # verify committed contract
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const apiRoot = path.join(repoRoot, 'apps', 'api', 'src');
const webRoot = path.join(repoRoot, 'apps', 'web', 'app');
const mobileRoot = path.join(repoRoot, 'apps', 'mobile', 'src', 'app');
const outputPath = path.join(repoRoot, 'docs', 'PRODUCT_CONTRACT_PHASE0.json');
const checkOnly = process.argv.includes('--check');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(absolute));
    else result.push(absolute);
  }
  return result;
}

function relative(absolute) {
  return path.relative(repoRoot, absolute).replaceAll(path.sep, '/');
}

function normalizeRoute(value) {
  const route = String(value || '').replace(/["'`\s]/g, '');
  return (`/${route}`).replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
}

function read(absolute) {
  return fs.readFileSync(absolute, 'utf8');
}

function sha256(absolute) {
  return crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
}

const states = ['loading', 'empty', 'error', 'forbidden', 'offline', 'success', 'conflict'];
const testKinds = ['contract', 'unit', 'integration', 'browser'];
const endpointClassifications = ['User-facing workflow', 'Admin workflow', 'Background job', 'Integration-only', 'API-only'];
const stateDefaults = {
  loading: { required: true, behavior: 'نمایش skeleton یا progress و غیرفعال‌کردن mutation تکراری' },
  empty: { required: true, behavior: 'نمایش empty state معنادار با CTA یا توضیح نبود داده' },
  error: { required: true, behavior: 'نمایش خطای قابل فهم، حفظ context و امکان retry' },
  forbidden: { required: true, behavior: 'نمایش Permission/Scope state بدون افشای داده‌ی محافظت‌شده' },
  offline: { required: true, behavior: 'نمایش وضعیت آفلاین، حفظ draft/queue و retry پس از اتصال' },
  success: { required: true, behavior: 'نمایش نتیجه، feedback یکنواخت و به‌روزرسانی context/timeline' },
  conflict: { required: true, behavior: 'نمایش conflict، جلوگیری از overwrite خاموش و ارائه‌ی تصمیم merge/reload' },
};

const taxonomy = {
  lifecycle: [
    { key: 'DRAFT', label: 'پیش‌نویس' },
    { key: 'ACTIVE', label: 'فعال' },
    { key: 'ON_HOLD', label: 'متوقف موقت' },
    { key: 'COMPLETED', label: 'تکمیل‌شده' },
    { key: 'CANCELLED', label: 'لغوشده' },
    { key: 'ARCHIVED', label: 'بایگانی‌شده' },
  ],
  work: [
    { key: 'OPEN', label: 'باز' },
    { key: 'IN_PROGRESS', label: 'در حال انجام' },
    { key: 'BLOCKED', label: 'مسدود' },
    { key: 'DONE', label: 'انجام‌شده' },
    { key: 'CANCELLED', label: 'لغوشده' },
  ],
  relationship: [
    { key: 'PROSPECTIVE', label: 'در حال شکل‌گیری' },
    { key: 'ACTIVE', label: 'فعال' },
    { key: 'AT_RISK', label: 'در معرض ریسک' },
    { key: 'DORMANT', label: 'کم‌تعامل' },
    { key: 'CLOSED', label: 'بسته' },
  ],
  opportunity: [
    { key: 'IDENTIFIED', label: 'شناسایی‌شده' },
    { key: 'QUALIFIED', label: 'تأیید اولیه' },
    { key: 'PROPOSAL', label: 'پیشنهاد' },
    { key: 'NEGOTIATION', label: 'مذاکره' },
    { key: 'WON', label: 'موفق' },
    { key: 'LOST', label: 'از دست‌رفته' },
    { key: 'ON_HOLD', label: 'متوقف موقت' },
  ],
  meeting: [
    { key: 'PLANNED', label: 'برنامه‌ریزی‌شده' },
    { key: 'IN_PROGRESS', label: 'در حال برگزاری' },
    { key: 'COMPLETED', label: 'برگزارشده' },
    { key: 'CANCELLED', label: 'لغوشده' },
  ],
  job: [
    { key: 'QUEUED', label: 'در صف' },
    { key: 'PROCESSING', label: 'در حال پردازش' },
    { key: 'COMPLETED', label: 'تکمیل‌شده' },
    { key: 'PARTIAL', label: 'ناقص' },
    { key: 'FAILED', label: 'ناموفق' },
    { key: 'CANCELLED', label: 'لغوشده' },
  ],
  qualityIssue: [
    { key: 'OPEN', label: 'باز' },
    { key: 'ASSIGNED', label: 'اختصاص‌یافته' },
    { key: 'SNOOZED', label: 'تعویق‌خورده' },
    { key: 'RESOLVED', label: 'رفع‌شده' },
    { key: 'REJECTED', label: 'ردشده' },
  ],
  approval: [
    { key: 'PENDING', label: 'در انتظار' },
    { key: 'APPROVED', label: 'تأییدشده' },
    { key: 'REJECTED', label: 'ردشده' },
    { key: 'EXPIRED', label: 'منقضی‌شده' },
  ],
  sync: [
    { key: 'CONNECTED', label: 'متصل' },
    { key: 'SYNCING', label: 'در حال همگام‌سازی' },
    { key: 'HEALTHY', label: 'سالم' },
    { key: 'DEGRADED', label: 'کاهش‌یافته' },
    { key: 'FAILED', label: 'ناموفق' },
    { key: 'DISCONNECTED', label: 'قطع‌شده' },
  ],
  severity: [
    { key: 'INFO', label: 'اطلاعات' },
    { key: 'LOW', label: 'کم' },
    { key: 'MEDIUM', label: 'متوسط' },
    { key: 'HIGH', label: 'زیاد' },
    { key: 'CRITICAL', label: 'بحرانی' },
  ],
};

const eventTaxonomy = [
  ['interaction.created', 'تعامل ثبت شد'],
  ['meeting.created', 'جلسه ایجاد شد'],
  ['meeting.finalized', 'جلسه نهایی شد'],
  ['action.created', 'اقدام ایجاد شد'],
  ['action.completed', 'اقدام تکمیل شد'],
  ['commitment.created', 'تعهد ایجاد شد'],
  ['commitment.overdue', 'تعهد عقب افتاد'],
  ['relationship.score_changed', 'امتیاز رابطه تغییر کرد'],
  ['relationship.risk_detected', 'ریسک رابطه شناسایی شد'],
  ['opportunity.stage_changed', 'مرحله فرصت تغییر کرد'],
  ['note.created', 'یادداشت ثبت شد'],
  ['document.uploaded', 'سند بارگذاری شد'],
  ['data_quality.issue_created', 'مسئله کیفیت داده ایجاد شد'],
  ['data_quality.issue_resolved', 'مسئله کیفیت داده رفع شد'],
  ['workflow.started', 'Workflow شروع شد'],
  ['workflow.failed', 'Workflow ناموفق شد'],
  ['integration.sync_failed', 'همگام‌سازی ناموفق شد'],
  ['approval.requested', 'درخواست تأیید ایجاد شد'],
  ['approval.completed', 'تأیید تکمیل شد'],
  ['privacy.requested', 'درخواست حریم خصوصی ثبت شد'],
  ['security.event', 'رویداد امنیتی ثبت شد'],
].map(([key, label]) => ({ key, label }));

const uiTerms = {
  organization: { en: 'Organization', fa: 'سازمان' },
  person: { en: 'Person', fa: 'شخص' },
  relationship: { en: 'Relationship', fa: 'رابطه' },
  interaction: { en: 'Interaction', fa: 'تعامل' },
  meeting: { en: 'Meeting', fa: 'جلسه' },
  action: { en: 'Action', fa: 'اقدام' },
  commitment: { en: 'Commitment', fa: 'تعهد' },
  followUp: { en: 'Follow-up', fa: 'پیگیری' },
  opportunity: { en: 'Opportunity', fa: 'فرصت' },
  project: { en: 'Project', fa: 'پروژه' },
  network: { en: 'Network', fa: 'شبکه' },
  recommendation: { en: 'Recommendation', fa: 'پیشنهاد' },
  note: { en: 'Note', fa: 'یادداشت' },
  dataQuality: { en: 'Data Quality', fa: 'کیفیت داده' },
  approval: { en: 'Approval', fa: 'تأیید' },
};

const personaCatalog = {
  executive: { en: 'Executive', fa: 'مدیر ارشد', focus: 'impact, risk, network and next best action' },
  'relationship-manager': { en: 'Relationship Manager', fa: 'مدیر روابط', focus: 'relationship context, interactions and follow-up' },
  'project-manager': { en: 'Project Manager', fa: 'مدیر پروژه', focus: 'milestones, risks, requirements and commitments' },
  analyst: { en: 'Analyst', fa: 'تحلیل‌گر', focus: 'evidence, quality, scoring and reporting' },
  'standard-user': { en: 'Standard User', fa: 'کاربر عادی', focus: 'daily work without technical identifiers' },
  'holding-admin': { en: 'Holding Admin', fa: 'مدیر هلدینگ', focus: 'cross-organization governance and access' },
  'subsidiary-admin': { en: 'Subsidiary Admin', fa: 'مدیر شرکت تابعه', focus: 'organization-level administration' },
  'platform-admin': { en: 'Platform Admin', fa: 'مدیر پلتفرم', focus: 'runtime, security and operational health' },
};

function domain({ label, surfaces, permissions, personas, classification = 'User-facing workflow', action = 'view-and-act', owner = 'Product Operations', productOwner = owner, technicalOwner = 'API Platform', scope = 'organization scope + role/ownership policy', statesOverride = states, tests = testKinds }) {
  return {
    label,
    surfaces,
    permissions,
    scope,
    personas,
    classification,
    productAction: action,
    owner: productOwner,
    productOwner,
    technicalOwner,
    requiredStates: statesOverride,
    stateMatrix: Object.fromEntries(statesOverride.map((state) => [state, stateDefaults[state] ?? { required: true }])),
    testPlan: tests,
  };
}

// Keys are controller prefixes. A blank @Controller() is assigned from the
// first path segment, so custom-fields and tags are still explicit domains.
const domainCatalog = {
  actions: domain({ label: 'اقدامات و کارهای اجرایی', surfaces: ['/today', '/actions', '/actions/[id]'], permissions: ['action.read', 'action.write'], personas: ['relationship-manager', 'project-manager', 'executive'], action: 'create-assign-complete' }),
  admin: domain({ label: 'مدیریت سیستم', surfaces: ['/admin', '/admin/*'], permissions: ['enterprise.admin'], personas: ['holding-admin', 'subsidiary-admin'], classification: 'Admin workflow', action: 'configure-and-govern', owner: 'Platform Governance', tests: ['contract', 'unit', 'integration', 'browser'] }),
  ai: domain({ label: 'هوش مصنوعی', surfaces: ['/ai', '/ai-executive-brief', '/intelligence'], permissions: ['ai.query', 'ai.executive_brief'], personas: ['executive', 'analyst', 'relationship-manager'], action: 'suggest-review-approve', owner: 'Intelligence Product' }),
  analytics: domain({ label: 'تحلیل و داشبورد', surfaces: ['/', '/dashboard', '/analytics'], permissions: ['analytics.read'], personas: ['executive', 'analyst'], action: 'monitor-and-drill-down' }),
  approvals: domain({ label: 'تأییدها', surfaces: ['/approvals'], permissions: ['approval.read', 'approval.write'], personas: ['executive', 'holding-admin', 'relationship-manager'], action: 'review-approve-reject' }),
  audit: domain({ label: 'ثبت رویداد و Audit', surfaces: ['/admin/audit', '/governance'], permissions: ['audit.read'], personas: ['holding-admin', 'analyst'], classification: 'Admin workflow', action: 'inspect-and-export', owner: 'Platform Governance', tests: ['contract', 'unit', 'integration'] }),
  auth: domain({ label: 'هویت و نشست', surfaces: ['/login', '/register', '/forgot-password', '/password-reset', '/verify-email', '/mfa', '/sessions'], permissions: ['auth.public', 'session.read', 'session.admin.revoke'], personas: ['standard-user', 'holding-admin'], action: 'authenticate-and-recover', owner: 'Identity and Security', tests: ['contract', 'unit', 'integration', 'browser'] }),
  authorization: domain({ label: 'مجوز و دسترسی', surfaces: ['/authorization', '/admin/permissions', '/admin/roles'], permissions: ['authorization.read', 'authorization.write', 'enterprise.admin'], personas: ['holding-admin', 'subsidiary-admin'], classification: 'Admin workflow', action: 'define-and-audit-access', owner: 'Platform Governance', tests: ['contract', 'unit', 'integration', 'browser'] }),
  commitments: domain({ label: 'تعهدات و پیگیری', surfaces: ['/today', '/commitments', '/commitments/[id]'], permissions: ['commitment.read', 'commitment.write'], personas: ['relationship-manager', 'project-manager', 'executive'], action: 'track-and-close' }),
  'core-domain': domain({ label: 'دامنه‌ی اصلی و معرفی', surfaces: ['/organizations/[id]', '/people/[id]', '/relationships', '/referrals'], permissions: ['org.read', 'person.read', 'relationship.read', 'relationship.write'], personas: ['relationship-manager', 'executive'], action: 'link-and-introduce' }),
  'data-lifecycle': domain({ label: 'چرخه عمر داده', surfaces: ['/data-lifecycle', '/privacy', '/admin/retention'], permissions: ['data.lifecycle_status', 'privacy.read', 'privacy.manage'], personas: ['holding-admin', 'standard-user'], classification: 'Admin workflow', action: 'request-review-enforce', owner: 'Privacy and Governance' }),
  'custom-fields': domain({ label: 'فیلدهای سفارشی', surfaces: ['/admin/custom-fields', '/data-management'], permissions: ['admin.custom_fields', 'entity.read', 'entity.write'], personas: ['holding-admin', 'analyst'], classification: 'Admin workflow', action: 'define-and-populate', owner: 'Data Operations' }),
  data: domain({ label: 'مدیریت و کیفیت داده', surfaces: ['/data-management', '/data-management/import', '/data-management/quality', '/data-quality'], permissions: ['data.import', 'data.quality.read', 'data.quality.write'], personas: ['analyst', 'holding-admin', 'relationship-manager'], action: 'import-triage-resolve', owner: 'Data Operations', tests: ['contract', 'unit', 'integration', 'browser'] }),
  documents: domain({ label: 'اسناد و دانش', surfaces: ['/documents', '/knowledge'], permissions: ['document.read', 'document.write'], personas: ['relationship-manager', 'project-manager', 'analyst'], action: 'upload-review-link' }),
  enterprise: domain({ label: 'حاکمیت Enterprise', surfaces: ['/enterprise', '/governance'], permissions: ['enterprise.read', 'enterprise.security'], personas: ['holding-admin', 'executive'], classification: 'Admin workflow', action: 'monitor-and-remediate', owner: 'Platform Governance' }),
  health: domain({ label: 'سلامت سرویس', surfaces: ['/health'], permissions: ['health.read', 'metrics.read'], personas: ['platform-admin', 'holding-admin'], classification: 'Admin workflow', action: 'inspect-runtime', owner: 'Platform Engineering', tests: ['contract', 'integration'] }),
  integrations: domain({ label: 'یکپارچه‌سازی', surfaces: ['/integrations', '/admin/integrations'], permissions: ['integration.read', 'integration.write'], personas: ['holding-admin', 'analyst'], classification: 'Admin workflow', action: 'connect-sync-retry-revoke', owner: 'Integration Operations', tests: ['contract', 'unit', 'integration', 'browser'] }),
  intelligence: domain({ label: 'هوشمندی رابطه', surfaces: ['/intelligence', '/relationships/[id]', '/network'], permissions: ['relationship.read', 'network.read', 'scoring.read', 'scoring.write'], personas: ['executive', 'relationship-manager', 'analyst'], action: 'explain-prioritize-act' }),
  interactions: domain({ label: 'تعاملات', surfaces: ['/interactions', '/interactions/[id]', '/today'], permissions: ['interaction.read', 'interaction.write'], personas: ['relationship-manager', 'executive'], action: 'capture-and-contextualize' }),
  meetings: domain({ label: 'جلسات و Follow-up', surfaces: ['/meetings', '/meetings/[id]', '/calendar'], permissions: ['meeting.read', 'meeting.write'], personas: ['relationship-manager', 'executive', 'project-manager'], action: 'prepare-capture-finalize' }),
  metrics: domain({ label: 'سنجه‌ها', surfaces: ['/metrics', '/monitoring'], permissions: ['metrics.read'], personas: ['platform-admin', 'holding-admin'], classification: 'Admin workflow', action: 'inspect-and-alert', owner: 'Platform Engineering', tests: ['contract', 'integration'] }),
  network: domain({ label: 'شبکه‌ی رابطه', surfaces: ['/network', '/relationships/[id]'], permissions: ['network.read', 'relationship.read', 'relationship.write'], personas: ['executive', 'relationship-manager', 'analyst'], action: 'discover-connect-act' }),
  notes: domain({ label: 'یادداشت‌ها', surfaces: ['/notes', '/organizations/[id]', '/people/[id]', '/relationships/[id]'], permissions: ['entity.read', 'entity.write'], personas: ['relationship-manager', 'executive', 'project-manager'], action: 'capture-link-retrieve' }),
  notifications: domain({ label: 'اعلان‌ها', surfaces: ['/notifications', '/today'], permissions: ['entity.read'], personas: ['standard-user', 'relationship-manager', 'executive'], action: 'triage-and-open' }),
  observability: domain({ label: 'مشاهده‌پذیری', surfaces: ['/observability', '/monitoring'], permissions: ['metrics.read'], personas: ['platform-admin', 'holding-admin'], classification: 'Admin workflow', action: 'inspect-and-remediate', owner: 'Platform Engineering', tests: ['contract', 'integration'] }),
  opportunities: domain({ label: 'فرصت‌ها', surfaces: ['/opportunities', '/opportunities/[id]'], permissions: ['opportunity.read', 'opportunity.write'], personas: ['relationship-manager', 'executive'], action: 'qualify-progress-close' }),
  organizations: domain({ label: 'سازمان‌ها', surfaces: ['/organizations', '/organizations/[id]'], permissions: ['org.read', 'org.write'], personas: ['relationship-manager', 'executive', 'analyst'], action: 'manage-and-orchestrate' }),
  people: domain({ label: 'اشخاص', surfaces: ['/people', '/people/[id]'], permissions: ['person.read', 'person.write'], personas: ['relationship-manager', 'executive', 'analyst'], action: 'manage-and-connect' }),
  privacy: domain({ label: 'حریم خصوصی', surfaces: ['/privacy'], permissions: ['privacy.read', 'privacy.manage'], personas: ['standard-user', 'holding-admin'], classification: 'Admin workflow', action: 'request-and-track', owner: 'Privacy and Governance' }),
  projects: domain({ label: 'پروژه‌ها', surfaces: ['/projects', '/projects/[id]'], permissions: ['project.read', 'project.write'], personas: ['project-manager', 'relationship-manager', 'executive'], action: 'plan-execute-review' }),
  recommendations: domain({ label: 'پیشنهادها', surfaces: ['/recommendations', '/recommendations/[id]', '/intelligence'], permissions: ['recommendation.read', 'recommendation.write'], personas: ['executive', 'relationship-manager', 'analyst'], action: 'review-apply-dismiss' }),
  relationships: domain({ label: 'روابط', surfaces: ['/relationships', '/relationships/[id]', '/network'], permissions: ['relationship.read', 'relationship.write'], personas: ['relationship-manager', 'executive', 'analyst'], action: 'assess-nurture-introduce' }),
  reports: domain({ label: 'گزارش‌ها و خروجی', surfaces: ['/reports', '/reports/export', '/analytics'], permissions: ['report.read', 'report.export'], personas: ['executive', 'analyst'], action: 'filter-analyze-export' }),
  requirements: domain({ label: 'نیازمندی و Matching', surfaces: ['/requirements', '/projects/[id]'], permissions: ['project.read', 'project.write'], personas: ['project-manager', 'analyst', 'executive'], action: 'define-match-prioritize' }),
  scoring: domain({ label: 'امتیازدهی', surfaces: ['/admin/scoring', '/intelligence', '/relationships/[id]'], permissions: ['scoring.read', 'scoring.write'], personas: ['analyst', 'executive', 'holding-admin'], classification: 'Admin workflow', action: 'calibrate-explain-recalculate', owner: 'Intelligence Product' }),
  search: domain({ label: 'جستجوی سراسری', surfaces: ['/search', '/today'], permissions: ['search.read'], personas: ['standard-user', 'relationship-manager', 'executive'], action: 'find-and-open' }),
  scores: domain({ label: 'امتیاز رابطه و مدل‌های scoring', surfaces: ['/intelligence', '/relationships/[id]', '/admin/scoring'], permissions: ['scoring.read', 'scoring.write'], personas: ['executive', 'relationship-manager', 'analyst', 'holding-admin'], action: 'explain-recalculate-calibrate', owner: 'Intelligence Product', tests: ['contract', 'unit', 'integration', 'browser'] }),
  security: domain({ label: 'امنیت', surfaces: ['/security', '/security-events', '/governance'], permissions: ['security.read', 'enterprise.security'], personas: ['holding-admin', 'platform-admin'], classification: 'Admin workflow', action: 'inspect-protect-remediate', owner: 'Identity and Security' }),
  sessions: domain({ label: 'نشست‌ها', surfaces: ['/sessions', '/admin/sessions'], permissions: ['session.read', 'session.admin.revoke'], personas: ['standard-user', 'holding-admin'], classification: 'Admin workflow', action: 'inspect-and-revoke', owner: 'Identity and Security' }),
  tags: domain({ label: 'برچسب‌ها', surfaces: ['/admin/tags', '/organizations/[id]', '/people/[id]'], permissions: ['tag.read', 'tag.write'], personas: ['analyst', 'relationship-manager', 'holding-admin'], action: 'classify-and-filter' }),
  users: domain({ label: 'کاربران', surfaces: ['/admin/users', '/settings'], permissions: ['user.read', 'user.write', 'enterprise.admin'], personas: ['holding-admin', 'subsidiary-admin'], classification: 'Admin workflow', action: 'manage-and-scope', owner: 'Identity and Security' }),
  workflows: domain({ label: 'Workflow و اتوماسیون', surfaces: ['/workflows', '/approvals', '/today'], permissions: ['workflow.read', 'workflow.write'], personas: ['holding-admin', 'relationship-manager', 'analyst'], action: 'define-run-audit', owner: 'Platform Operations', tests: ['contract', 'unit', 'integration', 'browser'] }),
};

function domainKeyFor(base, route, source) {
  if (!base && source?.includes('/custom-fields/')) return 'custom-fields';
  if (!base && source?.includes('/tags/')) return 'tags';
  const first = (base || route.replace(/^\//, '')).split('/')[0];
  return first || 'api';
}

function catalogFor(base, route, source) {
  const key = domainKeyFor(base, route, source);
  return [domainCatalog[key], key];
}

function endpointOverrides({ source, route }) {
  const publicAuthRoutes = [
    '/auth/oidc/:provider/authorize', '/auth/oidc/:provider/callback', '/auth/oidc/complete',
    '/auth/register', '/auth/login', '/auth/refresh', '/auth/logout',
    '/auth/password-reset/request', '/auth/password-reset/confirm', '/auth/email/verify',
  ];
  if (source.endsWith('/auth/auth.controller.ts') && publicAuthRoutes.includes(route)) {
    return {
      permission: 'public authentication flow',
      permissionSource: 'main.ts publicPrefixes + AuthController public route contract',
      scope: 'public auth/register/reset/session-token scope',
      access: 'public',
    };
  }
  if (source.endsWith('/common/mfa/mfa.controller.ts')) {
    return {
      permission: 'authenticated session',
      permissionSource: 'AuthGuard on MfaController',
      scope: 'current authenticated session + MFA enrollment state',
      access: 'authenticated',
    };
  }
  if (source.endsWith('/auth/auth.controller.ts')) {
    return {
      permission: 'authenticated session',
      permissionSource: 'AuthGuard on AuthController route exception',
      scope: 'current authenticated session',
      access: 'authenticated',
    };
  }
  if (source.endsWith('/integrations/integration-webhook.controller.ts')) {
    return {
      classification: 'Integration-only',
      productSurfaces: ['Provider webhook / integration runtime'],
      consumerSurface: 'External provider webhook adapter',
      productAction: 'verify-ingest-deduplicate',
      permission: 'webhook signature and replay protection',
      permissionSource: 'WebhookSignatureGuard',
      access: 'signed-integration',
      scope: 'provider + signature + replay-window + event-id policy',
    };
  }
  if (source.endsWith('/health/health.controller.ts')) {
    return {
      classification: 'API-only',
      productSurfaces: ['Container/orchestrator health probe', '/health'],
      consumerSurface: 'Runtime probe and Health screen',
      productAction: 'probe-runtime-readiness',
      permission: 'internal health probe policy',
      permissionSource: 'HealthController has no user permission; deployment/runtime contract',
      access: 'internal',
      scope: 'deployment/runtime probe policy',
    };
  }
  if (source.endsWith('/metrics.controller.ts') && route === '/metrics') {
    return {
      classification: 'API-only',
      productSurfaces: ['Prometheus scrape endpoint'],
      consumerSurface: 'Prometheus/internal monitoring',
      productAction: 'scrape-runtime-metrics',
      permission: 'internal metrics CIDR policy',
      permissionSource: 'InternalMetricsGuard',
      access: 'internal',
      scope: 'internal metrics network policy',
    };
  }
  if (source.endsWith('/analytics/analytics.controller.ts') && route === '/analytics/events') {
    return {
      classification: 'API-only',
      productSurfaces: ['Product telemetry instrumentation'],
      consumerSurface: 'Web/Mobile telemetry client',
      productAction: 'record-product-event',
    };
  }
  if (source.endsWith('/commitments/commitments.controller.ts') && route === '/commitments/follow-up/sweep-overdue') {
    return {
      classification: 'Background job',
      consumerSurface: 'Scheduler/worker and Today follow-up queue',
      productAction: 'sweep-overdue-follow-ups',
    };
  }
  return {};
}

function endpointSlug(method, route) {
  return `${method}-${route === '/' ? 'root' : route.slice(1)}`
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function extractControllers() {
  const files = walk(apiRoot).filter((file) => file.endsWith('.controller.ts')).sort();
  const endpoints = [];
  for (const file of files) {
    const text = read(file);
    const controller = text.match(/@Controller\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/)?.[1] ?? '';
    const classMatch = text.match(/export\s+class\s+([A-Za-z0-9_]+)/);
    const className = classMatch?.[1] ?? path.basename(file, '.ts');
    const classHeader = classMatch ? text.slice(0, classMatch.index) : '';
    const classPermission = classHeader.match(/@RequirePermission\(\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null;
    const classIsPublic = /@Public\b/.test(classHeader);
    const routePattern = /@(Get|Post|Put|Patch|Delete|All)\s*(?:\(\s*(['"`])([^'"`]*)\2\s*\))?/g;
    let match;
    while ((match = routePattern.exec(text))) {
      const method = match[1].toUpperCase();
      const segment = match[3] ?? '';
      const route = normalizeRoute(`${controller}/${segment}`);
      // Inspect only the decorator/method neighborhood, not the next method.
      const afterCurrentDecorator = text.slice(match.index + match[0].length);
      const nextRouteOffset = afterCurrentDecorator.search(/@(Get|Post|Put|Patch|Delete|All)\s*(?:\(|\b)/);
      const neighborhood = text.slice(match.index, nextRouteOffset === -1
        ? Math.min(text.length, match.index + 700)
        : match.index + match[0].length + nextRouteOffset);
      const methodPermission = neighborhood.match(/@RequirePermission\(\s*['"`]([^'"`]+)['"`]/)?.[1] ?? null;
      const methodIsPublic = /@Public\b/.test(neighborhood);
      const sourceFile = relative(file);
      const [catalog, domainKey] = catalogFor(controller, route, sourceFile);
      if (!catalog) {
        throw new Error(`No Phase 0 domain catalog entry for ${domainKey}: ${sourceFile} ${method} ${route}`);
      }
      const override = endpointOverrides({ source: sourceFile, route });
      const isPublic = methodIsPublic || classIsPublic;
      const permission = override.permission || methodPermission || classPermission || (isPublic ? 'public' : catalog.permissions[0]);
      const handler = neighborhood
        .replace(/@\w+(?:\([^)]*\))?/g, '')
        .match(/(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/)?.[1] ?? 'unknown-handler';
      const classification = override.classification || catalog.classification;
      const productSurfaces = override.productSurfaces || catalog.surfaces;
      const testPlan = catalog.testPlan;
      const testIds = testPlan.map((kind) => `phase0.endpoint.${endpointSlug(method, route)}.${kind}`);
      endpoints.push({
        key: `${method} ${route}`,
        method,
        route,
        apiRoute: `/api/v1${route === '/' ? '' : route}`,
        controllerBase: controller || '/',
        controller: className,
        handler,
        domain: domainKey,
        source: sourceFile,
        sourceLine: text.slice(0, match.index).split('\n').length,
        classification,
        consumerSurface: override.consumerSurface || productSurfaces.join(' | '),
        productSurfaces,
        action: `${method.toLowerCase()} ${handler}`,
        productAction: override.productAction || catalog.productAction,
        permission,
        permissionSource: override.permissionSource || (methodPermission ? 'RequirePermission decorator' : (classPermission ? 'class RequirePermission decorator' : (isPublic ? 'Public decorator' : 'Phase 0 domain policy'))),
        scope: override.scope || (isPublic ? 'public authentication/session scope' : catalog.scope),
        access: override.access || (isPublic ? 'public' : 'authenticated'),
        primaryPersona: catalog.personas[0],
        personas: catalog.personas,
        owner: catalog.owner,
        productOwner: catalog.productOwner,
        technicalOwner: catalog.technicalOwner,
        requiredStates: catalog.requiredStates,
        stateMatrix: catalog.stateMatrix,
        testPlan,
        testIds,
      });
    }
  }
  return { files, endpoints };
}

function webRouteInventory() {
  return walk(webRoot)
    .filter((file) => file.endsWith('page.tsx'))
    .map((file) => {
      const relativePage = path.relative(webRoot, file).replaceAll(path.sep, '/');
      const directory = path.dirname(relativePage).replaceAll(path.sep, '/');
      return {
        route: directory === '.' ? '/' : `/${directory}`,
        source: relative(file),
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

function mobileRouteInventory() {
  return walk(mobileRoot)
    .filter((file) => /\.(tsx|ts)$/.test(file))
    .map((file) => ({ source: relative(file) }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

function debtInventory() {
  const webAndMobile = [...walk(webRoot), ...walk(mobileRoot)].filter((file) => /\.(tsx|ts)$/.test(file));
  const findFiles = (pattern) => webAndMobile.filter((file) => pattern.test(read(file))).map(relative).sort();
  return {
    browserConfirmOrAlert: findFiles(/\b(?:window\.)?(?:confirm|alert)\s*\(/),
    genericWorkspaceConsumers: findFiles(/\b(?:CrudWorkspace|ResourceConsole|EntityWorkspace)\b/),
    technicalIdentifierReferences: findFiles(/\b(?:organizationId|personId|relationshipId|projectId|meetingId|ownerId|participantIds)\b/),
    note: 'این debtها در Phase 0 شفاف و قابل پیگیری شده‌اند؛ حذف کامل آن‌ها در Phase 1 تا Phase 4 انجام می‌شود و در این phase وانمود نمی‌شود که قبلاً حل شده‌اند.',
  };
}

const expectedWebFamilies = [
  '/', '/today', '/organizations', '/people', '/relationships', '/interactions', '/meetings', '/actions',
  '/commitments', '/projects', '/opportunities', '/requirements', '/network', '/search', '/notifications',
  '/workflows', '/reports', '/data-management', '/data-quality', '/documents', '/notes', '/admin', '/authorization',
  '/approvals', '/integrations', '/privacy', '/security', '/sessions', '/health', '/monitoring', '/analytics',
  '/metrics', '/observability',
];

function compareLegacyApiContract(endpoints) {
  const baselinePath = path.join(repoRoot, 'apps', 'API_CONTRACT.json');
  if (!fs.existsSync(baselinePath)) {
    return { path: 'apps/API_CONTRACT.json', present: false, baselineEndpointCount: null, missingFromCurrent: [], addedSinceBaseline: [] };
  }
  const baseline = JSON.parse(read(baselinePath));
  const keyOf = (entry) => `${String(entry.method).toUpperCase()} ${normalizeRoute(entry.route)}`;
  const baselineKeys = [...new Set(baseline.map(keyOf))].sort();
  const currentKeys = new Set(endpoints.map((entry) => entry.key));
  return {
    path: 'apps/API_CONTRACT.json',
    present: true,
    baselineEndpointCount: baselineKeys.length,
    missingFromCurrent: baselineKeys.filter((key) => !currentKeys.has(key)),
    addedSinceBaseline: [...currentKeys].filter((key) => !baselineKeys.includes(key)).sort(),
  };
}

function buildContract() {
  const { files: controllerFiles, endpoints } = extractControllers();
  const legacyApiContract = compareLegacyApiContract(endpoints);
  const webRoutes = webRouteInventory();
  const mobileRoutes = mobileRouteInventory();
  const protectedPath = path.join(repoRoot, 'network-preview.html');
  const protectedReference = {
    path: 'network-preview.html',
    tracked: false,
    expectedSha256: '25ab37bd85221cde540d47e9422af2bc59ce3de536be4cbc4a1f9a96aebeef78',
    policy: 'اگر فایل در workspace وجود دارد، hash آن باید با expectedSha256 یکسان باشد؛ نبودن آن در cloneهای معمولی مجاز است چون protected/untracked است.',
  };
  const routeSet = new Set(webRoutes.map((entry) => entry.route));
  const webGaps = expectedWebFamilies.filter((family) => ![...routeSet].some((route) => route === family || route.startsWith(`${family}/`)));
  const catalogDomains = Object.fromEntries(Object.entries(domainCatalog).sort(([a], [b]) => a.localeCompare(b)));
  const observedDomains = [...new Set(endpoints.map((endpoint) => endpoint.domain))].sort();
  const missingCatalogDomains = observedDomains.filter((key) => !catalogDomains[key]);

  return {
    contract: {
      name: 'SRIP Product Contract — Phase 0',
      version: '2026.08.30',
      sourceOfTruth: 'docs/PRODUCT_UPGRADE_PLAN_2026.md',
      executionChecklist: 'docs/PRODUCT_UPGRADE_EXECUTION_CHECKLIST_2026.md',
      generatedBy: 'scripts/verify-product-phase0.mjs',
      noDeletionPolicy: true,
      primaryLanguage: 'fa-IR',
      direction: 'rtl',
      productPositioning: 'Relationship Operating System for holding companies, subsidiaries and enterprise relationship teams',
    },
    policies: {
      protectedFiles: [protectedReference],
      technicalIdentifiers: {
        neverRequestFromOrdinaryUser: ['UUID', 'Prisma ID', 'raw database key', 'JSON mutation payload', 'internal permission key'],
        allowedOnlyFor: ['platform-admin', 'debug tooling', 'API integration contract'],
        replacement: 'EntityPicker, EntityMultiPicker, semantic builders, labels and deep links',
      },
      mutationStates: states,
      aiWritePolicy: ['preview', 'evidence', 'confidence', 'permission', 'human approval', 'audit'],
      requiredTestKinds: testKinds,
      namingConvention: {
        endpoint: 'UPPERCASE HTTP method + normalized /route with :param placeholders',
        component: 'PascalCase for shared UI and kebab-case file names for route components',
        event: 'lowercase domain.entity_action with dot-separated namespace',
        test: 'phase0.endpoint.<method-route-slug>.<contract|unit|integration|browser>',
      },
      labelPolicy: {
        primaryLanguage: 'fa-IR',
        technicalLabels: 'Only in admin, debug, API integration and audit contexts; ordinary users receive semantic labels and EntityPicker/deep links.',
        rawJson: 'Never request or expose as the ordinary mutation surface; use typed forms, preview and evidence.',
        uuid: 'Never request UUID/Prisma ID from an ordinary user; resolve via picker, search or deep link.',
      },
      visualBaseline: {
        reference: 'network-preview.html',
        hashAlgorithm: 'sha256',
        viewports: [1440, 1280, 1024, 768, 'mobile'],
        rule: 'Network route changes require screenshot comparison; the reference file itself is immutable.',
        referenceTokens: {
          canvas: { bodyBackground: '#050914', cardBackground: '#080f20', graphBackground: '#020713', bodyPadding: '24px', mobileBodyPadding: '10px' },
          palette: { text: '#f5f7ff', mutedText: '#8993aa', border: '#18233c', active: '#416de8', relationshipStrong: '#4b7cff', relationshipVeryStrong: '#20d1c3', relationshipModerate: '#9a6bff', relationshipWeak: '#f0ae38', risk: '#f04455' },
          typography: { family: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif', title: '19px/1.1', body: '11px', label: '12px/500', sublabel: '10px' },
          layout: { cardMaxWidth: '890px', cardHeight: '658px', headerHeight: '78px', graphHeight: '518px', footerHeight: '61px', graphViewBox: '880x510' },
          spacing: { cardHeaderHorizontal: '24px', graphToolInset: '12px/17px', legendInset: '12px/9px', controlGap: '8-9px' },
          radius: { card: '10px', controls: '8px', overlays: '9px' },
          density: 'dense network canvas with compact 10-12px labels and 34-40px controls',
        },
      },
    },
    taxonomy: { statuses: taxonomy, events: eventTaxonomy, terms: uiTerms, personas: personaCatalog, workflowClassifications: endpointClassifications },
    repositoryInventory: {
      controllerFiles: controllerFiles.map(relative),
      controllerCount: controllerFiles.length,
      endpointCount: endpoints.length,
      webPageCount: webRoutes.length,
      mobileSourceRouteFileCount: mobileRoutes.length,
      prismaModelCount: read(path.join(repoRoot, 'apps', 'api', 'prisma', 'schema.prisma')).match(/^model\s+/gm)?.length ?? null,
      legacyApiContract: legacyApiContract,
    },
    domainCatalog: catalogDomains,
    endpointMatrix: endpoints.sort((a, b) => a.key.localeCompare(b.key)),
    webRouteInventory: webRoutes,
    mobileRouteInventory: mobileRoutes,
    acceptance: {
      expectedWebFamilies,
      webRouteGaps: webGaps,
      observedDomains,
      missingCatalogDomains,
      endpointClassifications,
      observedClassifications: [...new Set(endpoints.map((endpoint) => endpoint.classification))].sort(),
      everyEndpointHasProductOwner: endpoints.every((endpoint) => Boolean(endpoint.productOwner)),
      everyEndpointHasPrimaryPersona: endpoints.every((endpoint) => Boolean(endpoint.primaryPersona)),
      everyEndpointHasTechnicalOwner: endpoints.every((endpoint) => Boolean(endpoint.technicalOwner)),
      everyEndpointHasSurface: endpoints.every((endpoint) => endpoint.productSurfaces.length > 0 && Boolean(endpoint.consumerSurface)),
      everyEndpointHasConsumerOrDecision: endpoints.every((endpoint) => Boolean(endpoint.consumerSurface) && Boolean(endpoint.classification)),
      everyEndpointHasAction: endpoints.every((endpoint) => Boolean(endpoint.action) && Boolean(endpoint.productAction)),
      everyEndpointHasPermissionPolicy: endpoints.every((endpoint) => Boolean(endpoint.permission) && Boolean(endpoint.permissionSource)),
      everyEndpointHasScopePolicy: endpoints.every((endpoint) => Boolean(endpoint.scope)),
      everyEndpointHasClassification: endpoints.every((endpoint) => endpointClassifications.includes(endpoint.classification)),
      everyEndpointHasStateMatrix: endpoints.every((endpoint) => states.every((state) => endpoint.requiredStates.includes(state) && endpoint.stateMatrix[state]?.required)),
      everyEndpointHasTestPlan: endpoints.every((endpoint) => testKinds.some((kind) => endpoint.testPlan.includes(kind)) && endpoint.testIds.length > 0),
      noLegacyEndpointDropped: legacyApiContract.missingFromCurrent.length === 0,
      endpointKeysUnique: new Set(endpoints.map((endpoint) => endpoint.key)).size === endpoints.length,
      testIdsUnique: new Set(endpoints.flatMap((endpoint) => endpoint.testIds)).size === endpoints.flatMap((endpoint) => endpoint.testIds).length,
    },
    debtRegister: debtInventory(),
  };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

let contract;
try {
  contract = buildContract();
} catch (error) {
  console.error(`PHASE0 PRODUCT CONTRACT ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const invariantFailures = [];
if (contract.acceptance.webRouteGaps.length) invariantFailures.push(`missing Web route families: ${contract.acceptance.webRouteGaps.join(', ')}`);
if (contract.acceptance.missingCatalogDomains.length) invariantFailures.push(`missing domain catalog entries: ${contract.acceptance.missingCatalogDomains.join(', ')}`);
if (!contract.acceptance.everyEndpointHasProductOwner) invariantFailures.push('an endpoint has no product owner');
if (!contract.acceptance.everyEndpointHasPrimaryPersona) invariantFailures.push('an endpoint has no primary persona');
if (!contract.acceptance.everyEndpointHasTechnicalOwner) invariantFailures.push('an endpoint has no technical owner');
if (!contract.acceptance.everyEndpointHasSurface) invariantFailures.push('an endpoint has no consumer surface');
if (!contract.acceptance.everyEndpointHasConsumerOrDecision) invariantFailures.push('an endpoint has neither a consumer surface nor an explicit classification decision');
if (!contract.acceptance.everyEndpointHasAction) invariantFailures.push('an endpoint has no action mapping');
if (!contract.acceptance.everyEndpointHasPermissionPolicy) invariantFailures.push('an endpoint has no permission policy');
if (!contract.acceptance.everyEndpointHasScopePolicy) invariantFailures.push('an endpoint has no scope policy');
if (!contract.acceptance.everyEndpointHasClassification) invariantFailures.push('an endpoint has an invalid workflow classification');
if (!contract.acceptance.everyEndpointHasStateMatrix) invariantFailures.push('an endpoint has incomplete state matrix');
if (!contract.acceptance.everyEndpointHasTestPlan) invariantFailures.push('an endpoint has no test plan');
if (!contract.acceptance.noLegacyEndpointDropped) invariantFailures.push(`legacy endpoint(s) missing from current source inventory: ${contract.repositoryInventory.legacyApiContract.missingFromCurrent.join(', ')}`);
if (!contract.acceptance.endpointKeysUnique) invariantFailures.push('duplicate endpoint keys discovered');
if (!contract.acceptance.testIdsUnique) invariantFailures.push('duplicate endpoint test IDs discovered');
if (contract.repositoryInventory.endpointCount === 0) invariantFailures.push('no API endpoints were discovered');
if (contract.repositoryInventory.controllerCount === 0) invariantFailures.push('no controllers were discovered');

const protectedPath = path.join(repoRoot, 'network-preview.html');
if (fs.existsSync(protectedPath) && contract.policies.protectedFiles[0].expectedSha256 !== sha256(protectedPath)) {
  invariantFailures.push('network-preview.html hash differs from the protected reference');
}

if (checkOnly) {
  if (!fs.existsSync(outputPath)) invariantFailures.push(`missing generated contract: ${relative(outputPath)}`);
  else if (read(outputPath) !== stableJson(contract)) invariantFailures.push(`${relative(outputPath)} is stale; run the generator and review the diff`);
} else {
  fs.writeFileSync(outputPath, stableJson(contract));
}

if (invariantFailures.length) {
  console.error('PHASE0_PRODUCT_CONTRACT_CHECK=FAIL');
  for (const failure of invariantFailures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PHASE0_PRODUCT_CONTRACT_CHECK=PASS controllers=${contract.repositoryInventory.controllerCount} endpoints=${contract.repositoryInventory.endpointCount} webPages=${contract.repositoryInventory.webPageCount} mobileFiles=${contract.repositoryInventory.mobileSourceRouteFileCount}`);
console.log(`PHASE0_PRODUCT_CONTRACT_OUTPUT=${relative(outputPath)}`);
const protectedReferenceState = !fs.existsSync(protectedPath)
  ? 'ABSENT_ALLOWED_UNTRACKED'
  : (sha256(protectedPath) === contract.policies.protectedFiles[0].expectedSha256 ? 'PRESENT_AND_HASHED' : 'HASH_MISMATCH');
console.log(`PHASE0_PROTECTED_REFERENCE=${protectedReferenceState}`);
console.log(`PHASE0_DEBT_REGISTER confirmOrAlert=${contract.debtRegister.browserConfirmOrAlert.length} genericWorkspace=${contract.debtRegister.genericWorkspaceConsumers.length} technicalIdentifierFiles=${contract.debtRegister.technicalIdentifierReferences.length}`);
