#!/usr/bin/env bash
# انتشار سایت استاتیک «داخل شاخهٔ کاری» — برای استقرار سادهٔ Plesk روی همان شاخه.
#
# بیلد استاتیک ریشهٔ دامنه (SRIP_BASE_PATH=/) را می‌سازد، فایل‌هایش را در
# «ریشهٔ ریپو» کنار سورس می‌گذارد (index.html، sw.js، _next/، .htaccess، …)
# و روی شاخهٔ فعلی کامیت+پوش می‌کند. پلسک فقط همین شاخه را می‌کشد و سایت
# از همان ریشه سرو می‌شود؛ فایل‌های سورس اضافی در httpdocs بی‌ضررند.
#
# فهرست فایل‌های بیلد در .site-build-manifest نگه داشته می‌شود تا نسخهٔ بعدی
# فایل‌های منسوخِ نسخهٔ قبل را پاک کند (بدون دست‌زدن به فایل‌های سورس).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

SRIP_BASE_PATH=/ SRIP_OUT_DIR="$OUT" bash "$ROOT/scripts/release-ux.sh"

cat > "$OUT/.htaccess" <<'EOT'
# SRIP — clean URLs for the static export (Apache/Plesk)
Options -Indexes
DirectoryIndex index.html
AddType application/manifest+json .webmanifest
AddType application/javascript .js
AddType text/css .css
AddType text/html .html
# سرویس‌کارگر باید همیشه تازه سرو شود تا به‌روزرسانی‌ها فوری اعمال شوند
<FilesMatch "sw\.js$">
  <IfModule mod_headers.c>
    Header set Cache-Control "no-cache"
  </IfModule>
</FilesMatch>
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteRule ^(.+?)/?$ $1.html [L]
RewriteCond %{REQUEST_FILENAME}/index.html -f
RewriteRule ^(.+?)/?$ $1/index.html [L]
</IfModule>
ErrorDocument 404 /404.html
EOT

MANIFEST=".site-build-manifest"

# ۱) پاک‌کردن فایل‌های بیلدِ نسخهٔ قبل که در بیلد تازه نیستند (منسوخ)
if [ -f "$MANIFEST" ]; then
  while IFS= read -r f; do
    [ -f "$f" ] && [ ! -f "$OUT/$f" ] && rm -f "$f"
  done < "$MANIFEST"
fi

# ۲) کپی بیلد تازه روی ریشهٔ ریپو (فایل‌های سورس دست‌نخورده می‌مانند)
cp -a "$OUT/." "$ROOT/"

# ۳) فهرست تازه برای پاک‌سازی نسخهٔ بعد
( cd "$OUT" && find . -type f | sed 's|^\./||' ) > "$MANIFEST"

# ۴) کامیت + پوش روی همان شاخهٔ کاری
VER="$(grep -oP "DEMO_MOCK_VERSION\s*=\s*'[^']+'" "$ROOT/apps/web-ux/scripts/mock-api.mjs" | grep -oP "'[^']+'" | tr -d "'")"
git add -A "$MANIFEST" .htaccess index.html 404.html sw.js _next fonts manifest.webmanifest *.html *.txt 2>/dev/null || true
# پوشه‌های مسیرها (organizations/ و…)
git add -A .
git commit -q -m "site: انتشار استاتیک نسخهٔ $VER (ریشهٔ ساب‌دامین، برای Plesk)" || echo "[release-branch] تغییری نبود"
git push origin "$BRANCH"
echo "[release-branch] شاخهٔ $BRANCH با بیلد نسخهٔ $VER به‌روز شد"
