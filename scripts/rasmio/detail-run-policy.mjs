import {requiresProxy} from './detail-lanes.mjs';
// Run-local deferrals only. Never mark deferred tasks visited or change IP quotas.
export function createDetailRunPolicy({emptyLimit=2}={}) {
 if(!Number.isInteger(emptyLimit)||emptyLimit<1)throw new Error('Invalid empty-detail limit');
 const emptyCounts={},deferredTypes=new Set();let directBlocked=false;
 return {
  permits(ent){return requiresProxy(ent)||(!directBlocked&&!deferredTypes.has(ent.type));},
  failure(ent,error){
   if(requiresProxy(ent))return;
   const reason=String(error?.message||error);
   if(/explicit-access-limit|HTTP (?:401|403|429)\b/.test(reason)){directBlocked=true;return;}
   if(reason==='empty-detail-response'){
    emptyCounts[ent.type]=(emptyCounts[ent.type]||0)+1;
    if(emptyCounts[ent.type]>=emptyLimit)deferredTypes.add(ent.type);
   }
  },
  snapshot(){return {scope:'current run only; tasks remain pending',directBlocked,deferredTypes:[...deferredTypes],emptyCounts:{...emptyCounts}};}
 };
}
