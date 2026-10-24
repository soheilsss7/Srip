/* فاز ۱۲.۲ — راستی‌آزمایی مهاجرت چارت v14 روی DB با ردیف persisted قدیمی (v6) */
const BASE = process.env.MOCK_API_URL ?? 'http://localhost:4000/api/v1';
const args = process.argv.slice(2);
const VERIFY = args.includes('--verify');

async function api(path, opts = {}) {
  const r = await fetch(BASE + path, { method: opts.method ?? 'GET', headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let b = null; try { b = await r.json(); } catch {}
  return { status: r.status, body: b };
}

const r = await api('/auth/login', { method: 'POST', body: { email: 'demo@srip.local', password: '123456', otp: '123456' } });
const token = r.body?.accessToken;
if (!token) { console.error('LOGIN FAIL', r.status, JSON.stringify(r.body)); process.exit(1); }

const st = await api('/program/settings', { token });
const ch = st.body.chart ?? [];
const total = ch.reduce((s, x) => s + (x.count ?? 1), 0);
const ai = ch.filter(x => x.ai).length;
const rk = await api('/program/risks', { token });
const owners = (rk.body.items ?? []).map(x => x.ownerRole);
const rc = await api('/role-cards', { token });
const titles = (Array.isArray(rc.body) ? rc.body : rc.body?.items ?? []).map(x => x.title);
const kp = await api('/program/kpis', { token });
const kOwners = (kp.body.items ?? []).map(x => x.owner);

if (!VERIFY) {
  console.log(JSON.stringify({ roles: st.body.roles.length, chart: ch.length, total, ai,
    removedLeft: ch.filter(x => ['کارشناس حاکمیت و ریسک هوش مصنوعی', 'تحلیلگر اعتماد و ایمنی'].includes(x.title)).length }, null, 1));
} else {
  const bad = [];
  if (st.body.roles.length !== 33) bad.push(`roles=${st.body.roles.length}≠33`);
  if (ch.length !== 33) bad.push(`chart=${ch.length}≠33`);
  if (total !== 36) bad.push(`total=${total}≠36`);
  if (ai !== 6) bad.push(`ai=${ai}≠6`);
  if (!ch.some(x => x.title === 'کارشناس امور بین‌الملل')) bad.push('بین‌الملل missing');
  if (!ch.some(x => x.layer === 'فناوری و داده')) bad.push('لایهٔ فناوری و داده missing');
  if (ch.some(x => x.layer === 'فناوری، داده و اعتماد')) bad.push('لایهٔ قدیمی مانده');
  if (owners.includes('تحلیلگر اعتماد و ایمنی')) bad.push('ریسک با مسئول حذف‌شده مانده');
  if (!owners.includes('تحلیلگر حاکمیت و کیفیت داده')) bad.push('نگاشت مسئول ریسک نشده');
  if (titles.includes('کارشناس حاکمیت و ریسک هوش مصنوعی')) bad.push('کارت نقش حذف‌شده مانده');
  if (!titles.includes('مهندس یادگیری ماشین')) bad.push('کارت نقش به مهندس یادگیری ماشین نگاشت نشده');
  if (kOwners.includes('کارشناس حاکمیت و ریسک هوش مصنوعی')) bad.push('مالک شاخص حذف‌شده مانده');
  const kpi8 = (kp.body.items ?? []).find(k => k.id === 'kpi-8');
  if (kpi8 && (kpi8.targetValue !== 36 || !kpi8.title.includes('۳۶ نفره'))) bad.push('kpi-8 هنوز ۳۷: ' + kpi8.title);
  if (bad.length) { console.error('❌ MIGRATION ISSUES:\n' + bad.map(x => ' - ' + x).join('\n')); process.exit(1); }
  console.log('✅ مهاجرت v14 کامل: چارت ۳۳/۳۶/۴ لایه، AI=۶، بین‌الملل حاضر، نقش‌های حذف‌شده در ریسک/کارت/شاخص نگاشت شدند، kpi-8=۳۶');
}
