import sys,tarfile,json,collections,datetime,hashlib
C=collections.Counter(); types=collections.defaultdict(collections.Counter); ids=set(); nonempty=set(); nodes=set(); edges=set(); pending=set();visited={}; examples=collections.defaultdict(list); manifest=None; frontierSummary={}; sourceRuns=collections.Counter(); coverage=collections.Counter(); info=collections.Counter(); errors=[]; graphDeclared={}
def sample(kind,x):
 if len(examples[kind])<12:examples[kind].append(x)
with tarfile.open(fileobj=sys.stdin.buffer,mode='r|gz')as tar:
 for m in tar:
  if not m.isfile():continue
  p='/'.join(m.name.split('/')[1:]);C['repositoryFiles']+=1
  if not p.startswith('scripts/rasmio/'):continue
  C['crawlerFiles']+=1;C['crawlerBytes']+=m.size
  rel=p[len('scripts/rasmio/'):]
  entity=rel.startswith('data/entities/')and rel.endswith('.json')
  graph=rel=='data/graph.json'or(rel.startswith('data/graph/')and rel.endswith('.json'))
  frontier=rel=='frontier.json'
  if not(entity or graph or frontier or rel=='out/manifest.json'):continue
  raw=tar.extractfile(m).read()
  try:d=json.loads(raw)
  except Exception as e:
   C['invalidJSON']+=1;sample('invalidJSON',{'file':p,'error':str(e)[:140]});continue
  if entity:
   C['entityFiles']+=1;C['entityBytes']+=m.size
   if not isinstance(d,dict):C['invalidEntityShape']+=1;sample('invalidEntityShape',p);continue
   t=str(d.get('type','unknown'));id=str(d.get('id',''));key=t+':'+id;s=types[t];s['files']+=1
   if key in ids:C['duplicateEntityIDs']+=1;sample('duplicateEntityIDs',key)
   ids.add(key)
   if rel.split('/')[-1]!=t+'-'+id+'.json':C['filenameIdentityMismatch']+=1;sample('filenameIdentityMismatch',p)
   rows=d.get('rows')or[];tables=d.get('tables')or[]
   tr=sum(len(a.get('rows')or[])for a in tables if isinstance(a,dict))
   populated=bool(rows or tr);s['nonempty'if populated else 'empty']+=1
   if populated:nonempty.add(key)
   s['linkedRows']+=len(rows);s['tables']+=len(tables);s['tableRows']+=tr
   s['schema2']+=d.get('tableSchemaVersion')==2
   s['withInfo']+=bool(d.get('info'));s['withSourceRun']+=bool(d.get('sourceRun'))
   s['proxyRecords']+=str(d.get('via','')).startswith('proxy-')or d.get('via')=='public-proxy-curl'
   coverage[(d.get('profileCoverage')or{}).get('status','not-recorded')]+=1
   sourceRuns[str(d.get('sourceRun','not-recorded'))]+=1
   for k,v in (d.get('info')or{}).items():info[str(k)]+=1
   for a in tables:
    if not isinstance(a,dict):C['invalidTableShape']+=1;continue
    rr=a.get('rows')or[];cols=a.get('columns');s['twentyRowTables']+=len(rr)==20
    if isinstance(cols,list):
     for r in rr:
      if not isinstance(r,list)or len(r)!=len(cols):C['tableWidthMismatches']+=1;sample('tableWidthMismatches',{'key':key,'columns':len(cols),'rowWidth':len(r)if isinstance(r,list)else None})
   if populated and len(examples['populated'])<8:sample('populated',{'key':key,'name':d.get('name'),'tables':len(tables),'tableRows':tr})
  elif graph:
   if isinstance(d,dict)and d.get('sharded'):graphDeclared=d
   if isinstance(d,dict):
    nn=d.get('nodes')or{};C['graphNodeOccurrences']+=len(nn);nodes.update(nn)
    for e in d.get('edges')or[]:
     C['graphEdgeOccurrences']+=1
     if isinstance(e,dict):edges.add((str(e.get('from')),str(e.get('to')),str(e.get('kind')),str(e.get('role'))))
  elif frontier:
   pp=d.get('pending')or[];pending={str(e.get('type'))+':'+str(e.get('id'))for e in pp if isinstance(e,dict)};visited=d.get('visited')or{}
   frontierSummary={'pendingEntries':len(pp),'pendingUnique':len(pending),'pendingByType':dict(collections.Counter(e.get('type','unknown')for e in pp if isinstance(e,dict))),'visitedEntries':len(visited),'parkedPersons':len(d.get('personsLater')or[]),'detailRepair':{k:v for k,v in (d.get('detailRepair')or{}).items()if k not in ['remaining','reopened']and not isinstance(v,(list,dict))},'repairRemaining':len((d.get('detailRepair')or{}).get('remaining')or[]),'stats':d.get('stats')}
   gg=d.get('graph')or{};nodes.update(gg.get('nodes')or{})
   for e in gg.get('edges')or[]:edges.add((str(e.get('from')),str(e.get('to')),str(e.get('kind')),str(e.get('role'))))
  elif rel=='out/manifest.json':manifest=d
  if C['entityFiles']and C['entityFiles']%5000==0 and entity:print('AUDITED',C['entityFiles'],file=sys.stderr,flush=True)
result={'snapshot':sys.argv[1],'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'counters':dict(C),'entityTypes':{k:dict(v)for k,v in types.items()},'entityUnique':len(ids),'nonemptyUnique':len(nonempty),'coverageStatus':dict(coverage),'graph':{'uniqueNodes':len(nodes),'uniqueEdgesByFromToKindRole':len(edges),'nodesWithEntityFile':len(nodes&ids),'nodesWithoutEntityFile':len(nodes-ids),'nodesWithNonemptyFile':len(nodes&nonempty),'nodeTypes':dict(collections.Counter(k.split(':')[0]for k in nodes)),'nodesWithoutFileAndOutsidePending':len(nodes-ids-pending),'nodesWithoutFileAndOutsidePendingByType':dict(collections.Counter(k.split(':')[0]for k in nodes-ids-pending)),'declaredManifest':graphDeclared},'frontier':frontierSummary,'queueChecks':{'pendingWithNonemptyFile':len(pending&nonempty),'pendingWithoutEntityFile':len(pending-ids),'visitedWithoutEntityFile':len(set(visited)-ids),'visitedWithEmptyFile':len((set(visited)&ids)-nonempty),'nonemptyWithoutVisited':len(nonempty-set(visited))},'infoKeyFileCounts':dict(info),'sourceRunCounts':dict(sourceRuns),'examples':dict(examples),'latestManifest':manifest,'notes':['Nonempty is not proof of full profile coverage.','Linked rows overlap table data; do not add to table rows.','Graph-only nodes are discovered identifiers, not downloaded profiles.','Legacy records without profileCoverage are not verified complete.']}
json.dump(result,open('inventory-full-2026-10-27.json','w'),ensure_ascii=False,indent=2);print('AUDIT_COMPLETE',C['entityFiles'],flush=True)
