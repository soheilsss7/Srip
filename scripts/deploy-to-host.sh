#!/usr/bin/env bash
# دیپلوی build استاتیک srip2 روی هاست دلخواه (Plesk اشتراکی / هر SSH/SFTP).
#
# روش: build با SRIP_BASE_PATH دلخواه → آپلود با tar-over-ssh (فقط OpenSSH لازم است؛
# rsync و ImageMagick و پکیج دیگری نیاز نیست).
#
# راه‌اندازی:
#   1) در Plesk دسترسی SSH/SFTP را برای کاربرتان فعال کنید و کلید عمومی را اضافه کنید.
#      (Plesk → Subscriptions → دامنه → Access → SSH Keys)
#   2) یک فایل «.deploy.env» در ریشهٔ ریپو بسازید (الگو: .deploy.env.example).
#   3) اجرا:  bash scripts/deploy-to-host.sh           (یا با --dry-run برای تست)
#
# اگر بخواهید همه‌چیز خودکار شود، فایل .github/workflows/deploy-host.yml را فعال
# کنید — همان اسکریپت با push به برنچ انتشار (که publish-live.sh انجام می‌دهد)
# به‌صورت خودکار اجرا می‌شود.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# --- بارگذاری پیکربندی (اگر هست) ---
if [ -f .deploy.env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.deploy.env
  set +a
fi

DRY="${SRIP_DEPLOY_DRY_RUN:-0}"
HOST="${SRIP_DEPLOY_HOST:-}"
USER_NAME="${SRIP_DEPLOY_USER:-}"
PORT="${SRIP_DEPLOY_PORT:-22}"
KEY="${SRIP_DEPLOY_SSH_KEY:-}"
# پوشهٔ مقصد نسبت به document root؛ پیش‌فرض: «srip» → https://domain.com/srip
SUBPATH="${SRIP_DEPLOY_SUBPATH:-srip}"
# مسیر کامل document root روی سرور (Plesk: معمولاً ~/httpdocs یا
# /var/www/vhosts/domain.com/httpdocs — با SSH وارد شوید و «pwd/ls» بزنید)
# «~» در ابتدای مسیر روی خود سرور expand می‌شود.
DOCROOT="${SRIP_DEPLOY_DOCROOT:-~/httpdocs}"
REMOTE_DOCROOT="${DOCROOT/#\~/\$HOME}"
# مسیر URL: باید با نام پوشهٔ مقصد یکی باشد (پیش‌فرض /srip)
BASE_PATH="${SRIP_BASE_PATH:-/$SUBPATH}"
BASE_PATH="${BASE_PATH%/}"

if [ -z "$HOST" ] || [ -z "$USER_NAME" ]; then
  echo "خطا: SRIP_DEPLOY_HOST و SRIP_DEPLOY_USER تنظیم نشده‌اند." >&2
  echo "الگو: cp .deploy.env.example .deploy.env و ویرایش آن." >&2
  exit 1
fi
if [ -n "$KEY" ]; then
  SSH_KEY_OPT=(-i "$KEY")
else
  SSH_KEY_OPT=()
fi

echo "[deploy-to-host] basePath=$BASE_PATH  host=$USER_NAME@$HOST:$PORT  dest=$REMOTE_DOCROOT/$SUBPATH"

# --- build ---
SRIP_BASE_PATH="$BASE_PATH" SRIP_OUT_DIR="$ROOT/.deploy-build" bash scripts/release-ux.sh

if [ "$DRY" = "1" ]; then
  echo "[deploy-to-host] DRY-RUN: build آماده است؛ آپلود انجام نشد."
  exit 0
fi

SSH=(ssh -p "$PORT" -o StrictHostKeyChecking=accept-new "${SSH_KEY_OPT[@]}" "$USER_NAME@$HOST")
# پاک‌سازی و ساخت پوشهٔ مقصد (فایل‌های کهنهٔ build — هش‌های قدیمی — حذف می‌شوند)
"${SSH[@]}" "rm -rf \"$REMOTE_DOCROOT/$SUBPATH\" && mkdir -p \"$REMOTE_DOCROOT/$SUBPATH\""
# آپلود: بدون نیاز به rsync
tar -C "$ROOT/.deploy-build" -czf - . | "${SSH[@]}" "tar -xzf - -C \"$REMOTE_DOCROOT/$SUBPATH\""
rm -rf "$ROOT/.deploy-build"
echo "[deploy-to-host] ✓ آپلود کامل شد: https://YOUR-DOMAIN$BASE_PATH"
