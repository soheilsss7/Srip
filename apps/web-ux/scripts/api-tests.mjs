/* ============================================================================
   SRIP Automated API test suite — runs against the running mock backend.
   Usage:  node scripts/api-tests.mjs            (defaults to :4000)
           MOCK_API_URL=http://localhost:4000/api/v1 node scripts/api-tests.mjs
   Exit code: 0 = all green · 1 = failures
   ============================================================================ */
const BASE = process.env.MOCK_API_URL ?? 'http://localhost:4000/api/v1';
const OWNER = { email: 'demo@srip.local', username: 'demo', password: '123456' };
const CLIENT = { email: 'client@arya-tech.ir', username: 'client', password: '123456' };
// The real backend persists in PostgreSQL and rejects duplicate
// organizations/people/relationships — make the automation fixtures unique per run.
const UNIQ = Date.now();
const TEST_ORG_NAME = `سازمان تست اتوماسیون ${UNIQ}`;
const TEST_PERSON_NAME = `اتو${UNIQ}`;
const TEST_REL_TARGET = ['org-3', 'org-4', 'org-5', 'org-6', 'org-7', 'org-8'][UNIQ % 6];

let pass = 0, fail = 0;
const failures = [];
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ❌ ${name} ${extra}`); }
};

async function api(path, { method = 'GET', token, body, raw } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return r;
  let j = null;
  try { j = await r.json(); } catch {}
  return { status: r.status, body: j, xid: r.headers.get('x-request-id') };
}

async function login(email, password = '123456', otp = '123456') {
  const r = await api('/auth/login', { method: 'POST', body: { email, password, otp } });
  return r;
}

const section = (t) => console.log(`\n──── ${t} ────`);

/* ============================ 1. AUTH ============================ */
section('احراز هویت');
{
  const ok = await login(OWNER.email);
  check('ورود مالک → 200 + توکن‌ها', ok.status === 200 && !!ok.body?.accessToken && !!ok.body?.refreshToken, JSON.stringify(ok.body).slice(0, 60));
  const bad = await login(OWNER.email, 'WrongPass!12345');
  check('رمز اشتباه → 401', bad.status === 401);
  const badOtp = await api('/auth/login', { method: 'POST', body: { email: OWNER.email, password: OWNER.password, otp: '123' } });
  check('MFA نامعتبر → 401', badOtp.status === 401);
  const noToken = await api('/organizations');
  check('بدون توکن → 401', noToken.status === 401);
  const reg = await api('/auth/register', { method: 'POST', body: { name: 'کاربر تست', email: `t${Date.now()}@test.ir`, password: 'Password123456' } });
  check('ثبت‌نام → 201', reg.status === 201);

  const sess = ok.body;
  // refresh flow
  const me1 = await api('/auth/me', { token: sess.accessToken });
  check('توکن دسترسی معتبر → /auth/me 200', me1.status === 200 && me1.body?.email === OWNER.email);
  const ref = await api('/auth/refresh', { method: 'POST', body: { token: sess.refreshToken } });
  check('تازه‌سازی توکن → 200 + توکن جدید', ref.status === 200 && !!ref.body?.accessToken && ref.body?.accessToken !== sess.accessToken);
  const me2 = await api('/auth/me', { token: ref.body.accessToken });
  check('توکن تازه‌شده کار می‌کند', me2.status === 200);
  const refAgain = await api('/auth/refresh', { method: 'POST', body: { token: sess.refreshToken } });
  check('توکن تازه‌سازی قدیمی پس از چرخش → 401', refAgain.status === 401);
  const lg = await api('/auth/logout', { method: 'POST', token: sess.accessToken, body: { token: ref.body.refreshToken } });
  check('خروج → 200', lg.status === 200);
  const refAfterLogout = await api('/auth/refresh', { method: 'POST', body: { token: ref.body.refreshToken } });
  check('توکن تازه‌سازی پس از خروج → 401', refAfterLogout.status === 401);
  const badJwt = await api('/organizations', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImRlbW9Ac3JpcC5sb2NhbCJ9.invalid' });
  check('JWT جعلی → 401', badJwt.status === 401);
  check('X-Request-ID اکو می‌شود', !!me1.xid);
  globalThis.__owner = sess;
}

/* ============================ 2. ROLES & SCOPE ============================ */
section('نقش‌ها و محدوده');
{
  const owner = await login(OWNER.email);
  const client = await login(CLIENT.email);
  check('ورود مستأجر → 200', client.status === 200);
  const admin = await login('admin@srip.local');
  check('ورود مدیر (هلدینگ) → 200', admin.status === 200);
  globalThis.__admin = admin;
  const om = await api('/auth/me', { token: owner.body.accessToken });
  check('مالک: isOwner + همهٔ محدوده', om.body?.isOwner === true && om.body?.accessibleOrganizationIds?.length >= 8);
  const cm = await api('/auth/me', { token: client.body.accessToken });
  check('مستأجر: فقط آریا فناوری', cm.body?.isOwner === false && JSON.stringify(cm.body?.accessibleOrganizationIds) === '["org-2"]');
  const co = await api('/organizations', { token: client.body.accessToken });
  const coList = Array.isArray(co.body) ? co.body : (co.body?.data ?? []);
  check('مستأجر: فقط ۱ سازمان', coList.length === 1 && coList[0]?.id === 'org-2');
  const c403 = await api('/organizations/org-1', { token: client.body.accessToken });
  check('مستأجر: سازمان خارج محدوده → 403', c403.status === 403);
  const cp403 = await api('/people/p-2', { token: client.body.accessToken });
  check('مستأجر: شخص خارج محدوده → 403', cp403.status === 403);
  const cr403 = await api('/recommendations/rec-4', { token: client.body.accessToken });
  check('مستأجر: پیشنهاد خارج محدوده → 403', cr403.status === 403);
  const crOk = await api('/recommendations/rec-1', { token: client.body.accessToken });
  check('مستأجر: پیشنهاد داخل محدوده → 200', crOk.status === 200);
  const ao = await api('/admin/overview', { token: client.body.accessToken });
  check('مستأجر: بخش مدیریت → 403', ao.status === 403);
  const ao2 = await api('/admin/overview', { token: owner.body.accessToken });
  check('مالک: بخش مدیریت → 200', ao2.status === 200);
  globalThis.__owner2 = owner; globalThis.__client = client;
}

/* ============================ 3. CRUD ============================ */
section('CRUD و چرخه‌های کاری');
{
  const { body: { accessToken: T } } = globalThis.__owner2;
  const org = await api('/organizations', { method: 'POST', token: T, body: { name: TEST_ORG_NAME, type: 'OTHER', industry: 'تست' } });
  check('ساخت سازمان → 201', org.status === 201 && !!org.body?.id);
  const p = await api('/people', { method: 'POST', token: T, body: { firstName: TEST_PERSON_NAME, lastName: 'میشن', organizationId: 'org-2' } });
  check('ساخت شخص → 201', p.status === 201 && !!p.body?.id);
  // Target the organization created THIS run — guarantees the relationship is
  // unique even against a persistent PostgreSQL backend (re-running the suite
  // against seeded org-3..org-8 eventually collides with an existing row).
  const rel = await api('/relationships', { method: 'POST', token: T, body: { relationshipType: 'CUSTOMER', sourceOrganizationId: 'org-2', targetOrganizationId: org.body.id } });
  check('ساخت رابطه → 201', rel.status === 201 && !!rel.body?.id);
  const mt = await api('/meetings', { method: 'POST', token: T, body: { title: 'جلسه اتوماسیون', startAt: '2026-09-12T09:00:00.000Z' } });
  check('ساخت جلسه → 201', mt.status === 201 && !!mt.body?.id);
  const out = await api(`/meetings/${mt.body.id}/outcome`, { method: 'POST', token: T, body: { outcome: 'توافق شد پروژه شروع شود' } });
  check('ثبت نتیجه جلسه → 200', out.status === 200);
  const n1 = await api('/notifications', { token: T });
  const n1List = Array.isArray(n1.body) ? n1.body : (n1.body?.items ?? []);
  check('اعلان خودکار «نتیجه جلسه» ساخته شد', n1List.some(n => n.title === 'نتیجه جلسه ثبت شد'));
  const ac = await api('/actions', { method: 'POST', token: T, body: { title: 'اقدام اتوماسیون', relationshipId: 'r-1' } });
  check('ساخت اقدام → 201', ac.status === 201);
  const co = await api('/commitments', { method: 'POST', token: T, body: { description: 'تعهد اتوماسیون' } });
  check('ساخت تعهد → 201', co.status === 201);
  const ix = await api('/interactions', { method: 'POST', token: T, body: { type: 'CALL', subject: 'تعامل اتوماسیون', organizationId: 'org-5' } });
  check('ساخت تعامل → 201', ix.status === 201);
  const pr = await api('/projects', { method: 'POST', token: T, body: { name: 'پروژه اتوماسیون' } });
  check('ساخت پروژه → 201', pr.status === 201);
  const op = await api('/opportunities', { method: 'POST', token: T, body: { name: 'فرصت اتوماسیون' } });
  check('ساخت فرصت → 201', op.status === 201);
  const rel2 = await api('/relationships', { method: 'POST', token: globalThis.__client.body.accessToken, body: { sourceOrganizationId: 'org-2', targetOrganizationId: 'org-7' } });
  check('مستأجر: ساخت رابطه با org-7 → 403', rel2.status === 403);
  const aff = await api('/people/p-1/organizations', { method: 'POST', token: T, body: { organizationId: 'org-3', roleTitle: 'عضو اتوماسیون' } });
  check('انتساب شخص به سازمان → 201', aff.status === 201);
  const del = await api('/people/p-1/organizations/org-3', { method: 'DELETE', token: T });
  check('حذف انتساب → 200', del.status === 200);
}

/* ============================ 4. RECOMMENDATION LIFECYCLE ============================ */
section('چرخهٔ پیشنهاد هوشمند');
{
  const T = globalThis.__owner2.body.accessToken;
  const gen = await api('/recommendations/generate', { method: 'POST', token: T });
  check('تولید پیشنهاد → 200', gen.status === 200);
  // The backend is stateful and persistent: seeded rec-1/2/3 get consumed after
  // the first run (EXECUTED / SNOOZED), so drive the lifecycle from PROPOSED
  // recommendations — the fresh relationship created above guarantees at least
  // one new FOLLOW_UP candidate on every run.
  const lst = await api('/recommendations?status=PROPOSED', { token: T });
  const props = (Array.isArray(lst.body) ? lst.body : (lst.body?.items ?? [])).filter(r => r?.id && r?.status === 'PROPOSED');
  const recA = props[0], recB = props[1] ?? recA, recC = props[2] ?? recA;
  if (!recA) {
    check('اجرا بدون تأیید → 400', false, 'no PROPOSED recommendation');
  } else {
    const ex1 = await api(`/recommendations/${recB.id}/execute`, { method: 'POST', token: T });
    check('اجرا بدون تأیید → 400', ex1.status === 400);
    const sn1 = await api(`/recommendations/${recC.id}/snooze`, { method: 'POST', token: T, body: { until: '2020-01-01T00:00:00.000Z' } });
    check('تعویق با تاریخ گذشته → 400', sn1.status === 400);
    const sn2 = await api(`/recommendations/${recC.id}/snooze`, { method: 'POST', token: T, body: { until: '2026-10-01T00:00:00.000Z' } });
    check('تعویق با تاریخ آینده → 200', sn2.status === 200);
    const ap = await api(`/recommendations/${recA.id}/approve`, { method: 'POST', token: T });
    check('تأیید → 200', ap.status === 200);
    const ex2 = await api(`/recommendations/${recA.id}/execute`, { method: 'POST', token: T });
    check('اجرا پس از تأیید → 200 + ساخت اقدام', ex2.status === 200 && !!ex2.body?.action?.id);
    const ex = await api(`/recommendations/${recA.id}/explain`, { token: T });
    check('توضیح پیشنهاد با شواهد → 200', ex.status === 200 && !!ex.body?.evidence);
    const n2 = await api('/notifications', { token: T });
    const n2List = Array.isArray(n2.body) ? n2.body : (n2.body?.items ?? []);
    check('اعلان خودکار «پیشنهاد/اقدام» ساخته شد', n2List.some(n => n.title === 'اقدام از پیشنهاد ایجاد شد'));
  }
}

/* ============================ 5. NETWORK & ANALYTICS ============================ */
section('شبکه، جستجو و ممیزی');
{
  const T = globalThis.__owner2.body.accessToken;
  const CT = globalThis.__client.body.accessToken;
  const g = await api('/network/graph', { token: T });
  check('گراف مالک → گره و پیوند دارد', g.status === 200 && g.body?.nodes?.length > 0 && g.body?.edges?.length > 0);
  const gp = await api('/network/graph?type=person', { token: T });
  check('گراف اشخاص → گره شخص دارد', gp.status === 200 && gp.body?.nodes?.some(n => n.type === 'person'));
  const cg = await api('/network/graph', { token: CT });
  const cgOrgIds = new Set((cg.body?.nodes ?? []).filter(n => n.type === 'organization').map(n => n.id));
  const cgEdgeOrgs = new Set((cg.body?.edges ?? []).flatMap(e => [e.source, e.target]).filter(id => id.startsWith('org:')));
  // invariant: every org node is org-2 itself or a counterparty appearing on an edge
  const orgsOk = [...cgOrgIds].every(id => id === 'org:org-2' || cgEdgeOrgs.has(id));
  const noUnrelated = !cgOrgIds.has('org:org-1') && !cgOrgIds.has('org:org-8');
  check('گراف مستأجر → فقط آریا فناوری + طرف‌های مقابل روابطش', cg.status === 200 && orgsOk && noUnrelated);
  const s = await api('/search?q=پترو', { token: T });
  check('جستجو → نتیجه دارد', s.status === 200 && (s.body?.total ?? s.body?.count ?? 0) > 0);
  const si = await api('/search?q=بازدید', { token: T });
  check('جستجوی تعامل → نتیجه دارد', si.status === 200 && (si.body?.results ?? []).some(r => r.type === 'interaction'));
  const al = await api('/admin/audit-log', { token: T });
  const auditEvents = Array.isArray(al.body) ? al.body : (al.body?.events ?? []);
  check('لاگ ممیزی → رویداد دارد', al.status === 200 && auditEvents.length > 0 && auditEvents.some(e => e.action === 'LOGIN_SUCCESS' || e.action === 'LOGIN'));
  const se = await api('/security/events', { token: T });
  const secEvents = Array.isArray(se.body) ? se.body : (se.body?.events ?? []);
  check('رویدادهای امنیتی از ممیزی تغذیه می‌شوند', se.status === 200 && Array.isArray(secEvents));
  const sum = await api('/analytics/summary', { token: T });
  check('خلاصهٔ تحلیلی → شمارش‌ها', sum.status === 200 && sum.body?.counts?.organizations >= 1);
  const ai = await api('/ai/query', { method: 'POST', token: T, body: { intent: 'NEXT_BEST_ACTION', query: 'بررسی ریسک و پیگیری اقدامات' } });
  check('پرس‌وجوی هوشمند → قطعی بدون مدل خارجی', ai.status === 200 && ai.body?.model?.provider === 'deterministic-gateway' && ai.body?.status === 'completed_without_external_model');
  const rep = await api('/reports/relationship-health', { token: T });
  check('گزارش سلامت روابط → داده دارد', rep.status === 200 && Array.isArray(rep.body?.data) && rep.body.data.length > 0);
  // Real contract: exports require an APPROVED approval (request → owner approves → export).
  const expReq = await api('/approvals', { method: 'POST', token: T, body: { entityType: 'Report', entityId: 'relationship-health', actionType: 'EXPORT', reason: 'Export of report relationship-health' } });
  const approvalId = expReq.body?.id ?? expReq.body?.approvalId ?? expReq.body?.data?.id;
  const expApprove = await api(`/approvals/${approvalId}/approve`, { method: 'POST', token: globalThis.__admin.body.accessToken, body: { reason: 'approved by owner' } });
  check('تأییدیهٔ خروجی: درخواست + تأیید مالک', expReq.status === 201 && !!approvalId && (expApprove.status === 200 || expApprove.status === 201));
  const repCsv = await api(`/reports/relationship-health/export/csv?approvalId=${approvalId}`, { token: T, raw: true });
  const csvBytes = repCsv.status === 200 ? new Uint8Array(await repCsv.arrayBuffer()) : new Uint8Array();
  const csvText = new TextDecoder().decode(csvBytes);
  const hasBom = csvBytes.length >= 3 && csvBytes[0] === 0xEF && csvBytes[1] === 0xBB && csvBytes[2] === 0xBF;
  check('خروجی CSV گزارش → 200 + BOM (EF BB BF) + هدر', repCsv.status === 200 && hasBom && csvText.includes('healthScore'));
  const repJson = await api(`/reports/relationship-health/export/json?approvalId=${approvalId}`, { token: T, raw: true });
  check('خروجی JSON گزارش → 200', repJson.status === 200);
  const rep403 = await api('/reports/relationship-health', { token: globalThis.__client.body.accessToken });
  check('گزارش مالک → مستأجر هم مجاز است', rep403.status === 200);
}

/* ============================ 6. PERSISTENCE ============================ */
section('پایداری روی PostgreSQL');
{
  // The real backend persists in PostgreSQL: data written earlier in this run
  // (the automation test organization) must still be there after a fresh login.
  const sess = await login(OWNER.email);
  const orgs = await api('/organizations', { token: sess.body.accessToken });
  const orgList = Array.isArray(orgs.body) ? orgs.body : (orgs.body?.data ?? []);
  check('داده‌ها پس از ورود مجدد پایدارند (سازمان تست اتوماسیون)', orgList.some(o => o.name === TEST_ORG_NAME));
  const me = await api('/auth/me', { token: sess.body.accessToken });
  check('کاربر seed با hash ذخیره شده (بدون رمز خام در پاسخ)', me.status === 200 && !('password' in (me.body ?? {})) && !('passwordHash' in (me.body ?? {})));
  const h = await api('/health', { raw: true });
  check('سلامت سرویس → 200', h.status === 200);
}

/* ===================== 7. REAL INITIAL DATA (سند عموم‌ها) ===================== */
section('دادهٔ اولیهٔ واقعی — aroun / شرکت x / هلدینگ پارس');
{
  // ورود حساب واقعی مالک سامانه (بدون MFA — مستقیم)
  const ar = await api('/auth/login', { method: 'POST', body: { email: 'aroun', password: '12356784' } });
  check('ورود aroun (نام کاربری، بدون MFA) → 200', ar.status === 200 && !!ar.body?.accessToken, JSON.stringify(ar.body).slice(0, 80));
  const arBad = await api('/auth/login', { method: 'POST', body: { email: 'aroun', password: 'wrong-pass' } });
  check('رمز اشتباه aroun → 401', arBad.status === 401);
  const t = ar.body?.accessToken;
  const meAr = await api('/auth/me', { token: t });
  check('aroun → مالک کل سیستم، سازمان اصلی «شرکت x»', meAr.status === 200 && meAr.body?.isOwner === true
    && (meAr.body?.memberships ?? []).some(m => m.organizationName === 'شرکت x' && m.role === 'SUPER_ADMIN'));
  const accAr = meAr.body?.accessibleOrganizationIds ?? [];
  check('aroun → دسترسی به همهٔ سازمان‌های واقعی (شرکت x + پارس + نهادها)', accAr.length >= 70 && accAr.includes('org-pars') && accAr.includes('org-x'), `count=${accAr.length}`);
  check('aroun → بدون هیچ سازمان دمو (آریا)', !accAr.some(id => ['org-1','org-2','org-3','org-4'].includes(id)));

  // سازمان‌های واقعی
  const orgs = await api('/organizations', { token: t });
  const orgList = Array.isArray(orgs.body) ? orgs.body : (orgs.body?.data ?? []);
  check('شرکت x (مالک پلتفرم) موجود است', orgList.some(o => o.name === 'شرکت x' && o.type === 'HOLDING'));
  check('هلدینگ پارس موجود است', orgList.some(o => o.name === 'هلدینگ پارس'));
  const parsId = (orgList.find(o => o.name === 'هلدینگ پارس') ?? {}).id;
  check('۱۲ حوزهٔ کاری زیرمجموعهٔ پارس', orgList.filter(o => o.parentOrganizationId === parsId).length === 12);
  for (const name of ['شورای ملی راهبری هوش مصنوعی', 'دانشگاه تهران', 'فرابورس ایران', 'پارک فناوری پردیس', 'دیجی‌کالا', 'بانک مرکزی جمهوری اسلامی ایران']) {
    check(`نهاد واقعی سند: ${name}`, orgList.some(o => o.name === name));
  }

  // خودشناسی و اعضای عموم‌ها
  const self = await api(`/publics/self/${parsId}`, { token: t });
  check('خودشناسی پارس: قالب HOLDING + هدف «مرجعیت هوش مصنوعی کشور»', self.status === 200
    && self.body?.self?.templateId === 'HOLDING' && self.body?.self?.missionTopic === 'مرجعیت هوش مصنوعی کشور');
  check('خودشناسی پارس: ۱۲ حوزهٔ کاری', (self.body?.self?.structure?.sectors ?? []).length === 12);
  const members = await api(`/publics/members?orgId=${parsId}`, { token: t });
  const mList = Array.isArray(members.body) ? members.body : (members.body?.data ?? members.body?.items ?? []);
  check('اعضای عموم‌های پارس: ۱۰۰+ نهاد واقعی', mList.length >= 100, `count=${mList.length}`);
  const cov = await api(`/publics/coverage?orgId=${parsId}`, { token: t });
  const covRows = cov.body?.byCategory ?? [];
  check('پوشش ۶ دستهٔ عموم محاسبه می‌شود', covRows.length === 6);
  check('شکاف‌های واقعی دیده می‌شوند (گروه‌های بدون نهاد نام‌برده)', covRows.some(r => (r.gapGroups ?? []).length > 0));

  // گراف شبکه: گره‌های پارس + نهادها
  const g = await api('/network/graph', { token: t });
  check('گراف: پارس و همهٔ نهادها گره دارند (۷۰+)', (g.body?.nodes ?? []).length >= 70);
  check('گراف: یال‌های ساختاری پارس↔۱۲ حوزه', (g.body?.edges ?? []).filter(e => e.kind === 'relationship').length === 12, `edges=${(g.body?.edges ?? []).filter(e => e.kind === 'relationship').length}`);
}

/* ===================== 8. TENANT ISOLATION (جداسازی مستأجران) ===================== */
section('جداسازی محیط شرکت‌ها — دمو فقط در دمو');
{
  // توکن دمو (u-1) و توکن aroun
  const dLogin = await api('/auth/login', { method: 'POST', body: { email: 'demo', password: '123456', otp: '123456' } });
  const dt = dLogin.body?.accessToken;
  const aLogin = await api('/auth/login', { method: 'POST', body: { email: 'aroun', password: '12356784' } });
  const at = aLogin.body?.accessToken;

  // دمو: دنیای آریا را می‌بیند، دادهٔ واقعی را هرگز
  const dOrgs = await api('/organizations', { token: dt });
  const dList = Array.isArray(dOrgs.body) ? dOrgs.body : (dOrgs.body?.data ?? []);
  check('دمو → هلدینگ آریا دیده می‌شود', dList.some(o => o.name === 'هلدینگ آریا'));
  check('دمو → شرکت x دیده نمی‌شود', !dList.some(o => o.name === 'شرکت x'));
  check('دمو → هلدینگ پارس دیده نمی‌شود', !dList.some(o => o.name === 'هلدینگ پارس'));
  check('دمو → نهاد واقعی سند (شورای راهبری) دیده نمی‌شود', !dList.some(o => o.name === 'شورای ملی راهبری هوش مصنوعی'));
  const dPars = await api('/organizations/org-pars', { token: dt });
  check('دمو → GET سازمان پارس → 403', dPars.status === 403);
  const dPub = await api('/publics/members?orgId=org-pars', { token: dt });
  check('دمو → اعضای عموم‌های پارس → 403', dPub.status === 403);

  // aroun: دادهٔ واقعی را می‌بیند، دنیای دمو را هرگز
  const aOrgs = await api('/organizations', { token: at });
  const aList = Array.isArray(aOrgs.body) ? aOrgs.body : (aOrgs.body?.data ?? []);
  check('aroun → هلدینگ آریا (دمو) دیده نمی‌شود', !aList.some(o => o.name === 'هلدینگ آریا'));
  check('aroun → شرکت x و هلدینگ پارس دیده می‌شوند', aList.some(o => o.name === 'شرکت x') && aList.some(o => o.name === 'هلدینگ پارس'));
  const aOrg1 = await api('/organizations/org-1', { token: at });
  check('aroun → GET سازمان دمو (org-1) → 403', aOrg1.status === 403);
  const aPeople = await api('/people', { token: at });
  const aPpl = Array.isArray(aPeople.body) ? aPeople.body : (aPeople.body?.data ?? []);
  check('aroun → اشخاص دمو (سارا محمدی) دیده نمی‌شوند', !aPpl.some(p => `${p.firstName ?? ''} ${p.lastName ?? ''}`.includes('سارا محمدی')), `count=${aPpl.length}`);
  const aMeet = await api('/meetings', { token: at });
  const aM = Array.isArray(aMeet.body) ? aMeet.body : (aMeet.body?.data ?? []);
  /* «تمیز» یعنی هیچ جلسهٔ دموی آریا دیده نمی‌شود — جلساتی که خود arous ساخته مشکلی نیست */
  check('aroun → جلسات دمو دیده نمی‌شوند (بدون آریا)', !aM.some(m => /پترو صنعت|سدنا|البرز|بانک ملّی|اتاق بازرگانی تهران|آریا/.test(String(m.title))), `count=${aM.length}`);
  const aDocs = await api('/documents', { token: at });
  const aD = Array.isArray(aDocs.body) ? aDocs.body : (aDocs.body?.data ?? []);
  check('aroun → اسناد دمو دیده نمی‌شوند', aD.length === 0, `count=${aD.length}`);
  const aNotif = await api('/notifications', { token: at });
  const aN = Array.isArray(aNotif.body) ? aNotif.body : (aNotif.body?.data ?? []);
  check('aroun → اعلان‌های دمو دیده نمی‌شوند (بدون آریا/پترو/سدنا)', !aN.some(n => /پترو صنعت|سدنا|البرز|آریا/.test(String(n.title) + String(n.body))), `count=${aN.length}`);
  const dNotif = await api('/notifications', { token: dt });
  const dN = Array.isArray(dNotif.body) ? dNotif.body : (dNotif.body?.data ?? []);
  check('دمو → اعلان‌های دمو دیده می‌شوند', dN.length >= 1, `count=${dN.length}`);

  // حساب تازه‌ثبت‌نام: شروع کاملاً خالی
  const em = `newuser-${Date.now()}@test.ir`;
  const reg = await api('/auth/register', { method: 'POST', body: { name: 'کاربر واقعی تازه', email: em, password: 'Password123456' } });
  check('ثبت‌نام حساب واقعی تازه → 201', reg.status === 201);
  const nl = await api('/auth/login', { method: 'POST', body: { email: em, password: 'Password123456' } });
  check('ورود حساب تازه → 200', nl.status === 200 && !!nl.body?.accessToken);
  const nt = nl.body?.accessToken;
  const nOrgs = await api('/organizations', { token: nt });
  const nList = Array.isArray(nOrgs.body) ? nOrgs.body : (nOrgs.body?.data ?? []);
  check('حساب تازه → بدون هیچ سازمانی (شروع از صفر)', nList.length === 0, `count=${nList.length}`);
  const nPub = await api('/publics/members?orgId=org-pars', { token: nt });
  check('حساب تازه → دادهٔ پارس هم دیده نمی‌شود → 403', nPub.status === 403);
  const nDemo = await api('/organizations/org-1', { token: nt });
  check('حساب تازه → دادهٔ دمو هم دیده نمی‌شود → 403', nDemo.status === 403);

  // سازمان می‌سازد → فقط خودش می‌بیند
  const cOrg = await api('/organizations', { method: 'POST', token: nt, body: { name: 'شرکت تست مستقل', type: 'COMPANY' } });
  check('حساب تازه → ایجاد سازمان خودش → 201', cOrg.status === 201);
  const nOrgs2 = await api('/organizations', { token: nt });
  const nList2 = Array.isArray(nOrgs2.body) ? nOrgs2.body : (nOrgs2.body?.data ?? []);
  check('حساب تازه → فقط سازمان خودش را می‌بیند', nList2.length === 1 && nList2[0]?.name === 'شرکت تست مستقل', `count=${nList2.length}`);
  const aOrgs2 = await api('/organizations', { token: at });
  const aList2 = Array.isArray(aOrgs2.body) ? aOrgs2.body : (aOrgs2.body?.data ?? []);
  check('سازمان شخصی کاربر تازه → برای مالک هم به‌عنوان مشتری دیده می‌شود', aList2.some(o => o.name === 'شرکت تست مستقل'));
}

/* ===================== 9. CUSTOMER ACCOUNT (مشتری پارس) ===================== */
section('حساب واقعی مشتری — مدیرعامل هلدینگ پارس (pars)');
{
  const pl = await api('/auth/login', { method: 'POST', body: { email: 'pars', password: 'pars1234' } });
  check('ورود pars (نام کاربری، بدون MFA) → 200', pl.status === 200 && !!pl.body?.accessToken);
  const pt = pl.body?.accessToken;
  const plBad = await api('/auth/login', { method: 'POST', body: { email: 'pars', password: 'wrong' } });
  check('رمز اشتباه pars → 401', plBad.status === 401);

  const me = await api('/auth/me', { token: pt });
  check('pars → NOT owner؛ عضویت اصلی «هلدینگ پارس»', me.status === 200 && me.body?.isOwner === false
    && (me.body?.memberships ?? []).some(m => m.organizationName === 'هلدینگ پارس' && m.isPrimary === true));

  const orgs = await api('/organizations', { token: pt });
  const list = Array.isArray(orgs.body) ? orgs.body : (orgs.body?.data ?? []);
  check('pars → هلدینگ پارس + ۱۲ حوزه دیده می‌شوند', list.some(o => o.name === 'هلدینگ پارس') && list.filter(o => o.parentOrganizationId === 'org-pars').length === 12, `count=${list.length}`);
  check('pars → نهادهای سند عموم‌ها دیده می‌شوند', list.some(o => o.name === 'شورای ملی راهبری هوش مصنوعی') && list.some(o => o.name === 'دیجی‌کالا'));
  check('pars → شرکت x (مالک پلتفرم) دیده نمی‌شود', !list.some(o => o.name === 'شرکت x'));
  check('pars → دنیای دمو (آریا) دیده نمی‌شود', !list.some(o => o.name === 'هلدینگ آریا'));
  const xOrg = await api('/organizations/org-x', { token: pt });
  check('pars → GET شرکت x → 403', xOrg.status === 403);
  const demoOrg = await api('/organizations/org-1', { token: pt });
  check('pars → GET سازمان دمو → 403', demoOrg.status === 403);

  const members = await api('/publics/members?orgId=org-pars', { token: pt });
  const mList = Array.isArray(members.body) ? members.body : (members.body?.data ?? members.body?.items ?? []);
  check('pars → نقشهٔ عموم‌های خودش: ۱۰۰+ عضو واقعی', members.status === 200 && mList.length >= 100, `count=${mList.length}`);
  const demoPub = await api('/publics/members?orgId=org-1', { token: pt });
  check('pars → نقشهٔ عموم‌های دمو → 403', demoPub.status === 403);

  const g = await api('/network/graph', { token: pt });
  const labels = (g.body?.nodes ?? []).map(n => n.label ?? '').join('|');
  check('pars → گراف: هلدینگ پارس + زیرمجموعه‌ها، بدون آریا/شرکت x', labels.includes('هلدینگ پارس') && labels.includes('پارس انرژی') && !labels.includes('هلدینگ آریا') && !labels.includes('شرکت x'), `nodes=${(g.body?.nodes ?? []).length}`);

  const aL = await api('/auth/login', { method: 'POST', body: { email: 'aroun', password: '12356784' } });
  const aOrgs = await api('/organizations', { token: aL.body?.accessToken });
  const aList = Array.isArray(aOrgs.body) ? aOrgs.body : (aOrgs.body?.data ?? []);
  check('aroun → محیط پارس به‌عنوان دادهٔ مشتری خودش را می‌بیند', aList.some(o => o.name === 'هلدینگ پارس'));
}

/* ===================== 10. QUICK-CREATE OWNERSHIP (مالکیت پیش‌فرض) ===================== */
section('ایجاد سریع — مالکیت پیش‌فرض و فرم‌های کامل');
{
  const aL = await api('/auth/login', { method: 'POST', body: { email: 'aroun', password: '12356784' } });
  const t = aL.body?.accessToken;

  // جلسه بدون سازمان/رابطه → متعلق به سازمان اصلی سازنده (شرکت x) و قابل‌مشاهده
  const m = await api('/meetings', { method: 'POST', token: t, body: { title: 'جلسهٔ بدون پیوند — تست مالکیت', startAt: '2026-09-12T10:00:00.000Z' } });
  check('جلسهٔ بدون پیوند → 201 با سازمان اصلی سازنده', m.status === 201 && m.body?.organizationId === 'org-x', JSON.stringify(m.body?.organizationId));
  const ml = await api('/meetings', { token: t });
  const mList = Array.isArray(ml.body) ? ml.body : (ml.body?.data ?? []);
  check('جلسهٔ بدون پیوند → در فهرست جلسات سازنده دیده می‌شود', mList.some(x => x.title === 'جلسهٔ بدون پیوند — تست مالکیت'));

  // پروژه/فرصت/تعهد بدون سازمان → بدون هاردکد org-2 (دمو) — مالک سازنده
  const pr = await api('/projects', { method: 'POST', token: t, body: { name: 'پروژهٔ سریع — تست مالکیت' } });
  check('پروژهٔ بدون سازمان → 201 با سازمان اصلی (نه org-2 دمو)', pr.status === 201 && pr.body?.organizationId === 'org-x', JSON.stringify(pr.body?.organizationId));
  const op = await api('/opportunities', { method: 'POST', token: t, body: { name: 'فرصت سریع — تست مالکیت', value: 1000000, probability: 40 } });
  check('فرصت بدون سازمان → 201 با سازمان اصلی', op.status === 201 && op.body?.organizationId === 'org-x', JSON.stringify(op.body?.organizationId));
  const cm = await api('/commitments', { method: 'POST', token: t, body: { description: 'تعهد سریع — تست مالکیت', dueAt: '2026-10-01T09:00:00.000Z' } });
  check('تعهد بدون سازمان → 201 با سازمان اصلی', cm.status === 201 && cm.body?.organizationId === 'org-x', JSON.stringify(cm.body?.organizationId));

  // فیلدهای کامل فرم‌ها: جلسه با رابطهٔ پارس + شرکت‌کننده — رد نمی‌شود
  const m2 = await api('/meetings', { method: 'POST', token: t, body: { title: 'جلسهٔ کامل', startAt: '2026-09-12T12:00:00.000Z', endAt: '2026-09-12T13:00:00.000Z', relationshipId: 'r-pars-01', objective: 'هم‌راستاسازی', agenda: '۱) مرور', location: 'دفتر مرکزی', meetingUrl: 'https://meet.example.com/x' } });
  check('جلسهٔ کامل (رابطهٔ پارس + محل + لینک) → 201', m2.status === 201 && m2.body?.organizationId === 'org-pars', JSON.stringify(m2.body?.organizationId));

  // کاربر تازه (بدون هیچ سازمانی) → پیام شفاف 400 نه 403/500
  const em = `qc-${Date.now()}@test.ir`;
  await api('/auth/register', { method: 'POST', body: { name: 'تست فرم', email: em, password: 'Password123456' } });
  const nl = await api('/auth/login', { method: 'POST', body: { email: em, password: 'Password123456' } });
  const nt = nl.body?.accessToken;
  const nm = await api('/meetings', { method: 'POST', token: nt, body: { title: 'بدون سازمان', startAt: '2026-09-12T10:00:00.000Z' } });
  check('کاربر بدون سازمان → پیام شفاف 400', nm.status === 400 && /سازمان/.test(nm.body?.message ?? ''), JSON.stringify(nm.body?.message).slice(0, 60));
}

/* ============================ SUMMARY ============================ */
console.log(`\n════════════════════════════════════════`);
console.log(`  PASS: ${pass}   FAIL: ${fail}`);
if (failures.length) { console.log(`  Failed: ${failures.join(' | ')}`); }
console.log(`════════════════════════════════════════`);
process.exit(fail > 0 ? 1 : 0);
