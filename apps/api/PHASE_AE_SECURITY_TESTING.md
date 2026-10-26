# PHASE AE — Security Testing

Canonical backend security matrix derived from the technical checklist.

## Required coverage
- OWASP ASVS
- OWASP Top 10
- Authentication
- Authorization
- IDOR
- SQL Injection
- XSS
- CSRF
- SSRF
- File Upload
- Rate Limit
- Session Attacks
- Data Leakage

## Mandatory authorization scenarios
### IDOR
User A requests User B's relationship:
`GET /relationships/{user-B-relationship}`
Expected: `403` or `404`.

### Cross-company leakage
Subsidiary A requests Organization B outside its authorized organization scope.
Expected: blocked by resource/organization authorization (`403` or `404`).

### Classification leakage
An INTERNAL-scope user requests a RESTRICTED relationship.
Expected: resource access is denied or restricted fields are removed by FieldSecurityService.

## Additional backend controls
- SQL injection payloads must remain data, never executable SQL.
- XSS payloads must not bypass output/security boundaries.
- Browser-origin CSRF protection applies to mutating requests.
- SSRF-sensitive outbound calls must not accept arbitrary user-controlled URLs.
- File upload requires extension/MIME/content/size validation and malware scanning when configured.
- Redis-backed distributed rate limits cover login, password reset, MFA, export, search, bulk import, webhooks and sensitive mutations.
- Sessions are checked for revocation, rotation and idle/absolute expiry.
- DTO/field security must prevent secrets and restricted relationship data from leaking.

## OWASP traceability
The test suite is a backend verification layer, not a substitute for a production external penetration test. Before production, external pentest, internal security review, API pentest, remediation and re-test remain required by the technical checklist.
