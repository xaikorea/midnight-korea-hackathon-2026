import {binding} from './store';

export async function ensureProofQueues(){
 const db=binding();
 await db.prepare('CREATE TABLE IF NOT EXISTS proof_jobs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,dedupe TEXT NOT NULL UNIQUE,created TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS program_proof_jobs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,application_id TEXT NOT NULL,created TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)').run();
 for(const table of ['proof_jobs','program_proof_jobs'])await db.prepare(`CREATE INDEX IF NOT EXISTS ${table}_work ON ${table}(json_extract(payload,'$.status'),created,id)`).run();
 await db.prepare('CREATE TABLE IF NOT EXISTS proof_worker_health(role TEXT PRIMARY KEY,last_seen INTEGER NOT NULL)').run();
}
export function proofQueuePolicy(){
 const raw=process.env.BIZPROOF_PROOF_QUEUE_LIMIT??'8';
 if(!/^[1-8]$/.test(raw))throw Error('BIZPROOF_PROOF_QUEUE_LIMIT must be 1..8');
 return {capacity:Number(raw),slotSeconds:600,consentSeconds:5400};
}
// Shared atomic INSERT predicate: both families consume the same bounded executor.
export const proofQueueCountSql=`((SELECT COUNT(*) FROM proof_jobs WHERE
 (json_extract(payload,'$.status') IN ('awaiting_approval','queued') AND json_extract(payload,'$.consentExpiresAt')>CAST(strftime('%s','now') AS INTEGER))
 OR json_extract(payload,'$.status') IN ('running','awaiting_verification')
 OR json_extract(payload,'$.revocation')='pending') +
 (SELECT COUNT(*) FROM program_proof_jobs WHERE
 (json_extract(payload,'$.status') IN ('awaiting_approval','queued') AND json_extract(payload,'$.deadline')>CAST(strftime('%s','now') AS INTEGER))
 OR json_extract(payload,'$.status') IN ('running','awaiting_verification')))`;
export const proofQueueFullMessage='체인 대기열이 혼잡합니다. 준비 기록은 보존됩니다. 대기 현황을 확인한 뒤 새 동의로 다시 요청하세요.';
export async function proofQueueFull(){const status=await proofQueueStatus();return !status.accepting;}
export async function proofQueueAdmissionLimit(){return (await proofQueueStatus()).capacity;}

type Row={id:string;owner:string;created:string;payload:string};
type QueueJob={status:string;deadline?:number;consentExpiresAt?:number;leaseExpiresAt?:number;startedAt?:string;revocation?:string;verification?:{checkedAt:string};events?:{at:string}[]};
export async function proofQueueStatus(owner?:string){
 await ensureProofQueues();const now=Date.now(),policy=proofQueuePolicy();
 const rows=await binding().prepare(`SELECT id,owner,created,payload FROM proof_jobs WHERE json_extract(payload,'$.status') IN ('awaiting_approval','queued','running','awaiting_verification') OR json_extract(payload,'$.revocation')='pending'
 UNION ALL SELECT id,owner,created,payload FROM program_proof_jobs WHERE json_extract(payload,'$.status') IN ('awaiting_approval','queued','running','awaiting_verification') ORDER BY created,id`).all<Row>();
 const active=rows.results.map(r=>({...r,job:JSON.parse(r.payload) as QueueJob})).filter(r=>r.job.revocation==='pending'||!['queued','awaiting_approval'].includes(r.job.status)||(r.job.deadline??r.job.consentExpiresAt??0)*1000>now);
 const waiting=active.filter(r=>r.job.revocation!=='pending'&&['queued','awaiting_approval'].includes(r.job.status)),running=active.filter(r=>r.job.status==='running'||(r.job.revocation==='pending'&&r.job.status!=='awaiting_verification')),verifying=active.filter(r=>r.job.status==='awaiting_verification');
 const history=await binding().prepare(`SELECT payload FROM (SELECT payload,created FROM proof_jobs WHERE json_extract(payload,'$.status')='confirmed' UNION ALL SELECT payload,created FROM program_proof_jobs WHERE json_extract(payload,'$.status')='confirmed') ORDER BY created DESC LIMIT 20`).all<{payload:string}>();
 const samples=history.results.map(r=>JSON.parse(r.payload) as QueueJob).map(j=>(Date.parse(j.verification?.checkedAt??'')-Date.parse(j.startedAt??j.events?.[0]?.at??''))/1000).filter(n=>Number.isFinite(n)&&n>0&&n<7200).sort((a,b)=>a-b);
 const observed=samples.length?samples[Math.ceil(samples.length*.9)-1]:null,slotSeconds=Math.max(policy.slotSeconds,observed?Math.ceil(observed):0);
 const capacity=Math.min(policy.capacity,Math.max(1,Math.floor((policy.consentSeconds-300)/slotSeconds)));
 const health=await binding().prepare('SELECT role,last_seen FROM proof_worker_health').all<{role:string;last_seen:number}>();
 const workers=Object.fromEntries(['executor','verifier'].map(role=>{const seen=health.results.find(r=>r.role===role)?.last_seen;return [role,{lastSeen:seen?new Date(seen).toISOString():null,recent:!!seen&&now-seen<180000}];}));
 const positions=waiting.filter(r=>owner===undefined||r.owner===owner).map(r=>{const index=waiting.indexOf(r),remainingSeconds=Math.max(0,Math.floor(((r.job.deadline??r.job.consentExpiresAt??0)*1000-now)/1000)),estimatedWaitSeconds=(index+running.length)*slotSeconds;return {id:r.id,ahead:index+running.length,estimatedWaitSeconds,remainingSeconds,expiryRisk:estimatedWaitSeconds+slotSeconds>=remainingSeconds};});
 return {capacity,waiting:waiting.length,running:running.length,verifying:verifying.length,accepting:active.length<capacity,slotSeconds,observedP90Seconds:observed,sampleCount:samples.length,oldestWaitSeconds:waiting.length?Math.max(0,Math.floor((now-Date.parse(waiting[0].created))/1000)):0,workers,positions,estimateNotice:'대기 예상은 최근 관측값과 작업당 최소 10분의 보수적 계획값입니다. 완료 시각을 보장하지 않으며 실행기 응답이 없으면 지연될 수 있습니다.'};
}
export type ProofQueueStatus=Awaited<ReturnType<typeof proofQueueStatus>>;
export async function noteProofWorker(role:'executor'|'verifier'){await ensureProofQueues();await binding().prepare('INSERT INTO proof_worker_health VALUES(?,?) ON CONFLICT(role) DO UPDATE SET last_seen=excluded.last_seen').bind(role,Date.now()).run();}

export async function orderProofWork<T extends {id:string;kind:string}>(work:T[]){
 if(!work.length)return work;
 const ids=work.map(j=>j.id),placeholders=ids.map(()=>'?').join(',');
 const rows=await binding().prepare(`SELECT id,created FROM proof_jobs WHERE id IN (${placeholders}) UNION ALL SELECT id,created FROM program_proof_jobs WHERE id IN (${placeholders})`).bind(...ids,...ids).all<{id:string;created:string}>();
 const times=new Map(rows.results.map(r=>[r.id,r.created]));
 return [...work].sort((a,b)=>(a.kind==='revoke'?0:1)-(b.kind==='revoke'?0:1)||(times.get(a.id)??'').localeCompare(times.get(b.id)??'')||a.id.localeCompare(b.id)).slice(0,20);
}
