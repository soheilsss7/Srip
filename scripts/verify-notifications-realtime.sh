#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$ROOT/apps/api/src/notifications"
for f in notification-realtime.service.ts notifications.gateway.ts notifications.service.ts notifications.module.ts notifications.controller.ts; do
  test -s "$BASE/$f"
done
node - "$BASE" <<'JS'
const fs=require('fs'),path=require('path'),ts=require('typescript');
const base=process.argv[2]; let bad=[];
for(const n of fs.readdirSync(base)){const p=path.join(base,n); if(!n.endsWith('.ts'))continue; const sf=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true); if(sf.parseDiagnostics.length) bad.push(p+':'+sf.parseDiagnostics.map(d=>d.messageText).join(','));}
if(bad.length){console.error('UNBALANCED',bad);process.exit(1)}
JS
python3 - "$BASE" <<'PY'
import sys, pathlib, json
root=pathlib.Path(sys.argv[1])
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
