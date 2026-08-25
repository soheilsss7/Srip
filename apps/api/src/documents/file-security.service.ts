import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Socket } from 'node:net';
import { PrismaService } from '../prisma/prisma.service';
import { S3Storage } from './s3.storage';
import { FileScanStatus } from '@prisma/client';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

const ALLOWED: Record<string, string[]> = {
  '.pdf': ['application/pdf'], '.png': ['image/png'], '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'], '.txt': ['text/plain'], '.csv': ['text/csv', 'application/csv', 'text/plain'],
  '.json': ['application/json'], '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};
const MAX_BYTES = Number(process.env.FILE_MAX_BYTES || 25 * 1024 * 1024);

@Injectable()
export class FileSecurityService {
  constructor(private readonly prisma: PrismaService, private readonly storage: S3Storage) {}

  validate(file: any) {
    if (!file?.buffer || !file?.originalname) throw new BadRequestException('File payload is required');
    if (file.size > MAX_BYTES) throw new BadRequestException(`File exceeds ${MAX_BYTES} byte limit`);
    const ext = '.' + String(file.originalname).split('.').pop()?.toLowerCase();
    const allowed = ALLOWED[ext];
    if (!allowed || !allowed.includes(String(file.mimetype).toLowerCase())) throw new BadRequestException('File extension and MIME type are not allowed');
    const detected = this.detectMime(file.buffer);
    if (detected && !(allowed.includes(detected) || (detected === 'application/zip' && (ext === '.docx' || ext === '.xlsx')))) throw new BadRequestException('File content does not match declared MIME type');
    return { ext, mimeType: String(file.mimetype).toLowerCase(), sha256: createHash('sha256').update(file.buffer).digest('hex'), detectedMimeType: detected };
  }

  private detectMime(buffer: Buffer) {
    if (buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff,0xd8,0xff]))) return 'image/jpeg';
    if (buffer.subarray(0, 6).toString() === 'GIF87a' || buffer.subarray(0, 6).toString() === 'GIF89a') return 'image/gif';
    if (buffer.subarray(0, 4).toString('binary') === 'PK\x03\x04') { const head=buffer.subarray(0, Math.min(buffer.length, 1024*1024)).toString('utf8'); if(head.includes('[Content_Types].xml')) return head.includes('wordprocessingml') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; return 'application/zip'; }
    return undefined;
  }

  async scan(documentId: string, bytes: Buffer, sha256: string) {
    const host = process.env.CLAMAV_HOST;
    const port = Number(process.env.CLAMAV_PORT || 3310);
    if (!host) {
      if (process.env.FILE_SCAN_REQUIRED === 'true') throw new ServiceUnavailableException('Malware scanner is required but CLAMAV_HOST is not configured');
      const row = await this.prisma.fileSecurityScan.create({ data: { documentId, status: FileScanStatus.NOT_REQUIRED, scanner: 'disabled', sha256, details: { required: false } } });
      return EntityResponseDto.fromUnknown(row);
    }
    const result = await this.clamdScan(host, port, bytes);
    const status = result.infected ? FileScanStatus.INFECTED : FileScanStatus.CLEAN;
    const row = await this.prisma.fileSecurityScan.create({ data: { documentId, status, scanner: `clamd://${host}:${port}`, sha256, signatureName: result.signature, details: { raw: result.raw } } });
    if (status === FileScanStatus.INFECTED) throw new BadRequestException(`Malware detected: ${result.signature || 'unknown'}`);
    return EntityResponseDto.fromUnknown(row);
  }

  private clamdScan(host: string, port: number, bytes: Buffer): Promise<{infected:boolean;signature?:string;raw:string}> {
    return new Promise((resolve, reject) => {
      const socket = new Socket(); let out = ''; let settled = false;
      const finish = (fn: any, value: any) => { if (settled) return; settled = true; socket.destroy(); fn(value); };
      socket.setTimeout(Number(process.env.CLAMAV_TIMEOUT_MS || 15000), () => finish(reject, new ServiceUnavailableException('ClamAV scan timed out')));
      socket.on('error', e => finish(reject, new ServiceUnavailableException(`ClamAV scan failed: ${e.message}`)));
      socket.on('data', chunk => { out += chunk.toString(); if (out.includes('\0')) { const line = out.replace(/\0/g,'').trim(); const infected = /FOUND$/.test(line); const signature = infected ? line.replace(/^stream:\s*/, '').replace(/:\s*FOUND$/,'') : undefined; finish(resolve, { infected, signature, raw: line }); } });
      socket.connect(port, host, () => { socket.write('zINSTREAM\0'); for (let i=0;i<bytes.length;i+=1024*1024) { const chunk=bytes.subarray(i,i+1024*1024); const len=Buffer.alloc(4); len.writeUInt32BE(chunk.length); socket.write(len); socket.write(chunk); } const end=Buffer.alloc(4); end.writeUInt32BE(0); socket.write(end); });
    });
  }
}
