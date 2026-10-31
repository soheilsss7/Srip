import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {extractEmbeddedNoticesFromDOM,persistEmbeddedNotices} from './embedded-notices.mjs';
const id='10720258320';
const real=JSON.parse(fs.readFileSync(new URL('./data/sources/rasmio/public-reader/2026-10-31/company-10720258320.json',import.meta.url)));
function element(tagName,text='',children=[],href=null) {
 const n={tagName,textContent:text,children,parentElement:null,getAttribute:()=>href};
 children.forEach(c=>c.parentElement=n);
 n.contains=x=>children.some(c=>c===x||c.contains(x));
 n.querySelectorAll=selector=>{
  const nodes=children.flatMap(c=>[c,...c.querySelectorAll('*')]);
  if(selector==='*')return nodes;
  if(selector==='a[href]')return nodes.filter(c=>c.tagName==='A');
  return nodes.filter(c=>['P','DIV','ARTICLE','SECTION'].includes(c.tagName));
 };return n;
}
function fixture(text=real.notices[0].text,links=['/News/130232001/']) {
 const body=element('P',text);const card=element('DIV',text,[body,...links.map(h=>element('A','آگهی مرتبط',[],h))]);
 return element('ROOT','',[card]);
}
test('extracts an actual saved public notice with explicit notice identity, not shell links',()=>{
 const n=extractEmbeddedNoticesFromDOM(id,fixture());assert.equal(n.length,1);assert.equal(n[0].noticeId,'130232001');
 assert.equal(n[0].directOfficialSourceFetched,false);assert.equal(n[0].fullOfficialNoticeVerified,false);
 assert.deepEqual(extractEmbeddedNoticesFromDOM(id,fixture('ورود و ثبت نام')),[]);
});
test('no wrong-company match, ambiguous anchor association, or external notice URL',()=>{
 assert.deepEqual(extractEmbeddedNoticesFromDOM('10100020043',fixture()),[]);
 assert.deepEqual(extractEmbeddedNoticesFromDOM(id,fixture(undefined,['/News/1/','/News/2/'])),[]);
 assert.deepEqual(extractEmbeddedNoticesFromDOM(id,fixture(undefined,['https://example.com/News/1/'])),[]);
});
test('redacts ASCII and Persian personal identifiers and flags truncated publisher text',()=>{
 const n=extractEmbeddedNoticesFromDOM(id,fixture(real.notices[0].text+' شماره ملی ۱۲۳۴۵۶۷۸۹۰ ...'))[0];
 assert.equal(n.publisherTruncationDetected,true);assert.ok(!n.text.includes('1234567890'));assert.ok(n.text.includes(id));
});
test('persistence is idempotent and retains changed text as another sourced variant',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'notice-test-'));
 try {
  const n=extractEmbeddedNoticesFromDOM(id,fixture());
  const args={notices:n,companyId:id,sourceURL:real.sourceURL,dataDir:dir,outDir:path.join(dir,'out'),runId:'test'};
  assert.equal(persistEmbeddedNotices(args).length,1);assert.equal(persistEmbeddedNotices(args).length,0);
  n[0].text+=' اصلاح ناشر';assert.equal(persistEmbeddedNotices(args).length,1);
  const saved=JSON.parse(fs.readFileSync(path.join(dir,'sources/rasmio/notices/130232001.json')));
  assert.equal(saved.variants.length,2);assert.equal(saved.variants[0].sourceURL,real.sourceURL);
  assert.throws(()=>persistEmbeddedNotices({...args,sourceURL:'https://rrk.ir/'}),/source mismatch/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
