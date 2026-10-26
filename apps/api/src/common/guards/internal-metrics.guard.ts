import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { isIP } from 'node:net';

type Network = { family: 4 | 6; address: bigint; prefix: number };

function parseAddress(value: string): { family: 4 | 6; address: bigint } | null {
  const normalized = value.trim();
  const family = isIP(normalized);
  if (family !== 4 && family !== 6) return null;
  if (family === 4) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
    return { family: 4, address: BigInt(parts.reduce((n, p) => (n * 256) + p, 0)) };
  }
  const [left, right = ''] = normalized.split('::');
  const leftParts = left ? left.split(':') : [];
  const rightParts = right ? right.split(':') : [];
  if (normalized.split('::').length > 2) return null;
  const groups = [...leftParts, ...rightParts];
  if (groups.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return null;
  const missing = 8 - groups.length;
  if (missing < 0 || (normalized.includes('::') ? missing < 1 : missing !== 0)) return null;
  const full = normalized.includes('::') ? [...leftParts, ...Array(missing).fill('0'), ...rightParts] : groups;
  if (full.length !== 8) return null;
  let address = 0n;
  for (const group of full) address = (address << 16n) | BigInt(parseInt(group, 16));
  return { family: 6, address };
}

function parseNetwork(value: string): Network | null {
  const [addressText, prefixText] = value.trim().split('/');
  const address = parseAddress(addressText);
  if (!address) return null;
  const prefix = prefixText === undefined ? address.family === 4 ? 32 : 128 : Number(prefixText);
  const max = address.family === 4 ? 32 : 128;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max) return null;
  return { family: address.family, address: address.address, prefix };
}

function inNetwork(address: bigint, network: Network): boolean {
  const bits = network.family === 4 ? 32 : 128;
  const shift = BigInt(bits - network.prefix);
  if (shift === 0n) return address === network.address;
  const mask = ((1n << BigInt(bits)) - 1n) ^ ((1n << shift) - 1n);
  return (address & mask) === (network.address & mask);
}

@Injectable()
export class InternalMetricsGuard implements CanActivate {
  private readonly networks: Network[];

  constructor() {
    const configured = (process.env.METRICS_ALLOWED_CIDRS ?? '127.0.0.1/32,::1/128')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map(parseNetwork)
      .filter((value): value is Network => value !== null);

    if (!configured.length) {
      throw new Error('METRICS_ALLOWED_CIDRS must contain at least one valid CIDR');
    }
    this.networks = configured;
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<any>();
    const rawIp = String(req.ip ?? req.socket?.remoteAddress ?? '').replace(/^::ffff:/, '');
    const parsed = parseAddress(rawIp);
    if (!parsed || !this.networks.some((network) => network.family === parsed.family && inNetwork(parsed.address, network))) {
      throw new ForbiddenException('Metrics endpoint is restricted to the internal monitoring network');
    }
    return true;
  }
}
