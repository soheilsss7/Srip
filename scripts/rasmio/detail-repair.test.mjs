import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {restoreIncompleteDetails, prioritizeDetailRepair, markDetailRepaired, hasDetailData, hasDetailCounts, backfillKnownDetailQueue} from './detail-repair.mjs';
test('restores missing and falsely visited empty entities but preserves populated files',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'repair-'));
 const ids=['company:10100042823','person:ABC','person:DEF','company:10480075869'];
 const f={pending:[{type:'person',id:'ABC'}],visited:{'person:ABC':{rows:0},'person:DEF':{rows:1}},graph:{nodes:Object.fromEntries(ids.map(k=>[k,{}]))}};
 fs.writeFileSync(path.join(dir,'company-10100042823.json'),JSON.stringify({rows:[]}));
 fs.writeFileSync(path.join(dir,'person-ABC.json'),JSON.stringify({rows:[],tables:[]}));
 fs.writeFileSync(path.join(dir,'person-DEF.json'),JSON.stringify({rows:[],tables:[{rows:[['value']]}]}));
 fs.writeFileSync(path.join(dir,'company-10480075869.json'),'{bad');
 fs.writeFileSync(path.join(dir,'company-0.json'),'{}');
 try{
  const r=restoreIncompleteDetails(f,dir);assert.equal(r.eligible,3);assert.equal(r.addedToPending,2);assert.equal(r.clearedVisited,1);assert.equal(r.corruptFiles,1);
  assert.equal(f.pending.length,3);assert.ok(f.visited['person:DEF']);assert.ok(!f.visited['person:ABC']);
  const q=prioritizeDetailRepair(f,[{type:'product',id:'1'}]);assert.equal(q.length,4);
  markDetailRepaired(f,'person:ABC');assert.equal(f.detailRepair.repaired,1);assert.ok(!f.detailRepair.remaining.includes('person:ABC'));
  assert.equal(restoreIncompleteDetails(f,dir).reused,true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('nonempty tables count even when linked rows are empty',()=>{
 assert.equal(hasDetailData({rows:[],tables:[{rows:[['key','value']]}]}),true);
 assert.equal(hasDetailData({rows:[],tables:[]}),false);
});

test('zero, dead and missing results never qualify as completed details',()=>{
 assert.equal(hasDetailCounts({rows:0,tableRows:0,dead:true}),false);
 assert.equal(hasDetailCounts(null),false);
 assert.equal(hasDetailCounts({rows:0,tableRows:7}),true);
 assert.equal(hasDetailCounts({rows:2}),true);
});

test('backfills graph-only profiles despite a nonempty queue, preserving populated profiles and other work',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'graph-repair-'));
 const f={pending:[{type:'product',id:'77'},{type:'person',id:'ABC'}],visited:{'company:10100000711':{rows:8},'person:DEF':{rows:4}},graph:{nodes:{'company:10100000711':{},'company:10100002620':{},'person:ABC':{},'person:DEF':{},'company:0':{},'brand:88':{}}}};
 fs.writeFileSync(path.join(dir,'person-DEF.json'),JSON.stringify({tables:[{rows:[['real']]}]}));
 try {
  const r=backfillKnownDetailQueue(f,dir);
  assert.equal(r.identifiedWithoutNonemptyDetail,3);assert.equal(r.addedToPending,2);assert.equal(r.clearedVisited,1);
  assert.deepEqual(r.addedByType,{company:2,person:0});
  assert.equal(f.pending.length,4);assert.equal(new Set(f.pending.map(e=>`${e.type}:${e.id}`)).size,4);
  assert.ok(f.visited['person:DEF']);assert.equal(f.visited['company:10100000711'],undefined);
  assert.deepEqual(f.graphDetailBackfill.reopened,['company:10100000711']);
  assert.equal(backfillKnownDetailQueue(f,dir).reused,true);assert.equal(f.pending.length,4);
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
