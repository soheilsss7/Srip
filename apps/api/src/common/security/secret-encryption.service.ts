import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type EncryptedSecretEnvelope = {
  version: 1;
  algorithm: 'AES-256-GCM';
  keyVersion: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

const IV_BYTES = 12;
const KEY_BYTES = 32;
const AUTH_TAG_BYTES = 16;

@Injectable()
export class SecretEncryptionService {
  encrypt(value: string): string {
    if (!value) throw new BadRequestException('Cannot encrypt an empty secret');
    const keyVersion = this.currentKeyVersion();
    const key = this.loadKey(keyVersion);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const envelope: EncryptedSecretEnvelope = {
      version: 1,
      algorithm: 'AES-256-GCM',
      keyVersion,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
    return JSON.stringify(envelope);
  }

  decrypt(value: string): string {
    const envelope = this.parseEnvelope(value);
    const key = this.loadKey(envelope.keyVersion);
    const iv = Buffer.from(envelope.iv, 'base64');
    const authTag = Buffer.from(envelope.authTag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES || ciphertext.length === 0) {
      throw new BadRequestException('Invalid encrypted secret metadata');
    }

    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new BadRequestException('Unable to decrypt secret with configured key version');
    }
  }

  isEncrypted(value: string | null | undefined): boolean {
    if (!value) return false;
    try {
      this.parseEnvelope(value);
      return true;
    } catch {
      return false;
    }
  }

  private parseEnvelope(value: string): EncryptedSecretEnvelope {
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { throw new BadRequestException('Stored integration token is not encrypted'); }
    if (!parsed || typeof parsed !== 'object') throw new BadRequestException('Invalid encrypted secret envelope');
    const e = parsed as Partial<EncryptedSecretEnvelope>;
    if (e.version !== 1 || e.algorithm !== 'AES-256-GCM' || typeof e.keyVersion !== 'string' || !e.keyVersion ||
        typeof e.iv !== 'string' || typeof e.authTag !== 'string' || typeof e.ciphertext !== 'string') {
      throw new BadRequestException('Invalid encrypted secret envelope');
    }
    return e as EncryptedSecretEnvelope;
  }

  private currentKeyVersion(): string {
    const version = process.env.SECRET_ENCRYPTION_KEY_VERSION || 'v1';
    if (!/^[A-Za-z0-9._-]{1,32}$/.test(version)) throw new ServiceUnavailableException('Invalid SECRET_ENCRYPTION_KEY_VERSION');
    return version;
  }

  private loadKey(version: string): Buffer {
    const current = this.currentKeyVersion();
    const envName = version === current
      ? 'SECRET_ENCRYPTION_KEY'
      : `SECRET_ENCRYPTION_KEY_${version.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    const raw = process.env[envName];
    if (!raw) throw new ServiceUnavailableException(`Encryption key ${version} is not configured`);

    let key: Buffer;
    if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, 'hex');
    else {
      try { key = Buffer.from(raw, 'base64'); } catch { key = Buffer.alloc(0); }
    }
    if (key.length !== KEY_BYTES) throw new ServiceUnavailableException(`${envName} must encode exactly 32 bytes`);
    return key;
  }
}
