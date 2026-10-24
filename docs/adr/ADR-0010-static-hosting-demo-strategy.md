# ADR-0010: استراتژی دمو روی میزبانی استاتیک (GitHub Pages)

- Status: Accepted
- Date: 2026-09-10
- Sprint: ۱ (بند ۱-۳ پلن)

## Context
محصول عمومی روی GitHub Pages (استاتیک، بدون بک‌اند) سرو می‌شود: `web-ux` با `output: export` + سرویس‌کارگر `sw.js` که از `mock-api.mjs` تولید می‌شود و کل `/api/v1/*` را در مرورگر جواب می‌دهد. این یعنی منطق کسب‌وکار در دو جا (mock و NestJS) زندگی می‌کند و دمو با production واگرا می‌شود. بند ۱-۳ پلن: یا نمونهٔ سبک API واقعی پشت دامنه دیپلوی شود، یا محدودیت صریحاً در ADR ثبت شود — نه mock ضمنی.

## Decision
مسیر هدف (سه پلهٔ زمان‌بندی‌شده):
1. **همین امروز (S1):** پرچم `SRIP_DEMO_MODE` روی `apps/api` (زیرساخت حالت دمو روی API واقعی) + این ADR به‌عنوان ثبت صریح محدودیت.
2. **Sprint 2 — منبع واحد داده:** بستهٔ `packages/demo-data` تنها تعریف‌کنندهٔ دادهٔ دمو؛ `seed-demo.ts` (Postgres) و `demo-data.json` (تزریق به SW) هر دو از آن تولید می‌شوند (تکرار الگوی موفق `criteria-data.json`). منطق مشترک امتیاز/هشدار در `packages/domain-rules`.
3. **Sprint 3 — جایگزینی موتور:** استقرار نمونهٔ دموی API واقعی (Railway/Fly/Cloudflare Workers — هزینهٔ نزدیک صفر) با `SRIP_DEMO_MODE=true`؛ `NEXT_PUBLIC_API_URL` به آن اشاره می‌کند؛ فقط پس از تأیید staging، `mock-api.mjs`/`sw.js` حذف می‌شوند.

## Consequences
- ✅ محدودیت میزبانی تصمیمِ ثبت‌شده است، نه وضعیت پیش‌فرضِ بی‌تصمیم.
- ⚠️ تا پلهٔ ۳، دمو موازی با API واقعی است — ریسک با «همان منبع داده/منطق» (پلهٔ ۲) به حداقل می‌رسد.
- Rollback: هر پله مستقل rollback دارد؛ حذف mock فقط با چک‌لیست تک‌تک endpointها.
