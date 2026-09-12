#!/usr/bin/env bash
# حذف «آینۀ کهنۀ ریشۀ دامنه» از docs/
#
# GitHub Pages از برنچ انتشار، مسیر /docs را سرو می‌کند. تا پیش از این اسکریپت،
# دو خروجی استاتیک کنار هم بودند:
#   • docs/            ← build قدیمی apps/web   →  https://…/Srip/
#   • docs/srip2/      ← build جاری apps/web-ux →  https://…/Srip/srip2/
# نتیجه: دو اپ روی یک دامنه، CSS/JS کهنه در ریشه و سردرگمی در گزارش باگ‌های موبایل.
#
# این اسکریپت فقط «مصالح build» ریشه را پاک می‌کند و به جایش دو صفحۀ ریدایرکت
# RTL می‌گذارد. سند‌ها (docs/**/*.md، docs/source/*.docx، docs/release/*.json)
# و docs/.nojekyll و کل docs/srip2/ دست‌نخورده می‌مانند — verify.sh و
# verify-phase0-6.sh و test/unit/package8-final-audit.spec.ts به آن سند‌ها وابسته‌اند.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$ROOT/docs"
cd "$DOCS"

# ۱) پاک‌کردن خروجی build قدیمی (هر چیزی که سند نیست)
mapfile -t VICTIMS < <(
  find . -type f \
    -not -path './srip2/*' \
    -not -path './index.html' \
    -not -path './404.html' \
    \( -name '*.html' -o -name '*.txt' -o -name '*.js' -o -name '*.css' -o -name '*.map' \) \
    | sort
)
printf '[prune-docs] %d فایل build قدیمی حذف می‌شود\n' "${#VICTIMS[@]}"
if [ "${#VICTIMS[@]}" -gt 0 ]; then
  printf '%s\n' "${VICTIMS[@]}" | xargs -d '\n' rm -f
fi

# ۲) پوشه‌های خالی‌شده
find . -mindepth 1 -type d -empty -not -path './srip2/*' -delete || true
echo "[prune-docs] پوشه‌های خالی پاک شد"

# ۳) دو صفحۀ ریدایرکت — ریشۀ دامنه باید فقط یک اپ داشته باشد.
#    ⚠ هدف ریدایرکت باید «مطلق» باشد: GitHub Pages فایل 404.html ریشه را برای هر
#    مسیر ناموجود سرو می‌کند؛ هدف نسبی (./srip2/index.html) نسبت به مسیرهای عمیق
#    (/Srip/srip2/relationships/…) resolve می‌شد و حلقهٔ بی‌نهایت /srip2/srip2/…
#    می‌ساخت. 404 ریشه هوشمند است: مسیرهای جزئیاتِ داخل اپ را به /view می‌برد.
write_index_redirect() {
  cat <<HTML
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<meta http-equiv="refresh" content="0; url=/Srip/srip2/"/>
<meta name="robots" content="noindex, follow"/>
<link rel="canonical" href="/Srip/srip2/"/>
<title>در حال انتقال… | هوش روابط راهبردی</title>
<style>
  :root{color-scheme:light dark}
  html,body{height:100%;margin:0;overflow-x:clip}
  body{display:grid;place-items:center;padding:24px;background:#070C1C;color:#E7ECF7;
    font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;text-align:center}
  .box{max-width:34rem;display:flex;flex-direction:column;align-items:center;gap:12px}
  .mark{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;
    font-size:26px;font-weight:900;color:#fff;background:linear-gradient(135deg,#6C63FF,#9261F8)}
  h1{margin:0;font-size:18px;font-weight:800}
  p{margin:0;font-size:13px;line-height:2;color:#9FB0D0}
  a{min-height:44px;display:inline-flex;align-items:center;padding:0 18px;border-radius:12px;
    background:#182036;border:1px solid #2B3554;color:#E7ECF7;
    font-size:13px;font-weight:800;text-decoration:none}
</style>
</head>
<body>
<div class="box">
  <div class="mark" aria-hidden="true">S</div>
  <h1>در حال انتقال به نسخۀ جاری سامانه…</h1>
  <p>اگر صفحه خودش باز نشد، روی پیوند زیر بزنید.</p>
  <a href="/Srip/srip2/">رفتن به سامانه</a>
</div>
<script>location.replace("/Srip/srip2/");</script>
</body>
</html>
HTML
}

write_smart_404() {
  cat <<'HTML'
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>در حال انتقال… | هوش روابط راهبردی</title>
<style>
  :root{color-scheme:light dark}
  html,body{height:100%;margin:0;overflow-x:clip}
  body{display:grid;place-items:center;padding:24px;background:#070C1C;color:#E7ECF7;
    font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;text-align:center}
  .box{max-width:34rem;display:flex;flex-direction:column;align-items:center;gap:12px}
  .mark{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;
    font-size:26px;font-weight:900;color:#fff;background:linear-gradient(135deg,#6C63FF,#9261F8)}
  h1{margin:0;font-size:18px;font-weight:800}
  p{margin:0;font-size:13px;line-height:2;color:#9FB0D0}
  a{min-height:44px;display:inline-flex;align-items:center;padding:0 18px;border-radius:12px;
    background:#182036;border:1px solid #2B3554;color:#E7ECF7;
    font-size:13px;font-weight:800;text-decoration:none}
</style>
</head>
<body>
<div class="box">
  <div class="mark" aria-hidden="true">S</div>
  <h1>در حال انتقال به نسخۀ جاری سامانه…</h1>
  <p>اگر صفحه خودش باز نشد، روی پیوند زیر بزنید.</p>
  <a href="/Srip/srip2/" id="go">رفتن به سامانه</a>
</div>
<script>
/* ۴۰۴ ریشهٔ سایت — GitHub Pages این فایل را برای «هر» مسیر ناموجود سرو می‌کند؛
   پس هدف ریدایرکت باید همیشه مطلق باشد (URL نسبی در مسیرهای عمیق مثل
   /Srip/srip2/relationships/… حلقهٔ بی‌نهایت /srip2/srip2/… می‌ساخت).
   منطق: مسیرهای جزئیاتِ داخل اپ → همان موجودیت در /view؛ بقیه → خانهٔ اپ. */
(function () {
  var BASE = '/Srip/srip2';
  var TYPES = { organizations:1, people:1, relationships:1, meetings:1, actions:1,
                commitments:1, projects:1, opportunities:1, interactions:1, recommendations:1 };
  var path = location.pathname;
  var rest = path.indexOf(BASE + '/') === 0 ? path.slice(BASE.length) : null;
  var m = rest && rest.match(/^\/([a-z]+)\/([^\/]+)\/?$/i);
  var target;
  if (m && TYPES[m[1].toLowerCase()]) {
    target = BASE + '/view?type=' + m[1].toLowerCase() + '&id=' + encodeURIComponent(m[2]);
  } else {
    target = BASE + '/';
  }
  var a = document.getElementById('go');
  if (a) a.setAttribute('href', target);
  location.replace(target);
})();
</script>
</body>
</html>
HTML
}

write_index_redirect > index.html
write_smart_404 > 404.html
echo "[prune-docs] index.html و 404.html ریدایرکتِ مطلق/هوشمند نوشته شد"
echo "[prune-docs] ریشۀ دامنه اکنون فقط به /Srip/srip2/ اشاره می‌کند"
