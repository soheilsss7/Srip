import {test} from 'node:test';import assert from 'node:assert/strict';import {recordTransportErrors} from './readback-transport.mjs';
const product={type:'product',id:'123',url:'https://rasmio.com/product/123/',via:'fetch-anon',sourceRun:'7'};
const request={event:'request',runId:'7',path:'/product/123/',status:200,outcome:'html-with-tables'};
test('independent product fetches require matching run, identity, HTTPS and a table-bearing response',()=>{
 assert.deepEqual(recordTransportErrors(product,{outcomes:[]},[request]),[]);
 for(const patch of [{runId:'8'},{path:'/product/456/'},{status:429},{outcome:'explicit-access-limit'}])assert.ok(recordTransportErrors(product,{outcomes:[]},[{...request,...patch}]).length);
 for(const patch of [{url:'http://rasmio.com/product/123/'},{url:'https://rasmio.com/product/456/'},{via:'browser'}])assert.ok(recordTransportErrors({...product,...patch},{outcomes:[]},[request]).length);
});
test('company and person direct traffic never qualifies through an independent-lane exemption',()=>{
 for(const type of ['company','person'])assert.ok(recordTransportErrors({...product,type},{outcomes:[]},[request]).length);
 const routed={...product,type:'company',via:'proxy-fetch',egress:{directFallback:false,observedExitIP:'8.8.8.8'}};
 assert.deepEqual(recordTransportErrors(routed,{outcomes:[{key:'company:123',success:true,observedExitIP:'8.8.8.8'}]}),[]);
 assert.ok(recordTransportErrors(routed,{outcomes:[]}).length);
});
