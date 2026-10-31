import {test} from 'node:test';import assert from 'node:assert/strict';import {regionalArgs} from './rrk-regional-probe.mjs';
test('regional routes preserve TLS validation, bounded requests and strict targets',()=>{
 const a=regionalArgs('socks5://8.8.8.8:1080','https://rrk.ir/robots.txt');assert.ok(a.includes('socks5h://8.8.8.8:1080'));assert.equal(a.includes('--insecure'),false);assert.equal(a.includes('--proxy-insecure'),false);assert.equal(a.includes('--location'),false);assert.ok(a.includes('--max-time'));
 for(const p of ['http://127.0.0.1:80','http://user:secret@8.8.8.8:80','http://8.8.8.8:80/evil'])assert.throws(()=>regionalArgs(p,'https://rrk.ir/robots.txt'));
 assert.throws(()=>regionalArgs('http://8.8.8.8:80','https://evil.test/'));
});
