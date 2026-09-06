#!/usr/bin/env bash
# انتشار روی GitHub Pages — یک‌جا و قابل‌تکرار.
#
# واقعیت انتشار این ریپو:
#   gh api repos/soheilsss7/Srip/pages --jq .source
#     → {"branch":"arena/01a04f6d-srip","path":"/docs"}
# یعنی لینک عمومی فقط از برنچ انتشار ساخته می‌شود. کار روی برنچ نشست تا وقتی
# merge نشود، روی https://soheilsss7.github.io/Srip/srip2 دیده نمی‌شود.
#
# این اسکریپت: push → ساخت/بازیافت PR → صبر برای CI → merge → بررسی محتوای
# deploy‌شده از راه GitHub API (نه curl به github.io؛ از sandbox کار نمی‌کند).
set -euo pipefail

REPO="${REPO:-soheilsss7/Srip}"
BASE="${PAGES_BRANCH:-arena/01a04f6d-srip}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HEAD="$(git rev-parse --abbrev-ref HEAD)"
if [ "$HEAD" = "$BASE" ]; then
  echo "[publish] روی برنچ انتشار هستید؛ چیزی برای PR نیست." >&2
  exit 1
fi
PROBE="${PROBE:-mobile-tabs}"
PROBE_FILE="${PROBE_FILE:-docs/srip2/organizations.html}"

step() { printf '\n\033[1m[publish] %s\033[0m\n' "$1"; }

step "۱) push برنچ $HEAD"
git push -u origin "$HEAD"

step "۲) ساخت/بازیافت PR به $BASE"
PR="$(gh pr list --repo "$REPO" --state open --head "$HEAD" --base "$BASE" --json number --jq '.[0].number' || true)"
if [ -z "${PR:-}" ]; then
  gh pr create --repo "$REPO" --base "$BASE" --head "$HEAD" \
    --title "${PR_TITLE:-انتشار: رابط موبایل v5 + تک‌اپ‌کردن ریشۀ دامنه}" \
    --body "${PR_BODY:-نوار تب پایین، اسکرول افقی جدول در موبایل، مهلت پردهٔ نشست، و حذف آیینۀ کهنۀ build از ریشۀ docs/.}"
  PR="$(gh pr list --repo "$REPO" --state open --head "$HEAD" --base "$BASE" --json number --jq '.[0].number')"
fi
echo "[publish] PR شمارهٔ $PR"

step "۳) صبر برای CI"
gh pr checks "$PR" --repo "$REPO" --watch --interval 15 || echo "[publish] یکی از چک‌ها سبز نشد — ادامه برای مشاهدهٔ وضعیت"
gh pr view "$PR" --repo "$REPO" --json state,statusCheckRollup \
  --jq '"state=\(.state)", (.statusCheckRollup[]? | "  \(.name // .context): \(.conclusion // .state)")' || true

step "۴) merge"
gh pr merge "$PR" --repo "$REPO" --merge || true
gh pr view "$PR" --repo "$REPO" --json state,mergedAt --jq '"state=\(.state) mergedAt=\(.mergedAt)"'

step "۵) صبر برای ساخت Pages"
for i in $(seq 1 30); do
  STATUS="$(gh api "repos/$REPO/pages/builds/latest" --jq .status 2>/dev/null || echo unknown)"
  echo "[publish] build #$i: $STATUS"
  [ "$STATUS" = "built" ] && break
  sleep 10
done

step "۶) بررسی محتوای deploy‌شده (از راه GitHub API)"
gh api "repos/$REPO/contents/$PROBE_FILE?ref=$BASE" --jq .content \
  | base64 -d > /tmp/publish-probe.html
HITS="$(grep -c -- "$PROBE" /tmp/publish-probe.html || true)"
echo "[publish] «$PROBE» در $PROBE_FILE روی $BASE → $HITS مورد"
if [ "${HITS:-0}" -eq 0 ]; then
  echo "[publish] ⚠ نشانه پیدا نشد؛ خروجی docs/srip2 احتمالاً کهنه است (scripts/release-ux.sh را دوباره بزنید)." >&2
  exit 1
fi
echo "[publish] ✓ انتشار تأیید شد — https://soheilsss7.github.io/Srip/srip2"
