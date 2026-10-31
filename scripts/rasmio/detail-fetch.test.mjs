import {test} from 'node:test';import assert from 'node:assert/strict';
import {fetchDetailHTML} from './detail-fetch.mjs';
test('returns a complete UTF-8 body without retry or cookies',async()=>{
 let calls=0;const html='شرکت <table><tr><td>داده</td></tr></table>';
 const r=await fetchDetailHTML('https://rasmio.com/product/1/',{fetchImpl:async(_,options)=>{
  calls++;assert.equal(options.cache,'no-store');assert.equal(options.headers?.cookie,undefined);return new Response(html);
 }});assert.equal(await r.text(),html);assert.equal(calls,1);
});
test('deadline covers a stalled body after HTTP headers, rejects partial content',async()=>{
 const p=fetchDetailHTML('https://rasmio.com/product/1/',{timeoutMs:20,fetchImpl:async(_,o)=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('<table>partial'));o.signal.addEventListener('abort',()=>c.error(o.signal.reason),{once:true});}}))});
 await assert.rejects(p,e=>e.retryable===true && e.partialResponseAccepted===false && /aborted/.test(e.message));
});
test('oversized bodies are never returned as accepted detail',async()=>{
 await assert.rejects(fetchDetailHTML('https://rasmio.com/product/1/',{maxBytes:3,fetchImpl:async()=>new Response('123456789')}),e=>e.retryable&&e.partialResponseAccepted===false);
});
test('explicit access errors remain errors, without browser or automatic retry',async()=>{
 let calls=0;
 await assert.rejects(fetchDetailHTML('https://rasmio.com/product/1/',{fetchImpl:async()=>{calls++;return new Response('blocked',{status:429});}}),/HTTP 429/);
 assert.equal(calls,1);
});
