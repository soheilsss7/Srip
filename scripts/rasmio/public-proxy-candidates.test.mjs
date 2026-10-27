import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePublicProxy, interleaveCandidates, proxyCurlArgs, allowedProbeTarget } from './public-proxy-candidates.mjs';
test('rejects private, credentialed, non-IP, unsupported and injected endpoints',()=>{
 for(const u of ['http://127.0.0.1:8000','http://10.0.0.1:80','http://169.254.169.254:80','http://192.168.1.1:81','http://100.64.0.1:80','http://203.0.113.1:80','http://user:pass@8.8.8.8:81','http://localhost:80','file://8.8.8.8:80','http://8.8.8.8:0','http://8.8.8.8:81/path','http://8.8.8.8:81?url=other'])assert.equal(parsePublicProxy(u),null,u);
 assert.equal(parsePublicProxy('socks5://8.8.8.8:1080').host,'8.8.8.8');
 assert.equal(parsePublicProxy('http://8.8.8.8:80').url,'http://8.8.8.8:80');
});
test('bounded interleaving deduplicates servers, not just ports',()=>{
 const p=interleaveCandidates([['http://8.8.8.8:81','socks5://8.8.8.8:1080'],['http://1.1.1.1:8080','http://9.9.9.9:8080']],2);
 assert.deepEqual(p.map(x=>x.host),['8.8.8.8','1.1.1.1']);
});
test('explicit HTTPS proxy, no direct fallback or insecure TLS flags',()=>{
 const args=proxyCurlArgs('socks5://8.8.8.8:1080','https://api.ipify.org/?format=json');
 assert.ok(args.includes('socks5h://8.8.8.8:1080'));assert.equal(args[args.indexOf('--noproxy')+1],'');assert.equal(args.includes('--insecure'),false);assert.equal(args.includes('--location'),false);
 assert.throws(()=>proxyCurlArgs('http://8.8.8.8:81','https://github.com/private'));
});

test('redirects remain on the exact anonymous company profile',()=>{
 assert.equal(allowedProbeTarget('https://rasmio.com/company/10100000711/'),true);
 for(const u of ['https://evil.example/company/10100000711','https://rasmio.com/company/999','http://rasmio.com/company/10100000711','https://rasmio.com/login','https://user:pass@rasmio.com/company/10100000711','https://rasmio.com/company/10100000711/../../login'])assert.equal(allowedProbeTarget(u),false);
});
