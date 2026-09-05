#!/usr/bin/env bash
# انتشار «نسخهٔ آزمایشی srip2» (کلون @srip/web-ux) در docs/srip2 بدون دست‌زدن به نسخهٔ اصلی
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/web-ux"
# ترتیب مهم: اول SW از روی موکِ جاری ساخته شود، بعد build (public -> out)
node scripts/make-demo-sw.mjs
SRIP_PAGES=1 NEXT_PUBLIC_API_URL='/Srip/srip2/api/v1' node scripts/next-build.mjs
rm -rf "$ROOT/docs/srip2"
mkdir -p "$ROOT/docs/srip2"
cp -a "$ROOT/apps/web-ux/out/." "$ROOT/docs/srip2/"
echo "[release-ux] docs/srip2 به‌روزرسانی شد — نسخهٔ اصلی docs دست‌نخورده ماند"
