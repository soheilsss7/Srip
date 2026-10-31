// A complete HTML response, including its body, must fit the deadline.
// Aborted/oversized bodies are deferrals, never browser retries or saved partial detail.
export async function fetchDetailHTML(url,{headers,fetchImpl=globalThis.fetch,timeoutMs=20000,maxBytes=4194304}={}) {
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(new Error('detail-response-deadline')),timeoutMs);
 try {
  const response=await fetchImpl(url,{headers,redirect:'follow',cache:'no-store',signal:controller.signal});
  if(!response.ok){await response.body?.cancel().catch(()=>{});const error=new Error('HTTP '+response.status);error.retryable=true;throw error;}
  let html='';
  if(response.body?.getReader) {
   const reader=response.body.getReader(),chunks=[];let bytes=0;
   try {for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){controller.abort();throw new Error('detail-response-too-large');}chunks.push(Buffer.from(value));}}
   finally{await reader.cancel().catch(()=>{});}
   html=Buffer.concat(chunks).toString('utf8');
  }else{html=await response.text();if(Buffer.byteLength(html)>maxBytes)throw new Error('detail-response-too-large');}
  if(controller.signal.aborted)throw new Error('detail-response-deadline');
  return {ok:true,status:response.status,text:async()=>html};
 }catch(cause){const error=new Error(controller.signal.aborted?'detail-response-aborted':cause.message,{cause});error.retryable=true;error.partialResponseAccepted=false;throw error;}
 finally{clearTimeout(timer);}
}
