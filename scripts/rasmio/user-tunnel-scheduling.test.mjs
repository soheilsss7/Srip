import {test} from 'node:test';import assert from 'node:assert/strict';import {prioritizeUserCandidates} from './user-tunnel-scheduling.mjs';
const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64),d='d'.repeat(64);const entries=[a,b,c,d].map(id=>({candidate:{id},nextCursor:0}));
test('productive healthy configs precede unknown or failed configs without admitting cooled exits',()=>{
 const now=1e7,health={[`user-tunnel:${d}`]:{checkedAt:now,retryAfter:now+1}},hints={[b.slice(0,16)]:{ip:'1.1.1.1',checkedAt:now,profile:true},[c.slice(0,16)]:{ip:'2.2.2.2',checkedAt:now}};
 assert.deepEqual(prioritizeUserCandidates(entries,{health,hints,available:()=>true,now}).map(x=>x.candidate.id),[b,c,a]);
});
test('exhausted exit aliases are skipped for an hour, then eligible for verified dynamic revalidation',()=>{const now=1e7,hints={[a.slice(0,16)]:{ip:'1.1.1.1',checkedAt:now-1000}};assert.equal(prioritizeUserCandidates([entries[0]],{hints,available:()=>false,now}).length,0);hints[a.slice(0,16)].checkedAt=now-3600001;assert.equal(prioritizeUserCandidates([entries[0]],{hints,available:()=>false,now}).length,1);});
