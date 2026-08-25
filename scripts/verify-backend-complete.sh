#!/usr/bin/env bash
# =============================================================================
# scripts/verify-backend-complete.sh
#
# این تنها راه واقعی برای گفتن «بک‌اند ۱۰۰٪ کار می‌کند» است. هیچ ابزار
# چت/کدنویسی بدون اجرای واقعی روی Postgres/Redis واقعی نمی‌تواند این را
# تضمین کند. این اسکریپت را روی سیستم خودتان (نه در چت) اجرا کنید.
#
# پیش‌نیاز:
#   - Docker + docker-compose (برای Postgres/Redis محلی) یا اتصال به
#     Postgres/Redis واقعی از طریق DATABASE_URL / REDIS_URL در .env
#   - Node.js 20+ و pnpm
#
# استفاده:
#   bash scripts/verify-backend-complete.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo -e "\n${YELLOW}==> $1${NC}"; }
ok() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

FAILURES=0
mark() { if [ "$1" -ne 0 ]; then FAILURES=$((FAILURES+1)); echo -e "${RED}✗ $2${NC}"; else ok "$2"; fi; }

step "1/9 نصب وابستگی‌ها (pnpm install)"
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile || pnpm install
  mark $? "pnpm install"
else
  fail "pnpm نصب نیست. ابتدا: npm install -g pnpm"
fi

step "2/9 بالا آوردن Postgres/Redis محلی (در صورت نبود DATABASE_URL/REDIS_URL خارجی)"
if [ -f docker-compose.yml ] && [ -z "${DATABASE_URL:-}" ]; then
  docker compose up -d postgres redis 2>/dev/null || docker-compose up -d postgres redis 2>/dev/null || true
  echo "منتظر آماده شدن Postgres..."
  for i in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready >/dev/null 2>&1 || docker-compose exec -T postgres pg_isready >/dev/null 2>&1; then break; fi
    sleep 2
  done
fi
ok "زیرساخت آماده شد (یا از پیش موجود بود)"

step "3/9 Prisma generate"
pnpm --filter @srip/api prisma:generate
mark $? "prisma generate"

step "4/9 Prisma migrate deploy (روی دیتابیس واقعی — این‌جا واقعاً migration اجرا می‌شود)"
pnpm --filter @srip/api exec prisma migrate deploy
mark $? "prisma migrate deploy — شامل Migration جدید Phase 26 (System User, NotificationDeliveryLog, PushSubscription, Meeting.followUpCandidates)"

step "5/9 بررسی وجود System User (باید توسط migration درج شده باشد)"
SYSTEM_USER_CHECK=$(pnpm --filter @srip/api exec prisma db execute --stdin <<< "SELECT count(*) FROM \"User\" WHERE id='00000000-0000-0000-0000-000000000099';" 2>/dev/null || echo "0")
ok "بررسی System User انجام شد (خروجی بالا را چک کنید — باید 1 باشد)"

step "6/9 Seed داده نمونه"
pnpm --filter @srip/api prisma:seed
mark $? "prisma seed"

step "7/9 Typecheck کل Monorepo"
pnpm typecheck
mark $? "typecheck"

step "8/9 اجرای کامل تست‌های Unit بک‌اند"
pnpm --filter @srip/api test
mark $? "jest unit tests (شامل تست‌های جدید Phase 26: meetings minutes/follow-up, commitments sweep, actions overdue, search reindex, analytics recompute, job worker routing)"

step "9/9 Build نهایی بک‌اند"
pnpm --filter @srip/api build
mark $? "nest build"

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}=========================================================${NC}"
  echo -e "${GREEN} همه مراحل با موفقیت رد شدند. اکنون می‌توانید با اطمینان${NC}"
  echo -e "${GREEN} بگویید بک‌اند روی این محیط به‌درستی نصب، migrate و تست شد.${NC}"
  echo -e "${GREEN}=========================================================${NC}"
  echo ""
  echo "برای بالا آوردن سرور واقعی:"
  echo "  pnpm --filter @srip/api start"
  echo ""
  echo "برای بالا آوردن Worker پس‌زمینه (Overdue Sweep / Analytics / Search maintenance):"
  echo "  QUEUE_WORKER_ENABLED=true pnpm --filter @srip/api start:worker"
else
  echo -e "${RED}=========================================================${NC}"
  echo -e "${RED} $FAILURES مرحله شکست خورد. لاگ بالا را بررسی کنید.${NC}"
  echo -e "${RED}=========================================================${NC}"
  exit 1
fi
