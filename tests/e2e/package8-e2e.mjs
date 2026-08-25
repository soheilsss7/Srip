/**
 * PACKAGE 8 canonical E2E. Requires a real deployed API and seeded credentials.
 * No mocks and no PASS without real HTTP responses.
 */
const enabled = process.env.RUN_E2E === '1';
if (!enabled) { console.log('PACKAGE8_E2E=SKIPPED (set RUN_E2E=1)'); process.exit(0); }
const base = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const userId = process.env.E2E_USER_ID;
const forbiddenOrg = process.env.E2E_FORBIDDEN_ORGANIZATION_ID;
if (!email || !password || !userId || !forbiddenOrg) throw new Error('Missing E2E_USER_EMAIL/E2E_USER_PASSWORD/E2E_USER_ID/E2E_FORBIDDEN_ORGANIZATION_ID');
let token = '';
let organizationId = '', targetOrganizationId = '', personId = '', relationshipId = '', meetingId = '', actionId = '', commitmentId = '';
async function request(path, {method='GET', body, idempotency=true}={}) {
  const headers = {accept:'application/json','x-request-id':crypto.randomUUID(),'x-correlation-id':crypto.randomUUID()};
  if (token) headers.authorization=`Bearer ${token}`;
  if (body !== undefined) headers['content-type']='application/json';
  if (idempotency && ['POST','PUT','PATCH','DELETE'].includes(method)) headers['idempotency-key']=crypto.randomUUID()+crypto.randomUUID();
  const r = await fetch(`${base}/api/v1${path}`, {method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text = await r.text(); let parsed; try { parsed=text?JSON.parse(text):undefined; } catch { parsed=text; }
  return {r,body:parsed};
}
const idOf=(v,keys=[])=>{for(const k of keys) if(v?.[k]?.id) return v[k].id; return v?.id||v?.data?.id||v?.entity?.id;};
const ok=(r,label)=>{if(!r.ok) throw new Error(`${label}: HTTP ${r.status}`);};

let x=await request('/auth/login',{method:'POST',body:{email,password},idempotency:false}); ok(x.r,'Login'); token=x.body?.accessToken||x.body?.token; if(!token) throw new Error('Login token missing'); console.log('PASS Login');
x=await request('/organizations',{method:'POST',body:{name:`Package8 ${Date.now()}`}}); ok(x.r,'Organization'); organizationId=idOf(x.body,['organization']);
x=await request('/organizations',{method:'POST',body:{name:`Package8 Target ${Date.now()}`}}); ok(x.r,'Target Organization'); targetOrganizationId=idOf(x.body,['organization']);
x=await request('/people',{method:'POST',body:{firstName:'Package8',lastName:'Person',organizationId,email:`p8-${Date.now()}@example.test`}}); ok(x.r,'Person'); personId=idOf(x.body,['person']);
x=await request('/relationships',{method:'POST',body:{sourceOrganizationId:organizationId,targetOrganizationId,relationshipType:'BUSINESS'}}); ok(x.r,'Relationship'); relationshipId=idOf(x.body,['relationship']);
x=await request('/meetings',{method:'POST',body:{organizationId,relationshipId,title:'Package8 Meeting',startAt:new Date(Date.now()+3600000).toISOString(),endAt:new Date(Date.now()+7200000).toISOString(),participantPersonIds:[personId]}}); ok(x.r,'Meeting'); meetingId=idOf(x.body,['meeting']);
x=await request(`/meetings/${meetingId}/complete`,{method:'POST',body:{}}); if(![200,201,204].includes(x.r.status)) throw new Error(`Complete Meeting: HTTP ${x.r.status}`);
x=await request('/actions',{method:'POST',body:{title:'Package8 Action',status:'OPEN',ownerId:userId,relationshipId,meetingId,personId,organizationId}}); ok(x.r,'Action'); actionId=idOf(x.body,['action']);
x=await request('/commitments',{method:'POST',body:{title:'Package8 Commitment',status:'OPEN',ownerId:userId,relationshipId,meetingId,organizationId,dueAt:new Date(Date.now()+86400000).toISOString()}}); ok(x.r,'Commitment'); commitmentId=idOf(x.body,['commitment']);
x=await request(`/commitments/${commitmentId}`,{method:'PATCH',body:{dueAt:new Date(Date.now()+172800000).toISOString()}}); ok(x.r,'Follow-up');
x=await request('/recommendations'); ok(x.r,'Recommendation');
x=await request(`/organizations/${forbiddenOrg}`); if(![403,404].includes(x.r.status)) throw new Error(`Permission Denial: HTTP ${x.r.status}`);
console.log(JSON.stringify({result:'PASS',flow:['Login','Create Organization','Create Person','Create Relationship','Create Meeting','Complete Meeting','Create Action','Create Commitment','Follow-up','Recommendation','Permission Denial'],ids:{organizationId,targetOrganizationId,personId,relationshipId,meetingId,actionId,commitmentId}},null,2));
