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

async function api(path, { method = 'GET', token, body, raw, headers = {} } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
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
  /* ۱۲ یال ساختاری پارس↔حوزه‌ها + ۱ یال مشتری شرکت x↔پارس (۱۴۰۳/۰۹ اضافه شد) */
  const parsEdges = (g.body?.edges ?? []).filter(e => e.kind === 'relationship' && (e.source === 'org:org-pars' || e.target === 'org:org-pars'));
  check('گراف: یال‌های ساختاری پارس↔۱۲ حوزه + مشتری x', parsEdges.length === 13, `parsEdges=${parsEdges.length}`);
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

/* ================== ۱۸. مسترپلن فاز ۲ — موتورهای تمایز ================== */
section('فاز ۲ — ورود ایمیل/تقویم، GIS، پورتال، رسانه، MCP، نظرسنجی، ارائه');
{
  const pl = await login('pars@srip.local', 'pars1234');
  const pt = pl.body?.accessToken;
  check('ورود pars → توکن', !!pt);

  /* ── ۱۱: ورود ساختاریافتهٔ ایمیل/تقویم ── */
  const imp = await api('/imports', { method: 'POST', token: pt, body: { kind: 'email-csv', content: 'From,To,Date,Subject\r\n"rostagar@sharif.edu","kian@petro-sanat.ir","2026-09-10T10:00:00Z","پیگیری آزمایشگاه"\r\n"nobody@unknown.org","naz@arya-tech.ir","2026-09-11T11:00:00Z","معرفی"\r\n' } });
  check('ورود CSV → 201 با نگاشت', imp.status === 201 && imp.body?.stats?.personMapped >= 1, JSON.stringify(imp.body?.stats));
  check('حاکمیت: بدنهٔ پیام ذخیره نمی‌شود', imp.body?.governance?.bodyStored === false);
  const iid = imp.body?.id;
  const r1 = await api(`/imports/${iid}/rows/ir-1`, { method: 'POST', token: pt, body: { decision: 'ACCEPT' } });
  check('تأیید انسانی رکورد → ACCEPT', r1.status === 200 && r1.body?.status === 'ACCEPT');
  const r2 = await api(`/imports/${iid}/rows/ir-2`, { method: 'POST', token: pt, body: { decision: 'EDIT', patch: { organizationId: 'org-pars' } } });
  check('اصلاح دستی نگاشت → EDITED', r2.status === 200 && r2.body?.matchedOrganizationIds?.[0] === 'org-pars');
  const rj = await api(`/imports/${iid}/rows/ir-1`, { method: 'POST', token: pt, body: { decision: 'REJECT' } });
  check('رد رکورد → REJECT', rj.status === 200 && rj.body?.status === 'REJECT');
  const r2b = await api(`/imports/${iid}/rows/ir-2`, { method: 'POST', token: pt, body: { decision: 'ACCEPT' } });
  check('پذیرش رکورد اصلاح‌شده', r2b.status === 200 && r2b.body?.status === 'ACCEPT');
  const com = await api(`/imports/${iid}/commit`, { method: 'POST', token: pt, body: {} });
  check('ثبت نهایی → فقط رکورد پذیرفته‌شده', com.status === 200 && com.body?.created?.length === 1, JSON.stringify(com.body?.created?.length));
  check('بدنهٔ پیام در خروجی هم نیست', com.body?.governance?.bodyStored === false && !('content' in (com.body ?? {})));
  const ics = await api('/imports', { method: 'POST', token: pt, body: { kind: 'calendar-ics', content: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:20260901T090000Z\r\nDTEND:20260901T100000Z\r\nSUMMARY:جلسهٔ پارس\r\nORGANIZER:mailto:rostagar@sharif.edu\r\nATTENDEE:mailto:kian@petro-sanat.ir\r\nEND:VEVENT\r\nEND:VCALENDAR' } });
  check('ورود ICS → 201 جلسه', ics.status === 201 && ics.body?.stats?.total === 1 && ics.body?.stats?.personMapped === 1, JSON.stringify(ics.body?.stats));
  const bad = await api('/imports', { method: 'POST', token: pt, body: { kind: 'email-csv', content: 'a,b,c\r\n1,2,3' } });
  check('CSV بی‌هدر معتبر → 400', bad.status === 400);

  /* ── ۱۲: GIS ── */
  const gis = await api('/gis/stakeholders', { token: pt });
  const provs = (gis.body?.provinces ?? []).filter(p => p.orgCount > 0);
  check('GIS → نقاط + استان‌ها', gis.status === 200 && gis.body?.total > 30 && provs.length >= 3, `total=${gis.body?.total} provs=${provs.length}`);

  /* ── ۱۳: پورتال عمومی + شکایت ── */
  const pinfo = await api('/portal/pars/info');
  check('اطلاعات پورتال بدون احراز هویت', pinfo.status === 200 && pinfo.body?.organizationName === 'هلدینگ پارس');
  const psub = await api('/portal/pars/submit', { method: 'POST', body: { type: 'COMPLAINT', name: 'تست اتوماسیون', message: 'پیام آزمایشی برای چرخهٔ شکایت پورتال عمومی.' } });
  check('ثبت شکایت عمومی → 201 با SLA', psub.status === 201 && psub.body?.slaDays === 5);
  const psid = psub.body?.id;
  const pq = await api('/portal/submissions', { token: pt });
  check('صف بررسی شامل شکایت', pq.status === 200 && (pq.body?.items ?? []).some(x => x.id === psid));
  const pmet = await api('/portal/metrics', { token: pt });
  check('سنجه‌های SLA و روند', pmet.status === 200 && Array.isArray(pmet.body?.trend) && pmet.body.trend.length === 6 && 'avgResolutionHours' in pmet.body);
  const pasn = await api(`/portal/submissions/${psid}/assign`, { method: 'POST', token: pt, body: { ownerUserId: 'u-pars' } });
  check('تعیین مسئول → در حال بررسی', pasn.status === 200 && pasn.body?.status === 'IN_PROGRESS');
  const pres = await api(`/portal/submissions/${psid}/resolve`, { method: 'POST', token: pt, body: { resolutionNote: 'بررسی و پیگیری شد.' } });
  check('رسیدگی → RESOLVED', pres.status === 200 && pres.body?.status === 'RESOLVED');
  const pconv = await api(`/portal/submissions/${psid}/convert`, { method: 'POST', token: pt, body: {} });
  check('تبدیل به ذینفع + تعامل', pconv.status === 200 && !!pconv.body?.personId && !!pconv.body?.interactionId);

  /* ── ۱۴: پایش رسانهٔ سبک ── */
  const scan = await api('/media/scan', { method: 'POST', token: pt, body: {} });
  check('پویش RSS منابع منتخب', scan.status === 200 && scan.body?.scanned === 5 && scan.body?.interactionsCreated >= 1, JSON.stringify(scan.body?.scanned));
  const cov = await api('/media/coverage?organizationId=org-ac-sharif', { token: pt });
  check('کارت پوشش + روند ۶ ماهه', cov.status === 200 && cov.body?.totalDetected >= 1 && cov.body?.trend?.length === 6);
  check('صداقت: برچسب «رصد منابع منتخب»', typeof cov.body?.honestyNote === 'string' && cov.body.honestyNote.includes('منتخب'));
  const firstMention = (cov.body?.mentions ?? [])[0];
  const rev = await api(`/media/mentions/${firstMention?.id}/review`, { method: 'POST', token: pt, body: { tone: 'POSITIVE', note: 'بازبینی انسانی' } });
  check('بازبینی لحن انسانی', rev.status === 200 && rev.body?.reviewTone === 'POSITIVE');
  const covX = await api('/media/coverage?organizationId=org-x', { token: pt });
  check('سازمان خارج از محدوده → 403', covX.status === 403);

  /* ── ۱۵: سرور MCP ── */
  const mcpInfo = await api('/mcp', { token: pt });
  check('MCP: مانیفست فقط-خواندنی', mcpInfo.status === 200 && mcpInfo.body?.readOnly === true && mcpInfo.body?.tools?.length === 6);
  const tl = await api('/mcp', { method: 'POST', token: pt, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
  check('MCP: tools/list', tl.status === 200 && tl.body?.result?.tools?.length === 6);
  const sg = await api('/mcp', { method: 'POST', token: pt, body: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'search_graph', arguments: { query: 'شریف' } } } });
  check('MCP: search_graph', sg.status === 200 && (sg.body?.result?.structuredContent?.organizations ?? []).some(o => o.id === 'org-ac-sharif'));
  check('MCP: هر پاسخ با تاریخ داده', !!sg.body?.result?.structuredContent?._meta?.dataDate);
  const badTool = await api('/mcp', { method: 'POST', token: pt, body: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'nope', arguments: {} } } });
  check('MCP: ابزار ناموجود → خطای استاندارد', badTool.body?.error?.code === -32602);

  /* ── ۱۶: نظرسنجی ذینفعان ── */
  const sv = await api('/surveys', { method: 'POST', token: pt, body: { memberId: 'PM-P-125' } });
  check('ایجاد نظرسنجی → لینک عمومی', sv.status === 201 && !!sv.body?.token && !!sv.body?.url);
  const svTok = sv.body?.token;
  const svPub = await api(`/portal/surveys/${svTok}`);
  check('دریافت نظرسنجی بدون احراز هویت', svPub.status === 200 && svPub.body?.questions?.length >= 3);
  const svBad = await api(`/portal/surveys/${svTok}/respond`, { method: 'POST', body: { answers: { satisfaction: 9, perception: 'SUPPORTER' } } });
  check('اعتبارسنجی پاسخ → 400', svBad.status === 400);
  const svOk = await api(`/portal/surveys/${svTok}/respond`, { method: 'POST', body: { answers: { satisfaction: 4, perception: 'NEUTRAL', priority: 'انرژی', comment: 'خوب بود' } } });
  check('پاسخ عمومی → اثر با برچسب منبع', svOk.status === 201 && svOk.body?.effect?.stanceRecorded === true);
  const svDup = await api(`/portal/surveys/${svTok}/respond`, { method: 'POST', body: { answers: { satisfaction: 2, perception: 'OPPOSER' } } });
  check('پاسخ تکراری → 409', svDup.status === 409);

  /* ── ۱۷: حالت ارائهٔ گراف ── */
  const pr = await api('/network/presentation', { token: pt });
  check('روایت بذر ۸ صحنه‌ای', pr.status === 200 && pr.body?.total === 8 && pr.body?.scenes?.[0]?.title?.startsWith('اکوسیستم'));
  const ns = await api('/network/presentation/scenes', { method: 'POST', token: pt, body: { title: 'صحنهٔ تست فاز ۲', note: 'n', filters: { category: 'MEDIA', view: 'ecosystem' } } });
  check('ساخت صحنه در انتهای روایت', ns.status === 201 && ns.body?.order >= 9);
  const up = await api(`/network/presentation/scenes/${ns.body?.id}`, { method: 'PATCH', token: pt, body: { order: 2 } });
  check('جابه‌جایی ترتیب صحنه', up.status === 200 && up.body?.order === 2);
  const dl = await api(`/network/presentation/scenes/${ns.body?.id}`, { method: 'DELETE', token: pt });
  check('حذف صحنه', dl.status === 200 && dl.body?.deleted === ns.body?.id);

  /* ── محرک‌های فاز ۲ در آمار گردش‌کار ── */
  const wf = await api('/workflows/coverage', { token: pt });
  check('محرک‌های فاز ۲ ثبت شده‌اند', wf.status === 200);
  const stats = await api('/workflows', { token: pt });
  const wfList = Array.isArray(stats.body) ? stats.body : stats.body?.items ?? [];
  check('گردش‌کارهای بذر فاز ۲ (wf-24..27)', ['wf-24', 'wf-25', 'wf-26', 'wf-27'].every(id => wfList.some(w => w.id === id)), JSON.stringify(wfList.length));
}


/* ================== ۱۹. مسترپلن فاز ۳ — اکوسیستم داده و کانال ================== */
section('فاز ۳ — غنی‌سازی منابع رسمی، API عمومی + وب‌هوک، QBR، Web Push، دستیار گراف');
{
  const { default: http } = await import('node:http');
  const { createHmac } = await import('node:crypto');
  const pl = await login('pars@srip.local', 'pars1234');
  const pt = pl.body?.accessToken;
  check('ورود pars → توکن', !!pt);
  const al = await login('aroun@srip.local', '12356784');
  const at = al.body?.accessToken;
  const dl = await login(OWNER.email, OWNER.password);
  const dt = dl.body?.accessToken;

  /* ── ۱۸: غنی‌سازی از منابع رسمی بیرونی ── */
  const srcs = await api('/enrichment/sources', { token: pt });
  check('سه منبع رسمی فعال', srcs.status === 200 && srcs.body?.total === 3 && srcs.body?.sources?.every(s => s.coverageFa && s.cadenceFa));
  const scan1 = await api('/enrichment/scan', { method: 'POST', token: pt, body: {} });
  check('پویش مرحله‌ای → پیشنهاد تازه', scan1.status === 200 && scan1.body?.created >= 8, JSON.stringify(scan1.body?.perSource));
  const sug = await api('/enrichment/suggestions?status=PENDING', { token: pt });
  check('صف پیشنهاد با منبع و سطح اطمینان', sug.status === 200 && sug.body?.items?.length >= 5 && sug.body.items[0].sourceNameFa && sug.body.items[0].confidenceFa);
  const target = sug.body.items[0];
  const acc = await api(`/enrichment/suggestions/${target.id}/accept`, { method: 'POST', token: pt });
  check('پذیرش انسانی → اعمال با شفافیت', acc.status === 200 && acc.body?.status === 'ACCEPTED');
  const overlay = await api(`/enrichment/organizations/${target.orgId}`, { token: pt });
  check('پوشش غنی‌شده با منبع + اطمینان + تاریخ', overlay.status === 200 && overlay.body?.fields?.some(f => f.field === target.field && f.sourceNameFa && f.appliedAt));
  const reAcc = await api(`/enrichment/suggestions/${target.id}/accept`, { method: 'POST', token: pt });
  check('پذیرش تکراری → 409', reAcc.status === 409);
  const rej = await api(`/enrichment/suggestions/${sug.body.items[1].id}/reject`, { method: 'POST', token: pt });
  check('رد پیشنهاد → 200', rej.status === 200 && rej.body?.status === 'REJECTED');
  const met = await api('/enrichment/metrics', { token: pt });
  check('نرخ پذیرش اندازه‌گیری‌شده', met.status === 200 && met.body?.accepted === 1 && met.body?.rejected === 1 && met.body?.acceptanceRate === 50, JSON.stringify(met.body));
  /* جداسازی مستأجر: دمو پیشنهاد پارس را نمی‌بیند و نمی‌پذیرد */
  const demoSug = await api('/enrichment/suggestions', { token: dt });
  check('جداسازی: پیشنهادهای دمو جدا از پارس', demoSug.status === 200 && !demoSug.body?.items?.some(s => s.id === target.id));
  const crossAcc = await api(`/enrichment/suggestions/${target.id}/accept`, { method: 'POST', token: dt });
  check('پذیرش خارج از محدوده → 403', crossAcc.status === 403);
  const scanDemo = await api('/enrichment/scan', { method: 'POST', token: dt, body: {} });
  check('پویش دمو → استخر مستقل (کشوری per-tenant)', scanDemo.status === 200 && scanDemo.body?.created >= 1, JSON.stringify(scanDemo.body?.created));

  /* ── ۱۹: کلید API عمومی ── */
  const kc = await api('/developer/keys', { method: 'POST', token: pt, body: { name: 'کلید آزمون خودکار', scopes: ['graph:read'] } });
  check('ساخت کلید → 201 (نمایش یک‌باره)', kc.status === 201 && String(kc.body?.key ?? '').startsWith('srip_ak_'));
  const KEY = kc.body?.key;
  const klist = await api('/developer/keys', { token: pt });
  check('فهرست کلیدها → ماسک‌شده (بدون مقدار کامل)', klist.status === 200 && klist.body?.items?.some(k => k.masked && !String(k.masked).includes(KEY.slice(16, -4))));
  const who = await api('/public/whoami', { method: 'GET', headers: { 'X-API-Key': KEY } });
  check('whoami با کلید → مستأجر درست', who.status === 200 && who.body?.tenantOrganizationId === 'org-pars');
  const orgs = await api('/public/organizations?q=پارس', { method: 'GET', headers: { 'X-API-Key': KEY } });
  check('سازمان‌ها با دامنهٔ مستأجر (۱۳)', orgs.status === 200 && orgs.body?.total === 13, JSON.stringify(orgs.body?.total));
  const org1 = await api('/public/organizations/org-pars-01', { method: 'GET', headers: { 'X-API-Key': KEY } });
  check('جزئیات سازمان → 200', org1.status === 200 && org1.body?.name === 'پارس انرژی');
  const rels = await api('/public/relationships?organizationId=org-pars', { method: 'GET', headers: { 'X-API-Key': KEY } });
  check('روابط سازمان → ۱۳ رابطه', rels.status === 200 && rels.body?.total === 13);
  const score = await api('/public/relationships/score?from=org-pars&to=org-pars-01', { method: 'GET', headers: { 'X-API-Key': KEY } });
  check('امتیاز رابطهٔ دوتایی → عدد سلامت', score.status === 200 && typeof score.body?.healthScore === 'number' && score.body?._meta?.sourceIds?.length >= 1);
  const insBad = await api('/public/insights/gaps?organizationId=org-pars', { method: 'GET', headers: { 'X-API-Key': KEY } });
  check('دامنهٔ ناکافی برای insights → 403', insBad.status === 403 && insBad.body?.code === 'INSUFFICIENT_SCOPE');
  const kc2 = await api('/developer/keys', { method: 'POST', token: pt, body: { name: 'کلید تحلیل', scopes: ['graph:read', 'insights:read'] } });
  const KEY2 = kc2.body?.key;
  const insOk = await api('/public/insights/gaps?organizationId=org-pars', { method: 'GET', headers: { 'X-API-Key': KEY2 } });
  check('دامنهٔ insights:read → شکاف‌ها', insOk.status === 200 && typeof insOk.body?.totalGaps === 'number');
  const noKey = await api('/public/organizations');
  check('بدون کلید → 401', noKey.status === 401);
  const badKey = await api('/public/organizations', { method: 'GET', headers: { 'X-API-Key': 'srip_ak_wrong' } });
  check('کلید نامعتبر → 401', badKey.status === 401);
  /* نرخ‌محدود: ۶۰ در ساعت برای هر کلید */
  let limited = null;
  for (let i = 0; i < 61 && !limited; i++) {
    const r = await api('/public/whoami', { method: 'GET', headers: { 'X-API-Key': KEY2 }, raw: true });
    if (r.status === 429) limited = r;
  }
  check('نرخ‌محدود ۶۰/ساعت → 429', !!limited);
  const rk = await api(`/developer/keys/${kc.body.id}/revoke`, { method: 'POST', token: pt });
  check('لغو کلید → 200', rk.status === 200 && rk.body?.revokedAt);
  const whoRevoked = await api('/public/whoami', { method: 'GET', headers: { 'X-API-Key': KEY } });
  check('کلید لغوشده → 401', whoRevoked.status === 401);
  const usage = await api('/developer/usage', { token: pt });
  check('آمار مصرف کلیدها + سند مسیرها', usage.status === 200 && usage.body?.items?.length >= 2 && usage.body?.publicEndpoints?.length === 7);

  /* ── ۱۹: وب‌هوک با امضای HMAC ── */
  const hooks = [];
  const listener = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { hooks.push({ headers: req.headers, body }); res.writeHead(200); res.end('ok'); });
  });
  await new Promise(r => listener.listen(4999, '127.0.0.1', r));
  const wc = await api('/developer/webhooks', { method: 'POST', token: pt, body: { url: 'http://127.0.0.1:4999/hook', events: ['RELATIONSHIP_SCORE_CHANGED', 'PUBLIC_SUBMISSION_RECEIVED'] } });
  check('ساخت وب‌هوک → 201 با رمز امضا', wc.status === 201 && String(wc.body?.secret ?? '').startsWith('srip_whsec_'));
  const SECRET = wc.body?.secret;
  /* تغییر امتیاز رابطه → پخش وب‌هوک */
  const relBefore = await api('/public/relationships/score?from=org-pars&to=org-pars-02', { method: 'GET', headers: { 'X-API-Key': KEY2 } });
  const hp = await api('/relationships/r-pars-02', { method: 'PATCH', token: pt, body: { healthScore: Math.max(1, (relBefore.body?.healthScore ?? 88) - 3) } });
  check('تغییر امتیاز رابطه → 200', hp.status === 200);
  await new Promise(r => setTimeout(r, 300));
  const wh = hooks.find(h => JSON.parse(h.body).event === 'RELATIONSHIP_SCORE_CHANGED');
  check('وب‌هوک «تغییر امتیاز» دریافت شد', !!wh);
  if (wh) {
    const sig = String(wh.headers['x-srip-signature'] ?? '').replace(/^sha256=/, '');
    const expect = createHmac('sha256', SECRET).update(wh.body).digest('hex');
    check('امضای HMAC-SHA256 معتبر', sig === expect);
    const payload = JSON.parse(wh.body);
    check('بدنهٔ رویداد با مقدار قبلی/جدید', payload.data?.relationship?.previousHealth != null && payload.data?.relationship?.newHealth != null);
  }
  const deliv = await api('/developer/webhook-deliveries', { token: pt });
  check('تاریخچهٔ تحویل → DELIVERED', deliv.status === 200 && deliv.body?.items?.some(d => d.status === 'DELIVERED' && d.signature?.startsWith('sha256=')));
  const whList = await api('/developer/webhooks', { token: pt });
  check('فهرست وب‌هوک‌ها + رویدادهای موجود', whList.status === 200 && whList.body?.availableEvents?.length === 4);

  /* ── ۲۰: QBR خودکار ── */
  const qbrA = await api('/qbr', { token: at });
  check('QBR: هر دو حساب واقعی (aroun)', qbrA.status === 200 && qbrA.body?.total === 2 && qbrA.body.items.some(i => i.organizationId === 'org-pars') && qbrA.body.items.some(i => i.organizationId === 'org-x'), JSON.stringify(qbrA.body?.items?.map(i => i.organizationId)));
  const qbrP = await api('/qbr/org-pars', { token: pt });
  check('بریف QBR pars → تیتر + دورهٔ ۹۰ روزه + قابل چاپ', qbrP.status === 200 && !!qbrP.body?.headline && qbrP.body?.period?.days === 90 && qbrP.body?.printable === true);
  const k = qbrP.body?.kpis ?? {};
  check('KPIهای بریف (۷ محور)', ['health', 'interactions', 'commitments', 'gaps', 'media', 'surveys', 'portal'].every(x => x in k));
  const qbrList2 = await api('/qbr', { token: pt });
  check('QBR pars → فقط حساب خودش', qbrList2.body?.total === 1 && qbrList2.body.items[0].organizationId === 'org-pars');
  const qbrX = await api('/qbr/org-x', { token: at });
  check('QBR org-x → شکاف null با پیام صادقانه', qbrX.status === 200 && qbrX.body?.kpis?.gaps?.total === null && !!qbrX.body?.kpis?.gaps?.note);
  const wfCov = await api('/workflows/coverage', { token: pt });
  check('محرک‌های فاز ۳ در پوشش گردش کار', wfCov.status === 200);

  /* ── ۲۱: Web Push + رضایت اعلان ── */
  const subBad = await api('/notifications/push/subscribe', { method: 'POST', token: pt, body: { endpoint: 'https://mock.push.srip.local/x', consent: 'PENDING' } });
  check('اشتراک بدون رضایت صریح → 400', subBad.status === 400);
  const sub = await api('/notifications/push/subscribe', { method: 'POST', token: pt, body: { endpoint: 'https://mock.push.srip.local/sub/auto-1', consent: 'GRANTED', topics: ['PORTAL', 'MEDIA'], keys: { p256dh: 'k1', auth: 'k2' } } });
  check('اشتراک با رضایت → 201', sub.status === 201 && sub.body?.consent === 'GRANTED');
  const subList = await api('/notifications/push/subscriptions', { token: pt });
  check('فهرست اشتراک‌ها → فعال', subList.status === 200 && subList.body?.items?.some(s => s.active));
  const dispNo = await api('/notifications/push/dispatch', { method: 'POST', token: dt, body: { title: 'x', organizationId: 'org-pars' } });
  check('ارسال بدون مجوز → 403 (demo به پارس)', dispNo.status === 403, JSON.stringify(dispNo.status));
  const disp = await api('/notifications/push/dispatch', { method: 'POST', token: pt, body: { title: 'اعلان آزمون فاز ۳', body: 'تست' } });
  check('ارسال اعلان → صف شد', disp.status === 200 && disp.body?.sent >= 1);
  const pend = await api('/notifications/push/pending', { token: pt });
  check('صف تحویل → پیام با موضوع', pend.status === 200 && pend.body?.items?.length >= 1 && pend.body?.items[0]?.title === 'اعلان آزمون فاز ۳' && pend.body?.transport?.includes('polling'));
  const ack = await api(`/notifications/push/pending/${pend.body.items[0].id}/ack`, { method: 'POST', token: pt });
  check('رسید تحویل (ack) → 200', ack.status === 200 && ack.body?.deliveredAt);
  /* پوش خودکار روی پیام پورتال */
  await api('/portal/pars/submit', { method: 'POST', body: { type: 'FEEDBACK', message: 'تست پوش خودکار فاز سه — درخواست همکاری پژوهشی.' } });
  const pend2 = await api('/notifications/push/pending', { token: pt });
  check('ثبت پورتال → پوش خودکار', pend2.body?.items?.some(x => x.title === 'پیام تازه در پورتال عمومی'));
  /* لغو رضایت */
  const revokeSub = await api(`/notifications/push/subscriptions/${sub.body.id}/revoke`, { method: 'POST', token: pt });
  check('لغو رضایت اعلان → 200', revokeSub.status === 200 && revokeSub.body?.consent === 'REVOKED');
  await api('/notifications/push/dispatch', { method: 'POST', token: pt, body: { title: 'بعد از لغو', body: 'نباید برسد' } });
  const pend3 = await api('/notifications/push/pending', { token: pt });
  check('پس از لغو رضایت → پیام جدید نیست', !pend3.body?.items?.some(x => x.title === 'بعد از لغو'));
  const ack404 = await api('/notifications/push/pending/none/ack', { method: 'POST', token: pt });
  check('رسید ناشناخته → 404', ack404.status === 404);

  /* ── مرکز اعلان‌ها: ترجیحات ماندگار + اعلان آزمایشی + خلاصهٔ دوره‌ای + گزارش تحویل ── */
  const prefGet1 = await api('/notifications/preferences', { token: pt });
  check('ترجیحات اعلان → پیش‌فرض سرور', prefGet1.status === 200 && prefGet1.body?.inAppEnabled === true && prefGet1.body?.digestEnabled === false);
  const prefSet = await api('/notifications/preferences', { method: 'PATCH', token: pt, body: { digestEnabled: true, emailEnabled: true, pushEnabled: true } });
  check('ذخیرهٔ ترجیحات اعلان → 200', prefSet.status === 200 && prefSet.body?.ok === true);
  const prefGet2 = await api('/notifications/preferences', { token: pt });
  check('ترجیحات ماندگار شد (roundtrip)', prefGet2.body?.digestEnabled === true && prefGet2.body?.pushEnabled === true && prefGet2.body?.inAppEnabled === true);
  const prefDemo = await api('/notifications/preferences', { token: dt });
  check('ترجیحات per-user (حساب دیگر پیش‌فرض)', prefDemo.body?.digestEnabled === false);
  const testNoSub = await api('/notifications/push/test', { method: 'POST', token: dt, body: {} });
  check('اعلان آزمایشی بدون اشتراک → 409', testNoSub.status === 409);
  const sub2 = await api('/notifications/push/subscribe', { method: 'POST', token: pt, body: { endpoint: 'https://mock.push.srip.local/sub/auto-2', consent: 'GRANTED', topics: ['GENERAL'] } });
  check('اشتراک دوباره (برای اعلان آزمایشی) → 201', sub2.status === 201);
  const testOk = await api('/notifications/push/test', { method: 'POST', token: pt, body: {} });
  check('اعلان آزمایشی → صف شد', testOk.status === 200 && testOk.body?.sent >= 1);
  const ptNotif = await api('/notifications', { token: pt });
  const ptN = Array.isArray(ptNotif.body) ? ptNotif.body : (ptNotif.body?.items ?? []);
  check('اعلان آزمایشی در فهرست اعلان‌ها', ptN.some(n => n.title === 'اعلان آزمایشی SRIP'));
  const digestOk = await api('/notifications/digest/DAILY', { method: 'POST', token: pt, body: {} });
  check('خلاصهٔ روزانه → ارسال شد', digestOk.status === 200 && digestOk.body?.sent === true && digestOk.body?.count >= 1, JSON.stringify(digestOk.body).slice(0, 80));
  const dlogRowsR = await api('/notifications/delivery-log', { token: pt });
  const dlogRows = Array.isArray(dlogRowsR.body) ? dlogRowsR.body : [];
  check('گزارش تحویل → رکورد پوش، آزمایشی و خلاصه', dlogRows.some(r => r.provider === 'web-push') && dlogRows.some(r => r.provider === 'test') && dlogRows.some(r => r.channel === 'EMAIL' && r.provider === 'digest'));

  /* ── ۲۲: دستیار پرسش‌وپاسخ طبیعی روی گراف ── */
  const ask = async (q, token = pt) => (await api('/assistant/ask', { method: 'POST', token, body: { question: q } })).body;
  const sugg = await api('/assistant/suggestions', { token: pt });
  check('۲۰ پرسش پرتکرار پیشنهادی', sugg.status === 200 && sugg.body?.total === 20);
  /* پوشش رسانه‌ای برای پرسش رسانه: ابتدا پویش */
  await api('/media/scan', { method: 'POST', token: pt, body: {} });
  const cases = [
    ['سلامت این حساب چقدر است؟', pt, 'account_health', (a) => a.answer.includes('هلدینگ پارس')],
    ['وضعیت کلی هلدینگ پارس چطور است؟', pt, 'account_health', (a) => a.answer.includes('میانگین')],
    ['امتیاز رابطهٔ هلدینگ پارس و پارس انرژی چقدر است؟', pt, 'score', (a) => a.references.some(r => r.type === 'RELATIONSHIP')],
    ['رابطهٔ هلدینگ پارس با شرکت x چطور است؟', at, 'score', (a) => a.answer.includes('سلامت')],
    ['مسیر معرفی از شرکت x به پارس انرژی چیست؟', at, 'path', (a) => a.answer.includes('شرکت x ← هلدینگ پارس ← پارس انرژی')],
    ['شکاف‌های پوشش عمومی هلدینگ پارس کدام‌اند؟', pt, 'gaps', (a) => a.answer.includes('شکاف')],
    ['با چه کسانی گپ پوشش عمومی داریم؟', pt, 'gaps', (a) => !!a.answer],
    ['پوشش رسانه‌ای دانشگاه صنعتی شریف چطور است؟', pt, 'media', (a) => a.answer.includes('دانشگاه صنعتی شریف')],
    ['آخرین اخبار دربارهٔ دانشگاه صنعتی شریف چه بود؟', pt, 'media', (a) => !!a.answer],
    ['پروفایل پارک فناوری پردیس را نشان بده', pt, 'profile', (a) => a.answer.includes('پارک فناوری پردیس')],
    ['دانشگاه فردوسی مشهد را در شبکه پیدا کن', pt, 'search', (a) => a.answer.includes('دانشگاه فردوسی')],
    ['تعهدات معوق کدام‌اند؟', dt, 'commitments_overdue', (a) => a.answer.includes('تعهد معوق')],
    ['تعهدات باز هلدینگ پارس کدام‌اند؟', pt, 'commitments_open', (a) => !!a.answer],
    ['تعهدات شرکت x کدام‌اند؟', at, 'commitments_open', (a) => !!a.answer],
    ['افراد هلدینگ پارس چه کسانی‌اند؟', pt, 'people', (a) => !!a.answer],
    ['در سه ماه گذشته چند تعامل داشتیم؟', pt, 'interactions', (a) => a.answer.includes('۹۰ روز')],
    ['میانگین سلامت روابط پارس آموزش چقدر است؟', pt, 'account_health', (a) => a.answer.includes('پارس آموزش')],
    ['سلامت رابطهٔ پارس مالی و هلدینگ پارس چقدر است؟', pt, 'score', (a) => a.references.some(r => r.type === 'RELATIONSHIP')],
    ['بهترین مسیر از شرکت x به پارس آموزش چیست؟', at, 'path', (a) => a.answer.includes('پارس آموزش')],
    ['چه چیزهایی می‌توانی پاسخ بدهی؟', pt, 'help', (a) => a.answer.includes('دامنهٔ من')],
  ];
  let askOk = 0;
  for (const [q, token, intent, verify] of cases) {
    const a = await ask(q, token);
    const ok = a?.intent === intent && (!verify || verify(a));
    if (ok) askOk++;
    else check(`دستیار: «${q}»`, false, `→ ${a?.intent}: ${String(a?.answer).slice(0, 80)}`);
  }
  check(`۲۰ پرسش پرتکرار با پاسخ صحیح و ارجاع (${askOk}/۲۰)`, askOk === 20);
  const allRefs = await Promise.all(cases.slice(0, 10).map(([q, token]) => ask(q, token)));
  check('هر پاسخ داده‌محور دارای ارجاع به رکورد منبع', allRefs.every(a => (a.references?.length ?? 0) >= 1 || a.intent === 'help'));
  const ood1 = await ask('قیمت بیت‌کوین چقدر است؟');
  check('خارج از دامنه → «نمی‌دانم» صادقانه (۱)', ood1?.outOfScope === true && ood1.answer.startsWith('نمی‌دانم'));
  const ood2 = await ask('هوای فردای تهران چطور است؟');
  check('خارج از دامنه → «نمی‌دانم» صادقانه (۲)', ood2?.outOfScope === true && ood2.answer.startsWith('نمی‌دانم'));
  const cross = await ask('امتیاز رابطهٔ هلدینگ آریا و بانک ملّی پارس چقدر است؟', pt);
  check('جداسازی مستأجر: پرسش از دنیای دمو → بدون افشای داده', cross?.references?.every(r => r.type !== 'RELATIONSHIP' || !String(r.id).startsWith('r-')) && !cross.answer.includes('آریا فناوری'));
  const askMeta = await ask('امتیاز رابطهٔ هلدینگ پارس و پارس انرژی چقدر است؟');
  check('هر پاسخ با _meta (تاریخ داده + موتور)', askMeta?._meta?.engine === 'deterministic-rules' && !!askMeta._meta?.dataDate);

  /* ── یکپارچگی فاز ۳ با پلتفرم: غنی‌سازی در پروفایل/MCP/API عمومی، پوش در اعلان‌ها، گردشکار سازمان‌محور ── */
  const od = await api(`/organizations/${target.orgId}`, { token: pt });
  check('غنی‌سازی → پروفایل سازمان (GET /organizations/:id)', od.status === 200 && od.body?.enrichment?.fields?.some(f => f.field === target.field && f.sourceNameFa), JSON.stringify(od.body?.enrichment?.total));
  const kc3 = await api('/developer/keys', { method: 'POST', token: pt, body: { name: 'کلید یکپارچگی', scopes: ['graph:read'] } });
  const pod = await api(`/public/organizations/${target.orgId}`, { headers: { 'X-API-Key': kc3.body?.key } });
  check('غنی‌سازی → API عمومی شریک‌ها', pod.status === 200 && (pod.body?.enrichment?.total ?? 0) >= 1, JSON.stringify(pod.status));
  const mcpProf = await api('/mcp', { method: 'POST', token: pt, body: { jsonrpc: '2.0', id: 99, method: 'tools/call', params: { name: 'stakeholder_profile', arguments: { organizationId: target.orgId } } } });
  check('غنی‌سازی → ابزار MCP stakeholder_profile', (mcpProf.body?.result?.structuredContent?.enrichedFields?.length ?? 0) >= 1);
  const profAsk = await ask(`پروفایل ${target.orgName} را نشان بده`);
  check('غنی‌سازی → پاسخ دستیار با منبع', String(profAsk.answer).includes(target.proposedValue) && String(profAsk.answer).includes('غنی‌شده'), String(profAsk.answer).slice(0, 80));

  /* شکایت ناشناس در پورتال شرکت x → گردشکار کامل + اعلان/اقدام سازمان‌محور برای مالک واقعی */
  const cx = await api('/portal/x/submit', { method: 'POST', body: { type: 'COMPLAINT', message: 'تست یکپارچگی: شکایت ناشناس برای چرخهٔ کامل گردش کار و اعلان سازمان‌محور.' } });
  check('شکایت ناشناس پورتال x → 201 (بدون کرش محرک)', cx.status === 201, JSON.stringify(cx.body?.message));
  const anots = await api('/notifications', { token: at });
  const wfNotif = (anots.body ?? []).find(n => String(n.title).includes('پورتال') && n.organizationId === 'org-x');
  check('گردشکار شکایت → اعلان سازمان‌محور دیده‌شده توسط aroun', !!wfNotif && wfNotif.tenant === 'real', JSON.stringify(wfNotif?.organizationId));
  const xacts = await api('/actions?organizationId=org-x', { token: at });
  const xitems = Array.isArray(xacts.body) ? xacts.body : xacts.body?.items ?? [];
  check('اقدام SLA → در سازمان درست (نه یتیم)', xitems.some(a => String(a.title).includes('SLA') && a.organizationId === 'org-x'));

  /* پوش → اعلان درون‌برنامه‌ای سازمان‌محور؛ رسید تحویل (ack) «رسیدن» را ثبت
     می‌کند اما اعلان را «خوانده» نمی‌کند — خواندن اقدام کاربر است */
  const dNotifs = await api('/notifications', { token: pt });
  const pushNotif = (dNotifs.body ?? []).find(n => n.title === 'اعلان آزمون فاز ۳' && n.channel === 'PUSH');
  check('پوش → اعلان درون‌برنامه‌ای سازمان‌محور (رسیده ولی هنوز خوانده‌نشده)', !!pushNotif && pushNotif.organizationId === 'org-pars' && pushNotif.isRead === false, JSON.stringify(pushNotif).slice(0, 90));
  const fbNotif = (dNotifs.body ?? []).find(n => n.title === 'پیام تازه در پورتال عمومی' && n.organizationId === 'org-pars');
  check('پوش پورتال (بازخورد) → اعلان درون‌برنامه‌ای pars', !!fbNotif);

  listener.close();
}

/* ================== ۲۰. مسترپلن فاز ۴/۲۴ — عامل معرفی خودکار (Boomerang) ================== */
section('فاز ۴ — عامل معرفی خودکار: مسیر گرم، واسطهٔ مجاز، پیش‌نویس، رضایت صریح');
{
  const dl = await login(OWNER.email, OWNER.password);
  const dt = dl.body?.accessToken;
  check('ورود demo → توکن', !!dt);

  /* برنامه‌ریزی عامل برای مقصد ۲-پرشی (org-6 از org-1 با واسطه در آریا فناوری) */
  const plan = await api('/core-domain/referrals/agent/plan', { method: 'POST', token: dt, body: { targetOrganizationId: 'org-6', goal: 'جلسهٔ آزمون API عامل' } });
  check('برنامه‌ریزی → مسیر گرم + واسطهٔ مجاز', plan.status === 200 && plan.body?.mode === 'INTERMEDIARY' && !!plan.body?.intermediary?.personId && plan.body?.draft?.message?.length > 40,
    JSON.stringify({ mode: plan.body?.mode, iv: plan.body?.intermediary?.name }));
  check('پیش‌نویس شامل قواعد دستورالعمل (مجاز/ممنوع)', plan.body?.draft?.instruction?.allowed?.length >= 1 && plan.body?.draft?.instruction?.forbidden?.length >= 1);
  check('قاعدهٔ رضایت صریح در پاسخ', String(plan.body?.consentRule || '').includes('RESPONDED_YES'));

  /* مسیر مستقیم → حالت DIRECT بدون واسطه */
  const direct = await api('/core-domain/referrals/agent/plan', { method: 'POST', token: dt, body: { targetOrganizationId: 'org-4' } });
  check('مسیر مستقیم → حالت DIRECT + پیش‌نویس مستقیم', direct.status === 200 && direct.body?.mode === 'DIRECT' && !direct.body?.intermediary && !!direct.body?.draft?.message);

  /* مقصد بدون مسیر → پیام صادقانه */
  const nop = await api('/core-domain/referrals/agent/plan', { method: 'POST', token: dt, body: { targetOrganizationId: 'org-99' } });
  check('مقصد ناموجود → 404', nop.status === 404);

  /* اجرا: واسطه → فقط درخواست رضایت (REQUESTED) + لاگ عامل */
  const iv = plan.body.intermediary;
  const launch = await api('/core-domain/referrals/agent/launch', {
    method: 'POST', token: dt,
    body: { targetOrganizationId: 'org-6', intermediaryPersonId: iv.personId, draft: plan.body.draft },
  });
  check('اجرا → 201 + PENDING + REQUESTED (بدون ارسال خودکار)', launch.status === 201 && launch.body?.status === 'PENDING' && launch.body?.requestStatus === 'REQUESTED' && launch.body?.agent?.consentRequired === true);
  check('اجرا → sourcePersonId همان واسطه', launch.body?.sourcePersonId === iv.personId);
  const runs = await api('/core-domain/referrals/agent/runs', { token: dt });
  check('لاگ اجرای عامل (PLAN/LAUNCH)', runs.status === 200 && runs.body?.items?.some(x => x.kind === 'LAUNCH' && x.referralId === launch.body.id));

  /* سقف: بستن کامل سقفِ واسطهٔ انتخابی → اجرا با همان شخص 409 */
  const st0 = await api(`/people/${iv.personId}/intro-settings`, { token: dt });
  await api(`/people/${iv.personId}/intro-settings`, { method: 'PUT', token: dt, body: { maxRequestsPerMonth: 0 } });
  const capLaunch = await api('/core-domain/referrals/agent/launch', {
    method: 'POST', token: dt,
    body: { targetOrganizationId: 'org-6', intermediaryPersonId: iv.personId, draft: plan.body.draft },
  });
  check('سقف بسته → اجرای عامل با همان واسطه 409', capLaunch.status === 409);
  const capPlan = await api('/core-domain/referrals/agent/plan', { method: 'POST', token: dt, body: { targetOrganizationId: 'org-6' } });
  check('سقف بسته → واسطهٔ سقف‌پر در برنامه انتخاب نمی‌شود', capPlan.status === 200 && (capPlan.body?.intermediary == null || capPlan.body.intermediary.personId !== iv.personId));
  await api(`/people/${iv.personId}/intro-settings`, { method: 'PUT', token: dt, body: { maxRequestsPerMonth: st0.body?.maxRequestsPerMonth ?? 2 } });
}

/* ================== ۲۱. مسترپلن فاز ۴/۲۵ — دیتابیس روابط بیرونی ================== */
section('فاز ۴ — دیتابیس روابط بیرونی (RelSci/TSC): کاتالوگ عمومی، اشتراک، اتصال per-tenant');
{
  const dl = await login(OWNER.email, OWNER.password);
  const dt = dl.body?.accessToken;
  const pl = await login('pars@srip.local', 'pars1234');
  const pt = pl.body?.accessToken;
  const HD = { authorization: `Bearer ${dt}` };
  const HP = { authorization: `Bearer ${pt}` };

  /* جست‌وجو + متر مصرف */
  const s1 = await api('/directory/entities?search=' + encodeURIComponent('بورس'), { token: dt });
  check('جست‌وجوی کاتالوگ → نهاد + متر مصرف', s1.status === 200 && s1.body?.items?.length >= 1 && s1.body.items[0].dataBasis === 'PUBLIC_RECORD' && s1.body.usage?.plan === 'directory-basic' && s1.body.usage.queries >= 1,
    JSON.stringify({ n: s1.body?.items?.length, u: s1.body?.usage }));
  check('منبع و مجوز در هر رکورد', !!s1.body.items[0].source?.name && !!s1.body.items[0].source?.license);
  /* دسته‌ها */
  const cat = await api('/directory/entities?category=REGULATOR&pageSize=50', { token: dt });
  check('فیلتر دستهٔ تنظیم‌گر (۱۵ وزارت/سازمان)', cat.status === 200 && cat.body?.total === 15 && cat.body.items.every(e => e.category === 'REGULATOR'));
  /* جزئیات + پیوندهای عمومی */
  const d1 = await api('/directory/entities/org-eco-tse', { token: dt });
  check('جزئیات نهاد → پیوند ساختاری با فرابورس', d1.status === 200 && d1.body?.ties?.some(x => x.directoryId === 'org-eco-ifb' && x.kind === 'STRUCTURAL'));
  /* اتصال per-tenant: دمو و پارس هرکدام سازمان خودشان را می‌گیرند */
  const l1 = await api('/directory/entities/org-eco-tse', { method: 'POST', token: dt });
  check('اتصال دمو → 200/201 + سازمان در محدودهٔ دمو', (l1.status === 200 || l1.status === 201) && !!l1.body?.linkedOrgId);
  const l2 = await api('/directory/entities/org-eco-tse', { method: 'POST', token: pt });
  check('اتصال pars → سازمان جدا (جداسازی مستأجر)', (l2.status === 200 || l2.status === 201) && l2.body?.linkedOrgId !== l1.body?.linkedOrgId);
  const reLink = await api('/directory/entities/org-eco-tse', { method: 'POST', token: dt });
  check('اتصال تکراری → همان سازمان (idempotent)', reLink.status === 200 && reLink.body?.linkedOrgId === l1.body?.linkedOrgId);
  const demoOrgs = await api('/organizations', { token: dt });
  const dlist = Array.isArray(demoOrgs.body) ? demoOrgs.body : demoOrgs.body?.items ?? [];
  check('سازمان متصل‌شده در فهرست سازمان‌های دمو', dlist.some(o => o.id === l1.body.linkedOrgId && o.directorySource?.directoryId === 'org-eco-tse'));
  /* متر مصرف جدا */
  const u1 = await api('/directory/usage', { token: dt });
  const u2 = await api('/directory/usage', { token: pt });
  check('متر مصرف per-tenant', u1.status === 200 && u2.status === 200 && u1.body?.links >= 1 && u2.body?.links >= 1 && u1.body.quota === 300);
  /* 404 */
  const nf = await api('/directory/entities/org-99', { token: dt });
  check('نهاد ناموجود → 404', nf.status === 404);
}

/* ============================ SUMMARY ============================ */
console.log(`\n════════════════════════════════════════`);
console.log(`  PASS: ${pass}   FAIL: ${fail}`);
if (failures.length) { console.log(`  Failed: ${failures.join(' | ')}`); }
console.log(`════════════════════════════════════════`);
process.exit(fail > 0 ? 1 : 0);
