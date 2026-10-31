import {test} from 'node:test';import assert from 'node:assert/strict';import {regionalArgs,selectRegionalProxies} from './rrk-regional-probe.mjs';
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
