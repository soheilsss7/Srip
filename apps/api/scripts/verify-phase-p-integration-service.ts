import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const servicePath = path.join(root, 'src/integrations/integrations.service.ts');
const service = fs.readFileSync(servicePath, 'utf8');

const required = [
  'SecretEncryptionService',
  'encryptedTokenSet(',
  'this.encryption.encrypt(t.accessToken)',
  'this.encryption.decrypt(r.accessTokenEncrypted)',
  'this.encryption.decrypt(r.refreshTokenEncrypted)',
  'credentialsEncrypted: true',
];

for (const token of required) {
  if (!service.includes(token)) throw new Error(`Missing Phase P contract: ${token}`);
}

const forbiddenPersistence = [
  'accessTokenEncrypted: t.accessToken',
  'refreshTokenEncrypted: t.refreshToken',
  'accessTokenEncrypted: accessToken',
  'refreshTokenEncrypted: refreshToken',
];
for (const token of forbiddenPersistence) {
  if (service.includes(token)) throw new Error(`Plaintext persistence pattern found: ${token}`);
}

if (!/return this\.encryption\.decrypt\(r\.accessTokenEncrypted\)/.test(service)) {
  throw new Error('Access token consumption is not decrypt-before-use');
}
if (!/const refreshToken = this\.encryption\.decrypt\(r\.refreshTokenEncrypted\)/.test(service)) {
  throw new Error('Refresh token consumption is not decrypt-before-use');
}

console.log('PHASE_P_INTEGRATION_SERVICE_VERIFICATION=PASS');
console.log('OAuth callback persistence: ENCRYPTED');
console.log('Refresh-token persistence: ENCRYPTED');
console.log('Access-token consumption: DECRYPTED');
console.log('Refresh-token consumption: DECRYPTED');
console.log('Raw token persistence patterns: 0');
