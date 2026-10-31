import {test} from 'node:test';import assert from 'node:assert/strict';import {regionalArgs,selectRegionalProxies,tlsCompatibilityCandidates} from './rrk-regional-probe.mjs';
test('regional routes preserve TLS validation, bounded requests and strict targets',()=>{
 const a=regionalArgs('socks5://8.8.8.8:1080','https://rrk.ir/robots.txt');assert.ok(a.includes('socks5h://8.8.8.8:1080'));assert.equal(a.includes('--insecure'),false);assert.equal(a.includes('--proxy-insecure'),false);assert.equal(a.includes('--location'),false);assert.ok(a.includes('--max-time'));
 for(const p of ['http://127.0.0.1:80','http://user:secret@8.8.8.8:80','http://8.8.8.8:80/evil'])assert.throws(()=>regionalArgs(p,'https://rrk.ir/robots.txt'));
 assert.throws(()=>regionalArgs('http://8.8.8.8:80','https://evil.test/'));
});

test('fresh-only assessment never retests historical endpoints and fails closed on absent refresh',()=>{
 const old='http://8.8.8.8:80',fresh='socks5://9.9.9.9:1080';
 const source={proxies:[old,fresh],freshProxies:[fresh]};
 assert.deepEqual(selectRegionalProxies(source,{freshOnly:true}),[fresh]);
 assert.deepEqual(selectRegionalProxies(source,{freshOnly:true,knownFailed:new Set([fresh])}),[]);
 assert.deepEqual(selectRegionalProxies({proxies:[old]},{freshOnly:true}),[]);
});

test('one previously failed route can be reassessed only with newer, recent, immutable publisher evidence',()=>{
 const now=Date.parse('2026-10-31T16:30:00Z');
 const item={proxy:'http://8.8.8.8:80',source:'https://github.com/roosterkid/openproxylist/blob/'+'a'.repeat(40)+'/HTTPS.txt',sourceBlob:'b'.repeat(40),publisherUpdatedAt:'2026-10-31T16:00:17Z',previousFailureAt:'2026-10-31T06:54:53Z'};
 const s={proxies:[],recoveryProxies:[item]};
 assert.deepEqual(selectRegionalProxies(s,{recoveryOnly:true,now}),[item.proxy]);
 assert.deepEqual(selectRegionalProxies(s,{recoveryOnly:true,now:now+3600000}),[]);
 assert.deepEqual(selectRegionalProxies(s,{recoveryOnly:true,now,knownFailed:new Set([item.proxy])}),[]);
 assert.deepEqual(selectRegionalProxies({...s,recoveryProxies:[{...item,source:'https://evil.test/'}]},{recoveryOnly:true,now}),[]);
});

test('TLS compatibility is limited to an observed EOF, recent known route and still verifies certificates',()=>{
 const now=100000,proxy='socks5://8.8.8.8:1080';const prior={attempts:[{proxy,status:0,error:'SSL_ERROR_SYSCALL',at:new Date(now-1000).toISOString()}]};
 assert.deepEqual(tlsCompatibilityCandidates({proxies:[proxy]},prior,new Set(),now),[proxy]);
 assert.deepEqual(tlsCompatibilityCandidates({proxies:[proxy]},prior,new Set([proxy]),now),[]);
 assert.deepEqual(tlsCompatibilityCandidates({proxies:[]},prior,new Set(),now),[]);
 const a=regionalArgs(proxy,'https://www.rrk.ir/robots.txt',{tls12:true});assert.ok(a.includes('--http1.1'));assert.ok(a.includes('--tls-max'));assert.ok(!a.includes('--insecure'));assert.ok(!a.includes('--proxy-insecure'));
});
