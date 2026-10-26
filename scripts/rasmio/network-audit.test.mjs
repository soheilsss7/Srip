import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installNetworkAudit } from './network-audit.mjs';
test('counts requests, detects explicit wall, and observes IP after five', async () => {
 const out = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
 let probes = 0;
 const a = installNetworkAudit({host:'rasmio.com',out,fetchImpl:async url => {
  if (String(url).includes('ipify')) { probes++; return Response.json({ip:'192.0.2.1'}); }
  return new Response('<html>سقف مجاز 5 درخواست</html>',{headers:{'content-type':'text/html'}});
 }});
 try {
  for(let i=0;i<5;i++) { const r=await a.fetch('https://rasmio.com/company/1'); assert.equal(r.status,200); assert.match(await r.text(),/سقف/); }
  const lines=fs.readFileSync(a.file,'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(probes,2); assert.equal(lines.filter(x=>x.event==='request').length,5);
  assert.equal(lines.find(x=>x.event==='request').outcome,'explicit-access-limit');
  assert.equal(lines.at(-1).changed,false);
 } finally { fs.rmSync(out,{recursive:true,force:true}); }
});
test('IP lookup failure does not prevent crawl', async () => {
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'audit-'));
 const a=installNetworkAudit({host:'rasmio.com',out,fetchImpl:async url=>{
  if(String(url).includes('ipify')) throw new Error('unavailable');
  return new Response('ok');
 }});
 try { assert.equal(await (await a.fetch('https://rasmio.com/')).text(),'ok'); } finally { fs.rmSync(out,{recursive:true,force:true}); }
});
