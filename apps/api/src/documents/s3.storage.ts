import { createHmac, createHash } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { ObjectStoragePort } from './storage.port';
import { MetricsService } from '../observability/metrics.service';
import { TraceService } from '../observability/trace.service';
export class S3Storage implements ObjectStoragePort {
  constructor(private readonly metrics:MetricsService, private readonly trace:TraceService) {}
  private cfg(){const endpoint=process.env.S3_ENDPOINT,bucket=process.env.S3_BUCKET,region=process.env.S3_REGION||'us-east-1',accessKey=process.env.S3_ACCESS_KEY,secretKey=process.env.S3_SECRET_KEY;if(!endpoint||!bucket||!accessKey||!secretKey)throw new ServiceUnavailableException('S3 storage is not configured');return {endpoint:endpoint.replace(/\/$/,''),bucket,region,accessKey,secretKey};}
  private sign(key:Buffer|string,msg:string){return createHmac('sha256',key).update(msg).digest();}
  private signingKey(secret:string,date:string,region:string){const kDate=this.sign(`AWS4${secret}`,date);const kRegion=this.sign(kDate,region);const kService=this.sign(kRegion,'s3');return this.sign(kService,'aws4_request');}
  private requestUrl(cfg:any,key:string){return `${cfg.endpoint}/${encodeURIComponent(cfg.bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;}
  async put(key:string,body:Uint8Array,contentType:string){ const started=Date.now();const cfg=this.cfg();const url=this.requestUrl(cfg,key);const u=new URL(url);const now=new Date();const amz=now.toISOString().replace(/[-:]|\.\d{3}/g,'');const date=amz.slice(0,8);const payloadHash=createHash('sha256').update(body).digest('hex');const encryption=process.env.S3_SERVER_SIDE_ENCRYPTION||'AES256';const canonicalHeaders=`content-type:${contentType}\nhost:${u.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\nx-amz-server-side-encryption:${encryption}\n`;const signed='content-type;host;x-amz-content-sha256;x-amz-date;x-amz-server-side-encryption';const canonical=`PUT\n${u.pathname}\n\n${canonicalHeaders}\n${signed}\n${payloadHash}`;const scope=`${date}/${cfg.region}/s3/aws4_request`;const stringToSign=`AWS4-HMAC-SHA256\n${amz}\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`;const sig=createHmac('sha256',this.signingKey(cfg.secretKey,date,cfg.region)).update(stringToSign).digest('hex');const auth=`AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${sig}`;const r=await fetch(url,{method:'PUT',headers:{Authorization:auth,'Content-Type':contentType,'Host':u.host,'X-Amz-Content-Sha256':payloadHash,'X-Amz-Date':amz,'X-Amz-Server-Side-Encryption':encryption,...this.trace.headers() as any},body:Buffer.from(body)});this.metrics.observeStorage('put',Date.now()-started,body.byteLength,!r.ok);if(!r.ok)throw new ServiceUnavailableException(`S3 upload failed: ${r.status}`);const span=this.trace.childSpan('storage.put',{storageSystem:'s3',storageOperation:'put',objectKey:key,bytes:body.byteLength},'client');span.end('OK');}
  async delete(key:string){ const started=Date.now();const cfg=this.cfg();const url=this.requestUrl(cfg,key);const u=new URL(url);const now=new Date();const amz=now.toISOString().replace(/[-:]|\.\d{3}/g,'');const date=amz.slice(0,8);const hash=createHash('sha256').update('').digest('hex');const headers=`host:${u.host}\nx-amz-content-sha256:${hash}\nx-amz-date:${amz}\n`;const signed='host;x-amz-content-sha256;x-amz-date';const canonical=`DELETE\n${u.pathname}\n\n${headers}\n${signed}\n${hash}`;const scope=`${date}/${cfg.region}/s3/aws4_request`;const sts=`AWS4-HMAC-SHA256\n${amz}\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`;const sig=createHmac('sha256',this.signingKey(cfg.secretKey,date,cfg.region)).update(sts).digest('hex');const auth=`AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${sig}`;const r=await fetch(url,{method:'DELETE',headers:{Authorization:auth,Host:u.host,'X-Amz-Content-Sha256':hash,'X-Amz-Date':amz,...this.trace.headers() as any}});this.metrics.observeStorage('delete',Date.now()-started,0,!r.ok&&r.status!==404);if(!r.ok&&r.status!==404)throw new ServiceUnavailableException(`S3 delete failed: ${r.status}`);const span=this.trace.childSpan('storage.delete',{storageSystem:'s3',storageOperation:'delete',objectKey:key},'client');span.end('OK');}
  async healthCheck(): Promise<{ status: 'ok' | 'error'; error?: string }> {
    const started = Date.now();
    let controller: AbortController | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const cfg = this.cfg();
      // Probe the bucket itself. HEAD on a synthetic object can return 404 even
      // when the bucket is healthy, so it is not a valid readiness signal.
      const url = `${cfg.endpoint}/${encodeURIComponent(cfg.bucket)}`;
      const u = new URL(url);
      const now = new Date();
      const amz = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
      const date = amz.slice(0, 8);
      const hash = createHash('sha256').update('').digest('hex');
      const canonicalHeaders = `host:${u.host}\nx-amz-content-sha256:${hash}\nx-amz-date:${amz}\n`;
      const signed = 'host;x-amz-content-sha256;x-amz-date';
      const canonical = `HEAD\n${u.pathname}\n\n${canonicalHeaders}\n${signed}\n${hash}`;
      const scope = `${date}/${cfg.region}/s3/aws4_request`;
      const stringToSign = `AWS4-HMAC-SHA256\n${amz}\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`;
      const signature = createHmac('sha256', this.signingKey(cfg.secretKey, date, cfg.region)).update(stringToSign).digest('hex');
      const auth = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
      controller = new AbortController();
      timeout = setTimeout(() => controller!.abort(), 1500);
      const response = await fetch(url, { method: 'HEAD', headers: { Authorization: auth, Host: u.host, 'X-Amz-Content-Sha256': hash, 'X-Amz-Date': amz, ...this.trace.headers() as any }, signal: controller.signal });
      const reachable = response.ok;
      this.metrics.observeStorage('health', Date.now() - started, 0, !reachable);
      return reachable ? { status: 'ok' } : { status: 'error', error: 'storage unavailable' };
    } catch {
      this.metrics.observeStorage('health', Date.now() - started, 0, true);
      return { status: 'error', error: 'storage unavailable' };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async createSignedReadUrl(key:string,expiresInSeconds:number){const cfg=this.cfg();const url=this.requestUrl(cfg,key);const u=new URL(url);const expires=Math.max(1,Math.min(900,Math.floor(expiresInSeconds)));const now=new Date();const amz=now.toISOString().replace(/[-:]|\.\d{3}/g,'');const date=amz.slice(0,8);const scope=`${date}/${cfg.region}/s3/aws4_request`;const credential=`${cfg.accessKey}/${scope}`;u.searchParams.set('X-Amz-Algorithm','AWS4-HMAC-SHA256');u.searchParams.set('X-Amz-Credential',credential);u.searchParams.set('X-Amz-Date',amz);u.searchParams.set('X-Amz-Expires',String(expires));u.searchParams.set('X-Amz-SignedHeaders','host');u.searchParams.set('response-content-disposition','attachment');u.searchParams.set('response-content-type','application/octet-stream');const canonicalQuery=[...u.searchParams.entries()].sort().map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');const canonical=`GET\n${u.pathname}\n${canonicalQuery}\nhost:${u.host}\n\nhost\nUNSIGNED-PAYLOAD`;const sts=`AWS4-HMAC-SHA256\n${amz}\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`;u.searchParams.set('X-Amz-Signature',createHmac('sha256',this.signingKey(cfg.secretKey,date,cfg.region)).update(sts).digest('hex'));return u.toString();}
}
