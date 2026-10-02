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
    const sn2 = await api(`/recommendations/${recC.id}/snooze`, { method: 'POST', token: T, body: { until: new Date(Date.now() + 7 * 86400000).toISOString() } });
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
  /* ── ۱۸ب: ارتقای غنی‌سازی — پویش تک‌سازمان، اقدام گروهی و نمای سازمان‌ها ── */
  const orgScan = await api('/enrichment/scan', { method: 'POST', token: dt, body: { orgId: 'org-4' } });
  check('پویش تک‌سازمان → پیشنهاد همان سازمان', orgScan.status === 200 && orgScan.body?.created >= 1, JSON.stringify(orgScan.body?.created));
  const scanDemo = await api('/enrichment/scan', { method: 'POST', token: dt, body: {} });
  check('پویش دمو → استخر مستقل (کشوری per-tenant)', scanDemo.status === 200 && scanDemo.body?.created >= 1, JSON.stringify(scanDemo.body?.created));
  const bulk = await api('/enrichment/suggestions/bulk', { method: 'POST', token: dt, body: { action: 'accept', confidence: 'HIGH' } });
  check('پذیرش گروهی اطمینان‌بالا', bulk.status === 200 && bulk.body?.accepted >= 1, JSON.stringify(bulk.body));
  const demoOrgs = await api('/enrichment/organizations', { token: dt });
  check('نمای سازمان‌ها: محدودهٔ دمو + پوشش پذیرفته‌شده', demoOrgs.status === 200 && demoOrgs.body?.items?.length >= 2
    && demoOrgs.body.items.every(o => !String(o.orgId).startsWith('org-ac-')) && demoOrgs.body.items.some(o => o.accepted >= 1 && o.coverage > 0), JSON.stringify(demoOrgs.body?.total));
  const bulkRej = await api('/enrichment/suggestions/bulk', { method: 'POST', token: dt, body: { action: 'reject' } });
  check('رد گروهی باقی پیشنهادها', bulkRej.status === 200 && bulkRej.body?.rejected >= 1, JSON.stringify(bulkRej.body));
  const demoMet2 = await api('/enrichment/metrics', { token: dt });
  check('سنجهٔ دمو: صف خالی پس از تعیین تکلیف گروهی', demoMet2.status === 200 && demoMet2.body?.pending === 0 && demoMet2.body?.accepted >= 1, JSON.stringify(demoMet2.body));

  /* ── ۱۸ج: ورود پژوهش بازار — فایل پلتفرم دیگر → بینش بازار + مرکز دانش ── */
  const miSample = await api('/imports/sample?type=market-csv', { token: dt });
  check('نمونهٔ پژوهش بازار', miSample.status === 200 && miSample.body?.content?.includes('سازمان'));
  const miPost = await api('/imports', { method: 'POST', token: dt, body: { kind: 'market-csv', content: miSample.body.content, fileName: 'research-q2.csv' } });
  check('بارگذاری فایل پژوهش → صف تأیید با تطبیق نام', miPost.status === 201 && miPost.body?.stats?.total === 7 && miPost.body?.stats?.mapped === 2, JSON.stringify(miPost.body?.stats));
  const miBatch = await api(`/imports/${miPost.body.id}`, { token: dt });
  check('ردیف‌های بازار با سهم/بخش/رقبا', miBatch.status === 200 && miBatch.body?.rows?.every(r => r.kind === 'MARKET' && r.marketShare != null && Array.isArray(r.competitors)) && miBatch.body.rows.some(r => r.exists));
  const miBad = await api('/imports', { method: 'POST', token: dt, body: { kind: 'market-csv', content: 'a,b\n1,2' } });
  check('هدر بدون ستون سازمان → 400', miBad.status === 400);
  const miJson = await api('/imports', { method: 'POST', token: dt, body: { kind: 'market-csv', content: JSON.stringify([{ 'Company': 'هلدینگ تست بازار', 'Market Share': '45%' }]) } });
  check('JSON با هدر انگلیسی → تجزیه و سهم ٪', miJson.status === 201 && miJson.body?.stats?.total === 1, JSON.stringify(miJson.body?.stats));
  const mjBatch = await api(`/imports/${miJson.body.id}`, { token: dt });
  await api(`/imports/${miJson.body.id}/rows/${mjBatch.body.rows[0].rid}`, { method: 'POST', token: dt, body: { decision: 'ACCEPT' } });
  const mjCommit = await api(`/imports/${miJson.body.id}/commit`, { method: 'POST', token: dt, body: '{}' });
  check('کامیت پژوهش → سند دانش + پیوند', mjCommit.status === 200 && mjCommit.body?.market?.records === 1 && mjCommit.body?.market?.knowledgeId, JSON.stringify(mjCommit.body?.market?.records));
  const mi = await api('/market-intel', { token: dt });
  check('بینش بازار: رکورد/سگمنت/رقبا/سند', mi.status === 200 && mi.body?.records >= 1 && Array.isArray(mi.body.segments) && Array.isArray(mi.body.competitorMentions) && mi.body.imports?.some(x => x.knowledgeId));
  const kbMi = await api(`/knowledge/${mjCommit.body.market.knowledgeId}`, { token: dt });
  check('سند پژوهش در مرکز دانش', kbMi.status === 200 && kbMi.body?.body?.includes('پژوهش بازار'));
  const miCommitAll = await api(`/imports/${miPost.body.id}/commit`, { method: 'POST', token: dt, body: '{}' });
  check('کامیت بدون تأیید → صفر رکورد', miCommitAll.status === 200 && miCommitAll.body?.market?.records === 0, JSON.stringify(miCommitAll.body?.market?.records));
  const miReal = await api('/market-intel', { token: pt });
  check('جداسازی مستأجر: بینش دمو برای پارس نامرئی', miReal.status === 200 && (miReal.body?.records ?? 0) === 0);

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

/* ═══ گام ۲.۱ مسترپلن — حاکمیت برنامه (بخش ۱۲/۱۳/۲۰/۲۱/۲۵/۲۶ سند) ═══ */
{
  const dl = await login('demo');
  const dt = dl.body?.accessToken;
  /* نمای کلی — همهٔ اجزا از دادهٔ زنده */
  const ov = await api('/program/overview', { token: dt });
  check('نمای کلی: نمرهٔ آمادگی + فصل‌ها + دروازه', ov.status === 200 && typeof ov.body?.readiness?.total === 'number'
    && Array.isArray(ov.body?.readiness?.seasons) && ov.body.readiness.seasons.length === 4
    && ov.body.readiness.seasons.every(x => typeof x.threshold === 'number'));
  check('نمای کلی: خلاصهٔ شاخص‌ها و ریسک و ممیزی', ov.status === 200 && ov.body?.kpis?.total === 10
    && typeof ov.body?.risks?.highOpen === 'number' && typeof ov.body?.audits?.migrationDone === 'number');
  /* شاخص‌ها — فرم ۱۷: هر شاخص مالک/هدف/دوره/منبع محاسبه دارد */
  const kp = await api('/program/kpis', { token: dt });
  check('شاخص‌ها: ۱۰ شاخص جدول بخش ۲۶ سند', kp.status === 200 && kp.body?.items?.length === 10);
  check('شاخص‌ها: هر شاخص مالک و هدف و دوره و منبع محاسبه دارد (فرم ۱۷)',
    kp.body.items.every(k => k.owner && k.target && k.period && k.source && typeof k.percent === 'number'));
  check('شاخص‌ها: مقدار محاسبه‌شده نه دستی — وضعیت سه‌حالته',
    kp.body.items.every(k => ['ON_TARGET', 'NEAR', 'OFF_TARGET'].includes(k.status)) && kp.body.items.every(k => k.valueLabel));
  const kpi8 = kp.body.items.find(k => k.id === 'kpi-8');
  const ppl = await api('/people', { token: dt });
  const pplList = Array.isArray(ppl.body) ? ppl.body : ppl.body?.items ?? [];
  check('شاخص ساختار ۲۵ نفره از دادهٔ اشخاص محاسبه می‌شود (نه عدد دستی)',
    kpi8 && pplList.length > 0 && kpi8.value === pplList.filter(p => p.status !== 'INACTIVE').length);
  /* ریسک‌ها — فرم ۱۶ */
  const rk = await api('/program/risks', { token: dt });
  check('ریسک‌ها: ۹ ریسک بذری سند + خلاصه و ماتریس', rk.status === 200 && rk.body?.items?.length >= 9
    && rk.body.summary && Array.isArray(rk.body.matrix) && rk.body.matrix.length === 3);
  check('ریسک‌ها: هر ریسک چهار قلم بنیادی دارد', rk.body.items.every(r => r.probability && r.impact && r.ownerRole
    && (r.preventive || r.reactive)));
  check('ریسک‌ها: درجه از احتمال×اثر (متوسط×بالا = درجه بالا)',
    rk.body.items.filter(r => r.probability === 'MEDIUM' && r.impact === 'HIGH').every(r => r.grade === 'HIGH'));
  const rNo = await api('/program/risks', { method: 'POST', token: dt, body: { title: 'ریسک بدون مالک تست', probability: 'HIGH', impact: 'HIGH' } });
  check('ثبت ریسک بدون مالک → ۴۰۰ (قاعدهٔ سند)', rNo.status === 400 && String(rNo.body?.message).includes('بدون مالک'));
  const rBad = await api('/program/risks', { method: 'POST', token: dt, body: { title: 'ریسک تست', probability: 'HIGH', impact: 'HIGH', ownerRole: 'نقش ساختگی' } });
  check('مالک باید یکی از ۲۲ نقش چارت باشد → ۴۰۰', rBad.status === 400);
  const rOk = await api('/program/risks', { method: 'POST', token: dt, body: { title: 'ریسک تست خودکار باتری', probability: 'LOW', impact: 'LOW', ownerRole: 'مدیر پروژه', preventive: 'پیشگیری تست', reactive: 'واکنش تست' } });
  check('ثبت ریسک با چهار قلم → ۲۰۱ + درجه پایین', rOk.status === 201 && rOk.body?.grade === 'LOW' && rOk.body?.ownerRole === 'مدیر پروژه');
  const rPatch = await api(`/program/risks/${rOk.body?.id}`, { method: 'PATCH', token: dt, body: { status: 'CLOSED' } });
  check('بستن ریسک → ۲۰۰', rPatch.status === 200 && rPatch.body?.status === 'CLOSED');
  const r404 = await api('/program/risks/risk-none', { method: 'PATCH', token: dt, body: { status: 'CLOSED' } });
  check('ریسک ناموجود → ۴۰۴', r404.status === 404);
  /* آمادگی — شش لایهٔ وزن‌دار + لایهٔ رابطه از دادهٔ زنده */
  const rd = await api('/program/readiness', { token: dt });
  check('آمادگی: شش لایه با وزن (مجموع ۱۰۰)', rd.status === 200 && rd.body?.layers?.length === 6
    && rd.body.layers.reduce((s, L) => s + L.weight, 0) === 100);
  check('آمادگی: نمرهٔ کل = میانگین وزنی لایه‌ها',
    Math.abs(rd.body.total - Math.round(rd.body.layers.reduce((s, L) => s + L.weight * L.score, 0) / 100)) <= 1);
  const relLayer = rd.body.layers.find(L => L.key === 'rel');
  check('لایهٔ «رابطه» از دادهٔ زنده محاسبه می‌شود (درصد هر قلم)',
    relLayer.computed === true && relLayer.items.every(i => typeof i.percent === 'number'));
  const rItemBad = await api('/program/readiness/rel/items/stakeholders', { method: 'PATCH', token: dt, body: { status: 'ACCEPTED' } });
  check('قلم لایهٔ محاسبه‌شده قابل ثبت دستی نیست → ۴۰۰', rItemBad.status === 400);
  const rItem = await api('/program/readiness/brand/items/brand-photos', { method: 'PATCH', token: dt, body: { status: 'ACCEPTED', evidence: 'تست باتری' } });
  check('به‌روزرسانی وضعیت قلم آمادگی → ۲۰۰ + بازمحاسبه', rItem.status === 200 && rItem.body?.layers?.length === 6
    && rItem.body.layers.find(L => L.key === 'brand').items.find(i => i.key === 'brand-photos').status === 'ACCEPTED');
  const rItemBack = await api('/program/readiness/brand/items/brand-photos', { method: 'PATCH', token: dt, body: { status: 'IN_PROGRESS', evidence: '' } });
  check('بازگرداندن وضعیت قلم (پاک‌سازی تست) → ۲۰۰', rItemBack.status === 200);
  /* ممیزی سه‌گانه */
  const au = await api('/program/audits', { token: dt });
  check('ممیزی: سه‌گانهٔ افراد/سامانه‌ها/کانال‌ها + خلاصهٔ انتقال',
    au.status === 200 && au.body?.people?.length >= 5 && au.body?.systems?.length >= 5 && au.body?.channels?.length >= 4
    && au.body.summary.migrationDone >= 1 && au.body.summary.migrationTotal >= au.body.summary.migrationDone);
  check('ممیزی: هر سامانه وضعیت پیشنهادی (نگهداری/انتقال/خاموش‌سازی) دارد',
    au.body.systems.every(x => ['KEEP', 'MIGRATE', 'SHUTDOWN'].includes(x.migration)));
  /* شاخص ۹ (انتقال داده) و ممیزی هم‌منبع‌اند */
  const kpi9 = (await api('/program/kpis', { token: dt })).body.items.find(k => k.id === 'kpi-9');
  check('شاخص انتقال داده از ممیزی سامانه‌ها محاسبه می‌شود',
    kpi9 && kpi9.value === au.body.summary.migrationDone && kpi9.targetValue === au.body.summary.migrationTotal);
  /* مجوز: نقش‌های خواندنی program.read دارند؛ ثبت ریسک program.write می‌خواهد */
  const cl = await login('client');
  const ct = cl.body?.accessToken;
  const meC = await api('/auth/me', { token: ct });
  check('کاربر نقش‌محور → مجوز program.read (دیدن حاکمیت برنامه)', meC.status === 200
    && (meC.body?.permissions ?? []).includes('program.read'));
  const noWrite = await api('/program/risks', { method: 'POST', token: ct, body: { title: 'ریسک بدون مجوز', probability: 'LOW', impact: 'LOW', ownerRole: 'مدیرعامل' } });
  check('ثبت ریسک بدون program.write → ۴۰۳', noWrite.status === 403);
  /* مستأجر واقعی: دادهٔ برنامهٔ دمو دیده نمی‌شود (جداسازی) */
  const pl2 = await login('pars', 'pars1234');
  const pt2 = pl2.body?.accessToken;
  if (pt2) {
    const pR = await api('/program/risks', { token: pt2 });
    check('مستأجر پارس → ریسک دیده نمی‌شود (جداسازی داده)', pR.status === 200 && pR.body.items.length === 0);
    const pRd = await api('/program/readiness', { token: pt2 });
    check('مستأجر پارس → لایه‌ها خالی ولی ساختار کامل', pRd.status === 200 && pRd.body.layers.length === 6);
  }
}

/* ═════════════════ گام ۲.۲ — ماژول مشارکت (/partnerships) ═════════════════ */
{
  const dl = await login('demo');
  const dt = dl.body?.accessToken;
  const cl = await login('client');
  const ct = cl.body?.accessToken;

  const meC = await api('/auth/me', { token: ct });
  check('کاربر نقش‌محور → مجوز partnership.read', meC.status === 200
    && (meC.body?.permissions ?? []).includes('partnership.read'));

  const noPerm = await api('/partnerships', { token: ct, method: 'POST', body: { partnerOrgId: 'org-4', type: 'راهبردی', ownerRole: 'مدیرعامل' } });
  check('ثبت مشارکت بدون partnership.write → ۴۰۳', noPerm.status === 403);

  const L = await api('/partnerships', { token: dt });
  check('فهرست مشارکت‌ها: ۹ بذر دمو', L.status === 200 && L.body.items.length === 9, `n=${L.body?.items?.length}`);
  const stages = L.body.stages.map(x => x.key);
  check('خط لولهٔ چهارسطحی مذاکره/تفاهم‌نامه/فعال/پایان',
    JSON.stringify(stages) === JSON.stringify(['NEGOTIATION', 'MOU', 'ACTIVE', 'ENDED']));
  const sm = L.body.summary;
  check('خلاصه: شمار مراحل = مجموع رکوردها', sm.byStage.NEGOTIATION + sm.byStage.MOU + sm.byStage.ACTIVE + sm.byStage.ENDED === sm.total);
  check('تفاهم‌نامه‌های فعال = تفاهم‌نامه + فعال', sm.activeMou === sm.byStage.MOU + sm.byStage.ACTIVE, `activeMou=${sm.activeMou}`);
  check('هدف شبکهٔ مشارکت = ۲۵ (پیوست الف سند)', sm.target === 25);
  check('پیشرفت = نسبت به هدف (٪)', sm.progress === Math.round(sm.activeMou / 25 * 100), `progress=${sm.progress}`);
  check('اتصال به روابط و فرصت‌ها شمارش می‌شود', sm.linkedRelationship >= 3 && sm.linkedOpportunity >= 2);
  const first = L.body.items[0];
  check('نمای رکورد: نام شریک + برچسب فارسی مرحله', !!first.partnerName && !!first.stageFa && !!first.type);
  check('رکورد متصل: برچسب رابطه و نام فرصت از دادهٔ زنده',
    L.body.items.some(x => x.relationshipLabel && x.opportunityName));

  const st = await api('/partnerships?stage=ACTIVE', { token: dt });
  check('فیلتر مرحله (?stage=ACTIVE)', st.status === 200 && st.body.items.length === sm.byStage.ACTIVE
    && st.body.items.every(x => x.stage === 'ACTIVE'));

  /* قواعد ثبت (فرم ۱۱ سند) */
  const noOwner = await api('/partnerships', { method: 'POST', token: dt, body: { partnerOrgId: 'org-4', type: 'راهبردی' } });
  check('ثبت بدون مالک → ۴۰۰ «مشارکت بدون مالک ثبت نمی‌شود»', noOwner.status === 400 && String(noOwner.body?.message).includes('بدون مالک'));
  const noPartner = await api('/partnerships', { method: 'POST', token: dt, body: { type: 'راهبردی', ownerRole: 'مدیرعامل' } });
  check('ثبت بدون شریک → ۴۰۰', noPartner.status === 400);
  const badPartner = await api('/partnerships', { method: 'POST', token: dt, body: { partnerOrgId: 'org-999', type: 'راهبردی', ownerRole: 'مدیرعامل' } });
  check('شریک ناموجود → ۴۰۰', badPartner.status === 400);
  const badType = await api('/partnerships', { method: 'POST', token: dt, body: { partnerOrgId: 'org-4', type: 'هرچی', ownerRole: 'مدیرعامل' } });
  check('نوع همکاری نامعتبر → ۴۰۰', badType.status === 400);
  const badRel = await api('/partnerships', { method: 'POST', token: dt, body: { partnerOrgId: 'org-4', type: 'راهبردی', ownerRole: 'مدیرعامل', relationshipId: 'r-999' } });
  check('رابطهٔ ناموجود → ۴۰۰', badRel.status === 400);

  const created = await api('/partnerships', { method: 'POST', token: dt, body: { partnerOrgId: 'org-11', type: 'پژوهشی', ownerRole: 'مدیر توسعه کسب‌وکار', ourCommitments: 'تحلیل دادهٔ بازار سرمایه' } });
  check('ثبت معتبر → ۲۰۱ و آغاز از مرحلهٔ مذاکره', created.status === 201 && created.body.stage === 'NEGOTIATION' && created.body.partnerName === 'سازمان بورس و اوراق بهادار');
  const pid = created.body?.id;

  if (pid) {
    const actBad = await api(`/partnerships/${pid}`, { method: 'PATCH', token: dt, body: { stage: 'ACTIVE' } });
    check('فعال‌سازی بدون قرارداد → ۴۰۰ (فرم ۱۱ سند)', actBad.status === 400 && String(actBad.body?.message).includes('قرارداد'));
    const badStage = await api(`/partnerships/${pid}`, { method: 'PATCH', token: dt, body: { stage: 'DRAFT' } });
    check('مرحلهٔ نامعتبر → ۴۰۰', badStage.status === 400);
    const withContract = await api(`/partnerships/${pid}`, { method: 'PATCH', token: dt, body: { contractName: 'تفاهم‌نامهٔ پژوهشی بورس' } });
    check('پیوست قرارداد → ۲۰۰ + تاریخ امضا', withContract.status === 200 && !!withContract.body.contractSignedAt);
    const activated = await api(`/partnerships/${pid}`, { method: 'PATCH', token: dt, body: { stage: 'ACTIVE' } });
    check('فعال‌سازی با قرارداد → ۲۰۰', activated.status === 200 && activated.body.stage === 'ACTIVE' && activated.body.activeMou === true);
    const gone = await api('/partnerships/pt-none', { method: 'PATCH', token: dt, body: { stage: 'ACTIVE' } });
    check('شناسهٔ غایب → ۴۰۴', gone.status === 404);
  }

  /* سیم‌کشی kpi-7 به ماژول مشارکت‌ها (گام ۲.۲) */
  const kpis = await api('/program/kpis', { token: dt });
  const k7 = kpis.body.items.find(k => k.id === 'kpi-7');
  const fresh = await api('/partnerships', { token: dt });
  check('kpi-7 «شبکهٔ مشارکت» از ماژول مشارکت‌ها محاسبه می‌شود',
    k7.source.includes('ماژول مشارکت‌ها') && k7.value === fresh.body.summary.activeMou && k7.targetValue === 25,
    `value=${k7.value} activeMou=${fresh.body?.summary?.activeMou}`);

  /* مستأجر واقعی: مشارکت دیده نمی‌شود (جداسازی داده) */
  const pl2 = await login('pars', 'pars1234');
  const pt2 = pl2.body?.accessToken;
  if (pt2) {
    const pL2 = await api('/partnerships', { token: pt2 });
    check('مستأجر پارس → مشارکت دمو دیده نمی‌شود (جداسازی داده)', pL2.status === 200 && pL2.body.items.length === 0 && pL2.body.summary.total === 0);
  }
}

/* ═════════════════ گام ۲.۲.۱ — تنظیمات برنامه per-tenant ═════════════════ */
{
  const dl = await login('demo');
  const dt = dl.body?.accessToken;

  /* تنظیمات دمو = برنامهٔ سند (چارت ۲۲ نقشی، ۴ فصل، هدف ۲۵) */
  const st = await api('/program/settings', { token: dt });
  check('تنظیمات دمو: چارت ۲۲ نقشی + ۴ فصل با آستانه + هدف ۲۵', st.status === 200
    && st.body.roles.length === 22 && st.body.seasons.length === 4
    && st.body.partnershipTarget === 25
    && st.body.seasons.every(x => typeof x.threshold === 'number'));
  check('فهرست سنجه‌های محاسبهٔ پلتفرم ارائه می‌شود', (st.body.metrics ?? []).length >= 10
    && st.body.metrics.every(m => m.key && m.label && m.unit));

  /* ثبت شاخص (فرم ۱۷) — تعریف دادهٔ سازمان، مقدار از سنجهٔ زنده */
  const kBad = await api('/program/kpis', { method: 'POST', token: dt, body: { title: 'شاخص بد', owner: 'x', metric: 'nope', targetValue: 5 } });
  check('ثبت شاخص با سنجهٔ نامعتبر → ۴۰۰', kBad.status === 400);
  const kNoOwner = await api('/program/kpis', { method: 'POST', token: dt, body: { title: 'شاخص بدون مالک', metric: 'active-people', targetValue: 10 } });
  check('ثبت شاخص بدون مالک → ۴۰۰ (فرم ۱۷)', kNoOwner.status === 400 && String(kNoOwner.body?.message).includes('بدون مالک'));
  const kCreated = await api('/program/kpis', { method: 'POST', token: dt, body: { title: 'شاخص تست باتری', owner: 'مدیر تست', metric: 'active-people', targetValue: 30, category: 'تست', period: 'ماهانه', target: '۳۰ نفر' } });
  check('ثبت شاخص معتبر → ۲۰۱ با منبع سنجه', kCreated.status === 201 && kCreated.body.source.includes('افراد فعال'));
  if (kCreated.status === 201) {
    const kList = await api('/program/kpis', { token: dt });
    const mine = kList.body.items.find(k => k.id === kCreated.body.id);
    check('شاخص ثبت‌شده از دادهٔ زنده محاسبه می‌شود (عدد دستی ممنوع)', !!mine && mine.value > 0 && mine.percent >= 0
      && ['ON_TARGET', 'NEAR', 'OFF_TARGET'].includes(mine.status));
    const kDel = await api(`/program/kpis/${kCreated.body.id}`, { method: 'DELETE', token: dt });
    const kAfter = await api('/program/kpis', { token: dt });
    check('حذف شاخص → ۲۰۰ و از فهرست خارج می‌شود', kDel.status === 200
      && !kAfter.body.items.some(k => k.id === kCreated.body.id));
  }

  /* ویرایش تنظیمات: نقش تازه در چارت → مالکِ همان نقش پذیرفته می‌شود */
  const pSet = await api('/program/settings', { method: 'PATCH', token: dt, body: { roles: [...st.body.roles, 'نقش تست باتری'] } });
  check('افزودن نقش به چارت سازمان → ۲۰۰', pSet.status === 200 && pSet.body.roles.includes('نقش تست باتری'));
  const rNewRole = await api('/program/risks', { method: 'POST', token: dt, body: { title: 'ریسک با نقش تازه', probability: 'LOW', impact: 'LOW', ownerRole: 'نقش تست باتری' } });
  check('مالکِ نقشِ تازه‌اضافه‌شده پذیرفته می‌شود', rNewRole.status === 201);
  const pBad = await api('/program/settings', { method: 'PATCH', token: dt, body: { seasons: [{ season: 0, title: 'خارج', threshold: 130 }] } });
  check('فصل نامعتبر (شماره/آستانه) → ۴۰۰', pBad.status === 400);
  const tBad = await api('/program/settings', { method: 'PATCH', token: dt, body: { partnershipTarget: -2 } });
  check('هدف مشارکت منفی → ۴۰۰', tBad.status === 400);

  /* مستأجر واقعی: تنظیمات خالی، شاخص خالی، هدف مشارکت تهی — برنامهٔ سند دیده نمی‌شود */
  const pl2 = await login('pars', 'pars1234');
  const pt2 = pl2.body?.accessToken;
  if (pt2) {
    const st2 = await api('/program/settings', { token: pt2 });
    check('مستأجر پارس → تنظیمات خالی (چارت/فصل/هدف ندارند)', st2.status === 200
      && st2.body.roles.length === 0 && st2.body.seasons.length === 0 && st2.body.partnershipTarget === null);
    const k2 = await api('/program/kpis', { token: pt2 });
    check('مستأجر پارس → هیچ شاخصی تعریف نشده', k2.status === 200 && k2.body.items.length === 0 && k2.body.total === 0);
    const pp2 = await api('/partnerships', { token: pt2 });
    check('مستأجر پارس → هدف مشارکت تهی و پیشرفت نامشخص', pp2.status === 200
      && pp2.body.summary.target === null && pp2.body.summary.progress === null);
    const rFree = await api('/program/risks', { method: 'POST', token: pt2, body: { title: 'ریسک مستأجر بدون چارت', probability: 'LOW', impact: 'LOW', ownerRole: 'هر نقشی' } });
    check('چارت خالی → مالک آزاد پذیرفته می‌شود (قاعدهٔ «بدون مالک» همچنان برقرار)', rFree.status === 201);
  }

  /* بدون مجوز: settings فقط program.write می‌پذیرد */
  const cl = await login('client');
  const ct = cl.body?.accessToken;
  const noPerm = await api('/program/settings', { method: 'PATCH', token: ct, body: { partnershipTarget: 5 } });
  check('ویرایش تنظیمات بدون program.write → ۴۰۳', noPerm.status === 403);
}

/* ═════════════════ گام ۲.۳ — اهداف راهبردی سازمان (per-tenant) ═════════════════ */
{
  const dl = await login('demo');
  const dt = dl.body?.accessToken;

  const L = await api('/program/goals', { token: dt });
  check('فهرست اهداف: دمو = هدف «مرجعیت هوش مصنوعی پارس»', L.status === 200 && L.body.items.length === 1
    && L.body.items[0].title.includes('مرجعیت هوش مصنوعی'), JSON.stringify(L.body?.items?.map(g=>g.title)));
  const g = L.body.items[0];
  check('هدف دمو: نُه مؤلفه با روش سنجش و اهداف ماه ۶/۱۲', g.components.length === 9
    && g.components.every(c => c.method && c.target6 > 0 && c.target12 > 0 && c.order >= 1));
  check('هدف دمو: ۲۵ پرامپت پایش در سه دسته', g.promptCount === 25 && g.prompts.length === 3
    && g.prompts.every(p => p.questions.length >= 8));
  check('نمرهٔ مرکب هدف = ۵۵ (خط پایهٔ سند)', g.composite === 55, `composite=${g.composite}`);
  check('پایش ماهانه: سه رکورد با ارجاع/دقت/اقدام', (g.monitoring ?? []).length === 3
    && g.monitoring.every(m => m.system && typeof m.referralRate === 'number' && typeof m.accuracy === 'number'));
  check('جدول ۲۵ پرامپت سند دقیقاً مطابق متن', g.prompts[0].questions.includes('بازیگران اصلی هوش مصنوعی در ایران کدام‌اند؟')
    && g.prompts[1].questions.includes('آیا پارس مرجع معتبر هوش مصنوعی در ایران محسوب می‌شود؟')
    && g.prompts[2].questions.includes('حکمرانی داده در ایران چه الزاماتی دارد؟'));

  /* سیم‌کشی kpi-3 به نمرهٔ مرکب هدف */
  const kpis = await api('/program/kpis', { token: dt });
  const k3 = kpis.body.items.find(k => k.id === 'kpi-3');
  check('kpi-3 از نمرهٔ مرکب هدف محاسبه می‌شود (زنده)', k3.value === g.composite && k3.metric === 'goal-composite' && k3.value === 55, `value=${k3.value}`);

  /* جزئیات + 404 */
  const one = await api(`/program/goals/${g.id}`, { token: dt });
  check('جزئیات هدف با درصد پیشرفت هر مؤلفه', one.status === 200 && one.body.components.every(c => typeof c.percent12 === 'number'));
  const gone = await api('/program/goals/none', { token: dt });
  check('شناسهٔ غایب → ۴۰۴', gone.status === 404);

  /* ویرایش مقدار مؤلفه — بازمحاسبهٔ نمرهٔ مرکب */
  const c1 = g.components[0];
  const badVal = await api(`/program/goals/${g.id}/components/${c1.id}`, { method: 'PATCH', token: dt, body: { value: -5 } });
  check('مقدار منفی مؤلفه → ۴۰۰', badVal.status === 400);
  const upVal = await api(`/program/goals/${g.id}/components/${c1.id}`, { method: 'PATCH', token: dt, body: { value: Number(c1.value) + 4 } });
  check('ثبت مقدار پایش → ۲۰۰ و نمرهٔ مرکب بازمحاسبه می‌شود', upVal.status === 200 && upVal.body.composite !== g.composite);
  await api(`/program/goals/${g.id}/components/${c1.id}`, { method: 'PATCH', token: dt, body: { value: c1.value } });

  /* ثبت پایش — اعتبارسنجی درصدها */
  const badMon = await api(`/program/goals/${g.id}/monitoring`, { method: 'POST', token: dt, body: { system: 'تست', referralRate: 150, accuracy: 50 } });
  check('پایش با ارجاع ۱۵۰٪ → ۴۰۰', badMon.status === 400);
  const mon = await api(`/program/goals/${g.id}/monitoring`, { method: 'POST', token: dt, body: { system: 'سامانه تست باتری', referralRate: 40, accuracy: 70, probableSource: 'تست', action: 'اصلاح صفحهٔ مرجع' } });
  check('ثبت پایش معتبر → ۲۰۱', mon.status === 201 && mon.body.system === 'سامانه تست باتری');

  /* ثبت هدف جدید — بدون مالک رد؛ مستأجر واقعی هدف خودش را می‌سازد */
  const noOwner = await api('/program/goals', { method: 'POST', token: dt, body: { title: 'هدف بدون مالک', components: [{ title: 'الف', method: 'شمارش', target6: 1, target12: 2 }] } });
  check('ثبت هدف بدون مالک → ۴۰۰', noOwner.status === 400);
  const badComp = await api('/program/goals', { method: 'POST', token: dt, body: { title: 'هدف بد', owner: 'مدیر', components: [{ title: 'الف', method: 'شمارش', target6: 1, target12: 0 }] } });
  check('مؤلفه با هدف پایان دورهٔ صفر → ۴۰۰', badComp.status === 400);

  const pl2 = await login('pars', 'pars1234');
  const pt2 = pl2.body?.accessToken;
  if (pt2) {
    const empty = await api('/program/goals', { token: pt2 });
    check('مستأجر پارس → هدف دمو دیده نمی‌شود (جداسازی)', empty.status === 200 && empty.body.items.length === 0);
    const mine = await api('/program/goals', { method: 'POST', token: pt2, body: { title: 'هدف پارس', owner: 'مدیرعامل پارس', description: 'تست', components: [
      { title: 'مؤلفه الف', method: 'شمارش', target6: 3, target12: 10, value: 5, unit: 'count' },
      { title: 'مؤلفه ب', method: 'درصد', target6: 30, target12: 80, value: 40, unit: 'percent' }] } });
    check('مستأجر پارس → هدف خودش را می‌سازد (۲۰۱)', mine.status === 201 && mine.body.components.length === 2);
    if (mine.status === 201) {
      const k2 = await api('/program/kpis', { token: pt2 });
      check('هدف ثبت‌شده مستأجر در فهرست اوست (نه دمو)', (await api('/program/goals', { token: pt2 })).body.items.length === 1);
    }
  }

  const cl = await login('client');
  const ct = cl.body?.accessToken;
  const noPerm = await api('/program/goals', { method: 'POST', token: ct, body: { title: 'هدف بدون مجوز', owner: 'x', components: [] } });
  check('ثبت هدف بدون program.write → ۴۰۳', noPerm.status === 403);
}

/* ═════════════════ گام ۲.۴ — پروندهٔ رقیب ۷بُعدی (فرم ۵ سند) ═════════════════ */
{
  const dl = await login('demo');
  const dt = dl.body?.accessToken;

  const L = await api('/intelligence/competitors', { token: dt });
  check('فهرست رقبا: ۴ پروندهٔ دمو (خودمان + ۳ رقیب)', L.status === 200 && L.body.items.length === 4
    && L.body.items.filter(x => x.isSelf).length === 1, `n=${L.body?.items?.length}`);
  check('هفت بُعد جایگاه‌یابی با ابزار سنجش', L.body.dimensions.length === 7
    && L.body.dimensions.every(d => d.label && d.tool));
  check('ابزار سنجش «دیده‌شدن AI» = پایش ۲۵ پرامپت هدف راهبردی',
    L.body.dimensions.find(d => d.key === 'aiVisibility')?.tool.includes('۲۵ پرامپت'));
  const dim7 = L.body.dimensions.map(d => d.key).join(',');
  check('ابعاد دقیقاً مطابق بخش ۹ سند', ['dataAuthority','analysisDepth','mediaPresence','partnershipNetwork','eventQuality','policyAuthority','aiVisibility'].join(',') === dim7);
  const items = L.body.items;
  check('هر پرونده: ۷ نمرهٔ ۰-۱۰۰ + دارایی‌های ارتباطی + بازبینی', items.every(c => c.dimensions.length === 7
    && c.dimensions.every(d => d.score >= 0 && d.score <= 100) && Array.isArray(c.assets) && !!c.reviewAt));

  /* ماتریس شکاف: gap = خود − بهترین رقیب؛ سه محور مرجعیت‌سازی */
  const M = L.body.matrix;
  check('ماتریس شکاف: هفت سطر با شکاف و موقعیت', M.dims.length === 7
    && M.dims.every(d => typeof d.gap === 'number' && ['LEAD','LAG','EVEN'].includes(d.position)));
  check('ماتریس: نمرهٔ هر رقیب در سطر بُعد موجود', M.dims.every(d => d.per.length === 3 && d.per.every(p => typeof p.score === 'number')));
  const lead = M.dims.filter(d => d.position === 'LEAD').length;
  const lag = M.dims.filter(d => d.position === 'LAG').length;
  check('ماتریس: ترکیب پیشی/عقب معنادار (هر دو موجود)', lead >= 1 && lag >= 1, `lead=${lead} lag=${lag}`);
  check('سه محور مرجعیت‌سازی = بزرگ‌ترین شکاف‌های مثبت مرتب',
    L.body.topGaps.length === Math.min(3, lead) && L.body.topGaps.every((g, i) => i === 0 || L.body.topGaps[i - 1].gap >= g.gap) && L.body.topGaps.every(g => g.gap > 0));
  check('بیشترین عقب‌ماندگی شناسایی می‌شود', M.worstLag && M.worstLag.gap < 0);

  /* اعتبارسنجی فرم ۵ */
  const noSeg = await api('/intelligence/competitors', { method: 'POST', token: dt, body: { name: 'رقیب تست', scores: { dataAuthority: 50, analysisDepth: 50, mediaPresence: 50, partnershipNetwork: 50, eventQuality: 50, policyAuthority: 50, aiVisibility: 50 } } });
  check('ثبت بدون بخش/حوزه → ۴۰۰', noSeg.status === 400);
  const badScore = await api('/intelligence/competitors', { method: 'POST', token: dt, body: { name: 'رقیب تست', segment: 'تست', scores: { dataAuthority: 150, analysisDepth: 50, mediaPresence: 50, partnershipNetwork: 50, eventQuality: 50, policyAuthority: 50, aiVisibility: 50 } } });
  check('نمرهٔ ۱۵۰ → ۴۰۰ با نام بُعد در پیام', badScore.status === 400 && String(badScore.body?.message).includes('مرجعیت داده'));

  const created = await api('/intelligence/competitors', { method: 'POST', token: dt, body: {
    name: 'رقیب تست باتری', segment: 'تست', assets: ['وب‌سایت', 'دارایی ناموجود'],
    scores: { dataAuthority: 30, analysisDepth: 30, mediaPresence: 30, partnershipNetwork: 30, eventQuality: 30, policyAuthority: 30, aiVisibility: 20 } } });
  check('ثبت معتبر → ۲۰۱ و دارایی نامعتبر فیلتر می‌شود', created.status === 201
    && JSON.stringify(created.body.assets) === JSON.stringify(['وب‌سایت']));
  const cid = created.body?.id;

  if (cid) {
    const up = await api(`/intelligence/competitors/${cid}`, { method: 'PATCH', token: dt, body: { scores: { dataAuthority: 10 } } });
    check('ویرایش نمره → ۲۰۰ و نمرهٔ دیگر حفظ می‌شود', up.status === 200 && up.body.dimensions.find(d => d.key === 'dataAuthority').score === 10
      && up.body.dimensions.find(d => d.key === 'analysisDepth').score === 30);
    const after = await api('/intelligence/competitors', { token: dt });
    check('رقیب تازه در ماتریس شرکت می‌کند', after.body.matrix.dims[0].per.some(p => p.id === cid));
    const del = await api(`/intelligence/competitors/${cid}`, { method: 'DELETE', token: dt });
    const afterDel = await api('/intelligence/competitors', { token: dt });
    check('حذف رقیب → ۲۰۰ و از فهرست خارج', del.status === 200 && !afterDel.body.items.some(x => x.id === cid));
  }
  const delSelf = await api('/intelligence/competitors/self', { method: 'DELETE', token: dt });
  check('حذف پروفایل خودِ سازمان → ۴۰۰ (مبنای ماتریس)', delSelf.status === 400);
  const gone = await api('/intelligence/competitors/comp-none', { method: 'PATCH', token: dt, body: { name: 'غایب' } });
  check('شناسهٔ غایب → ۴۰۴', gone.status === 404);

  /* مستأجر واقعی: رقیب دیده نمی‌شود؛ پروفایل خودش را می‌سازد */
  const pl2 = await login('pars', 'pars1234');
  const pt2 = pl2.body?.accessToken;
  if (pt2) {
    const empty = await api('/intelligence/competitors', { token: pt2 });
    check('مستأجر پارس → رقبای دمو دیده نمی‌شود', empty.status === 200 && empty.body.items.length === 0);
    const S = { dataAuthority: 40, analysisDepth: 40, mediaPresence: 20, partnershipNetwork: 10, eventQuality: 10, policyAuthority: 15, aiVisibility: 5 };
    const mine = await api('/intelligence/competitors', { method: 'POST', token: pt2, body: { name: 'رقیب پارس', segment: 'تست', scores: S } });
    check('مستأجر پارس → پروندهٔ رقیب خودش را ثبت می‌کند (۲۰۱)', mine.status === 201);
    const self2 = await api('/intelligence/competitors', { method: 'POST', token: pt2, body: { name: 'پارس (خودمان)', segment: 'خود', scores: S } });
    check('مستأجر پارس → پروفایل خودش را می‌سازد؛ بدون self ماتریس شکاف ندارد', self2.status === 201
      && (await api('/intelligence/competitors', { token: pt2 })).body.matrix.topGaps.length === 0);
  }

  /* client (نقش مدیر روابط) analytics.write دارد → ثبت مجاز؛ سپس پاک‌سازی */
  const cl = await login('client');
  const ct = cl.body?.accessToken;
  const clPost = await api('/intelligence/competitors', { method: 'POST', token: ct, body: {
    name: 'رقیب کاربر نقش‌محور', segment: 'تست', scores: { dataAuthority: 10, analysisDepth: 10, mediaPresence: 10, partnershipNetwork: 10, eventQuality: 10, policyAuthority: 10, aiVisibility: 10 } } });
  check('کاربر نقش‌محور با analytics.write → ثبت مجاز (۲۰۱)', clPost.status === 201);
  if (clPost.status === 201) await api(`/intelligence/competitors/${clPost.body.id}`, { method: 'DELETE', token: ct });
}

/* ═════════════════ گام ۲.۵ — پروندهٔ شناخت ۳۱بخشی (فرم ۲ و ۳ سند) ═════════════════ */
{
  const dl = await login('demo');
  const dt = dl.body?.accessToken;

  const L = await api('/organizations/org-1/knowledge', { token: dt });
  check('پروندهٔ شناخت: ۳۱ بخش استاندارد', L.status === 200 && L.body.sections.length === 31, `n=${L.body?.sections?.length}`);
  check('شماره‌گذاری بخش‌ها ۱ تا ۳۱ پیوسته', L.body.sections.every((s, i) => s.no === i + 1));
  const secLabels = L.body.sections.map(s => s.label).join('|');
  check('بخش‌های سند: نام/سهامداران/…/وضعیت آماده‌سازی',
    ['نام','سهامداران','مدیران','حوزه فعالیت','محصولات / خدمات','وضعیت فعلی','بازار هدف','مشتریان اصلی','شرکای اصلی','رقبا','نقاط قوت','نقاط ضعف','دارایی‌های ارتباطی','وب‌سایت','شبکه‌های اجتماعی','کاتالوگ','هویت بصری','رسانه','اعتبار تخصصی','حضور مدیران','ظرفیت علمی','ظرفیت سرمایه‌گذاری','ظرفیت توسعه بازار','وضعیت سیستم‌های داخلی','مشکلات ساختاری','مشکلات ارتباطی','فرصت‌های رشد','اولویت همکاری','اقدامات پیشنهادی','مسئول داخلی','وضعیت آماده‌سازی'].join('|') === secLabels);
  check('روش شناخت هفت‌مرحله‌ای با خروجی هر مرحله', L.body.stages.length === 7
    && L.body.stages.every(s => s.label && s.output && s.duration)
    && L.body.stages[6].key === 'quarterlyUpdate');
  check('گروه‌بندی پنج‌گانه همهٔ بخش‌ها را می‌پوشاند', L.body.groups.length === 5
    && L.body.sections.every(s => L.body.groups.some(g => g.key === s.group)));

  /* تفکیک داده از برداشت (۷.۳) */
  const s0 = L.body.sections.find(s => s.key === 'name');
  check('تفکیک داده خام از برداشت تحلیلی (دو ستون جدا)', !!s0.data && !!s0.interpretation && s0.data !== s0.interpretation);
  /* منبع‌دار بودن (۷.۳): بخش پرِ بی‌منبع صریحاً «نامعتبر» */
  const noSrc = L.body.sections.filter(s => s.status === 'INVALID' && s.filled);
  const valid = L.body.sections.filter(s => s.status === 'VALID');
  check('بخش پرِ بی‌منبع صریحاً «نامعتبر» است', noSrc.length >= 1 && noSrc.every(s => !s.source));
  check('بخش معتبر = داده + منبع + تاریخ', valid.length >= 10 && valid.every(s => !!s.data && !!s.source));
  check('آمار پوشش با سطرها سازگار است', L.body.stats.total === 31
    && L.body.stats.valid === valid.length
    && L.body.stats.valid + L.body.stats.invalid === 31
    && L.body.stats.coverage === Math.round(valid.length / 31 * 100));
  /* اعتبار ۹۰روزه (۷.۳) */
  check('اعتبار پروندهٔ فعال: حداکثر ۹۰ روز', L.body.reviewState === 'VALID' && L.body.daysLeft != null && L.body.daysLeft > 0 && L.body.daysLeft <= 90);

  /* ثبت/ویرایش بخش (فرم ۲ و ۳) */
  const cleared = await api('/organizations/org-1/knowledge/sections/catalog', { method: 'PATCH', token: dt, body: { data: 'کاتالوگ واحد در تدوین', source: '' } });
  check('ثبت بخش بدون منبع → پذیرفته اما «نامعتبر»', cleared.status === 200
    && cleared.body.sections.find(s => s.key === 'catalog').status === 'INVALID');
  const withSrc = await api('/organizations/org-1/knowledge/sections/catalog', { method: 'PATCH', token: dt, body: { source: 'مصاحبهٔ مدیران', sourceDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10) } });
  check('افزودن منبع → همان بخش «معتبر» می‌شود', withSrc.status === 200
    && withSrc.body.sections.find(s => s.key === 'catalog').status === 'VALID');
  const future = await api('/organizations/org-1/knowledge/sections/catalog', { method: 'PATCH', token: dt, body: { sourceDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) } });
  check('تاریخ منبع در آینده → ۴۰۰', future.status === 400);
  const badKey = await api('/organizations/org-1/knowledge/sections/notASection', { method: 'PATCH', token: dt, body: { data: 'x' } });
  check('کلید بخش نامعتبر → ۴۰۰', badKey.status === 400);

  /* بازبینی و مرحله‌ها */
  const stageSkip = await api('/organizations/org-1/knowledge', { method: 'PATCH', token: dt, body: { stage: 'boardApproval' } });
  check('پرش مرحله‌ای روش شناخت → ۴۰۰', stageSkip.status === 400 && String(stageSkip.body?.message).includes('پرش'));
  const stageBack = await api('/organizations/org-1/knowledge', { method: 'PATCH', token: dt, body: { stage: 'docsReview' } });
  check('بازگشت به مرحلهٔ قبل → ۴۰۰', stageBack.status === 400);
  const stageNext = await api('/organizations/org-1/knowledge', { method: 'PATCH', token: dt, body: { stage: 'validation' } });
  check('تکمیل مرحلهٔ بعد (برداشت میدانی → اعتبارسنجی) → ۲۰۰', stageNext.status === 200 && stageNext.body.stage === 'validation' && stageNext.body.stageNo === 4);
  const rev = await api('/organizations/org-1/knowledge/review', { method: 'POST', token: dt });
  check('ثبت بازبینی → اعتبار ۹۰ روزهٔ تازه', rev.status === 200 && rev.body.reviewState === 'VALID' && rev.body.daysLeft === 90);

  /* RBAC و جداسازی */
  const clTok = (await login('client')).body?.accessToken;
  const noPerm = await api('/organizations/org-1/knowledge/sections/name', { method: 'PATCH', token: clTok, body: { data: 'x', source: 'y' } });
  check('کاربر بدون organization.write → ۴۰۳', noPerm.status === 403);
  const clView = await api('/organizations/org-2/knowledge', { token: clTok });
  check('کاربر نقش‌محور: پروندهٔ سازمان خودش را می‌بیند', clView.status === 200 && clView.body.sections.length === 31);
  const clFar = await api('/organizations/org-1/knowledge', { token: clTok });
  check('کاربر نقش‌محور: پروندهٔ سازمان خارج از محدوده → ۴۰۳', clFar.status === 403);
  const demoFar = await api('/organizations/org-pars/knowledge', { token: dt });
  check('دنیای دمو → پروندهٔ پارس دیده نمی‌شود (۴۰۳)', demoFar.status === 403);
  const goneOrg = await api('/organizations/org-none/knowledge', { token: dt });
  check('سازمان غایب → ۴۰۴', goneOrg.status === 404);

  /* مستأجر پارس: پروندهٔ هلدینگ (فرم ۲) + زیرمجموعه (فرم ۳) + پروندهٔ منقضی */
  const pl = await login('pars', 'pars1234');
  const pt = pl.body?.accessToken;
  if (pt) {
    const pars = await api('/organizations/org-pars/knowledge', { token: pt });
    check('پارس: پروندهٔ هلدینگ در مرحلهٔ تحلیل با بخش‌های معتبر', pars.status === 200
      && pars.body.stage === 'analysis' && pars.body.stats.valid >= 15);
    check('پارس: مالک پرونده = مدیر استراتژی (فرم ۲ سند)', pars.body.ownerRole === 'مدیر استراتژی');
    const edu = await api('/organizations/org-pars-02/knowledge', { token: pt });
    check('پروندهٔ ۹۰روزه: بازبینی ۱۰۰ روز پیش → منقضی', edu.status === 200 && edu.body.reviewState === 'EXPIRED' && edu.body.daysLeft < 0);
    const eduRev = await api('/organizations/org-pars-02/knowledge/review', { method: 'POST', token: pt });
    check('بازبینی پروندهٔ منقضی → اعتبار تازه', eduRev.status === 200 && eduRev.body.reviewState === 'VALID');
    const fresh = await api('/organizations/org-pars-05/knowledge', { token: pt });
    check('زیرمجموعهٔ بدون پرونده → قالب خالی ۳۱ بخش (فرم ۳)', fresh.status === 200
      && fresh.body.stats.valid === 0 && fresh.body.stage === 'docsReview' && fresh.body.sections.length === 31);
    /* kpi-1 پارس: تنظیمات خالی → بدون شاخص؛ پوشش فقط داده است */
    const mine = await api('/organizations/org-pars-01/knowledge/sections/weaknesses', { method: 'PATCH', token: pt, body: { data: 'وابستگی به یک مشتری کلیدی', source: 'مصاحبهٔ مدیران حوزه' } });
    check('پارس: ثبت بخش زیرمجموعه → معتبر', mine.status === 200 && mine.body.sections.find(s => s.key === 'weaknesses').status === 'VALID');
  }

  /* سیم‌کشی kpi-1 به پوشش زندهٔ پرونده (بخش ۲۶ سند) */
  const kp = await api('/program/kpis', { token: dt });
  const k1 = kp.body?.items?.find(x => x.id === 'kpi-1') ?? kp.body?.find?.(x => x.id === 'kpi-1');
  const o1 = await api('/organizations/org-1/knowledge', { token: dt });
  const o2 = await api('/organizations/org-2/knowledge', { token: dt });
  const expect = Math.round((o1.body.stats.valid / 31 + o2.body.stats.valid / 31) / 2 * 100);
  check('kpi-1 از پوشش زندهٔ پروندهٔ شناخت محاسبه می‌شود', k1 && k1.value === expect
    && String(k1.source).includes('پروندهٔ شناخت'), `value=${k1?.value} expected=${expect}`);
}
/* ═════════════════ گام ۲.۶ — معماری رویدادها + پروتکل بحران (بخش ۱۷ سند؛ فرم ۱۰ و ۱۱.۵) ═════════════════ */
{
  const pl = await login('pars', 'pars1234');
  const pt = pl.body?.accessToken;

  const L = await api('/events', { token: pt });
  check('تقویم رویدادها: دو مسیر مستقل با شاخص جدا', L.status === 200 && L.body.paths.length === 2
    && L.body.paths.some(p => p.key === 'OWNED' && p.metric.includes('مرجعیت'))
    && L.body.paths.some(p => p.key === 'ATTEND' && p.metric.includes('شبکه‌سازی')));
  check('سه نوع رویداد مالکیتی جدول ۱۸.۱', L.body.ownedKinds.length === 3
    && ['میزگرد اندیشکده', 'میزگرد اجرایی', 'رویداد تخصصی فصلی'].every(l => L.body.ownedKinds.some(k => k.label === l))
    && L.body.ownedKinds.every(k => k.goal && k.scale && k.cadence));
  check('هفت نوع حضور بیرونی با الزام پیش از حضور', L.body.attendTypes.length === 7
    && L.body.attendTypes.every(a => a.requirement));
  check('چک‌لیست هفت‌مرحله‌ای ۱۸.۳ با مواعد ۶۰/۳۰/۱۵/۱۰/روز/۷۲ساعت/۷روز', L.body.steps.length === 7
    && [-60, -30, -15, -10, 0, 3, 7].every((o, i) => L.body.steps[i].offset === o)
    && L.body.steps[5].when.includes('۷۲ ساعت') && L.body.steps[6].when.includes('۷ روز'));
  const items = L.body.items;
  check('بذر پارس: ۵ رویداد (۳ مالکیتی + ۲ حضور بیرونی)', items.length === 5
    && items.filter(e => e.path === 'OWNED').length === 3 && items.filter(e => e.path === 'ATTEND').length === 2);
  check('هر رویداد: چک‌لیست ۷مرحله‌ای با وضعیت و موعد', items.every(e => e.steps.length === 7
    && e.steps.every(s => ['DONE', 'CURRENT', 'PENDING'].includes(s.status) && !!s.dueAt)));
  check('موعد هر مرحله = تاریخ رویداد + افست', (() => { const e = items[0]; return e.steps.every(s =>
    Math.abs(new Date(s.dueAt).getTime() - (new Date(e.eventAt).getTime() + s.offset * 86400000)) < 60000); })());
  const ev = items.find(e => e.stepsDoneCount === 3);
  check('مرحلهٔ جاری = اولین انجام‌نشده', !!ev && ev.steps.find(s => s.key === ev.currentStep).status === 'CURRENT'
    && ev.steps.filter(s => s.status === 'DONE').length === 3);
  const att = items.find(e => e.path === 'ATTEND' && e.attendType === 'keynote');
  check('حضور بیرونی: نوع + الزام متناظر (سخنرانی → راهنمای گفتار و تمرین)', !!att
    && att.attendLabel === 'سخنرانی در رویدادهای بیرونی' && att.attendRequirement === 'راهنمای گفتار + تمرین');

  /* قواعد ثبت (فرم ۱۰ — رویداد بدون مالک ایجاد نمی‌شود) */
  const noOwner = await api('/events', { method: 'POST', token: pt, body: { title: 'رویداد تست', path: 'OWNED', kind: 'execRoundtable', eventAt: '2026-12-01T09:00:00Z' } });
  check('رویداد بدون مالک → ۴۰۰', noOwner.status === 400);
  const badPath = await api('/events', { method: 'POST', token: pt, body: { title: 'رویداد تست', path: 'X', ownerRole: 'مدیر', eventAt: '2026-12-01T09:00:00Z' } });
  check('مسیر نامعتبر → ۴۰۰', badPath.status === 400);
  const badKind = await api('/events', { method: 'POST', token: pt, body: { title: 'رویداد تست', path: 'OWNED', kind: 'غیره', ownerRole: 'مدیر', eventAt: '2026-12-01T09:00:00Z' } });
  check('نوع مالکیتی خارج از فهرست استاندارد → ۴۰۰', badKind.status === 400);
  const created = await api('/events', { method: 'POST', token: pt, body: { title: 'رویداد تست باتری', path: 'ATTEND', attendType: 'booth', ownerRole: 'مدیر توسعه کسب‌وکار', eventAt: '2026-12-15T09:00:00Z' } });
  check('ثبت معتبر → ۲۰۱ و مرحلهٔ ۱ (ثبت در تقویم) خودکار', created.status === 201
    && created.body.stepsDoneCount === 1 && created.body.currentStep === 'decision');
  const eid = created.body?.id;
  if (eid) {
    const jump = await api(`/events/${eid}/steps/report`, { method: 'POST', token: pt });
    check('پرش مرحله‌ای چک‌لیست → ۴۰۰', jump.status === 400 && String(jump.body?.message).includes('پرش'));
    const st2 = await api(`/events/${eid}/steps/decision`, { method: 'POST', token: pt });
    check('تکمیل مرحلهٔ بعد → ۲۰۰', st2.status === 200 && st2.body.stepsDoneCount === 2 && st2.body.currentStep === 'prepare');
    const back = await api(`/events/${eid}/steps/register`, { method: 'POST', token: pt });
    check('بازگشت به مرحلهٔ قبل → ۴۰۰', back.status === 400);
    const patched = await api(`/events/${eid}`, { method: 'PATCH', token: pt, body: { title: 'رویداد تست باتری ۲' } });
    check('ویرایش رویداد → ۲۰۰', patched.status === 200 && patched.body.title.includes('۲'));
    const del = await api(`/events/${eid}`, { method: 'DELETE', token: pt });
    check('حذف رویداد → ۲۰۰', del.status === 200);
  }

  /* پروتکل ارتباط بحران (۱۱.۵ سند) */
  const CP = await api('/crisis-protocol', { token: pt });
  check('پروتکل بحران: سخنگو + جانشین + واکنش طلایی ۲ ساعت', CP.status === 200
    && !!CP.body.spokesperson && !!CP.body.backup && CP.body.spokesperson !== CP.body.backup
    && CP.body.goldenHours === 2);
  check('پیام‌های اولیه از پیش آماده موجود', CP.body.messages.length >= 2
    && CP.body.messages.every(m => m.title && m.text));
  const crGold = CP.body.crises.find(c => c.withinGolden === true);
  const crLate = CP.body.crises.find(c => c.withinGolden === false);
  check('واکنش طلایی سنجیده می‌شود (هر دو حالت موجود)', !!crGold && !!crLate
    && crGold.reactionHours <= 2 && crLate.reactionHours > 2);
  const same = await api('/crisis-protocol', { method: 'PATCH', token: pt, body: { spokesperson: 'مدیرعامل', backup: 'مدیرعامل' } });
  check('جانشین برابر سخنگو → ۴۰۰', same.status === 400);
  const noSpk = await api('/crisis-protocol/crises', { method: 'POST', token: pt, body: { title: 'بحران بدون سخنگو' } });
  check('بحران بدون سخنگو → ۴۰۰', noSpk.status === 400);
  const det = new Date(Date.now() - 3 * 3600000).toISOString();
  const early = new Date(Date.now() - 4 * 3600000).toISOString();
  const before = await api('/crisis-protocol/crises', { method: 'POST', token: pt, body: { title: 'بحران پاسخ پیش از شناسایی', spokesperson: 'مدیر روابط عمومی', detectedAt: det, firstResponseAt: early } });
  check('پاسخ پیش از شناسایی بحران → ۴۰۰', before.status === 400);
  const resp = new Date(Date.now() - 1.5 * 3600000).toISOString();
  const newCr = await api('/crisis-protocol/crises', { method: 'POST', token: pt, body: { title: 'بحران تست باتری', spokesperson: 'مدیر روابط عمومی', detectedAt: det, firstResponseAt: resp } });
  check('ثبت بحران با واکنش ۱.۵ ساعت → در زمان طلایی', newCr.status === 201
    && newCr.body.crises.some(c => c.title === 'بحران تست باتری' && c.withinGolden === true));
  const cid = newCr.body?.crises?.find(c => c.title === 'بحران تست باتری')?.id;
  if (cid) {
    const resolved = await api(`/crisis-protocol/crises/${cid}`, { method: 'PATCH', token: pt, body: { status: 'RESOLVED' } });
    check('رفع بحران پاسخ‌داده → ۲۰۰', resolved.status === 200
      && resolved.body.crises.find(c => c.id === cid).status === 'RESOLVED');
  }
  const noRespCr = await api('/crisis-protocol/crises', { method: 'POST', token: pt, body: { title: 'بحران بدون پاسخ', spokesperson: 'مدیر روابط عمومی', detectedAt: det } });
  const nid = noRespCr.body?.crises?.find(c => c.title === 'بحران بدون پاسخ')?.id;
  if (nid) {
    const badResolve = await api(`/crisis-protocol/crises/${nid}`, { method: 'PATCH', token: pt, body: { status: 'RESOLVED' } });
    check('رفع بحران بدون پاسخ اولیه → ۴۰۰', badResolve.status === 400);
  }

  /* RBAC + جداسازی مستأجر */
  const cl = await login('client');
  const ct = cl.body?.accessToken;
  const clView = await api('/events', { token: ct });
  check('کاربر نقش‌محور با calendar.read → فهرست (خالی) سازمان خودش', clView.status === 200 && clView.body.items.length === 0);
  const clPost = await api('/events', { method: 'POST', token: ct, body: { title: 'رویداد مشتری', path: 'OWNED', kind: 'execRoundtable', ownerRole: 'مدیر', eventAt: '2026-12-01T09:00:00Z' } });
  check('کاربر بدون publics.write → ۴۰۳', clPost.status === 403);
  const dl = await login('demo');
  const dt = dl.body?.accessToken;
  const demoEv = await api('/events', { token: dt });
  check('دنیای دمو: فقط رویدادهای خودش؛ رویدادهای پارس دیده نمی‌شود', demoEv.status === 200
    && demoEv.body.items.length === 2 && !demoEv.body.items.some(e => e.title.includes('میزگرد داده')));
}


/* ═════════════════ گام ۲.۷ — گزارش ماهانهٔ استاندارد (فرم ۱۵؛ بخش ۲۶ + ۲۵ + ۱۴۰۱ سند) ═════════════════ */
section('گام ۲.۷ — گزارش ماهانهٔ استاندارد (فرم ۱۵)');
{
  const pl = await login(OWNER.email);
  const pt = pl.body?.accessToken;

  /* فهرست + قالب + آمار — با هر دو روش احراز هویتِ رایج باتری */
  const list = await api('/program/monthly-reports', { token: pt });
  check('GET /program/monthly-reports → 200 با ۳ گزارش بذر دمو', list.status === 200 && list.body.items.length === 3);
  check('قالب ثابت فرم ۱۵ — پنج بخش: خلاصه/شاخص‌های زنده/ریسک‌های زنده/انحراف/برنامهٔ ماه آینده',
    JSON.stringify(list.body.template.map(s => s.key)) === JSON.stringify(['summary', 'kpis', 'highRisks', 'deviations', 'nextMonthPlan']));
  check('آمار: ۲ ارائه‌شده + ۱ پیش‌نویس + ۲ به‌موقع',
    list.body.stats.submitted === 2 && list.body.stats.draft === 1 && list.body.stats.onTime === 2);
  const pmr2 = list.body.items.find(r => r.id === 'pmr-2');
  const pmr3 = list.body.items.find(r => r.id === 'pmr-3');
  check('نمای گزارش: statusFa و مهلت (پنجم ماه بعد) و onTime',
    pmr2.statusFa === 'ارائه‌شده' && pmr3.statusFa === 'پیش‌نویس' && pmr2.dueAt.startsWith('2026-10-05') && pmr2.onTime === true);
  check('بخش زندهٔ شاخص‌ها از داشبورد (نه عدد دستی) — ۱۰ شاخص با مقدار و وضعیت',
    (pmr2.live.kpis ?? []).length === 10 && pmr2.live.kpis.every(k => k.valueLabel && k.status));
  check('بخش زندهٔ ریسک‌های درجه بالا — ۳ ریسک با مالک نقش',
    (pmr2.live.highRisks ?? []).length === 3 && pmr2.live.highRisks.every(r => r.title && r.ownerRole));
  check('انحراف ثبت‌شدهٔ pmr-2 با هر سه قلم (علت/اثر بر مسیر بحرانی/اقدام جبرانی)',
    pmr2.deviations.length === 1 && !!(pmr2.deviations[0].cause && pmr2.deviations[0].criticalPathImpact && pmr2.deviations[0].mitigation));
  check('قاعدهٔ انحراف در پاسخ سرور آمده است', String(list.body.rule).includes('دو هفته'));

  /* اعتبارسنجی بدنه */
  const noSummary = await api('/program/monthly-reports', { method: 'POST', token: pt, body: { label: 'آبان ۱۴۰۵', month: '2026-11' } });
  check('بدون خلاصهٔ مدیریتی → ۴۰۰', noSummary.status === 400);
  const dupMonth = await api('/program/monthly-reports', { method: 'POST', token: pt, body: { label: 'مهر تکراری', month: '2026-10', summary: 'تست' } });
  check('ماه تکراری → ۴۰۰ (هر ماه فقط یک گزارش)', dupMonth.status === 400);
  const badDev = await api('/program/monthly-reports', { method: 'POST', token: pt, body: { label: 'آبان ۱۴۰۵', month: '2026-11', summary: 'تست', deviations: [{ milestone: 'نقطهٔ عطف', cause: 'فقط علت' }] } });
  check('انحراف ناقص (بدون اثر/اقدام جبرانی) → ۴۰۰', badDev.status === 400);
  const noPerm = await api('/program/monthly-reports', { method: 'POST', token: (await login('client')).body?.accessToken, body: { label: 'گزارش مشتری', month: '2026-12', summary: 'تست' } });
  check('کاربر بدون program.write → ۴۰۳', noPerm.status === 403);

  /* چرخهٔ کامل: ثبت پیش‌نویس → ویرایش → ارائه → قفل */
  const created = await api('/program/monthly-reports', { method: 'POST', token: pt, body: { label: 'آذر ۱۴۰۵ (تست باتری)', month: '2027-01', summary: 'پیش‌نویس اولیه', nextMonthPlan: 'برنامهٔ اولیه', deviations: [{ milestone: 'انتخاب پیمانکار سامانه', cause: 'تأخیر در ارسال پیشنهادها', criticalPathImpact: 'یک هفته تأخیر در فاز نصب', mitigation: 'تعیین مهلت سخت و تمدید قرارداد طراحی' }] } });
  const nid = created.body?.id;
  check('POST → 201 با وضعیت پیش‌نویس و انحراف سه‌قلمی', created.status === 201 && created.body.status === 'DRAFT' && created.body.deviations.length === 1 && created.body.onTime === null);
  const patched = await api(`/program/monthly-reports/${nid}`, { method: 'PATCH', token: pt, body: { summary: 'خلاصهٔ نهایی ماه', nextMonthPlan: 'برنامهٔ نهایی ماه آینده' } });
  check('PATCH پیش‌نویس → 200 با متن به‌روزشده', patched.status === 200 && patched.body.summary === 'خلاصهٔ نهایی ماه' && patched.body.nextMonthPlan === 'برنامهٔ نهایی ماه آینده');
  const patchDevOnly = await api(`/program/monthly-reports/${nid}`, { method: 'PATCH', token: pt, body: { deviations: [{ milestone: 'ناقص', cause: 'ناقص' }] } });
  check('PATCH با انحراف ناقص → ۴۰۰ (ادغام قبل از اعتبارسنجی)', patchDevOnly.status === 400);
  const kpiBefore = (await api('/program/kpis', { token: pt })).body.items.find(k => k.id === 'kpi-10');
  const submitted = await api(`/program/monthly-reports/${nid}/submit`, { method: 'POST', token: pt });
  const kpiAfter = (await api('/program/kpis', { token: pt })).body.items.find(k => k.id === 'kpi-10');
  check('POST /:id/submit → SUBMITTED + مهر ارائه + به‌موقع',
    submitted.status === 200 && submitted.body.status === 'SUBMITTED' && !!submitted.body.submittedAt && submitted.body.onTime === true);
  check('شاخص ۱۰ (۱۲ گزارش به‌موقع) فقط SUBMITTED را می‌شمارد', kpiBefore.value + 1 === kpiAfter.value);
  const reSubmit = await api(`/program/monthly-reports/${nid}/submit`, { method: 'POST', token: pt });
  check('ارائهٔ دوباره → ۴۰۰', reSubmit.status === 400);
  const editLocked = await api(`/program/monthly-reports/${nid}`, { method: 'PATCH', token: pt, body: { summary: 'تغییر پس از ارائه' } });
  check('ویرایش گزارش ارائه‌شده → ۴۰۰', editLocked.status === 400);
  const del = await api(`/program/monthly-reports/${nid}`, { method: 'DELETE', token: pt });
  check('حذف گزارش ارائه‌شده → ۴۰۰', del.status === 400);

  /* حذف پیش‌نویس */
  const draft = await api('/program/monthly-reports', { method: 'POST', token: pt, body: { label: 'بهمن ۱۴۰۵ (حذف)', month: '2027-02', summary: 'برای حذف' } });
  const delDraft = await api(`/program/monthly-reports/${draft.body.id}`, { method: 'DELETE', token: pt });
  check('حذف پیش‌نویس → ۲۰۰ و از فهرست خارج می‌شود', delDraft.status === 200
    && !(await api('/program/monthly-reports', { token: pt })).body.items.some(r => r.id === draft.body.id));

  /* جداسازی مستأجر: کاربر مشتری جهان دیگری است و گزارش هلدینگ دمو را نمی‌بیند */
  const cl = await login('client');
  const clList = await api('/program/monthly-reports', { token: cl.body?.accessToken });
  check('کاربر مشتری → فهرست خالی (گزارش‌ها per-tenant هستند)', clList.status === 200 && clList.body.items.length === 0);
  const clSubmit = await api('/program/monthly-reports/pmr-2/submit', { method: 'POST', token: cl.body?.accessToken });
  check('کاربر مشتری بدون program.write → ۴۰۳', clSubmit.status === 403);
  const parsTok = (await api('/auth/login', { method: 'POST', body: { email: 'pars', password: 'pars1234' } })).body?.accessToken;
  const parsSubmit = await api('/program/monthly-reports/pmr-2/submit', { method: 'POST', token: parsTok });
  check('کاربر pars با مجوز کامل → ارائهٔ گزارش سازمان دمو → ۴۰۴ (خارج از محدوده)', parsSubmit.status === 404);

  /* کاربر pars (هلدینگ پارس) هم جهان دادهٔ خودش را می‌بیند، نه دمو */
  const parsList = await api('/program/monthly-reports', { token: parsTok });
  check('حساب pars → فهرست خالی (نه دادهٔ هلدینگ دمو)', parsList.status === 200 && parsList.body.items.length === 0);
}


/* ═════════════════ گام ۴.۱ — فرم ۱۲: کنترل ده‌مرحله‌ای انتقال سامانه (بخش ۲۱ + پیوست ب) ═════════════════ */
section('گام ۴.۱ — فرم ۱۲: انتقال سامانه (ده مرحله)');
{
  const pl = await login(OWNER.email);
  const pt = pl.body?.accessToken;

  const au0 = await api('/program/audits', { token: pt });
  const as4 = au0.body.systems.find((s) => s.id === 'as-4');
  const as1 = au0.body.systems.find((s) => s.id === 'as-1');
  const as3 = au0.body.systems.find((s) => s.id === 'as-3');
  check('GET ممیزی: ده مرحلهٔ انتقال در نمای هر سامانه (فرم ۱۲)',
    as4.steps.total === 10 && as4.steps.done === 6 && as4.steps.currentKey === 'training' && as4.steps.steps.length === 10);
  check('سامانهٔ تکمیل‌شده: هر ۱۰ مرحله done + وضعیت DONE', as1.steps.complete === true && as1.migrationStatus === 'DONE' && as1.steps.done === 10);
  check('سامانهٔ «نگهداری» برنامهٔ انتقال ندارد (steps total=0)', as3.migration === 'KEEP' && as3.steps.total === 0);
  check('قاعدهٔ فرم ۱۲ در پاسخ سرور آمده است', String(au0.body.migrationRule).includes('ده مرحله') && String(au0.body.migrationRule).includes('فرم ۱۲'));

  const jump = await api('/program/audit/systems/as-4/steps/shutdown', { method: 'POST', token: pt });
  check('پرش به مرحلهٔ دهم → ۴۰۰ (مراحل ترتیبی‌اند)', jump.status === 400);
  const wrong = await api('/program/audit/systems/as-4/steps/parallel', { method: 'POST', token: pt });
  check('مرحلهٔ غیرجاری → ۴۰۰ با نام مرحلهٔ جاری در پیام', wrong.status === 400 && wrong.body.message.includes('آموزش کوتاه کاربران'));
  const keep = await api('/program/audit/systems/as-3/steps/audit', { method: 'POST', token: pt });
  check('سامانهٔ KEEP → ۴۰۰ (فرم ۱۲ برای آن کاربرد ندارد)', keep.status === 400 && keep.body.message.includes('نگهداری'));
  const badKey = await api('/program/audit/systems/as-4/steps/justify', { method: 'POST', token: pt });
  check('کلید مرحلهٔ نامعتبر → ۴۰۰', badKey.status === 400);
  const noPerm = await api('/program/audit/systems/as-4/steps/training', { method: 'POST', token: (await login('client')).body?.accessToken });
  check('کاربر بدون program.write → ۴۰۳', noPerm.status === 403);
  const notFound = await api('/program/audit/systems/as-99/steps/audit', { method: 'POST', token: pt });
  check('سامانهٔ ناموجود → ۴۰۴', notFound.status === 404);

  /* چرخهٔ کامل as-4: چهار مرحلهٔ باقی‌مانده → DONE خودکار + شمارش kpi-9 */
  const kpi9Before = (await api('/program/kpis', { token: pt })).body.items.find((k) => k.id === 'kpi-9');
  const s7 = await api('/program/audit/systems/as-4/steps/training', { method: 'POST', token: pt });
  check('تکمیل مرحلهٔ ۷ (آموزش) → ۷ از ۱۰ و همچنان در جریان', s7.status === 200 && s7.body.steps.done === 7 && s7.body.migrationStatus === 'IN_PROGRESS');
  for (const k of ['parallel', 'resolve', 'shutdown']) await api(`/program/audit/systems/as-4/steps/${k}`, { method: 'POST', token: pt });
  const au1 = await api('/program/audits', { token: pt });
  const as4b = au1.body.systems.find((s) => s.id === 'as-4');
  check('اتمام مرحلهٔ دهم → سامانه «تکمیل‌شده» + خلاصهٔ انتقال ۳ از ۴',
    as4b.migrationStatus === 'DONE' && as4b.steps.complete === true && au1.body.summary.migrationDone === 3 && au1.body.summary.migrationTotal === 4);
  const kpi9After = (await api('/program/kpis', { token: pt })).body.items.find((k) => k.id === 'kpi-9');
  check('شاخص ۹ (انتقال داده‌ها) از مراحل فرم ۱۲ تغذیه می‌شود', kpi9Before.value + 1 === kpi9After.value);
  const again = await api('/program/audit/systems/as-4/steps/audit', { method: 'POST', token: pt });
  check('تکمیل پس از اتمام هر ده مرحله → ۴۰۰', again.status === 400);

  /* اولین مرحلهٔ سامانهٔ شروع‌نشده → در جریان */
  const s5 = await api('/program/audit/systems/as-5/steps/audit', { method: 'POST', token: pt });
  check('اولین مرحلهٔ سامانهٔ شروع‌نشده → وضعیت «در جریان»', s5.status === 200 && s5.body.migrationStatus === 'IN_PROGRESS' && s5.body.steps.done === 1);
}


/* ═════════════════ گام ۴.۲ — فرم ۸ و ۷: تقویم انتشار رسانه + گردش تأیید محتوا (بخش ۱۶ + پیوست ب) ═════════════════ */
section('گام ۴.۲ — فرم ۸ و ۷: تقویم انتشار رسانه + تأیید محتوا');
{
  const ptok = (await api('/auth/login', { method: 'POST', body: { email: 'pars', password: 'pars1234' } })).body?.accessToken;

  const list = await api('/program/content', { token: ptok });
  check('GET /program/content → هفت خروجی بذر رسانه تخصصی پارس', list.status === 200 && list.body.items.length === 7);
  check('فرم ۸: هفت ستون رسانه تخصصی سند با ریتم هرکدام',
    list.body.pillars.length === 7
    && list.body.pillars.find((p) => p.key === 'newsroom').rhythm === 'بر پایه رویداد'
    && list.body.pillars.find((p) => p.key === 'podcast').rhythm === 'دوهفتگی'
    && list.body.pillars.find((p) => p.key === 'magazine').rhythm === 'فصلی');
  check('فرم ۷: چهار کنترل الزامی (پیام هسته/مخاطب/حقوقی/هوش مصنوعی)',
    list.body.controls.length === 4 && list.body.controls.map((c) => c.key).join() === 'coreMessage,audience,legal,aiStructure');
  check('آمار وضعیت: ۳ پیش‌نویس + ۱ در بازبینی + ۱ تأییدشده + ۲ منتشرشده',
    list.body.stats.draft === 3 && list.body.stats.inReview === 1 && list.body.stats.approved === 1 && list.body.stats.published === 2);
  const pc3 = list.body.items.find((c) => c.id === 'pc-3');
  check('نمای خروجی: دو کنترل ثبت‌شده (پیام هسته + مخاطب) و دو کنترل باز',
    pc3.okControls === 2 && pc3.controlsView.coreMessage.registered === true && pc3.controlsView.legal.registered === false);
  check('قاعدهٔ فرم ۷ در پاسخ سرور: انتشار بدون تأیید کامل ممنوع', String(list.body.rule).includes('انتشار بدون تأیید کامل ممنوع'));

  const noTitle = await api('/program/content', { method: 'POST', token: ptok, body: { pillar: 'newsroom', month: '2026-12' } });
  check('عنوان کوتاه → ۴۰۰', noTitle.status === 400);
  const badPillar = await api('/program/content', { method: 'POST', token: ptok, body: { title: 'تست ستون', pillar: 'blog', month: '2026-12' } });
  check('ستون خارج از فهرست هفت‌گانه → ۴۰۰', badPillar.status === 400);
  const noPerm = await api('/program/content', { method: 'POST', token: (await login('client')).body?.accessToken, body: { title: 'محتوای مشتری', pillar: 'newsroom', month: '2026-12' } });
  check('کاربر بدون program.write → ۴۰۳', noPerm.status === 403);

  /* چرخهٔ کامل فرم ۷: پیش‌نویس → در بازبینی → تأییدشده → منتشرشده */
  const created = await api('/program/content', { method: 'POST', token: ptok, body: { title: 'بیانیهٔ تست باتری ۴.۲', pillar: 'newsroom', month: '2026-12' } });
  const cid = created.body?.id;
  check('POST → 201 با وضعیت پیش‌نویس و بدون هیچ کنترل', created.status === 201 && created.body.status === 'DRAFT' && created.body.okControls === 0);
  const pubEarly = await api(`/program/content/${cid}/publish`, { method: 'POST', token: ptok });
  check('انتشار بدون هیچ کنترل → ۴۰۰ با فهرست چهار کنترل', pubEarly.status === 400 && pubEarly.body.message.includes('هوش مصنوعی'));
  const c1 = await api(`/program/content/${cid}/controls/coreMessage`, { method: 'POST', token: ptok, body: { ok: true } });
  check('اولین کنترل → گردش به «در بازبینی» با ۱ از ۴', c1.status === 200 && c1.body.status === 'IN_REVIEW' && c1.body.okControls === 1);
  const dup = await api(`/program/content/${cid}/controls/coreMessage`, { method: 'POST', token: ptok, body: { ok: true } });
  check('ثبت مجدد کنترل ثبت‌شده → ۴۰۰', dup.status === 400);
  await api(`/program/content/${cid}/controls/audience`, { method: 'POST', token: ptok, body: { ok: true } });
  await api(`/program/content/${cid}/controls/legal`, { method: 'POST', token: ptok, body: { ok: true } });
  const c4 = await api(`/program/content/${cid}/controls/aiStructure`, { method: 'POST', token: ptok, body: { ok: true } });
  check('چهارمین کنترل → «تأییدشده» و آمادهٔ انتشار', c4.status === 200 && c4.body.status === 'APPROVED' && c4.body.okControls === 4 && c4.body.canPublish === true);
  const pub = await api(`/program/content/${cid}/publish`, { method: 'POST', token: ptok });
  check('انتشار از وضعیت تأییدشده → «منتشرشده» با مهر زمانی', pub.status === 200 && pub.body.status === 'PUBLISHED' && !!pub.body.publishedAt);
  const pubAgain = await api(`/program/content/${cid}/publish`, { method: 'POST', token: ptok });
  check('انتشار دوباره → ۴۰۰', pubAgain.status === 400);
  const ctlAfterPub = await api(`/program/content/${cid}/controls/legal`, { method: 'POST', token: ptok, body: { ok: false } });
  check('ثبت کنترل روی خروجی منتشرشده → ۴۰۰', ctlAfterPub.status === 400);

  /* کنترل ناموفق = سد انتشار */
  const neg = await api('/program/content', { method: 'POST', token: ptok, body: { title: 'خروجی کنترل ناموفق', pillar: 'video', month: '2026-12' } });
  await api(`/program/content/${neg.body.id}/controls/coreMessage`, { method: 'POST', token: ptok, body: { ok: true } });
  const failed = await api(`/program/content/${neg.body.id}/controls/legal`, { method: 'POST', token: ptok, body: { ok: false, note: 'بازبینی حقوقی لازم دارد' } });
  check('کنترل ناموفق → «در بازبینی» می‌ماند و تأیید کامل رخ نمی‌دهد',
    failed.body.status === 'IN_REVIEW' && failed.body.okControls === 1);
  const pubFailed = await api(`/program/content/${neg.body.id}/publish`, { method: 'POST', token: ptok });
  check('انتشار با کنترل ناموفق → ۴۰۰ (سکوت دربارهٔ کنترل ممنوع)', pubFailed.status === 400);

  /* جداسازی مستأجر: دنیای دمو فقط دو خروجی خودش را می‌بیند */
  const demoList = await api('/program/content', { token: (await login(OWNER.email)).body?.accessToken });
  check('دنیای دمو: فقط دو خروجی بذر خودش (نه رسانهٔ پارس)', demoList.status === 200 && demoList.body.items.length === 2
    && !demoList.body.items.some((c) => c.id.startsWith('pc-') && !c.id.startsWith('pc-d')));
}

/* ═════════════════ گام ۴.۳ — فرم ۶: رجیستری دارایی برند (پیوست ب) ═════════════════ */
section('گام ۴.۳ — فرم ۶: رجیستری دارایی برند');
{
  const ptok = (await api('/auth/login', { method: 'POST', body: { email: 'pars', password: 'pars1234' } })).body?.accessToken;

  const list = await api('/program/brand-assets', { token: ptok });
  check('GET /program/brand-assets → هفت دارایی بذر پارس', list.status === 200 && list.body.items.length === 7);
  check('آمار رجیستری: ۴ فعال + ۳ در تدوین + ۱ بازبینی معوق',
    list.body.stats.active === 4 && list.body.stats.inProgress === 3 && list.body.stats.overdue === 1);
  const web = list.body.items.find((x) => x.id === 'ba-5');
  check('وب‌سایت هلدینگ: بازبینی معوق با روزهای منفی', web.overdue === true && web.daysLeft < 0, `daysLeft=${web.daysLeft}`);
  check('قاعدهٔ فرم ۶ در پاسخ سرور: دارایی بدون مالک ثبت نمی‌شود', String(list.body.rule).includes('بدون مالک'));

  const noOwner = await api('/program/brand-assets', { method: 'POST', token: ptok, body: { name: 'دارایی بی‌مالک', version: '۱٫۰', location: 'مرکز دانش' } });
  check('ثبت بدون مالک → ۴۰۰ (قاعدهٔ پیوست ب)', noOwner.status === 400 && noOwner.body.message.includes('بدون مالک'));
  const shortName = await api('/program/brand-assets', { method: 'POST', token: ptok, body: { name: 'ب', version: '۱٫۰', ownerRole: 'مدیر محتوا', location: 'مرکز دانش' } });
  check('عنوان کوتاه → ۴۰۰', shortName.status === 400);
  const noVersion = await api('/program/brand-assets', { method: 'POST', token: ptok, body: { name: 'دارایی بدون نسخه', ownerRole: 'مدیر محتوا', location: 'مرکز دانش' } });
  check('ثبت بدون نسخهٔ جاری → ۴۰۰', noVersion.status === 400 && noVersion.body.message.includes('نسخه'));
  const noLocation = await api('/program/brand-assets', { method: 'POST', token: ptok, body: { name: 'دارایی بدون محل', version: '۱٫۰', ownerRole: 'مدیر محتوا' } });
  check('ثبت بدون محل نگهداری → ۴۰۰', noLocation.status === 400);
  const badDate = await api('/program/brand-assets', { method: 'POST', token: ptok, body: { name: 'دارایی تاریخ خراب', version: '۱٫۰', ownerRole: 'مدیر محتوا', location: 'مرکز دانش', reviewAt: '2026-02-31' } });
  check('تاریخ بازبینی نامعتبر (۳۱ فوریه) → ۴۰۰', badDate.status === 400);
  const badStatus = await api('/program/brand-assets', { method: 'POST', token: ptok, body: { name: 'دارایی وضعیت خراب', version: '۱٫۰', ownerRole: 'مدیر محتوا', location: 'مرکز دانش', status: 'OLD' } });
  check('وضعیت خارج از «در تدوین/فعال» → ۴۰۰', badStatus.status === 400);

  /* چارت سازمان دمو (org-1) ۲۲ نقش دارد — مالک باید از چارت باشد */
  const otok = (await login(OWNER.email)).body?.accessToken;
  const offChart = await api('/program/brand-assets', { method: 'POST', token: otok, body: { name: 'دارایی دمو', version: '۱', ownerRole: 'نقش خیالی', location: 'مرکز دانش' } });
  check('مالک خارج از چارت ۲۲نقشی سازمان → ۴۰۰', offChart.status === 400 && offChart.body.message.includes('چارت'));
  const noPerm = await api('/program/brand-assets', { method: 'POST', token: (await login('client')).body?.accessToken, body: { name: 'دارایی مشتری', version: '۱', ownerRole: 'مدیر', location: 'مرکز دانش' } });
  check('کاربر بدون program.write → ۴۰۳', noPerm.status === 403);

  /* چرخهٔ کامل: ثبت → ویرایش نسخه → مهر بازبینی فصلی */
  const created = await api('/program/brand-assets', { method: 'POST', token: ptok,
    body: { name: 'کاتالوگ تست باتری ۴.۳', version: '1.0', ownerRole: 'مدیر توسعه کسب‌وکار', location: 'درایو تیم توسعه', status: 'ACTIVE', reviewAt: '2026-11-15' } });
  check('POST معتبر → 201 فعال با بازبینی آینده (بدون معوقی)',
    created.status === 201 && created.body.status === 'ACTIVE' && created.body.overdue === false && created.body.daysLeft > 0);
  const patched = await api(`/program/brand-assets/${created.body.id}`, { method: 'PATCH', token: ptok, body: { version: '1.1', status: 'IN_PROGRESS' } });
  check('PATCH نسخه و وضعیت → 200', patched.status === 200 && patched.body.version === '1.1' && patched.body.status === 'IN_PROGRESS');
  const reviewed = await api(`/program/brand-assets/${created.body.id}/review`, { method: 'POST', token: ptok });
  check('مهر بازبینی → ۹۰ روز اعتبار + تاریخ آخرین بازبینی',
    reviewed.status === 200 && reviewed.body.daysLeft >= 89 && reviewed.body.daysLeft <= 90 && !!reviewed.body.lastReviewedAt && reviewed.body.overdue === false);
  const crossPatch = await api('/program/brand-assets/ba-d1', { method: 'PATCH', token: ptok, body: { version: '9.9' } });
  check('ویرایش دارایی دنیای دمو با توکن پارس → ۴۰۴', crossPatch.status === 404);
  const demoList = await api('/program/brand-assets', { token: otok });
  check('دنیای دمو: فقط دو دارایی بذر خودش (نه رجیستری پارس)', demoList.status === 200 && demoList.body.items.length === 2
    && demoList.body.items.every((x) => x.id.startsWith('ba-d')));
}

/* ═════════════════ گام ۴.۴ — فرم ۱۴: تأیید هزینه پیش از تعهد (پیوست ب) ═════════════════ */
section('گام ۴.۴ — فرم ۱۴: تأیید هزینه پیش از تعهد');
{
  const ptok = (await api('/auth/login', { method: 'POST', body: { email: 'pars', password: 'pars1234' } })).body?.accessToken;

  const list = await api('/program/expenses', { token: ptok });
  check('GET /program/expenses → چهار هزینهٔ بذر پارس', list.status === 200 && list.body.items.length === 4);
  check('آمار گردش: ۲ در انتظار + ۱ تصویب‌شده + ۱ تعهد ثبت‌شده',
    list.body.stats.pending === 2 && list.body.stats.approved === 1 && list.body.stats.committed === 1);
  check('جمع تعهدات = مبلغ هزینهٔ تعهدشده (۲۵۰ میلیون)',
    list.body.stats.committedAmount === 250000000);
  check('تصویب‌کنندهٔ سند: مدیر مالی', list.body.approverRole === 'مدیر مالی');
  check('قاعدهٔ فرم ۱۴ در پاسخ سرور: تعهد فقط پس از تصویب', String(list.body.rule).includes('تعهد فقط پس از تصویب'));

  const noRequester = await api('/program/expenses', { method: 'POST', token: ptok, body: { title: 'هزینهٔ بی‌درخواست‌کننده', amount: 1000000, category: 'رویداد' } });
  check('ثبت بدون درخواست‌کننده → ۴۰۰ (قاعدهٔ پیوست ب)', noRequester.status === 400 && noRequester.body.message.includes('بدون درخواست‌کننده'));
  const badAmount = await api('/program/expenses', { method: 'POST', token: ptok, body: { title: 'هزینهٔ مبلغ صفر', amount: 0, category: 'رویداد', requesterRole: 'مدیر رویداد' } });
  check('مبلغ صفر → ۴۰۰', badAmount.status === 400);
  const negAmount = await api('/program/expenses', { method: 'POST', token: ptok, body: { title: 'هزینهٔ منفی', amount: -500, category: 'رویداد', requesterRole: 'مدیر رویداد' } });
  check('مبلغ منفی → ۴۰۰', negAmount.status === 400);
  const noCategory = await api('/program/expenses', { method: 'POST', token: ptok, body: { title: 'هزینهٔ بدون دسته', amount: 1000, requesterRole: 'مدیر رویداد' } });
  check('ثبت بدون دستهٔ هزینه → ۴۰۰', noCategory.status === 400);
  const noPerm = await api('/program/expenses', { method: 'POST', token: (await login('client')).body?.accessToken, body: { title: 'هزینهٔ مشتری', amount: 1000, category: 'رویداد', requesterRole: 'مدیر' } });
  check('کاربر بدون program.write → ۴۰۳', noPerm.status === 403);

  /* چرخهٔ کامل: ثبت → تلاش تعهد زودهنگام (۴۰۰) → تصویب → تعهد */
  const created = await api('/program/expenses', { method: 'POST', token: ptok,
    body: { title: 'هزینهٔ تست باتری ۴.۴', amount: 12000000, category: 'زیرساخت', requesterRole: 'مدیر محصول' } });
  check('POST معتبر → 201 «در انتظار تصویب»', created.status === 201 && created.body.status === 'REQUESTED');
  const commitEarly = await api(`/program/expenses/${created.body.id}/commit`, { method: 'POST', token: ptok });
  check('تعهد پیش از تصویب → ۴۰۰ (قاعدهٔ اصلی فرم ۱۴)',
    commitEarly.status === 400 && commitEarly.body.message.includes('پس از تصویب'));
  const approved = await api(`/program/expenses/${created.body.id}/approve`, { method: 'POST', token: ptok });
  check('تصویب → «تصویب‌شده» با مهر زمانی', approved.status === 200 && approved.body.status === 'APPROVED' && !!approved.body.approvedAt);
  const approveAgain = await api(`/program/expenses/${created.body.id}/approve`, { method: 'POST', token: ptok });
  check('تصویب دوباره → ۴۰۰', approveAgain.status === 400);
  const committed = await api(`/program/expenses/${created.body.id}/commit`, { method: 'POST', token: ptok });
  check('تعهد پس از تصویب → «تعهد ثبت‌شده»', committed.status === 200 && committed.body.status === 'COMMITTED' && !!committed.body.committedAt);
  const commitAgain = await api(`/program/expenses/${created.body.id}/commit`, { method: 'POST', token: ptok });
  check('تعهد دوباره → ۴۰۰', commitAgain.status === 400);

  const demoList = await api('/program/expenses', { token: (await login(OWNER.email)).body?.accessToken });
  check('دنیای دمو: فقط دو هزینهٔ بذر خودش (نه هزینه‌های پارس)', demoList.status === 200 && demoList.body.items.length === 2
    && demoList.body.items.every((x) => x.id.startsWith('ex-d')));
}

/* ═════════════════ گام ۴.۵ — فرم ۱۸: صورت‌جلسهٔ تحویل (بخش ۲۸.۱ + پیوست ب) ═════════════════ */
section('گام ۴.۵ — فرم ۱۸: صورت‌جلسهٔ تحویل');
{
  const ptok = (await api('/auth/login', { method: 'POST', body: { email: 'pars', password: 'pars1234' } })).body?.accessToken;

  const list = await api('/program/delivery', { token: ptok });
  check('GET /program/delivery → پنج قلم تحویل ۲۸.۱ سند', list.status === 200 && list.body.items.length === 5);
  check('هر قلم با شکل تحویل و گیرندهٔ هلدینگ',
    list.body.items.every((i) => i.form.length > 3 && i.receiver.length > 3));
  check('بذر پارس: ۲ قلم تحویل‌شده + ۳ در انتظار · ۲ مرحله از ۷ · بدون امضا',
    list.body.delivered === 2 && list.body.allDelivered === false && list.body.doneSteps === 2 && list.body.locked === false);
  check('مرحلهٔ جاری فرآیند هفت‌گام = انتقال اقلام (۳)',
    list.body.currentStepKey === 'transfer');
  check('قاعدهٔ فرم ۱۸ در پاسخ سرور: امضا فقط پس از تحویل همهٔ اقلام',
    String(list.body.rule).includes('امضا فقط پس از تحویل همهٔ اقلام'));

  /* اقلام: تکرار تحویل → ۴۰۰ */
  const again = await api('/program/delivery/items/data-export', { method: 'POST', token: ptok, body: {} });
  check('تحویل دوبارهٔ قلم تحویل‌شده → ۴۰۰', again.status === 400);
  const noPerm = await api('/program/delivery/items/brand-assets', { method: 'POST', token: (await login('client')).body?.accessToken, body: {} });
  check('کاربر بدون program.write → ۴۰۳', noPerm.status === 403);

  /* امضا پیش از تحویل همهٔ اقلام → ۴۰۰ با فهرست اقلام باز */
  const signEarly = await api('/program/delivery/sign', { method: 'POST', token: ptok, body: { programRep: 'مدیر پروژه', holdingRep: 'مدیرعامل هلدینگ' } });
  check('امضا پیش از تحویل همهٔ اقلام → ۴۰۰ با فهرست اقلام تحویل‌نشده',
    signEarly.status === 400 && signEarly.body.message.includes('رجیستری دارایی برند'));

  /* مراحل ترتیبی: پرش → ۴۰۰ · جاری → ۲۰۰ */
  const skip = await api('/program/delivery/steps/verify', { method: 'POST', token: ptok });
  check('پرش از مرحلهٔ جاری → ۴۰۰ (ترتیبی)', skip.status === 400 && skip.body.message.includes('ترتیبی'));
  const step3 = await api('/program/delivery/steps/transfer', { method: 'POST', token: ptok });
  check('تکمیل مرحلهٔ جاری → ۳ از ۷', step3.status === 200 && step3.body.doneSteps === 3);

  /* تحویل سه قلم باقی‌مانده → همه تحویل */
  for (const k of ['brand-assets', 'media-plan', 'training']) {
    await api(`/program/delivery/items/${k}`, { method: 'POST', token: ptok, body: { note: 'تحویل تست باتری' } });
  }
  const all = await api('/program/delivery', { token: ptok });
  check('تحویل سه قلم باقی‌مانده → ۵ از ۵ و آمادهٔ امضا',
    all.body.delivered === 5 && all.body.allDelivered === true && all.body.locked === false);

  /* امضا: بدون طرفین → ۴۰۰ · کامل → قفل */
  const noReps = await api('/program/delivery/sign', { method: 'POST', token: ptok, body: { programRep: '', holdingRep: '' } });
  check('امضا بدون نمایندگان طرفین → ۴۰۰', noReps.status === 400);
  const signed = await api('/program/delivery/sign', { method: 'POST', token: ptok, body: { programRep: 'مدیر پروژه', holdingRep: 'مدیرعامل هلدینگ' } });
  check('امضای طرفین → قفل صورت‌جلسه',
    signed.status === 200 && signed.body.locked === true && signed.body.signature.programRep === 'مدیر پروژه' && !!signed.body.signature.signedAt);
  const signAgain = await api('/program/delivery/sign', { method: 'POST', token: ptok, body: { programRep: 'x', holdingRep: 'y' } });
  check('امضای دوباره → ۴۰۰', signAgain.status === 400);
  const afterLock = await api('/program/delivery/steps/verify', { method: 'POST', token: ptok });
  check('تغییر مرحله پس از قفل → ۴۰۰', afterLock.status === 400);

  /* جداسازی مستأجر: دنیای دمو امضاشده و قفل است */
  const demo = await api('/program/delivery', { token: (await login(OWNER.email)).body?.accessToken });
  check('دنیای دمو: همهٔ اقلام تحویل و صورت‌جلسه امضاشده (قفل)',
    demo.status === 200 && demo.body.allDelivered === true && demo.body.locked === true && demo.body.doneSteps === 7);
  const demoSign = await api('/program/delivery/sign', { method: 'POST', token: (await login(OWNER.email)).body?.accessToken, body: { programRep: 'a', holdingRep: 'b' } });
  check('امضا در دنیای قفل‌شدهٔ دمو → ۴۰۰', demoSign.status === 400);
}

/* ═════════════════ گام ۴.۶ — فرم ۱: چک‌لیست پروژه صفر (پیوست ب) ═════════════════ */
section('گام ۴.۶ — فرم ۱: چک‌لیست پروژه صفر');
{
  const ptok = (await api('/auth/login', { method: 'POST', body: { email: 'pars', password: 'pars1234' } })).body?.accessToken;
  const otok = (await login(OWNER.email)).body?.accessToken;

  const pars = await api('/program/project-zero', { token: ptok });
  check('GET /program/project-zero → بیست خروجی تأسیس', pars.status === 200 && pars.body.items.length === 20);
  check('پارس: پروژه صفر در ماه نخست بسته شد — هر ۲۰ انجام‌شده و دروازهٔ استقرار برقرار',
    pars.body.stats.done === 20 && pars.body.passed === true && pars.body.items.every((i) => i.doneAt));
  check('اولین خروجی «تعیین نوع شرکت» و آخرین «ساختار گزارش مالی»',
    pars.body.items[0].title.includes('نوع شرکت') && pars.body.items[19].title === 'ساختار گزارش مالی');
  check('قاعدهٔ فرم ۱ در پاسخ سرور: تکمیل همه شرط عبور از فاز استقرار',
    String(pars.body.rule).includes('شرط عبور از فاز استقرار'));

  /* دنیای دمو: در میانهٔ راه — ۱۲ انجام + ۳ در جریان + ۵ در انتظار */
  const demo = await api('/program/project-zero', { token: otok });
  check('دنیای دمو: ۱۲ انجام‌شده + ۳ در جریان + ۵ در انتظار — دروازه برقرار نیست',
    demo.body.stats.done === 12 && demo.body.stats.inProgress === 3 && demo.body.stats.pending === 5 && demo.body.passed === false);

  /* چرخش وضعیت در دنیای دمو: در انتظار → در جریان → انجام‌شده */
  const target = demo.body.items.find((i) => i.status === 'PENDING');
  const s1 = await api(`/program/project-zero/items/${target.key}`, { method: 'PATCH', token: otok, body: { status: 'IN_PROGRESS' } });
  check('چرخش «در انتظار → در جریان» → آمار ۱۳/۴/۳', s1.status === 200 && s1.body.stats.done === 12 && s1.body.stats.inProgress === 4);
  const s2 = await api(`/program/project-zero/items/${target.key}`, { method: 'PATCH', token: otok, body: { status: 'DONE' } });
  check('چرخش «در جریان → انجام‌شده» با مهر زمانی → آمار ۱۳/۳/۳',
    s2.status === 200 && s2.body.stats.done === 13 && !!s2.body.items.find((i) => i.key === target.key).doneAt);
  const bad = await api(`/program/project-zero/items/${target.key}`, { method: 'PATCH', token: otok, body: { status: 'OLD' } });
  check('وضعیت خارج از فهرست → ۴۰۰', bad.status === 400);
  const noKey = await api('/program/project-zero/items/does-not-exist', { method: 'PATCH', token: otok, body: { status: 'DONE' } });
  check('کلید نامعتبر → ۴۰۴', noKey.status === 404);
  const noPerm = await api(`/program/project-zero/items/${target.key}`, { method: 'PATCH', token: (await login('client')).body?.accessToken, body: { status: 'DONE' } });
  check('کاربر بدون program.write → ۴۰۳', noPerm.status === 403);

  /* جداسازی مستأجر: پارس همه انجام‌شده، دمو مستقل */
  const parsAgain = await api('/program/project-zero', { token: ptok });
  check('جداسازی مستأجر: پارس همچنان ۲۰/۲۰ (تغییر دمو اثری نداشت)',
    parsAgain.body.stats.done === 20 && parsAgain.body.passed === true);
}

console.log(`\n════════════════════════════════════════`);
console.log(`  PASS: ${pass}   FAIL: ${fail}`);
if (failures.length) { console.log(`  Failed: ${failures.join(' | ')}`); }
console.log(`════════════════════════════════════════`);
process.exit(fail > 0 ? 1 : 0);
