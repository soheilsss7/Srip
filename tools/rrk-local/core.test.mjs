import {test} from 'node:test';
import assert from 'node:assert/strict';
import {noticeFromFields,sourceURL,graphFor,robotAllows} from './core.mjs';
const fields={companyNationalId:'۱۰۱۰۱۸۶۵۶۲۷',companyName:'نمونهٔ ساختگی آزمون',tracking:'123456',noticeText:'آقای علی رضایی به شماره ملی 1234567890 به سمت مدیرعامل انتخاب گردید. این متن فقط دادهٔ ساختگی آزمون است.'};
test('extracts a scoped person observation without publishing ten-digit identifiers',()=>{
 const r=noticeFromFields(fields,'https://rrk.ir/ords/r/rrs/rrs-front/f-detail-ad?p28_id=12&session=SECRET&cs=OTHER');
 assert.equal(r.companyNationalId,'10101865627');assert.equal(r.personObservations[0].name,'علی رضایی');assert.equal(r.personObservations[0].role,'مدیرعامل');assert.equal(r.personObservations[0].identityResolution,'unresolved');
 assert.ok(!JSON.stringify(r).includes('1234567890'));assert.ok(!JSON.stringify(r).includes('SECRET'));assert.ok(!JSON.stringify(r).includes('OTHER'));assert.equal(r.coverage.fullProfileVerified,false);
});
test('does not merge people just because names match in two notices',()=>{
 const a=noticeFromFields(fields,'https://rrk.ir/ords/r/x'),b=noticeFromFields({...fields,tracking:'123457'},'https://rrk.ir/ords/r/x');
 const g=graphFor([a,b]);assert.equal(g.nodes.filter(n=>n.type==='person-observation').length,2);assert.equal(g.identityMergesPerformed,0);assert.equal(g.edges.length,2);
});
test('rejects missing company identity, shells and out-of-scope sources',()=>{
 assert.throws(()=>noticeFromFields({...fields,companyNationalId:''},'https://rrk.ir/'));
 assert.throws(()=>noticeFromFields({...fields,noticeText:'پوسته'},'https://rrk.ir/'));
 for(const u of ['http://rrk.ir/','https://evil.test/','https://u:p@rrk.ir/'])assert.throws(()=>sourceURL(u));
});
test('honors robots exclusions conservatively',()=>{
 assert.equal(robotAllows('User-agent: *\nDisallow: /ords/', 'https://rrk.ir/ords/r/x'),false);
 assert.equal(robotAllows('Disallow: /*detail*', 'https://rrk.ir/ords/f-detail-ad'),false);
 assert.equal(robotAllows('Disallow: /private', 'https://rrk.ir/ords/r/x'),true);
});
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateRecord} from './core.mjs';
import {importBundle} from './import.mjs';
test('import is idempotent, keeps a separate sourced graph, rejects tampering',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rrk-import-'));
 try{
  const r=noticeFromFields(fields,'https://rrk.ir/ords/r/x');const b={schemaVersion:1,source:'rrk.ir',records:[r]};
  assert.equal(validateRecord(r).companyNationalId,'10101865627');
  assert.equal(importBundle(b,dir).added,1);const second=importBundle(b,dir);assert.equal(second.added,0);assert.equal(second.unchanged,1);assert.equal(second.relationships,1);assert.equal(second.canonicalRasmioProfilesChanged,0);
  assert.throws(()=>importBundle({...b,records:[{...r,text:r.text+' modified'}]},dir),/hash/);
  assert.throws(()=>validateRecord({...r,personObservations:[{name:'نام ساختگی',role:'مدیرعامل',evidence:'بی مدرک'}]}),/evidence/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('multiline Persian names retain a valid evidence chain',()=>{
 const r=noticeFromFields({...fields,noticeText:'خانم مریم\n  احمدی به سمت بازرس اصلی انتخاب شد. این آگهی ساختگی فقط برای آزمون چندخطی است.'},'https://rrk.ir/ords/r/x');
 assert.equal(r.personObservations[0].name,'مریم احمدی');assert.equal(validateRecord(r).personObservations.length,1);
});
