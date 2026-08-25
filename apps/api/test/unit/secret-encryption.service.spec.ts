import { BadRequestException } from '@nestjs/common';
import { SecretEncryptionService } from '../../src/common/security/secret-encryption.service';

describe('SecretEncryptionService', () => {
  const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  let service: SecretEncryptionService;
  beforeEach(() => {
    process.env.SECRET_ENCRYPTION_KEY = key;
    process.env.SECRET_ENCRYPTION_KEY_VERSION = 'v1';
    service = new SecretEncryptionService();
  });

  it('encrypts with AES-256-GCM metadata and decrypts', () => {
    const encrypted = service.encrypt('oauth-access-token');
    const envelope = JSON.parse(encrypted);
    expect(envelope.algorithm).toBe('AES-256-GCM');
    expect(envelope.keyVersion).toBe('v1');
    expect(envelope.iv).toBeTruthy();
    expect(envelope.authTag).toBeTruthy();
    expect(envelope.ciphertext).toBeTruthy();
    expect(service.decrypt(encrypted)).toBe('oauth-access-token');
    expect(encrypted).not.toContain('oauth-access-token');
  });

  it('uses a fresh IV for each encryption', () => {
    const a = JSON.parse(service.encrypt('same'));
    const b = JSON.parse(service.encrypt('same'));
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('rejects plaintext legacy values instead of treating them as encrypted', () => {
    expect(service.isEncrypted('raw-oauth-token')).toBe(false);
    expect(() => service.decrypt('raw-oauth-token')).toThrow(BadRequestException);
  });

  it('fails closed with a wrong key', () => {
    const encrypted = service.encrypt('secret');
    process.env.SECRET_ENCRYPTION_KEY = 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefab';
    expect(() => service.decrypt(encrypted)).toThrow(BadRequestException);
  });
});
