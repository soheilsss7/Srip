# User-supplied public tunnel rotation

The user explicitly authorized public storage and crawler use of the 57 URI lines
in `data/sources/user-public-tunnels/2026-11-04.txt`. Do not put private subscription
links or account credentials in that file. Original lines, including rejected and
duplicate inputs, are retained; runtime parsing repairs HTML entities and Markdown
wrappers without changing the original archive.

## Current admission

- 57 original inputs; 52 unique supported configurations.
- One duplicate and four rejected inputs (one unsupported cipher; three ECH or
  certificate-pin extensions whose semantics must not be silently discarded).
- VLESS, VMess AEAD, Trojan, and AEAD Shadowsocks; TCP/raw, WebSocket, gRPC, XHTTP
  where supported by the pinned official Xray client.
- Parsing is NOT proof of connectivity, a distinct exit, destination access, or
  permission to exceed the source site's access policy.

## Production

`createRotatingProxyTransport` adds up to eight eligible user configurations ahead
of the ordinary public proxy candidates per run (32 total health checks unchanged).
The cursor advances on actual attempts and is stored in the crawler frontier.
Each managed local SOCKS endpoint must pass a fixed HTTPS echo check before use.
Configurations resolving to the same exit share the existing persistent four-page
budget and exhaustion/cooldown state; aliases do not reset the budget.

The client binds only to loopback, is not a relay service, does not inherit account
cookies or GitHub credentials, and is killed/cleaned up on completion. TLS checks
remain enabled. Failed/insecure/unsupported configurations never silently fall
back to direct company/person requests. Ordinary public proxies remain available
as fallback candidates. `USER_PUBLIC_TUNNELS=0` disables user tunnel admission.

`out/proxy-transport-RUN_ID.json` contains admission, rotation selection, echo and
profile outcomes. `tunnelId`/`egress.userTunnelId` traces real profile acquisition
back to the user configuration fingerprint. Do not call an echo check a successful
profile download or an RRK-origin success.

## Separate whole-list health assessment

Repository dispatch: event `rasmio-run`, payload `mode: user-tunnel-probe`.
The registered isolated diagnostic does not acquire production writer slots,
does not issue company/profile/RRK requests, and tests the accepted configurations
with at most three concurrent clients. Its report is
`out/user-tunnel-probe-RUN_ID.json`. It records parsing rejections, attempted
connections, distinct echo-observed exits and explicit origin-data count zero.

Xray v26.10.31 archive SHA-256 is pinned and verified before extracting/running.
Temporary generated client configurations are owner-only files outside the repo.
