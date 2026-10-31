import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {measurementRequest,summarizeMeasurement,runRrkVantageProbe} from './rrk-vantage-probe.mjs';
test('bounded diagnostic request, not a crawling relay',()=>{const r=measurementRequest('IR');assert.equal(r.limit,2);assert.equal(r.measurementOptions.request.path,'/ords/f');assert.throws(()=>measurementRequest('US'));});
test('does not count unverified TLS or persist HTTP response body/headers',()=>{const r=summarizeMeasurement({results:[{probe:{location:{country:'IR'}},result:{statusCode:200,rawBody:'PRIVATE BODY',rawOutput:'Set-Cookie: secret',tls:{authorized:false}}}]})[0];assert.equal(r.authorizedTLS,false);assert.equal(r.transportOutput,null);assert.equal(r.bodyCharacters,12);assert.ok(!JSON.stringify(r).includes('secret'));});
async function exercise(statusCode){
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'vantage-test-'));const calls=[];
 try {const result=await runRrkVantageProbe({out,wait:async()=>{},fetchImpl:async(url,opt)=>{calls.push([url,opt.method]);const data=url.includes('/nodes/hosts')?{nodes:{}}:opt.method==='POST'?{id:'example1'}:{status:'finished',results:[{probe:{location:{country:'IR'}},result:{statusCode,tls:{authorized:true},rawBody:'small'}}]};return new Response(JSON.stringify(data),{status:200});}});return {...result,calls};}finally{fs.rmSync(out,{recursive:true,force:true});}
}
test('origin denial stops further measurement submissions',async()=>{const r=await exercise(403);assert.equal(r.calls.filter(c=>c[1]==='POST').length,1);assert.equal(r.report.stoppedOnOriginDenial,true);assert.equal(r.report.usableCrawlerRoute,false);});
test('successful diagnostics still cannot claim notices or bulk crawler route',async()=>{const r=await exercise(200);assert.equal(r.calls.filter(c=>c[1]==='POST').length,2);assert.equal(r.report.httpsRespondingVantages.length,2);assert.equal(r.report.advertsExtracted,0);assert.equal(r.report.canonicalRecordsChanged,false);});
