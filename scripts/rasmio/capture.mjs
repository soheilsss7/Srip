/* ═══ پوستهٔ ضدگلوله — هر اتفاقی بیفتد، ردپای کاملش روی arena ذخیره می‌شود ═══ */
import { execSync, execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const BRANCH = process.env.OTP_BRANCH || 'arena/01a08a50-srip';
// Isolated, non-relaying experiment. Never imports the production crawler.
let publicProxyProbe = false;
try { publicProxyProbe = ['public-proxy-probe','public-proxy-repair-sample','linka-probe','rrk-probe','rrk-route-probe','rrk-archive-probe'].includes(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).client_payload?.mode); } catch {}
if (publicProxyProbe) {
  const { runPublicProxyProbe } = await import('./public-proxy-probe.mjs');
  const mode=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')).client_payload?.mode;
  const { files, report } = mode==='rrk-archive-probe' ? await (await import('./rrk-archive-probe.mjs')).runRrkArchiveProbe() : mode==='rrk-route-probe' ? await (await import('./rrk-route-assessment.mjs')).runRrkRouteAssessment() : mode==='rrk-probe' ? await (await import('./rrk-probe.mjs')).runRrkProbe() : mode==='linka-probe' ? await (await import('./linka-probe.mjs')).runLinkaProbe() : await runPublicProxyProbe({repairSample:mode==='public-proxy-repair-sample'});
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'proxy-probe-publish-'));
  const git = (args, env = process.env) => execFileSync('git', args, { env, encoding: 'utf8', timeout: 60000 }).trim();
  try {
    git(['config','user.name','rasmio-bot']);git(['config','user.email','actions@users.noreply.github.com']);
    let published = false;
    for (let attempt = 0; attempt < 3 && !published; attempt++) {
      git(['fetch','origin',BRANCH]);
      const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp,'index') };
      const parent = git(['rev-parse','FETCH_HEAD']);
      git(['read-tree',parent],env);
      const datasetFiles=[], receipts=[];report.datasetPublication=[];
      for(const profile of report.verifiedProfiles) {
        if(!profile.sampledFromPendingEmptyFile || !/^data\/entities\/company-\d{11}\.json$/.test(profile.entityFile || ''))continue;
        let previous=null;
        try { previous=JSON.parse(execFileSync('git',['show',`${parent}:scripts/rasmio/${profile.entityFile}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']})); }catch{}
        if(previous?.rows?.length || previous?.tables?.some(t=>t.rows?.length)) {
          report.datasetPublication.push({key:profile.key,status:'populated-remote-file-preserved'});continue;
        }
        const stored=fs.readFileSync(profile.file,'utf8'), detail=JSON.parse(stored);
        if(detail.id!==profile.key.split(':')[1] || detail.sourceRun!==report.runId || !detail.tables?.some(t=>t.rows?.length))throw new Error('Invalid proxy sample persistence');
        fs.mkdirSync('data/entities',{recursive:true});fs.writeFileSync(profile.entityFile,stored);datasetFiles.push(profile.entityFile);
        receipts.push({at:new Date().toISOString(),runId:report.runId,key:profile.key,rows:detail.rows.length,tables:profile.tables,tableRows:profile.tableRows,via:'public-proxy-curl',sha256:profile.sha256,file:profile.entityFile});
        report.datasetPublication.push({key:profile.key,status:'previously-empty-file-populated',file:profile.entityFile});
      }
      if(receipts.length) {const receiptFile=`out/verified-data-${report.runId}.jsonl`;fs.writeFileSync(receiptFile,receipts.map(r=>JSON.stringify(r)).join('\n')+'\n');datasetFiles.push(receiptFile);}
      fs.writeFileSync(files[0],JSON.stringify(report,null,2));
      git(['add','-f','--',...files,...datasetFiles],env);
      const tree = git(['write-tree'],env);
      const commit = git(['commit-tree',tree,'-p',parent,'-m',`${mode} ${report.runId}: ${report.verifiedProfiles.length} verified profile responses`],env);
      git(['update-ref',`refs/heads/${BRANCH}`,commit]);
      try { git(['push','origin',BRANCH]);published=true; } catch { if(attempt===2)throw new Error('Proxy experiment output could not be published'); }
    }
    console.log(JSON.stringify({ mode:'public-proxy-probe',attempted:report.attempts.length,echoExits:report.verifiedExitCount,profiles:report.verifiedProfiles.length,files }));
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
  process.exit(report.error ? 1 : 0);
}
let verify = false;
try { verify = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).client_payload?.mode === 'verify-data'; } catch {}
if (verify) {
  process.env.RASMIO_VERIFY = '1';
  try {
    const keys = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).client_payload?.keys;
    if (Array.isArray(keys)) process.env.RASMIO_VERIFY_KEYS = JSON.stringify(keys.filter(k => /^(company|person|product):[a-zA-Z0-9]+$/.test(k)).slice(0, 6));
  } catch {}

  process.env.RASMIO_PARALLEL = '1';
  process.env.CRAWL_LIMIT = '6';
  process.env.CRAWL_TIME_BUDGET_S = '300';
}

const sh = (c) => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).toString().trim(); } catch (e) { return 'ERR: ' + String((e && e.message) || e).slice(0, 300); } };
const dump = (tag, text) => { try { fs.mkdirSync('out', { recursive: true }); fs.appendFileSync('out/boot.log', `\n===== ${tag} @ ${new Date().toISOString()} =====\n${text}\n`); } catch {} };
const push = (tag) => {
  sh('git config user.name rasmio-bot'); sh('git config user.email actions@users.noreply.github.com');
  sh('git add -f out'); sh(`git commit -m "boot: ${tag} $(date -u +%H:%M:%S)"`);
  sh(`git fetch origin ${BRANCH}`); sh(`git rebase origin/${BRANCH}`);
  const r = sh(`git push origin HEAD:${BRANCH}`);
  dump('push-' + tag, r.slice(0, 300));
};

process.on('uncaughtException', (e) => { dump('uncaught', String((e && e.stack) || e)); push('uncaught'); process.exit(1); });
process.on('unhandledRejection', (e) => { dump('rejection', String((e && e.stack) || e)); push('rejection'); process.exit(1); });

dump('boot', [
  'node ' + process.version,
  'cwd ' + process.cwd(),
  'HEAD ' + sh('git rev-parse HEAD'),
  sh('git log --oneline -3'),
  'puppeteer نصب است؟ ' + fs.existsSync('node_modules/puppeteer'),
  'پکیج‌ها: ' + sh('ls node_modules | tr "\\n" " " | head -c 400'),
  'env: ' + Object.keys(process.env).filter((k) => /RASMIO|OTP|GITHUB_REPOSITORY|PUPPETEER/.test(k)).join(','),
].join('\n'));
push('boot');

/* ⛓ تضمین بقای زنجیره: هر اجرا در پایان (موفق یا ناموفق) یک اجرای جانشین می‌فرستد.
   اگر ظرفیت پر باشد، جانشین در شروع خودش بی‌صدا بیرون می‌رود — بدون ضرر. */
const relay = () => {
  if (verify) return;
  try {
    let tok = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
    if (!tok) {
      try {
        const gd = execSync('git rev-parse --git-dir', { stdio: ['ignore', 'pipe'] }).toString().trim();
        const cfg = fs.readFileSync(`${gd}/config`, 'utf8');
        const m = cfg.match(/basic\s+([A-Za-z0-9+/=]{20,})/i);
        if (m) tok = Buffer.from(m[1], 'base64').toString('utf8').split(':').pop();
      } catch {}
    }
    if (!tok) {
      try {
        const hdr = execSync('git config --get-all http.https://github.com/.extraheader', { stdio: ['ignore', 'pipe'] }).toString();
        const m2 = hdr.match(/basic\s+([A-Za-z0-9+/=]{20,})/i);
        if (m2) tok = Buffer.from(m2[1], 'base64').toString('utf8').split(':').pop();
      } catch {}
    }
    const repo = process.env.GITHUB_REPOSITORY || 'soheilsss7/Srip';
    if (!tok) { dump('relay', 'توکن نیست'); return; }
    // Rejected runs exit inside bot.mjs and never reach relay. Only the admitted writer schedules a successor.
    execSync(`curl -s -X POST -H "authorization: Bearer ${tok}" -H "accept: application/vnd.github+json" -H "content-type: application/json" https://api.github.com/repos/${repo}/dispatches -d '{"event_type":"rasmio-run"}'`, { stdio: 'ignore', timeout: 30_000 });
    dump('relay', 'یک جانشین فرستاده شد');
  } catch (e) { dump('relay-error', 'successor request failed; status=' + String(e?.status || 'unknown')); }
};

const productionBaseline=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
try {
  await import('./bot.mjs');
  // Independently read the published Git objects after every normal run.
  const runId=String(process.env.GITHUB_RUN_ID||'');
  if(/^\d+$/.test(runId)&&fs.existsSync(`out/proxy-transport-${runId}.json`)) {
    let audit;
    try {audit=execFileSync(process.execPath,['verify-proxy-run.mjs',productionBaseline,'HEAD',runId],{encoding:'utf8',maxBuffer:8000000,timeout:120000});}
    catch(e){audit=String(e.stdout||JSON.stringify({runId,errors:['Independent readback audit could not complete'],globalCompletionVerified:false}));}
    fs.writeFileSync(`out/production-readback-${runId}.json`,audit);
    try {const a=JSON.parse(audit);dump('production-readback',JSON.stringify({newlyNonempty:a.newlyNonempty,tableRows:a.tableRows,errors:a.errors,globalCompletionVerified:false}));}catch{dump('production-readback','invalid audit output');}
  }
  dump('bot-finished', 'ربات بدون خطا تمام شد');
  push('bot-finished');
} catch (e) {
  dump('crash', String((e && e.stack) || e));
  push('crash');
  relay();
  process.exit(1);
}
relay();
