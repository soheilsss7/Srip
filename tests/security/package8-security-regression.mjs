/** PACKAGE 8 security regression smoke. Static by default; optional runtime checks are fail-fast. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mustContain = (file, tokens) => {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const token of tokens) if (!text.includes(token)) throw new Error(`${file}: missing ${token}`);
};

mustContain('apps/api/PHASE_AE_SECURITY_TESTING.md', ['OWASP ASVS','OWASP Top 10','IDOR','SQL Injection','XSS','CSRF','SSRF','File Upload','Rate Limit','Session Attacks','Data Leakage']);
mustContain('apps/api/src/ai/ai-pipeline.service.ts', ['BLOCKED_PROMPT_INJECTION','BLOCKED_SYSTEM_PROMPT_REFERENCE']);
mustContain('apps/api/src/common/api-contract/error-contract.ts', ['SENSITIVE_DETAIL_KEYS','requestId']);
mustContain('apps/api/src/common/authorization/field-security.service.ts', ['sanitize']);
mustContain('apps/api/src/common/rate-limit/rate-limit.service.ts', ['rate:global','rate:ip:','rate:user:','rate:sensitive:']);
mustContain('apps/api/src/common/guards/auth.guard.ts', ['revokedAt','rotatedAt','absoluteExpiresAt','idleExpiresAt']);
mustContain('apps/api/src/production-hardening.ts', ['OriginVerificationMiddleware','X-Content-Type-Options','X-Frame-Options']);
mustContain('apps/api/src/documents/file-security.service.ts', ['MAX_BYTES','ClamAV','INFECTED']);

console.log('PACKAGE8_SECURITY_STATIC=PASS');

if (process.env.PACKAGE8_SECURITY_RUNTIME === '1') {
  const base = (process.env.API_URL || 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
  const checks = [
    ['protected endpoint rejects anonymous', async () => {
      const r = await fetch(`${base}/people`); if (![401,403].includes(r.status)) throw new Error(`HTTP ${r.status}`);
    }],
    ['health exposes security headers', async () => {
      const r = await fetch(`${base}/health/live`); if (!r.ok) throw new Error(`HTTP ${r.status}`);
      for (const h of ['x-content-type-options','x-frame-options','referrer-policy']) if (!r.headers.get(h)) throw new Error(`missing ${h}`);
    }],
  ];
  for (const [name, fn] of checks) { await fn(); console.log(`PASS ${name}`); }
  console.log('PACKAGE8_SECURITY_RUNTIME=PASS');
}
