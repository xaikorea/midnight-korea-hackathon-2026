import {z} from 'zod';
import {binding} from './store';
import {automaticDemoOwner} from './demo-automation';
import {digest} from './signatures';
import {issuerCall,issuerScope,RemoteIssuerError} from './remote-issuer';
import {finishDemoIssuance} from './demo-issuance';
import {intentBody} from '../services/issuer/protocol.mjs';

type Status='pending'|'running'|'retry'|'complete'|'blocked'|'needs_attention';
type Stage='identity'|'consent'|'submit'|'review'|'receive'|'complete';
type IssuerRequest={id:string;revision:number;status:string;documentHash?:string};
export type DemoIssuanceJob={id:string;owner:string;scope:string;key:string;documentHash:string;createdAt:string;expiresAt:number;status:Status;stage:Stage;attempts:number;nextAttemptAt:number;lease?:string;leaseUntil:number;identityId?:string;requestId?:string;receipt?:{credentialId:string;requestId:string;digest:string;receivedAt:string;status:string;companyId:string};reason?:string;reasonCode?:string;revision:number};
function error(status:number,message:string):never{throw new RemoteIssuerError(status,message);}
async function tables(){
 await binding().prepare('CREATE TABLE IF NOT EXISTS demo_issuance_jobs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,idem TEXT NOT NULL,created TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,UNIQUE(owner,idem))').run();
 await binding().prepare("CREATE INDEX IF NOT EXISTS demo_issuance_ready ON demo_issuance_jobs(json_extract(payload,'$.status'),created,id)").run();
}
async function get(id:string,owner?:string){await tables();const row=await binding().prepare('SELECT payload,revision FROM demo_issuance_jobs WHERE id=?').bind(id).first<{payload:string;revision:number}>();if(!row)error(404,'자동 발급 작업을 찾을 수 없습니다.');const j={...JSON.parse(row.payload),revision:row.revision} as DemoIssuanceJob;if(owner&&j.owner!==owner)error(404,'자동 발급 작업을 찾을 수 없습니다.');return j;}
async function save(j:DemoIssuanceJob){const row=await binding().prepare('UPDATE demo_issuance_jobs SET payload=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(j),j.id,j.revision).run();if(row.meta.changes!==1)error(409,'자동 발급 작업이 다른 처리기에서 변경되었습니다. 현재 상태를 조회하세요.');j.revision++;return j;}
export function publicDemoIssuanceJob(j:DemoIssuanceJob){return {id:j.id,requestId:j.requestId,createdAt:j.createdAt,expiresAt:j.expiresAt,status:j.status,stage:j.stage,attempts:j.attempts,nextAttemptAt:j.nextAttemptAt,reason:j.reason,reasonCode:j.reasonCode};}
export async function listDemoIssuanceJobs(owner:string){await tables();const rows=await binding().prepare('SELECT payload,revision FROM demo_issuance_jobs WHERE owner=? ORDER BY created DESC,id DESC LIMIT 12').bind(owner).all<{payload:string;revision:number}>();return rows.results.map(r=>({...JSON.parse(r.payload),revision:r.revision}) as DemoIssuanceJob);}
async function allowed(owner:string,scope:string){if(!automaticDemoOwner(owner)||await issuerScope(owner,owner)!==scope)error(403,'내 공개 합성 체험의 자동 발급만 처리할 수 있습니다.');}
export async function startDemoIssuanceJob(owner:string,scope:string,input:{key:string;documentHash?:string;consent?:boolean}){
 await allowed(owner,scope);z.string().uuid().parse(input.key);
 const documentHash=z.string().regex(/^[a-f0-9]{64}$/).parse(input.documentHash);
 if(input.consent!==true||documentHash!==await digest(intentBody()))error(400,'현재 합성 발급 문서와 자동 처리 범위에 동의하세요.');
 await tables();const prior=(await listDemoIssuanceJobs(owner)).find(j=>j.key===input.key||!['complete','blocked'].includes(j.status));
 if(prior){if(prior.documentHash!==input.documentHash)error(409,'동의한 문서가 다릅니다.');return prior;}
 const now=Date.now(),j:DemoIssuanceJob={id:crypto.randomUUID(),owner,scope,key:input.key,documentHash,createdAt:new Date(now).toISOString(),expiresAt:now+10*60000,status:'pending',stage:'identity',attempts:0,nextAttemptAt:now,leaseUntil:0,revision:0};
 // One atomic statement prevents two simultaneous browser tabs creating two active flows.
 const inserted=await binding().prepare("INSERT OR IGNORE INTO demo_issuance_jobs(id,owner,idem,created,payload,revision) SELECT ?,?,?,?,?,0 WHERE (SELECT COUNT(*) FROM demo_issuance_jobs WHERE owner=?)<12 AND NOT EXISTS(SELECT 1 FROM demo_issuance_jobs WHERE owner=? AND json_extract(payload,'$.status') NOT IN ('complete','blocked'))").bind(j.id,owner,j.key,j.createdAt,JSON.stringify(j),owner,owner).run();
 if(inserted.meta.changes!==1){const existing=(await listDemoIssuanceJobs(owner)).find(v=>v.key===j.key||!['complete','blocked'].includes(v.status));if(existing)return existing;error(429,'이 체험 공간의 자동 발급 한도에 도달했습니다.');}return j;
}
async function key(j:DemoIssuanceJob,label:string){const h=await digest({key:j.key,label});return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);}
function result(j:DemoIssuanceJob){return {id:j.requestId,status:j.status==='complete'?'issued':'processing',receipt:j.receipt,automatic:true,autoJob:publicDemoIssuanceJob(j)};}

export async function processDemoIssuanceJob(id:string,owner?:string){
 let j=await get(id,owner);await allowed(j.owner,j.scope);
 if(['complete','blocked','needs_attention'].includes(j.status)||j.nextAttemptAt>Date.now()||j.leaseUntil>Date.now())return result(j);
 if(j.expiresAt<=Date.now()){j.status='blocked';j.reasonCode='expired';j.reason='자동 발급 동의 10분이 만료되었습니다. 현재 기관 기록을 확인하고 다시 동의하세요.';return result(await save(j));}
 j.status='running';j.lease=crypto.randomUUID();j.leaseUntil=Date.now()+120000;j.attempts++;
 try{await save(j);}catch{return result(await get(id,owner));}
 const lease=j.lease;
 try{
  // Each external action uses a stable key. A lost acknowledgement never means create again.
  if(!j.identityId){const identity=await issuerCall<{id:string}>(j.scope,'POST','/v1/identity-sessions',{key:await key(j,'identity'),mode:'simulated',documentHash:j.documentHash});j.identityId=identity.id;j.stage='consent';await save(j);}
  if(!j.requestId){
   await issuerCall(j.scope,'POST',`/v1/identity-sessions/${j.identityId}/confirm`,{key:await key(j,'consent'),documentHash:j.documentHash,consent:true});j.stage='submit';await save(j);
   const request=await issuerCall<IssuerRequest>(j.scope,'POST','/v1/issuance-requests',{key:await key(j,'submit'),identityId:j.identityId,documentHash:j.documentHash});j.requestId=request.id;j.stage='review';await save(j);
  }
  const request=await issuerCall<IssuerRequest>(j.scope,'GET',`/v1/issuance-requests/${j.requestId}`);
  if(request.documentHash!==j.documentHash||!['submitted','issued'].includes(request.status)||request.status==='submitted'&&request.revision!==1)error(422,'보완·반려·철회·재심사된 신청은 자동 승인하지 않습니다. 기관 기록을 확인하세요.');
  if(j.expiresAt<=Date.now())error(422,'자동 발급 동의가 만료되었습니다. 현재 기록을 확인하고 다시 동의하세요.');
  j.stage=request.status==='issued'?'receive':'review';await save(j);
  const issued=await finishDemoIssuance(j.owner,j.scope,request);j.receipt=issued.receipt;j.stage='complete';j.status='complete';j.reason=undefined;j.reasonCode=undefined;j.leaseUntil=0;await save(j);
 }catch(e){
  const current=await get(id,owner);if(current.lease!==lease)return result(current);j=current;
  const retryable=!(e instanceof RemoteIssuerError)||e.status>=500||e.status===429;
  j.status=retryable?(j.attempts<6?'retry':'needs_attention'):'blocked';j.leaseUntil=0;j.nextAttemptAt=Date.now()+Math.min(120,15*2**Math.max(0,j.attempts-1))*1000;
  j.reasonCode=retryable?'transport':'requires-review';j.reason=retryable?(j.status==='retry'?'발급 서버 연결을 다시 확인합니다. 같은 신청으로 자동 재시도하며 창을 닫아도 기록을 보존합니다.':'자동 재시도 한도에 도달했습니다. 연결을 확인한 뒤 같은 작업을 이어가세요.'):'현재 기관 기록·문서·동의 상태를 확인해야 합니다. 자동 승인하지 않습니다.';await save(j);
 }
 return result(j);
}
export async function resumeDemoIssuanceJob(owner:string,id:string){
 const j=await get(id,owner);await allowed(owner,j.scope);
 if(!['retry','needs_attention','pending'].includes(j.status))error(409,'자동 재개 가능한 상태가 아닙니다. 기관 기록을 확인하세요.');
 if(j.expiresAt<=Date.now())error(409,'자동 발급 동의 10분이 만료되었습니다. 현재 신청을 확인한 뒤 새로 동의하세요.');
 j.status='retry';j.nextAttemptAt=Date.now();j.attempts=0;j.leaseUntil=0;await save(j);return processDemoIssuanceJob(id,owner);
}
export async function recoverDemoIssuanceJobs(){
 if(process.env.BIZPROOF_PUBLIC_DEMO!=='true'||process.env.BIZPROOF_DEMO_AUTO_RUN!=='true')return;
 await tables();const rows=await binding().prepare("SELECT id FROM demo_issuance_jobs WHERE json_extract(payload,'$.status') IN ('pending','running','retry') AND json_extract(payload,'$.leaseUntil')<=? AND json_extract(payload,'$.nextAttemptAt')<=? ORDER BY created,id LIMIT 3").bind(Date.now(),Date.now()).all<{id:string}>();
 for(const r of rows.results)await processDemoIssuanceJob(r.id);
}
