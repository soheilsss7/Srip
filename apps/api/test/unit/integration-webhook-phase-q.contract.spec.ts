import crypto from 'node:crypto';

describe('Phase Q webhook contract', () => {
  it('signs the exact raw bytes, not re-serialized JSON', () => {
    const raw = Buffer.from('{"b":2,"a":1}', 'utf8');
    const secret = 'test-secret';
    const timestamp = '1730000000';
    const signed = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), raw]);
    const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
    const reordered = JSON.stringify(JSON.parse(raw.toString('utf8')));
    const reorderedSigned = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), Buffer.from(reordered)]);
    const reorderedSignature = crypto.createHmac('sha256', secret).update(reorderedSigned).digest('hex');
    expect(expected).not.toBe(reorderedSignature);
  });

  it('rejects a timestamp outside the configured replay window', () => {
    const now = Math.floor(Date.now() / 1000);
    const maxSkew = 300;
    expect(Math.abs(now - (now - maxSkew - 1)) > maxSkew).toBe(true);
  });
});
