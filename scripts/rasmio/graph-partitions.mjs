export function graphShardOf(key,shards=16){let h=0;for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))|0;return ((h%shards)+shards)%shards;}
// A partial checkpoint is used only between full checkpoints; the final/published
// graph always uses the full path. Partition bytes match the full writer exactly.
export function graphPartitions(graph,{shards=16,onlyShards=null}={}){
 if(!Number.isInteger(shards)||shards<1||shards>256)throw new Error('Invalid shard count');
 const selected=onlyShards===null?Array.from({length:shards},(_,i)=>i):[...new Set(onlyShards)];
 if(selected.some(i=>!Number.isInteger(i)||i<0||i>=shards))throw new Error('Invalid graph shard');
 const buckets=new Map(selected.map(i=>[i,{nodes:{},edges:[]}])),seen=new Set();
 for(const [key,node] of Object.entries(graph.nodes||{})){const b=buckets.get(graphShardOf(key,shards));if(b)b.nodes[key]=node;}
 for(const e of graph.edges||[]){const b=buckets.get(graphShardOf(String(e.from||''),shards));if(!b)continue;const key=`${e.from}|${e.to}|${e.kind}|${e.role}`;if(seen.has(key))continue;seen.add(key);b.edges.push(e);}
 return buckets;
}
