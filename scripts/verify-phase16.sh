#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

test -f apps/mobile/package.json
test -f apps/mobile/src/app/login.tsx
test -f apps/mobile/src/app/'(tabs)'/_layout.tsx
test -f apps/mobile/src/app/'(tabs)'/relationships.tsx
test -f apps/mobile/src/app/'(tabs)'/meetings.tsx
test -f apps/mobile/src/app/'(tabs)'/actions.tsx
test -f apps/mobile/src/app/meeting/'[id].tsx'
test -f apps/mobile/src/app/relationship/'[id].tsx'
test -f apps/mobile/src/state/session.tsx
test -f apps/mobile/src/services/api-client.ts
grep -q 'expo-secure-store' apps/mobile/package.json
grep -q 'Authorization' apps/mobile/src/services/api-client.ts
grep -q 'SecureStore' apps/mobile/src/state/session.tsx
echo 'PHASE 16 STATIC VERIFICATION OK'
