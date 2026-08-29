'use client';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const DEMO_CREDENTIALS = { email: 'demo@srip.local', password: 'ChangeMe!123456', secret: 'VEDETXJXC6U63QHDRC2Y3LPGS4' } as const;

function base32ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const clean = s.replace(/=+$/, '').toUpperCase();
  const out: number[] = [];
  let bits = 0, value = 0;
  for (const c of clean) {
    const n = B32.indexOf(c);
    if (n < 0) throw new Error('Invalid TOTP secret');
    value = (value << 5) | n;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const buf = new ArrayBuffer(out.length);
  new Uint8Array(buf).set(out);
  return new Uint8Array(buf);
}

/* Pure-JS SHA-1 (RFC 3174) — used when WebCrypto's crypto.subtle is not available
   (crypto.subtle is only exposed in secure contexts; the demo login must work over
   plain http for local demo access). */
function sha1(msg: Uint8Array): number[] {
  const ml = msg.length * 8;
  const bytes = new Uint8Array((((msg.length + 8) >> 6) + 1) * 64);
  bytes.set(msg);
  bytes[msg.length] = 0x80;
  new DataView(bytes.buffer).setUint32(bytes.byteLength - 4, ml >>> 0, false);
  let H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
  const w = new Uint32Array(80);
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < bytes.byteLength; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
    for (let j = 16; j < 80; j++) { const v = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]; w[j] = (v << 1) | (v >>> 31); }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4];
    for (let j = 0; j < 80; j++) {
      let f, k;
      if (j < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) >>> 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = temp;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0;
  }
  return H;
}

function hmacSha1(key: Uint8Array, data: Uint8Array): Uint8Array {
  const words = (h: number[]): Uint8Array => {
    const out = new Uint8Array(h.length * 4);
    const dv = new DataView(out.buffer);
    h.forEach((v, i) => dv.setUint32(i * 4, v, false));
    return out;
  };
  let k = key;
  if (k.length > 64) k = words(sha1(k));
  if (k.length < 64) { const k2 = new Uint8Array(64); k2.set(k); k = k2; }
  const ipad = new Uint8Array(64), opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) { ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5c; }
  const inner = new Uint8Array(64 + data.length);
  inner.set(ipad);
  inner.set(data, 64);
  const outer = new Uint8Array(64 + 20);
  outer.set(opad);
  outer.set(words(sha1(inner)), 64);
  return words(sha1(outer));
}

export async function demoOtp(secret = DEMO_CREDENTIALS.secret): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const keyBytes = base32ToBytes(secret);
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter));
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  let sig: Uint8Array;
  if (subtle) {
    const key = await subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    sig = new Uint8Array(await subtle.sign('HMAC', key, msg));
  } else {
    sig = hmacSha1(keyBytes, msg);
  }
  const o = sig[sig.length - 1] & 15;
  const code = ((sig[o] & 127) << 24) | ((sig[o + 1] & 255) << 16) | ((sig[o + 2] & 255) << 8) | (sig[o + 3] & 255);
  return String(code % 1_000_000).padStart(6, '0');
}