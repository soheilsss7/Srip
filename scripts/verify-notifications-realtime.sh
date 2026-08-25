#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$ROOT/apps/api/src/notifications"
for f in notification-realtime.service.ts notifications.gateway.ts notifications.service.ts notifications.module.ts notifications.controller.ts; do
  test -s "$BASE/$f"
done
python3 - "$BASE" <<'PY'
import sys, pathlib, json
root=pathlib.Path(sys.argv[1])
files=list(root.glob('*.ts'))
for p in files:
    s=p.read_text()
    pairs={'(':')','[':']','{':'}'}
    st=[]; quote=None; esc=False
    for c in s:
        if quote:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==quote: quote=None
            continue
        if c in "'\"`": quote=c; continue
        if c in pairs: st.append(pairs[c])
        elif c in ')]}':
            if not st or st.pop()!=c: raise SystemExit(f'UNBALANCED:{p}')
    if st or quote: raise SystemExit(f'UNBALANCED:{p}')
pkg=json.loads((root.parent.parent/'package.json').read_text())['dependencies']
for dep in ['@nestjs/websockets','@nestjs/platform-socket.io','socket.io']:
    assert dep in pkg, dep
s=(root/'notifications.gateway.ts').read_text()
for token in ['WebSocketGateway','handleConnection','jwt.verifyAsync','client.join','notification-user:']:
    assert token in s, token
s=(root/'notification-realtime.service.ts').read_text()
for token in ['Subject','notification.created','notification.delivery','notification.read','notification.read-all']:
    assert token in s, token
print('NOTIFICATIONS_REALTIME_STATIC_CHECK=PASS')
PY
