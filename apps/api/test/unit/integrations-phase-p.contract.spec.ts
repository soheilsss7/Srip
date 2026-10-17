import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase P integration token persistence contract', () => {
  const source = readFileSync(join(process.cwd(), 'src/integrations/integrations.service.ts'), 'utf8');

  it('encrypts provider tokens before persistence', () => {
    expect(source).toContain('this.encryption.encrypt(t.accessToken)');
    expect(source).toContain('this.encryption.encrypt(t.refreshToken)');
    expect(source).toContain('encryptedTokenSet(');
  });

  it('decrypts tokens before provider consumption', () => {
    expect(source).toContain('this.encryption.decrypt(r.accessTokenEncrypted)');
    expect(source).toContain('this.encryption.decrypt(r.refreshTokenEncrypted)');
  });

  it('does not persist provider token fields directly', () => {
    expect(source).not.toContain('accessTokenEncrypted: t.accessToken');
    expect(source).not.toContain('refreshTokenEncrypted: t.refreshToken');
  });
});
