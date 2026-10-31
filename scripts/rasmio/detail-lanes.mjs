// Keep each lane's priority and every queued task; a dead proxy pool must not starve other types.
export const requiresProxy = e => ['company','person'].includes(e.type);
export function interleaveDetailLanes(queue, {enabled=true, width=4}={}) {
  if (!enabled) return [...queue];
  if(!Number.isInteger(width) || width<2 || width>16)throw new Error('Invalid wave width');
  const routed=[], independent=[];
  for (const e of queue) (requiresProxy(e)?routed:independent).push(e);
  const output=[]; let a=0,b=0;
  const share=Math.max(1,Math.floor(width/2));
  while(a<routed.length || b<independent.length) {
    for(let n=0;n<share && a<routed.length;n++)output.push(routed[a++]);
    for(let n=0;n<width-share && b<independent.length;n++)output.push(independent[b++]);
  }
  return output;
}
export function poolExhausted(pool) {
  return !!pool && pool.index>=pool.candidates.length && !pool.busy.size && !pool.ready.some(e=>!e.retired && pool.available(e.ip));
}
