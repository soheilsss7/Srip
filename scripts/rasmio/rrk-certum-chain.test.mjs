import {test} from 'node:test';import assert from 'node:assert/strict';
import {chainCompletionCandidates,checkIssuerCertificate,issuerURL} from './rrk-certum-chain.mjs';
import {regionalArgs} from './rrk-regional-probe.mjs';
test('complete only a recent observed missing-issuer route; never timeout/denied/unlisted',()=>{const now=100000,p='http://8.8.8.8:80',a={proxy:p,status:0,error:'unable to get local issuer certificate',at:new Date(now-1000).toISOString()},s={proxies:[p]};assert.deepEqual(chainCompletionCandidates(s,{attempts:[a]},new Set(),now),[p]);assert.deepEqual(chainCompletionCandidates(s,{attempts:[a]},new Set([p]),now),[]);assert.deepEqual(chainCompletionCandidates(s,{attempts:[{...a,error:'timed out'}]},new Set(),now),[]);assert.deepEqual(chainCompletionCandidates(s,{attempts:[a]},new Set(),now+86400000),[]);assert.deepEqual(chainCompletionCandidates({proxies:[]},{attempts:[a]},new Set(),now),[]);});
test('malformed certificates fail closed and curl still validates TLS',()=>{assert.throws(()=>checkIssuerCertificate('not a certificate'));assert.ok(issuerURL.startsWith('https://'));const a=regionalArgs('http://8.8.8.8:80','https://rrk.ir/robots.txt',{caBundle:'/tmp/verified-chain.pem'});assert.ok(a.includes('--cacert'));assert.ok(!a.includes('--insecure'));assert.ok(!a.includes('--proxy-insecure'));});
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync,execFile} from 'node:child_process';import {promisify} from 'node:util';import {prepareCertumChain} from './rrk-certum-chain.mjs';
test('a plausible-name self-signed intermediate cannot become a trusted root',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'certum-untrusted-test-'));try{
  const cert=path.join(dir,'forged.pem');execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(dir,'key.pem'),'-out',cert,'-days','1','-subj','/CN=Certum DV TLS G2 R39 CA','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'ignore'});
  assert.equal(checkIssuerCertificate(fs.readFileSync(cert)).ca,true);
  const run=promisify(execFile);const fakeDownload=async(cmd,args,opt)=>{if(cmd==='curl'){fs.copyFileSync(cert,args[args.indexOf('--output')+1]);return {stdout:''};}return run(cmd,args,opt);};
  await assert.rejects(prepareCertumChain(dir,fakeDownload,{PATH:process.env.PATH}));assert.equal(fs.existsSync(path.join(dir,'certum-complete-chain.pem')),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
