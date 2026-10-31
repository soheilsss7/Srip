// Scheduling only: endpoint health is never evidence that a destination permits access.
export const HEALTH_FRESH_MS=15*60*1000;
export function endpointEligible(record, availableExit, now=Date.now()) {
  if(!record)return true;
  if(record.retryAfter>now)return false;
  // Refresh dynamic endpoints eventually, but don't pay for the same exhausted exit every run.
  if(record.observedExitIP && now-record.checkedAt<HEALTH_FRESH_MS && !availableExit(record.observedExitIP))return false;
  return true;
}
export function healthSuccess(previous,ip,now=Date.now()) {
  return {observedExitIP:ip,checkedAt:now,failures:0,retryAfter:0};
}
export function healthFailure(previous,now=Date.now()) {
  const failures=Math.min((previous?.failures||0)+1,8);
  return {...previous,checkedAt:now,failures,retryAfter:now+Math.min(30,2**failures)*60*1000};
}
export function newestRunFirst(a,b) {
  const run=s=>Number(s.match(/-(\d+)\.json$/)?.[1]||0);
  return run(b)-run(a)||b.localeCompare(a);
}
