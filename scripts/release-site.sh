#!/usr/bin/env bash
# انتشار بیلد استاتیک «ریشهٔ ساب‌دامین» روی برنچ deploy/plesk — برای استقرار Plesk/آپاچی.
#
# این اسکریپت:
#   ۱) بیلد استاتیک را با SRIP_BASE_PATH=/ می‌سازد (اپ در ریشهٔ دامنه سرو می‌شود، بدون /Srip/srip2)
#   ۲) .htaccess با قواعد URL تمیز اضافه می‌کند (foo → foo.html؛ همان رفتار GitHub Pages)
#   ۳) درخت خروجی را به‌صورت یک کامیت روی برنچ deploy/plesk پوش می‌کند
#      (بدون دست‌زدن به شاخهٔ کاری — الگوی انتشار، مانند برنچ Pages)
#
# استقرار (یک‌بار در Plesk):
#   Git → Create repository → Remote → https://github.com/<user>/Srip.git
#   → Deployment: Automatic → Server path: httpdocs ساب‌دامین → Branch: deploy/plesk
# پس از هر تغییر، اجرای همین اسکریپت سایت را به‌روز می‌کند.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${SRIP_DEPLOY_BRANCH:-deploy/plesk}"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT" "$GIT_INDEX_FILE"' EXIT
# هویت گیت برای commit-tree در محیط‌های بدون config (مثل GitHub Actions)
export GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-srip-release}"
export GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-release@srip.local}"
export GIT_COMMITTER_NAME="${GIT_COMMITTER_NAME:-$GIT_AUTHOR_NAME}"
export GIT_COMMITTER_EMAIL="${GIT_COMMITTER_EMAIL:-$GIT_AUTHOR_EMAIL}"

SRIP_BASE_PATH=/ SRIP_OUT_DIR="$OUT" bash "$ROOT/scripts/release-ux.sh"

cat > "$OUT/.htaccess" <<'EOT'
# SRIP — clean URLs for the static export (Apache/Plesk)
# same routing as GitHub Pages: /foo -> foo.html (or foo/index.html), else 404
Options -Indexes
DirectoryIndex index.html
AddType application/manifest+json .webmanifest
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
# real file/directory → serve as-is
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
# /login → /login.html
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteRule ^(.+?)/?$ $1.html [L]
# /foo/ → /foo/index.html
RewriteCond %{REQUEST_FILENAME}/index.html -f
RewriteRule ^(.+?)/?$ $1/index.html [L]
</IfModule>
ErrorDocument 404 /404.html
EOT

# کامیت روی برنچ استقرار با ابزار plumbing — شاخهٔ کاری دست‌نخورده می‌ماند
export GIT_INDEX_FILE="$(mktemp)"
GD=--git-dir="$ROOT/.git"
git "$GD" read-tree --empty
( cd "$OUT" && git "$GD" --work-tree="$OUT" add -A . )
TREE=$(git "$GD" write-tree)
PARENT="$(git "$GD" ls-remote origin "refs/heads/$BRANCH" | cut -f1 || true)"
if [ -n "$PARENT" ]; then PARENT_ARGS=(-p "$PARENT"); else PARENT_ARGS=(); fi
VER="$(grep -oP "DEMO_MOCK_VERSION\s*=\s*'[^']+'" "$ROOT/apps/web-ux/scripts/mock-api.mjs" | grep -oP "'[^']+'" | tr -d "'")"
COMMIT=$(printf 'site release %s\n\nstatic export for subdomain root (SRIP_BASE_PATH=/) — Plesk/Apache\n' "$VER" \
  | git "$GD" commit-tree "$TREE" ${PARENT_ARGS[@]+"${PARENT_ARGS[@]}"})
git "$GD" push origin "$COMMIT:refs/heads/$BRANCH"
echo "[release-site] $BRANCH ← $COMMIT (نسخهٔ $VER)"
