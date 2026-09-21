import {readState,saveState,ConflictError} from './store';
import {env} from 'cloudflare:workers';
import {preparedDemoState} from './prepared-demo';
import {encodeStorage} from './storage-protection';
const lifetime=12*3600000;
async function tables(){await env.DB!.prepare('CREATE TABLE IF NOT EXISTS demo_ready_spaces(owner TEXT PRIMARY KEY,prepared INTEGER NOT NULL,claimed INTEGER)').run();await env.DB!.prepare('CREATE TABLE IF NOT EXISTS demo_sessions(id TEXT PRIMARY KEY,ip TEXT,created INTEGER,expires INTEGER)').run();}
export async function demoPoolStatus(){await tables();const now=Date.now();const available=await env.DB!.prepare('SELECT COUNT(*) AS n FROM demo_ready_spaces WHERE claimed IS NULL AND prepared>?').bind(now-lifetime).first<{n:number}>();const used=await env.DB!.prepare('SELECT COUNT(*) AS n FROM demo_ready_spaces WHERE claimed IS NOT NULL').first<{n:number}>();return {available:available?.n??0,assigned:used?.n??0,preparedLifetimeHours:12};}
export async function prepareDemoPool(target=5){
 if(!Number.isInteger(target)||target<1||target>10)throw Error('Invalid pool size');await tables();
 for(let n=0;n<target;n++){
  if((await demoPoolStatus()).available>=target)break;
  const owner='demo-'+crypto.randomUUID(),state=await preparedDemoState(),now=Date.now(),payload=await encodeStorage(owner,JSON.stringify(state));
  // The capacity predicate and the two inserts execute in one transaction.
  await env.DB!.batch([
   env.DB!.prepare('INSERT INTO workspaces(owner,payload,version) SELECT ?,?,0 WHERE (SELECT COUNT(*) FROM demo_ready_spaces WHERE claimed IS NULL AND prepared>?)<?').bind(owner,payload,now-lifetime,target),
   env.DB!.prepare('INSERT INTO demo_ready_spaces(owner,prepared,claimed) SELECT ?,?,NULL WHERE EXISTS(SELECT 1 FROM workspaces WHERE owner=?)').bind(owner,now,owner)
  ]);
 }
 return demoPoolStatus();
}
export async function claimPreparedDemo(ip:string){
 await tables();const now=Date.now();
 const limits=await env.DB!.prepare('SELECT (SELECT COUNT(*) FROM demo_sessions WHERE expires>?) AS active,(SELECT COUNT(*) FROM demo_sessions WHERE ip=? AND created>?) AS recent').bind(now,ip,now-3600000).first<{active:number;recent:number}>();
 if(!limits||limits.active>=5||limits.recent>=10)return null;
 await prepareDemoPool(3);
 for(let attempt=0;attempt<5;attempt++){
  const next=await env.DB!.prepare('SELECT owner FROM demo_ready_spaces WHERE claimed IS NULL AND prepared>? ORDER BY prepared,owner LIMIT 1').bind(now-lifetime).first<{owner:string}>();if(!next)return null;
  const result=await env.DB!.batch([
   env.DB!.prepare('INSERT OR IGNORE INTO demo_sessions(id,ip,created,expires) SELECT owner,?,?,? FROM demo_ready_spaces WHERE owner=? AND claimed IS NULL AND prepared>? AND (SELECT COUNT(*) FROM demo_sessions WHERE expires>?)<5 AND (SELECT COUNT(*) FROM demo_sessions WHERE ip=? AND created>?)<10').bind(ip,now,now+7200000,next.owner,now-lifetime,now,ip,now-3600000),
   env.DB!.prepare('UPDATE demo_ready_spaces SET claimed=COALESCE(claimed,?) WHERE owner=? AND EXISTS(SELECT 1 FROM demo_sessions WHERE id=?)').bind(now,next.owner,next.owner)
  ]);
  if(result[0].meta.changes===1)return next.owner;
 }
 return null;
}

export async function ensurePreparedWorkspace(owner:string){
 for(let attempt=0;attempt<3;attempt++){
  const {state,version}=await readState(owner);if(state.preparedDemo)return;
  const prepared=await preparedDemoState();
  state.companies.push(...prepared.companies);state.issuers.push(...prepared.issuers);state.credentials.push(...prepared.credentials);state.policies.push(...prepared.policies);state.requests.push(...prepared.requests);state.schemas.push(...prepared.schemas);state.audit.push(...prepared.audit);
  (state.demoJourneys??=[]).push(...prepared.demoJourneys!);(state.policyAutomation??=[]).push(...prepared.policyAutomation!);state.preparedDemo=prepared.preparedDemo;
  try{await saveState(owner,state,version);return;}catch(e){if(!(e instanceof ConflictError)||attempt===2)throw e;}
 }
}
