# Phase 19 — Release Evidence Manifest

Every mandatory gate must point to immutable evidence before GO.

| Gate | Required evidence | Owner | Status |
|---|---|---|---|
| Release identity | version, commit SHA, tag | Release | PENDING |
| CI | build/test/security job URLs or artifacts | Engineering | PENDING |
| Staging | deployment ID + smoke/E2E report | Engineering | PENDING |
| Database | migration rehearsal + backup checksum + restore drill | DBA | PENDING |
| Security | scan/pentest report + remediation record | Security | PENDING |
| Infrastructure | DNS/TLS/WAF/secret-manager evidence | Platform | PENDING |
| Observability | dashboard + alert test evidence | SRE | PENDING |
| Integrations | OAuth/email/push/storage/search/AI evidence | Engineering | PENDING |
| Mobile | signed builds + TestFlight/Play evidence | Mobile | PENDING |
| UAT | signed acceptance record | Product | PENDING |
| Legal/privacy | approval record | Legal/Privacy | PENDING |
| Rollback | staging rollback drill evidence | Engineering/SRE | PENDING |
| Final decision | signed GO/NO-GO | Release owner | PENDING |

Do not replace evidence with a green static verification result.
