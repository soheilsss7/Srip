#!/usr/bin/env bash
# انتشار زندهٔ srip2 بدون merge.
#
# GitHub Pages از برنچ «arena/01a04f6d-srip» و مسیر /docs ساخته می‌شود، یعنی
# محتوای docs/srip2 همان چیزی است که روی https://soheilsss7.github.io/Srip/srip2
# سرو می‌شود. این اسکریپت:
#   ۱) برنچ کاری جاری را push می‌کند (برای پیگیری تغییرات)
#   ۲) همان کامیت را به صورت fast-forward مستقیم روی برنچ انتشار push می‌کند
#      — بدون ساخت PR و بدون merge
#   ۳) صبر می‌کند تا GitHub Pages build تمام شود
#   ۴) از راه GitHub API بررسی می‌کند که محتوای deployشده واقعاً به‌روز است
set -euo pipefail

REPO="${REPO:-soheilsss7/Srip}"
BASE="${PAGES_BRANCH:-arena/01a04f6d-srip}"
PROBE="${PROBE:-organizations}"
PROBE_FILE="${PROBE_FILE:-docs/srip2/organizations.html}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HEAD="$(git rev-parse --abbrev-ref HEAD)"
if [ "$HEAD" = "$BASE" ]; then
  echo "[publish-live] روی خود برنچ انتشار هستید؛ چیزی برای push مستقیم نیست." >&2
  exit 1
fi

step() { printf '\n\033[1m[publish-live] %s\033[0m\n' "$1"; }

step "۱) push برنچ کاری «$HEAD»"
git push -u origin "$HEAD"

step "۲) push مستقیم (fast-forward، بدون merge) به برنچ انتشار «$BASE»"
git push origin "$HEAD:$BASE"

step "۳) صبر برای ساخت GitHub Pages"
LAST=""
for i in $(seq 1 30); do
  STATUS="$(gh api "repos/$REPO/pages/builds/latest" --jq .status 2>/dev/null || echo unknown)"
  COMMIT="$(gh api "repos/$REPO/pages/builds/latest" --jq .commit 2>/dev/null || echo unknown)"
  echo "[publish-live] build #$i: $STATUS ($COMMIT)"
  if [ "$STATUS" = "built" ]; then
    LAST="$COMMIT"
    break
  fi
  sleep 10
done
if [ -z "$LAST" ]; then
  echo "[publish-live] ⚠ Pages هنوز built نشده؛ کمی بعد دوباره بررسی کنید." >&2
  exit 1
fi
EXPECT="$(git rev-parse HEAD)"
if [ "$LAST" != "$EXPECT" ]; then
  echo "[publish-live] ⚠ آخرین build روی «$LAST» است، اما HEAD «$EXPECT» است." >&2
fi

step "۴) بررسی محتوای deployشده (از راه GitHub API)"
gh api "repos/$REPO/contents/$PROBE_FILE?ref=$BASE" --jq .content \
  | base64 -d > /tmp/publish-live-probe.html
HITS="$(grep -c -- "$PROBE" /tmp/publish-live-probe.html || true)"
echo "[publish-live] «$PROBE» در $PROBE_FILE روی $BASE → $HITS مورد"
if [ "${HITS:-0}" -eq 0 ]; then
  echo "[publish-live] ⚠ نشانه پیدا نشد؛ محتوا احتمالاً کهنه است." >&2
  exit 1
fi

echo "[publish-live] ✓ انتشار بدون merge انجام شد — https://soheilsss7.github.io/Srip/srip2"
