# دیپلوی srip2 روی دامنه/هاست خودتان (مثلاً Plesk اشتراکی)

خروجی پروژه یک **build استاتیک و مستقل** است (بدون دیتابیس/بکاند — API دمو داخل
Service Worker است). پس هر هاستی که فایل استاتیک سرو کند کافی است. این راهنما دو
مسیر دارد: **دستی (اسکریپت محلی)** و **خودکار (GitHub Actions)**.

> ⚠️ نکتهٔ کلیدی: build برای مسیر URL مشخصی ساخته می‌شود (`basePath`). اگر می‌خواهید
> سایت در `https://your-domain.com/srip` دیده شود، build باید با `SRIP_BASE_PATH=/srip`
> انجام شود و پوشهٔ مقصد هم `srip` باشد. اگر پوشه عوض شود، مسیر را هم باید عوض کنید.

---

## گام ۰ — دسترسی SSH در Plesk

1. وارد Plesk شوید → **Subscriptions → دامنهٔ شما → Access**.
2. **SSH Access** را فعال کنید (اگر غیرفعال است).
3. کلید عمومی بسازید (محلی):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
   ```
4. محتوای `~/.ssh/id_ed25519.pub` را در Plesk (Access → SSH Keys → Add) اضافه کنید.
5. با `ssh youruser@ftp.your-domain.com` تست کنید و بعد `pwd; ls` بزنید تا
   **document root** را ببینید (معمولاً `~/httpdocs` یا
   `/var/www/vhosts/your-domain.com/httpdocs`).

---

## مسیر ۱ — دستی (برای تست اول)

```bash
cp .deploy.env.example .deploy.env      # بعد ویرایش: هاست، یوزر، مسیر docroot
bash scripts/deploy-to-host.sh          # build + آپلود
```

- تست بدون آپلود: `SRIP_DEPLOY_DRY_RUN=1 bash scripts/deploy-to-host.sh`
- `deploy-to-host.sh` فقط OpenSSH لازم دارد (نه rsync، نه ImageMagick) — آپلود با
  `tar | ssh` انجام می‌شود.

نتیجه: `https://your-domain.com/srip` (اگر `SRIP_DEPLOY_SUBPATH=srip`).

---

## مسیر ۲ — خودکار با هر تغییر (توصیه‌شده)

هر تغییر از طریق `scripts/publish-live.sh` به برنچ انتشار
(`arena/01a04f6d-srip`) push می‌شود. ورک‌فلو
`.github/workflows/deploy-host.yml` روی همین push اجرا می‌شود: build → SSH → آپلود.
یعنی **همان لحظه‌ای که تغییر منتشر می‌شود، دامنهٔ شما هم به‌روز می‌شود.**

### تنظیمات GitHub (یک بار)

**Repository Settings → Secrets and variables → Actions:**

| Secret / Variable | مقدار |
|---|---|
| Secret `SRIP_DEPLOY_HOST` | `ftp.your-domain.com` (آدرس SSH هاست) |
| Secret `SRIP_DEPLOY_USER` | کاربر SSH/SFTP Plesk |
| Secret `SRIP_DEPLOY_PORT` | `22` (اختیاری) |
| Secret `SRIP_DEPLOY_SSH_KEY` | محتوای کامل `~/.ssh/id_ed25519` (کلید **خصوصی**) |
| Secret `SRIP_DEPLOY_DOCROOT` | `~/httpdocs` یا مسیر کامل (اختیاری؛ پیش‌فرض `~/httpdocs`) |
| Secret `SRIP_DEPLOY_SUBPATH` | `srip` (اختیاری؛ پیش‌فرض `srip`) |
| **Variable** `SRIP_DEPLOY_ENABLED` | `true` ← این ورک‌فلو را فعال می‌کند |
| **Variable** `SRIP_BASE_PATH` | `/srip` (اختیاری؛ پیش‌فرض `/srip`) |

> نکته: پایین صفحهٔ Secrets، تب **Variables** هم هست — `SRIP_DEPLOY_ENABLED` باید
> آنجا باشد، نه در Secrets.

بعد از فعال‌سازی، ورک‌فلو را یک بار دستی تست کنید:
`Actions → Deploy srip2 to custom host → Run workflow`.

---

## سؤال‌های متداول

**چه چیزی آپلود می‌شود؟** فقط خروجی `out/` (فایل‌های استاتیک + `sw.js` + آیکون‌ها)؛
سورس پروژه نه. آپلود هر بار پوشهٔ مقصد را پاک و تازه می‌کند (فایل‌های کهنهٔ build حذف می‌شوند).

**خدمات دمو هنوز کار می‌کند؟** بله — `sw.js` داخل همان پوشه است؛ مرورگر API دمو
را از خودش پاسخ می‌دهد (ورود: demo/123456). فقط مطمئن شوید پوشه به‌درستی آپلود شده
(فایل `sw.js` کنار `index.html` باشد).

**HTTPS؟** اگر دامنه SSL دارد (Plesk/LetsEncrypt) و سایت زیر `https://domain.com/srip`
سرو می‌شود، کافی است `SRIP_BASE_PATH` با همان مسیر یکی باشد. اگر زیردامنه
(`srip.domain.com`) می‌خواهید، `SRIP_BASE_PATH=/` بگذارید و `SRIP_DEPLOY_SUBPATH` را
خالی/`httpdocs` کنید.

**مشکل در کش؟** نسخهٔ دمو در پاسخ `/health` است؛ مرورگر وقتی نسخهٔ build فرق کند
خودش SW را تازه و صفحه را رفرش می‌کند. اگر خواستید: یک بار Ctrl+Shift+R.
