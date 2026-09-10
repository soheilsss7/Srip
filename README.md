# SRIP — پلتفرم هوش روابط راهبردی

بستر سازمانی برای هلدینگ‌هایی که روابط راهبردی را میان زیرمجموعه‌ها، مشتریان، شرکا و ذی‌نفعان بیرونی مدیریت می‌کنند.

**وضعیت فعلی پروژه را فقط این سه سند می‌گویند** (فایل‌های تاریخی به `docs/history/` منتقل شده‌اند):

| سند | محتوا |
|---|---|
| [`docs/architecture/module-status.md`](docs/architecture/module-status.md) | وضعیت واقعی هر ۳۶ ماژول (API واقعی / دمو / تست) — ممیزی ۲۰۲۶-۰۹-۱۰ |
| [`docs/architecture/INTEGRATION-PLAN.md`](docs/architecture/INTEGRATION-PLAN.md) | پلن زندهٔ یکپارچه‌سازی (۸ فاز) با وضعیت اجرا |
| [`CHANGELOG.md`](CHANGELOG.md) | تاریخچهٔ نسخه به نسخه |

تصمیم‌های معماری: [`docs/adr/`](docs/adr) (ADR-0001 تا ADR-0011 + قالب) · تاریخچهٔ کامل: [`docs/history/`](docs/history)

## استقرار (Deployment)

- **دموی عمومی (زنده):** <https://soheilsss7.github.io/Srip/srip2/> — خروجی استاتیک `apps/web-ux` + سرویس‌کارگر دمو (بدون بک‌اند؛ استراتژی ثبت‌شده در ADR-0010).
- **انتشار بدون merge:** `bash scripts/publish-live.sh` (push مستقیم fast-forward به برنچ انتشار Pages).
- **API واقعی:** NestJS + Prisma + PostgreSQL/Redis — `docker compose up -d postgres redis` سپس `pnpm dev`. حالت دمو روی API واقعی: `SRIP_DEMO_MODE=true` + `pnpm --filter @srip/api prisma:seed:demo`.

## Stack

- Web (محصول زنده): `apps/web-ux` — Next.js 16 (static export) + React 19 + TypeScript
- Web (قدیمی): `apps/web` — نگهداری‌شده برای مرجع
- Mobile: `apps/mobile` — Expo / React Native
- API: `apps/api` — NestJS + Prisma + PostgreSQL + Redis
- Monorepo: pnpm 10.12.4 + Turborepo

## Quick start

```bash
pnpm install                       # pnpm 10.12.4
cp .env.example apps/api/.env      # و جایگزینی رازها
docker compose up -d postgres redis
pnpm db:generate && pnpm db:migrate
pnpm --filter @srip/api prisma:seed:demo   # دادهٔ دمو در Postgres واقعی
pnpm dev
```

دموی بدون بک‌اند (همان قرارداد API، موتور قطعی):

```bash
node apps/web-ux/scripts/mock-api.mjs          # :4000
pnpm --filter @srip/web-ux dev                  # :3000 (پراکسی خودکار /api/v1)
```

ورود دمو (OTP دلخواه ۶ رقمی): مالک `demo / 123456` (همه‌چیز) · مستأجر `client / 123456` (فقط آریا فناوری).

## ساختار مخزن

```
apps/api        ← API واقعی NestJS (۴۴ کنترلر) + Prisma schema + seedها
apps/web-ux     ← محصول زندهٔ وب (static export) + mock-api.mjs (موتور دموی SW)
apps/web        ← نسخهٔ قبلی وب (مرجع)
apps/mobile     ← موبایل Expo
packages/       ← بسته‌های مشترک (design-system, ui, api-client, …)
docs/adr        ← تصمیم‌های معماری (Context/Decision/Consequences)
docs/architecture ← module-status + پلن یکپارچه‌سازی
docs/history    ← آرشیو تمام PACKAGE*/PHASE*/STAGE*/WEB_FRONTEND* (ادعاهای دورهٔ ساخت)
scripts/        ← verify*, publish-live, backup, deploy
```

## آزمون و صحت‌سنجی

```bash
pnpm verify                 # چک‌های مخزن
pnpm --filter @srip/api test:unit     # ۴۰ فایل تست unit
node apps/web-ux/scripts/api-tests.mjs  # سوئیت دمو (auth/scope/CRUD/…)
pnpm --filter @srip/web-ux build:pages  # بیلد استاتیک + به‌روزرسانی sw.js
```

CI (روی PR): quality + api-tests (Postgres/Redis واقعی) + security-static.

## هشدار امنیتی

ورود توسعه‌ای فقط پایه است؛ استقرار واقعی نیازمند OIDC، MFA، RBAC/ABAC (فاز ۴ پلن)، rate limiting، مدیریت راز، ممیزی، پشتیبان‌گیری و تست نفوذ است.

## نقطهٔ بازگشت (بکاپ)

تگ `backup-platform-2026-09-10` + Release هم‌نام — وضعیت دقیق پلتفرم پیش از این اسپرینت. راهنمای بازگردانی: `BACKUP.md`.
