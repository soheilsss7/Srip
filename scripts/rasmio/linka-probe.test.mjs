import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractLinkaFacts} from './linka-probe.mjs';
test('extracts exact national identity only from source description, preserving provenance',()=>{
 const x=extractLinkaFacts('<title>شرکت نمونه</title><meta name="description" content="شرکت نمونه به شناسه ملی ۱۰۱۰۱۸۶۵۶۲۷ با شماره 143593">','https://linka.ir/company/abc/');
 assert.equal(x.nationalId,'10101865627');assert.equal(x.identityVerified,true);assert.equal(x.fullProfileVerified,false);assert.equal(x.source,'linka.ir');
});
test('title similarity and unrelated identifiers do not verify identity',()=>{
 const x=extractLinkaFacts('<title>شرکت نفت پارس 10100302746</title><script>nationalId=10100302746</script>','https://linka.ir/company/abc/');
 assert.equal(x.nationalId,null);assert.equal(x.identityVerified,false);
});
