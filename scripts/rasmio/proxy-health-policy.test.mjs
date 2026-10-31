import {test} from 'node:test';
import assert from 'node:assert/strict';
import {endpointEligible,healthSuccess,healthFailure,newestRunFirst,HEALTH_FRESH_MS} from './proxy-health-policy.mjs';
test('recent exhausted echo exits are skipped without spending another health check',()=>{
 const h=healthSuccess(null,'1.1.1.1',1000);
 assert.equal(endpointEligible(h,()=>false,1001),false);
 assert.equal(endpointEligible(h,()=>true,1001),true);
 assert.equal(endpointEligible(h,()=>false,1000+HEALTH_FRESH_MS),true);
 assert.equal(endpointEligible(null,()=>false,1001),true);
});
test('failed endpoints back off persistently, with bounded retries and recovery',()=>{
 let h=healthFailure(null,1000);assert.equal(h.failures,1);assert.equal(endpointEligible(h,()=>true,1001),false);
 assert.equal(endpointEligible(JSON.parse(JSON.stringify(h)),()=>true,h.retryAfter),true);
 for(let i=0;i<20;i++)h=healthFailure(h,1000);
 assert.equal(h.retryAfter,1000+30*60*1000);
 h=healthSuccess(h,'1.1.1.1',2000);assert.equal(h.failures,0);assert.equal(h.retryAfter,0);
});
test('new transport observations precede old probe files regardless of filename prefix',()=>{
 const files=['public-proxy-probe-411000.json','proxy-transport-412000.json'];
 assert.equal(files.sort(newestRunFirst)[0],'proxy-transport-412000.json');
});
