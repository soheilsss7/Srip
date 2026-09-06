#!/usr/bin/env bash
# انتشار «نسخهٔ آزمایشی srip2» (کلون @srip/web-ux) — خروجی استاتیک قابل سرو از هر هاست.
#
# خروجی پیش‌فرض: docs/srip2 (برای GitHub Pages با مسیر /Srip/srip2)
# برای دامنه/هاست دیگر:
#   SRIP_BASE_PATH=/srip SRIP_OUT_DIR=/tmp/out-srip bash scripts/release-ux.sh
#   (SRIP_BASE_PATH = مسیر URL که سایت از آن سرو می‌شود؛ باید با نام پوشهٔ مقصد یکی باشد)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRIP_BASE_PATH="${SRIP_BASE_PATH:-/Srip/srip2}"
SRIP_OUT_DIR="${SRIP_OUT_DIR:-$ROOT/docs/srip2}"
cd "$ROOT/apps/web-ux"
# ترتیب مهم: اول SW از روی موکِ جاری ساخته شود، بعد build (public -> out)
node scripts/sync-criteria-catalog.mjs --check || node scripts/sync-criteria-catalog.mjs
SRIP_PAGES=1 node scripts/gen-icons.mjs || true  # آیکون/manifest — اگر ImageMagick نبود فقط SVG ساخته می‌شود
node scripts/make-demo-sw.mjs
# نسخهٔ Mock API را از خود موک بیرون بکش و داخل bundle تزریق کن؛
# مرورگر با مقایسهٔ mockVersion با پاسخ /health، SW کهنه را خودکار به‌روز می‌کند.
MOCK_VER="$(grep -oP "DEMO_MOCK_VERSION\s*=\s*'[^']+'" scripts/mock-api.mjs | grep -oP "'[^']+'" | tr -d "'")"
SRIP_PAGES=1 SRIP_BASE_PATH="$SRIP_BASE_PATH" NEXT_PUBLIC_API_URL="${SRIP_BASE_PATH%/}/api/v1" NEXT_PUBLIC_MOCK_VERSION="$MOCK_VER" node scripts/next-build.mjs
rm -rf "$SRIP_OUT_DIR"
mkdir -p "$SRIP_OUT_DIR"
cp -a "$ROOT/apps/web-ux/out/." "$SRIP_OUT_DIR/"
echo "[release-ux] $SRIP_OUT_DIR به‌روزرسانی شد (basePath=$SRIP_BASE_PATH) — نسخهٔ اصلی docs دست‌نخورده ماند"
