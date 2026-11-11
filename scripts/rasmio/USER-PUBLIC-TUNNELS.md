# User-supplied public tunnel rotation

The user explicitly authorized public storage and crawler use of the 57 URI lines
in `data/sources/user-public-tunnels/2026-11-04.txt`. Do not put private subscription
links or account credentials in that file. Original lines, including rejected and
duplicate inputs, are retained; runtime parsing repairs HTML entities and Markdown
wrappers without changing the original archive.

## Original batch admission

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

## Throughput scheduling update

Production now ranks recent profile-success configurations ahead of echo-only,
unknown, and expired-failure configurations. Known exhausted exits are not retested
more than hourly (then refreshed for dynamic exit changes); the persistent
four-request budget is unchanged. Up to 32 selected echo health checks run with
**at most three health-only workers** before profile extraction. This does not
increase the profile/browser worker ceiling or reserve a single profile request.
Echo 401/403/429 stops scheduling further echo checks. Reports include
`healthWarmup` timings, while successful data must still pass independent readback.
Empty public shells in one lane no longer force every independent lane to a
single worker; duplicated empty-wave sleeps were removed, retaining the normal
pacing interval and access-wall handling. No sustained speed multiplier is implied.

## Additional public batch (2026-11-11)

The manifest `data/sources/user-public-tunnels/catalog.json` now appends the second
user-authorized archive without replacing the first. Both runtime rotation and
the diagnostic use the same loader. Old candidate IDs and ordering are preserved.
The new archive has 49 inputs: 39 unique parser-supported candidates in the batch,
7 rejected inputs and 3 internal duplicates. One supported candidate also exists
in the original batch, giving **38 new candidates / 90 total**, with 106 original
inputs, 11 rejected and 5 duplicates overall. Rejections retain their source and
line number; unsupported security settings are not removed. Parser support is
not client validation or network success: the client validates candidates before
starting them and the normal scheduler admits only successful health checks.
Shared observed-exit-IP request limits remain unchanged. The catalog regression
suite and existing configuration/scheduler/transport tests pass (29 tests).
