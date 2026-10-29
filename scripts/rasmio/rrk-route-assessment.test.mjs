import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rrkDiagnosticArgs} from './rrk-route-assessment.mjs';
test('diagnostic target is scoped and never disables TLS or follows redirects',()=>{
 const a=rrkDiagnosticArgs('https://rrk.ir/ords/f?p=200:199');
 assert.ok(a.includes('-4'));assert.ok(a.includes('--max-time'));assert.ok(!a.includes('-k'));assert.ok(!a.includes('--insecure'));assert.ok(!a.includes('--location'));assert.equal(a[a.indexOf('--noproxy')+1],'*');
 for(const u of ['https://evil.test/','https://user:pass@rrk.ir/','https://rrk.ir:444/'])assert.throws(()=>rrkDiagnosticArgs(u));
});
test('explicit public route rejects credentials, private addresses and command injection',()=>{
 assert.throws(()=>rrkDiagnosticArgs('https://rrk.ir/',{proxy:'http://user:pass@8.8.8.8:80'}));
 assert.throws(()=>rrkDiagnosticArgs('https://rrk.ir/',{proxy:'http://127.0.0.1:80'}));
 const a=rrkDiagnosticArgs('https://rrk.ir/',{proxy:'http://8.8.8.8:80'});assert.equal(a[a.indexOf('--noproxy')+1],'');
});
