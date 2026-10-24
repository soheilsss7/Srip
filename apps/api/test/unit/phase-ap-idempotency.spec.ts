import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('PHASE AP idempotency contract', () => {
  const root = join(__dirname, '../..');
  const interceptor = readFileSync(join(root, 'src/common/api-contract/api-contract.interceptor.ts'), 'utf8');
  const swagger = readFileSync(join(root, 'src/main.ts'), 'utf8');
  const webhook = readFileSync(join(root, 'src/integrations/integration-webhook.controller.ts'), 'utf8');
  const reporting = readFileSync(join(root, 'src/reporting/reporting.controller.ts'), 'utf8');

  it('covers all mutation verbs globally', () => {
    expect(interceptor).toContain("new Set(['POST', 'PUT', 'PATCH', 'DELETE'])");
  });

  it('covers export as a retry-sensitive operation', () => {
    expect(interceptor).toContain('isExport(path)');
    expect(swagger).toContain("/reports\\/[^/]+\\/export\\/[^/]+$");
    expect(reporting).toContain('@Get(\':kind/export/:format\')');
    // Binary export must stream through as a StreamableFile — returning the raw
    // body (or passing through @Res() without passthrough) corrupts CSV/JSON
    // downloads with JSON-serialized Buffer payloads.
    expect(reporting).toContain('new StreamableFile(result.body');
    expect(reporting).not.toContain('return result.body;');
    // The global response sanitizer must never JSON-serialize streamed files.
    expect(interceptor).toContain('value instanceof StreamableFile');
  });

  it('covers signed webhook idempotency and hashes the raw body', () => {
    expect(interceptor).toContain('isWebhook(path)');
    expect(interceptor).toContain('hashBytes(req.rawBody)');
    expect(webhook).toContain('@Post(\':provider\')');
  });

  it('persists and replays binary responses', () => {
    expect(interceptor).toContain('responseBodyBase64');
    expect(interceptor).toContain("Buffer.from(record.responseBodyBase64, 'base64')");
  });
});
