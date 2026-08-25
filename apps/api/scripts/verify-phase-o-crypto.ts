import { SecretEncryptionService } from '../src/common/security/secret-encryption.service';

process.env.SECRET_ENCRYPTION_KEY = process.env.SECRET_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.SECRET_ENCRYPTION_KEY_VERSION = process.env.SECRET_ENCRYPTION_KEY_VERSION || 'v1';
const service = new SecretEncryptionService();
const token = 'phase-o-test-token';
const encrypted = service.encrypt(token);
const envelope = JSON.parse(encrypted);
if (envelope.algorithm !== 'AES-256-GCM' || !envelope.keyVersion || !envelope.iv || !envelope.authTag || !envelope.ciphertext) throw new Error('Invalid encryption envelope');
if (service.decrypt(encrypted) !== token) throw new Error('AES-256-GCM round-trip failed');
if (encrypted.includes(token)) throw new Error('Plaintext token leaked into ciphertext envelope');
if (service.isEncrypted(token)) throw new Error('Plaintext incorrectly classified as encrypted');
const wrongKey = process.env.SECRET_ENCRYPTION_KEY;
process.env.SECRET_ENCRYPTION_KEY = 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefab';
try { service.decrypt(encrypted); throw new Error('Wrong key unexpectedly decrypted ciphertext'); } catch (error) { if (!(error instanceof Error) || !error.message.includes('decrypt')) throw error; }
process.env.SECRET_ENCRYPTION_KEY = wrongKey;
console.log('PHASE_O_SECRET_ENCRYPTION_VERIFICATION=PASS');
