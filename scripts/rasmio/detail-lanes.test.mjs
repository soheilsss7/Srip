import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interleaveDetailLanes,requiresProxy,poolExhausted} from './detail-lanes.mjs';
const task=(type,id)=>({type,id});
test('repair-heavy queue cannot starve independent work in the first wave',()=>{
 const q=[...Array.from({length:8},(_,i)=>task('company',i)),task('product',1),task('brand',2),task('person',9)];
 const original=[...q];const mixed=interleaveDetailLanes(q);
 assert.deepEqual(mixed.slice(0,4).map(e=>e.type),['company','company','product','brand']);
 assert.equal(mixed.length,q.length);assert.deepEqual(q,original);
 assert.deepEqual(mixed.filter(requiresProxy),q.filter(requiresProxy));
 assert.deepEqual(mixed.filter(e=>!requiresProxy(e)),q.filter(e=>!requiresProxy(e)));
});
test('verify ordering unchanged; single-lane and empty queues terminate',()=>{
 for(const q of [[],[task('person',1)],[task('product',1),task('brand',2)]])assert.deepEqual(interleaveDetailLanes(q),q);
 const q=[task('company',1),task('company',2),task('product',3)];assert.deepEqual(interleaveDetailLanes(q,{enabled:false}),q);
});
test('busy or reusable pools are not incorrectly declared exhausted',()=>{
 const pool={index:1,candidates:[{}],busy:new Set(),ready:[],available:()=>true};
 assert.equal(poolExhausted(pool),true);pool.checking=1;assert.equal(poolExhausted(pool),false);pool.checking=0;pool.busy.add('ip');assert.equal(poolExhausted(pool),false);pool.busy.clear();
 pool.ready=[{ip:'ip',retired:false}];assert.equal(poolExhausted(pool),false);
 pool.ready[0].retired=true;assert.equal(poolExhausted(pool),true);
 pool.index=0;assert.equal(poolExhausted(pool),false);
});

test('a spent health-check budget is exhausted even if the candidate array is longer',()=>{const pool={index:2,candidates:[1,2,3,4],checked:2,maxChecks:2,busy:new Set(),ready:[],available:()=>true};assert.equal(poolExhausted(pool),true);pool.checking=1;assert.equal(poolExhausted(pool),false);pool.checking=0;pool.ready=[{ip:'8.8.8.8',retired:false}];assert.equal(poolExhausted(pool),false);});
