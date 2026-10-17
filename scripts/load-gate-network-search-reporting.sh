#!/usr/bin/env bash
set -euo pipefail
: "${API_URL:=http://127.0.0.1:4000/api/v1}";: "${PERF_AUTH_TOKEN:?PERF_AUTH_TOKEN is required}";: "${PERF_ORGANIZATION_ID:?PERF_ORGANIZATION_ID is required}"
python3 - "$API_URL" "$PERF_AUTH_TOKEN" <<'PYX'
import sys,time,json,urllib.request,statistics,os
base,token=sys.argv[1:];org=os.environ['PERF_ORGANIZATION_ID'];paths=[('network',f'/network/graph?organizationId={org}&limit=250',1000),('search','/search?q=bank&limit=20',1000),('reporting',f'/reports/executive-summary?organizationId={org}',1500)]
results=[]
for name,path,target in paths:
 xs=[];fail=0
 for _ in range(20):
  t=time.perf_counter();req=urllib.request.Request(base+path,headers={'Authorization':'Bearer '+token})
  try:
   with urllib.request.urlopen(req,timeout=10) as r:r.read();fail+=r.status>=400
  except:fail+=1
  xs.append((time.perf_counter()-t)*1000)
 xs.sort();p95=xs[int(len(xs)*.95)-1];results.append({'name':name,'p50Ms':round(statistics.median(xs),2),'p95Ms':round(p95,2),'p99Ms':round(xs[-1],2),'failures':fail,'targetP95Ms':target,'pass':fail==0 and p95<target})
print(json.dumps({'results':results,'pass':all(r['pass'] for r in results)},indent=2));raise SystemExit(0 if all(r['pass'] for r in results) else 1)
PYX
