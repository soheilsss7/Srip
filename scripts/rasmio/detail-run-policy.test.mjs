import {test} from 'node:test';import assert from 'node:assert/strict';
import {createDetailRunPolicy} from './detail-run-policy.mjs';
test('repeated empty brand pages cannot stop useful product or routed work',()=>{
 const p=createDetailRunPolicy(),brand={type:'brand',id:'1'};
 p.failure(brand,new Error('empty-detail-response'));assert.ok(p.permits(brand));
 p.failure(brand,new Error('empty-detail-response'));assert.equal(p.permits(brand),false);
 for(const type of ['product','patent','company','person'])assert.ok(p.permits({type}));
 assert.deepEqual(p.snapshot().deferredTypes,['brand']);assert.ok(createDetailRunPolicy().permits(brand));
});
test('explicit restriction stops all independent traffic, not just its entity type',()=>{
 for(const reason of ['explicit-access-limit','HTTP 401','HTTP 403','HTTP 429']){
  const p=createDetailRunPolicy();p.failure({type:'product'},new Error(reason));
  for(const type of ['product','brand','patent'])assert.equal(p.permits({type}),false);
  for(const type of ['company','person'])assert.ok(p.permits({type}));
 }
});
test('one proxy failure and transient errors do not manufacture a direct access restriction',()=>{
 const p=createDetailRunPolicy();p.failure({type:'company'},new Error('HTTP 429'));p.failure({type:'product'},new Error('detail-response-aborted'));
 assert.equal(p.snapshot().directBlocked,false);assert.ok(p.permits({type:'product'}));
});
