# E2E مرورگر — نقشهٔ عموم‌ها (Publics)

این پوشه حاوی E2E پاپتیر برای هاب عموم‌ها (`publics-ui.mjs`) و راه‌اندازی
مرورگر بدون نیاز به دانلود خارجی است.

## چرا این‌طور کار می‌کند؟

`@sparticuz/chromium` (وابستگی dev) **کروم ۱۴۹ را داخل tarball خودش** حمل می‌کند
(نیازی به CDN یا Google storage نیست). لایهٔ Amazon Linux 2023 همین بسته
(`bin/al2023.tar.br`) شامل کتابخانه‌های NSS/NSPR است: `libnss3`, `libnssutil3`,
`libnspr4`, `libplc4`, `libplds4`, `libfreebl3`, `libsoftokn3`.
پس **ساخت از منبع لازم نیست** — `scripts/e2e-browser-setup.mjs` همهٔ این‌ها را
در `.e2e-browser/` از حالت brotli خارج می‌کند:

- `.e2e-browser/chromium` — باینری کروم
- `.e2e-browser/nss/` — کتابخانه‌های NSS/NSPR (برای `LD_LIBRARY_PATH`)
- `.e2e-browser/libGLESv2.so` و … — SwiftShader؛ کروم آن را کنار باینری خودش
  پیدا می‌کند و بدون آن در مسیرهای غیر از `/tmp` پروسهٔ مرورگر بالا نمی‌آید.

## اجرا

پیش‌نیازها: mock API روی `:4100` و dev server روی `http://localhost:3000`
(الزاماً با `localhost`، نه `127.0.0.1` — سرور `_next/static` را برای
Host کارت می‌کند).

```bash
# در apps/web-ux:
corepack pnpm install          # نصب puppeteer-core + @sparticuz/chromium
node scripts/e2e-browser-setup.mjs
node scripts/e2e/publics-ui.mjs
```

دستور دوم و سوم را می‌توان با متغیرهای `CHROME_EXE` / `CHROME_LD` جایگزین کرد.
E2E در ابتدا `POST /api/v1/dev/reset` (مخصوص مالک) را صدا می‌زند تا دادهٔ دمو
بازنشانی شود و اجرا تکرارپذیر باشد.

## محدودهٔ بررسی

۳۷ بررسی: ورود (دمو «مالک») → هاب عموم‌ها (من کیستم، ۶ دسته، ۱۰۵ گروه،
ماتریس، اعضا، درج/ارزیابی) → پوشش → گپ‌ها (+ مسیر پیشنهادی) → KPI/بریف →
خروجی JSON/CSV/Excel → شبکهٔ روابط (گرهٔ ego، ۸+ گرهٔ دسته‌بندی‌شده، فیلتر
دستهٔ کارا) → اقدام واقعی ساخته‌شده از محرک `PUBLIC_GAP_DETECTED` و پوشش
گردش‌کارها.
