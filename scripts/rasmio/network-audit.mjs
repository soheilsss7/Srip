import fs from 'node:fs';
import { isIP } from 'node:net';

// Observation only: never changes routing, retries, cookies or site quotas.
export function installNetworkAudit({ host, out, fetchImpl = globalThis.fetch, runId = process.env.GITHUB_RUN_ID || 'local' }) {
  const raw = fetchImpl.bind(globalThis);
  fs.mkdirSync(out, { recursive: true });
  const file = `${out}/network-audit-${String(runId).replace(/[^\w-]/g, '_')}.jsonl`;
  let sequence = 0, ip = null;
  const write = data => {
    try { fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), runId, ...data }) + '\n'); } catch {}
  };
  async function observeIP(reason) {
    try {
      const r = await raw('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const value = (await r.json()).ip;
      if (!isIP(value)) throw new Error('Invalid IP response');
      write({ event: 'egress-observation', reason, ip: value, previousIP: ip, changed: ip === null ? null : value !== ip,
        scope: 'IP observed by ipify; destination-specific routing is not verified' });
      ip = value;
    } catch (e) { write({ event: 'egress-error', reason, error: e.message }); ip = null; }
  }
  const ready = observeIP('start');
  async function auditedFetch(input, options) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.hostname !== host) return raw(input, options);
    await ready;
    const requestNumber = ++sequence;
    const started = Date.now();
    try {
      const response = await raw(input, options);
      const contentType = response.headers.get('content-type') || '';
      let tables = null, outcome = response.ok ? 'http-success-unverified' : 'http-error';
      if (/text\/html/i.test(contentType)) {
        const html = await response.clone().text();
        tables = (html.match(/<table\b/gi) || []).length;
        // A login button alone is not evidence of a quota wall.
        outcome = /سقف\s*مجاز|امکان مشاهده اطلاعات در صفحه شرکت برای شما محدود شده/.test(html)
          ? 'explicit-access-limit' : tables > 0 ? 'html-with-tables' : 'html-without-tables';
      } else if (response.status === 429) outcome = 'rate-limited';
      write({ event: 'request', requestNumber, path: url.pathname, observedIP: ip,
        status: response.status, elapsedMs: Date.now() - started, tables, outcome });
      if (requestNumber % 5 === 0) await observeIP(`after-request-${requestNumber}`);
      return response;
    } catch (e) {
      write({ event: 'request-error', requestNumber, path: url.pathname, observedIP: ip, elapsedMs: Date.now() - started, error: e.message });
      throw e;
    }
  }
  return { fetch: auditedFetch, ready, file };
}
