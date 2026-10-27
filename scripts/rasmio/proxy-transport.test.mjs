import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {reserveExit,permittedDetailURL,transportCurlArgs,PublicProxyTransport} from './proxy-transport.mjs';
test('budget persists across leases and blocks fifth navigation, including a browser fallback',()=>{
 const state={};for(let i=1;i<=4;i++)assert.equal(reserveExit(state,'8.8.8.8',{now:100}),i);
 assert.throws(()=>reserveExit(state,'8.8.8.8',{now:101}),/budget/);
 const persisted=JSON.parse(JSON.stringify(state));assert.throws(()=>reserveExit(persisted,'8.8.8.8',{now:102}),/budget/);
 assert.equal(reserveExit(persisted,'8.8.8.8',{now:100+96*3600000}),1);
 assert.throws(()=>reserveExit(state,'__proto__'),/Invalid/);
});
test('destination and identity are restricted for both detail types',()=>{
 const c={type:'company',id:'10100009135'},p={type:'person',id:'ABC123'};
 assert.equal(permittedDetailURL('https://rasmio.com/company/10100009135/direct/',c),true);
 assert.equal(permittedDetailURL('https://rasmio.com/person/abc123/name/',p),true);
 for(const u of ['https://rasmio.com/login/','https://evil.test/company/10100009135/','http://rasmio.com/company/10100009135/','https://rasmio.com/company/10100000711/','https://user:pass@rasmio.com/company/10100009135/'])assert.equal(permittedDetailURL(u,c),false);
});
test('curl uses an explicit proxy with validated TLS and no inherited bypass',()=>{
 const a=transportCurlArgs('http://8.8.8.8:80','https://rasmio.com/company/10100009135/direct/');
 assert.equal(a[0],'-q');assert.equal(a[a.indexOf('--noproxy')+1],'');assert.ok(a.includes('--proxy'));assert.ok(!a.includes('-k'));assert.ok(!a.includes('--insecure'));assert.ok(!a.includes('--location'));
 assert.throws(()=>transportCurlArgs('http://user:pass@8.8.8.8:80','https://rasmio.com/'));
});
test('mocked pool routes HTTP, preserves counters, quarantines limited exits and has no direct fallback',async()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'pool-test-'));const frontier={};const calls=[];
 const execute=async(cmd,args,options)=>{
  calls.push({args,env:options.env});
  if(args.at(-1)==='https://api.ipify.org/?format=json')return {stdout:'{"ip":"1.1.1.1"}'};
  return {stdout:'<html>table</html>\n__EGRESS_META__200\t'};
 };
 const pool=new PublicProxyTransport({frontier,out,execute,maxChecks:1});
 pool.candidates=[{url:'http://8.8.8.8:80'}];
 try {
  const lease=await pool.acquire({type:'company',id:'10100009135'});
  const result=await lease.fetch('https://rasmio.com/company/10100009135/direct/');assert.equal(result.status,200);assert.match(await result.text(),/table/);
  lease.reserve('browser-navigation','https://rasmio.com/company/10100009135/direct/');
  lease.finish(false,'explicit-access-limit');
  assert.equal(frontier.proxyTransport.exits['1.1.1.1'].requests,2);
  await assert.rejects(pool.acquire({type:'person',id:'ABC123'}),/unavailable/);
  for(const c of calls){assert.equal(c.env.GITHUB_TOKEN,undefined);assert.equal(c.env.GH_TOKEN,undefined);assert.ok(c.args.includes('--proxy'));}
  assert.equal(pool.report.directFallback,false);
 } finally {pool.close();fs.rmSync(out,{recursive:true,force:true});}
});
