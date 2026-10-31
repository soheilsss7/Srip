import {test} from 'node:test';import assert from 'node:assert/strict';import {graphPartitions,graphShardOf} from './graph-partitions.mjs';
test('partial partition content matches the full checkpoint byte for byte without losing linked nodes',()=>{
 const nodes=Object.fromEntries(Array.from({length:1000},(_,i)=>['company:'+i,{id:String(i),name:'شرکت '+i}]));
 const edge={from:'company:1',to:'company:2',kind:'board',role:'member'};const g={nodes,edges:[edge,{...edge},{...edge,role:'chair'}]};
 const full=graphPartitions(g),selected=[graphShardOf('company:1'),graphShardOf('company:2')],partial=graphPartitions(g,{onlyShards:selected});
 for(const i of selected)assert.equal(JSON.stringify(partial.get(i)),JSON.stringify(full.get(i)));
 assert.equal([...full.values()].reduce((n,b)=>n+b.edges.length,0),2);
 assert.equal([...full.values()].reduce((n,b)=>n+Object.keys(b.nodes).length,0),1000);
 assert.equal(partial.size,new Set(selected).size);assert.equal(graphPartitions(g,{onlyShards:[]}).size,0);
});
test('partial checkpoints reject invalid partition selections',()=>{for(const onlyShards of [[-1],[16],[1.2]])assert.throws(()=>graphPartitions({nodes:{},edges:[]},{onlyShards}));});
