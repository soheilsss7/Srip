#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail(){ echo "NETWORK_STATIC_CHECK=FAIL: $1" >&2; exit 1; }
[[ -f apps/api/src/network/network.controller.ts ]] || fail "network controller missing"
[[ -f apps/api/src/network/network.service.ts ]] || fail "network service missing"
[[ -f apps/api/prisma/migrations/20260204120000_person_relationship_network/migration.sql ]] || fail "person relationship migration missing"
grep -q "model PersonRelationship" apps/api/prisma/schema.prisma || fail "PersonRelationship model missing"
grep -q "person-relationships" apps/api/src/network/network.controller.ts || fail "person relationship endpoints missing"
for x in "shortest" "best" "centrality" "bridgePeople" "bottlenecks" "singlePointsOfFailure" "connectors"; do grep -q "$x" apps/api/src/network/network.service.ts || fail "network capability missing: $x"; done
grep -q "person_relationship" apps/api/src/network/network.service.ts || fail "person relationship graph edge missing"
grep -q "network.read" apps/api/src/network/network.controller.ts || fail "network read permission missing"
grep -q "relationship.write" apps/api/src/network/network.controller.ts || fail "person relationship write permission missing"
python3 - <<'PY'
from pathlib import Path
p=Path('apps/api/src/network/network.service.ts')
s=p.read_text()
if s.count('{') != s.count('}'):
    raise SystemExit('brace mismatch in network service')
p=Path('apps/api/src/network/network.controller.ts')
s=p.read_text()
if s.count('{') != s.count('}'):
    raise SystemExit('brace mismatch in network controller')
PY
echo "NETWORK_STATIC_CHECK=PASS"
