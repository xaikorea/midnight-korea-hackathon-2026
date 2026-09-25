import {z} from 'zod';
import {binding,readState} from './store';
import {credentialPayload,type Credential,type VerificationRequest} from './domain';
import {digest,sign} from './signatures';
import {issuerScope,verifyRemoteOriginal,remoteCredentialStatus,remoteConfig} from './remote-issuer';
import {platformKey,verifyProcessingResult} from './processing-signature';
import {deriveIssuedBinding,originalRequestSchema,publicSigningKey,verifySigned,type OriginalRequest} from '../contracts/sdk/issued-source';
import {jobEventSchema,jobReceiptSchema,jobVerificationSchema,type JobEvent,type JobReceipt,type VerificationTask} from '../contracts/sdk/proof-job-protocol';

export class ProofJobError extends Error{constructor(public status:number,message:string){super(message);}}
function fail(message:string,status=409):never{throw new ProofJobError(status,message);}
type Status='awaiting_approval'|'queued'|'running'|'awaiting_verification'|'confirmed'|'blocked'|'needs_attention'|'cancelled';
export type ProofJob={id:string;owner:string;scope:string;key:string;credentialId:string;sourceDigest:string;requests:OriginalRequest[];referenceTime:number;consentExpiresAt:number;createdAt:string;status:Status;revision:number;approvedBy?:string;approvedAt?:string;worker?:string;lease?:string;leaseExpiresAt?:number;target?:{contractAddress:string;holder:string};chainBinding?:Awaited<ReturnType<typeof deriveIssuedBinding>>;receipts:JobReceipt[];events:(JobEvent&{seq:number;at:string})[];revocation:'none'|'pending'|'confirmed';verification?:z.infer<typeof jobVerificationSchema>;verificationChallenge?:string;reason?:string};
type Row={payload:string;revision:number};
export async function proofJobTables(){await binding().prepare('CREATE TABLE IF NOT EXISTS proof_jobs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,dedupe TEXT NOT NULL UNIQUE,created TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)').run();await binding().prepare('CREATE INDEX IF NOT EXISTS proof_jobs_owner ON proof_jobs(owner,created)').run();}
export async function getProofJob(id:string){await proofJobTables();const row=await binding().prepare('SELECT payload,revision FROM proof_jobs WHERE id=?').bind(id).first<Row>();if(!row)fail('체인 작업을 찾을 수 없습니다.',404);const j=JSON.parse(row!.payload) as ProofJob;j.revision=row!.revision;return j;}
async function save(j:ProofJob){const updated=await binding().prepare('UPDATE proof_jobs SET payload=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(j),j.id,j.revision).run();if(updated.meta.changes!==1)fail('작업 상태가 변경되었습니다. 다시 조회하세요.');j.revision++;return j;}
export async function allProofJobs(owner?:string){await proofJobTables();const rows=owner?await binding().prepare('SELECT payload,revision FROM proof_jobs WHERE owner=? ORDER BY created DESC LIMIT 10').bind(owner).all<Row>():await binding().prepare('SELECT payload,revision FROM proof_jobs ORDER BY created DESC LIMIT 100').all<Row>();return rows.results.map(r=>({...JSON.parse(r.payload),revision:r.revision}) as ProofJob);}
function originalRequest(r:VerificationRequest){return originalRequestSchema.parse({id:r.id,companyId:r.companyId,policyId:r.policyId,policyHash:r.policyHash,policy:r.policy,nonce:r.nonce,expiresAt:r.expiresAt,createdAt:r.createdAt});}
async function current(j:ProofJob,allowRevoked=false){
 const {state:s}=await readState(j.owner),c=s.credentials.find(c=>c.id===j.credentialId);
 if(!c?.remoteBinding||c.remoteBinding.scope!==j.scope||await issuerScope(j.owner,j.owner)!==j.scope||c.source?.kind!=='synthetic'||await digest(credentialPayload(c))!==j.sourceDigest)fail('원본 자격 또는 체험 공간 연결이 변경되었습니다.',422);
 const original={...c,status:'active'};delete original.revokedAt;delete original.reason;
 // Expiry prevents new use but must never prevent status checks or later revocation.
 await verifyRemoteOriginal(original,j.scope,c.remoteBinding.requestId,allowRevoked?'status':'use');
 const receipt=s.credentialReceipts?.find(r=>r.credentialId===c.id),status=await remoteCredentialStatus(c,receipt?.statusRevision);
 if(!allowRevoked&&(status.body.status!=='active'||c.status!=='active'))fail('발급기관에서 취소한 자격입니다.',422);
 if(!allowRevoked){
  if(j.consentExpiresAt<=Math.floor(Date.now()/1000))fail('체인 처리 동의가 만료되었습니다. 새 동의가 필요합니다.',422);
  for(const snapshot of j.requests){const r=s.requests.find(r=>r.id===snapshot.id),p=s.presentations.find(p=>p.requestId===snapshot.id&&p.credentialId===c.id),issuer=s.issuers.find(i=>i.id===c.issuerId);
   if(!r||!['verified','rejected'].includes(r.status)||!p?.verifiedAt||!issuer||p.submittedBy!==j.owner||!await verifyProcessingResult(p,issuer)||p.credentialDigest!==j.sourceDigest||p.policyHash!==snapshot.policyHash||p.nonce!==snapshot.nonce||p.audience!==snapshot.policy.audience||await digest(originalRequest(r))!==await digest(snapshot)||await digest(r.policy)!==r.policyHash||Date.parse(r.expiresAt)<=Date.now())fail('원래 두 신청의 서명·동의·정책·상태가 변경되었습니다.',422);
  }
 }
 return {original:original as Credential,status:status.body.status};
}
export async function requestProofJob(owner:string,input:{credentialId:string;requestIds:string[];key:string;consent:boolean}){
 if(!/^demo-[a-f0-9-]{36}$/.test(owner)||input.consent!==true)fail('합성 체험 공간의 명시적 동의가 필요합니다.',403);
 await proofJobTables();const scope=await issuerScope(owner,owner),dedupe=await digest({owner,key:input.key});
 const old=await binding().prepare('SELECT id FROM proof_jobs WHERE dedupe=?').bind(dedupe).first<{id:string}>();
 if(old){const j=await getProofJob(old.id);if(j.credentialId!==input.credentialId||j.requests.map(r=>r.id).sort().join()!==[...input.requestIds].sort().join())fail('다른 요청에 사용된 중복 키입니다.');return j;}
 const {state:s}=await readState(owner),c=s.credentials.find(c=>c.id===input.credentialId);
 if(!c?.remoteBinding)fail('별도 발급기관에서 받은 자격을 선택하세요.',422);
 const requests=input.requestIds.map(id=>s.requests.find(r=>r.id===id));if(requests.length!==2||requests.some(r=>!r)||new Set(requests.map(r=>r!.policy.kind)).size!==2||new Set(requests.map(r=>r!.nonce)).size!==2)fail('구매사와 지원사업의 원래 신청 두 건이 필요합니다.',422);
 const now=Math.floor(Date.now()/1000),j:ProofJob={id:crypto.randomUUID(),owner,scope,key:input.key,credentialId:c!.id,sourceDigest:await digest(credentialPayload(c!)),requests:requests.map(r=>originalRequest(r!)),referenceTime:now,consentExpiresAt:now+5400,createdAt:new Date().toISOString(),status:'awaiting_approval',revision:0,receipts:[],events:[],revocation:'none'};
 await current(j);
 // An atomic capacity predicate also prevents concurrent duplicate work under distinct click keys.
 const lock=await digest({credentialId:j.credentialId,requests:j.requests.map(r=>r.id).sort()});
 const existing=(await allProofJobs(owner)).find(v=>v.credentialId===j.credentialId&&v.requests.map(r=>r.id).sort().join()===j.requests.map(r=>r.id).sort().join()&&!['cancelled','blocked'].includes(v.status));if(existing)return existing;
 const inserted=await binding().prepare('INSERT OR IGNORE INTO proof_jobs(id,owner,dedupe,created,payload,revision) SELECT ?,?,?,?,?,0 WHERE (SELECT COUNT(*) FROM proof_jobs WHERE owner=?)<10 AND NOT EXISTS(SELECT 1 FROM proof_jobs WHERE owner=? AND json_extract(payload,\'$.credentialId\')=? AND json_extract(payload,\'$.status\') NOT IN (\'cancelled\',\'blocked\'))').bind(j.id,owner,dedupe,j.createdAt,JSON.stringify({...j,requestLock:lock}),owner,owner,c!.id).run();
 if(inserted.meta.changes!==1)fail('이미 요청한 작업이 있거나 체험 작업 한도에 도달했습니다.');return j;
}
export async function approveProofJob(id:string,actor:string,revision:number){const j=await getProofJob(id);if(j.status!=='awaiting_approval'||j.revision!==revision)fail('승인할 작업 상태를 다시 확인하세요.');await current(j);j.status='queued';j.approvedBy=actor;j.approvedAt=new Date().toISOString();return save(j);}
export async function resumeProofJob(id:string,revision:number){const j=await getProofJob(id);if(j.status!=='needs_attention'||j.revision!==revision||!j.approvedAt)fail('복구할 작업 상태를 다시 확인하세요.');if(j.revocation==='none')await current(j);j.status='queued';j.leaseExpiresAt=0;j.reason='기존 실행기의 비공개 기록과 거래를 먼저 대조합니다. 미확정 거래는 재전송하지 않습니다.';return save(j);}
export async function cancelProofJob(id:string,owner?:string){const j=await getProofJob(id);if(owner&&j.owner!==owner)fail('작업을 찾을 수 없습니다.',404);if(!['awaiting_approval','queued'].includes(j.status))fail('진행 중인 거래를 자동 취소할 수 없습니다. 처리 기록을 확인하세요.');j.status='cancelled';return save(j);}
export async function noteCredentialRevoked(owner:string,credentialId:string){
 for(const job of await allProofJobs(owner)){
  if(job.credentialId!==credentialId)continue;
  for(let n=0;n<4;n++){
   const j=await getProofJob(job.id);
   // Repeated issuer polling must not overwrite a running revocation verification
   // or race every heartbeat by incrementing an already synchronized revision.
   if(j.revocation==='confirmed'||j.revocation==='pending'||!j.target&&['blocked','cancelled'].includes(j.status))break;
   j.revocation=j.target?'pending':'none';if(j.status!=='cancelled')j.status='blocked';j.reason='발급기관 취소 · 새 증명과 재사용 차단';
   try{await save(j);break;}catch(e){if(!(e instanceof ProofJobError)||n===3)throw e;}
  }
 }
}
export async function refreshProofJob(j:ProofJob){
 let unknown=false;
 try{const result=await current(j,true);if(result.status==='revoked'&&j.revocation!=='confirmed'){await noteCredentialRevoked(j.owner,j.credentialId);j=await getProofJob(j.id);}}catch{unknown=true;}
 if(j.leaseExpiresAt&&j.leaseExpiresAt<Date.now()&&(j.status==='running'||j.status==='blocked'&&j.revocation==='pending')){j.status='needs_attention';j.reason='실행기 연결이 끊겼습니다. 기존 거래를 확인하기 전 재전송하지 않습니다.';return save(j);}
 if(['awaiting_approval','queued'].includes(j.status)&&j.revocation==='none'&&j.consentExpiresAt<=Math.floor(Date.now()/1000)){j.status='blocked';j.reason='체인 처리 동의가 만료되었습니다. 새 동의로 다시 요청하세요.';return save(j);}return unknown?{...j,currentStatus:'unknown'}:j;
}
export function publicProofJob(j:ProofJob&{currentStatus?:string}){return {id:j.id,credentialId:j.credentialId,sourceDigest:j.sourceDigest,requests:j.requests.map(r=>({id:r.id,kind:r.policy.kind,audience:r.policy.audience,policyHash:r.policyHash})),createdAt:j.createdAt,consentExpiresAt:j.consentExpiresAt,status:j.status,revision:j.revision,approvedAt:j.approvedAt,contractAddress:j.target?.contractAddress,events:j.events,receipts:j.receipts,revocation:j.revocation,verification:j.verification,reason:j.reason,currentStatus:j.currentStatus??'checked',network:'undeployed',environment:'Local Devnet'};}
export async function claimProofJob(worker:string,id?:string){
 const jobs=id?[await getProofJob(id)]:await allProofJobs();
 for(let j of jobs){j=await refreshProofJob(j);if(['awaiting_verification','needs_attention','cancelled'].includes(j.status)||j.leaseExpiresAt&&j.leaseExpiresAt>Date.now())continue;const revoke=j.revocation==='pending'&&!!j.target&&!!j.approvedAt;
  if(!revoke&&j.status!=='queued')continue;
  if(!revoke)try{await current(j);}catch{j.status='blocked';j.reason='원본·기관 상태·동의를 다시 확인해야 합니다.';await save(j);continue;}
  j.worker=worker;j.lease=crypto.randomUUID();j.leaseExpiresAt=Date.now()+180000;j.status=revoke?'blocked':'running';
  try{await save(j);return {id:j.id,scope:j.scope,lease:j.lease,kind:revoke?'revoke':'proof',target:j.target,sourceDigest:j.sourceDigest};}catch(e){if(!(e instanceof ProofJobError))throw e;}
 }return null;
}
// Work discovery carries no original attributes and does not grant approval or a lease.
export async function availableProofWork(role:'executor'|'verifier'){
 await proofJobTables();
 const condition=role==='verifier'?"json_extract(payload,'$.status')='awaiting_verification'":"(json_extract(payload,'$.status') IN ('queued','running') OR (json_extract(payload,'$.status')='blocked' AND json_extract(payload,'$.revocation')='pending'))";
 const rows=await binding().prepare("SELECT payload,revision FROM proof_jobs WHERE json_extract(payload,'$.approvedAt') IS NOT NULL AND "+condition+" ORDER BY created ASC LIMIT 20").all<Row>();
 const work:{id:string;kind:'proof'|'revoke'}[]=[];
 for(const row of rows.results){
  const original={...JSON.parse(row.payload),revision:row.revision} as ProofJob;
  const j=await refreshProofJob(original);
  if('currentStatus' in j&&j.currentStatus==='unknown')continue;
  if(role==='verifier'?j.status!=='awaiting_verification':j.status!=='queued'&&!(j.status==='blocked'&&j.revocation==='pending'))continue;
  if(role==='executor'&&j.leaseExpiresAt&&j.leaseExpiresAt>Date.now())continue;
  work.push({id:j.id,kind:j.revocation==='pending'?'revoke':'proof'});
 }
 return {jobs:work,network:'undeployed' as const};
}
function requireLease(j:ProofJob,worker:string,lease:string){if(j.worker!==worker||j.lease!==lease||!j.leaseExpiresAt||j.leaseExpiresAt<Date.now())fail('실행 권한이 만료되었거나 다른 실행기가 소유하고 있습니다.',403);}
export async function proofWorkerCommand(worker:string,raw:unknown){
 const b=z.object({action:z.enum(['heartbeat','bind','source','event','receipt','submitted','failed']),id:z.string().uuid(),lease:z.string().uuid(),target:z.object({contractAddress:z.string().regex(/^[a-f0-9]{64}$/),holder:z.string().regex(/^[a-f0-9]{64}$/)}).strict().optional(),event:jobEventSchema.optional(),receipt:jobReceiptSchema.optional()}).strict().parse(raw);
 const j=await getProofJob(b.id);requireLease(j,worker,b.lease);
 if(b.action==='heartbeat'){j.leaseExpiresAt=Date.now()+180000;await save(j);return {active:j.status==='running'||j.revocation==='pending',revocation:j.revocation};}
 if(b.action==='bind'){if(!b.target)fail('계약 연결 필요');if(j.target&&await digest(j.target)!==await digest(b.target))fail('기존 계약과 보유자 연결을 바꿀 수 없습니다.');j.target=b.target;return publicProofJob(await save(j));}
 if(b.action==='source'){
  if(!j.target||j.status!=='running'||j.revocation!=='none')fail('새 증명을 실행할 수 없는 작업입니다.',422);
  const {original}=await current(j),key=platformKey(),chain=await deriveIssuedBinding(original,j.requests,j.referenceTime,j.target,Math.floor(Date.now()/1000),j.consentExpiresAt);
  // Preserve the initial chain deadline/attestation lifetime across fresh status checks.
  if(j.chainBinding){chain.requests=j.chainBinding.requests;chain.claims=j.chainBinding.claims;}
  if(!j.chainBinding){j.chainBinding=chain;await save(j);}
  const body={context:'bizproof:midnight:issued-source:v2' as const,jobId:j.id,keyId:key.keyId,scope:j.scope,referenceTime:j.referenceTime,consentExpiresAt:j.consentExpiresAt,original,originalRequests:j.requests,binding:chain};return {body,signature:await sign(key.privateKey,body)};
 }
 if(b.action==='event'){if(!b.event)fail('처리 단계 필요');if(j.events.length<400)j.events.push({...b.event!,seq:j.events.length+1,at:new Date().toISOString()});}
 if(b.action==='receipt'){const r=b.receipt;if(!r||j.target&&r.contractAddress!==j.target.contractAddress)fail('계약·영수증 연결 불일치');const old=j.receipts.find(x=>x.txId===r!.txId);if(old&&await digest(old)!==await digest(r))fail('영수증 원본 불일치');if(!old){if(j.receipts.length>=30)fail('영수증 한도');j.receipts.push(r!);}}
 if(b.action==='submitted'){
  if(!j.target||!j.chainBinding)fail('원본 연결이 없는 작업입니다.');
  const revoking=j.revocation==='pending';if(!revoking&&j.receipts.filter(r=>r.operation==='submit').length!==2||revoking&&!j.receipts.some(r=>r.operation==='revokeCredential'))fail('확정 영수증을 먼저 저장하세요.');
  if(!revoking)await current(j);j.status='awaiting_verification';j.verificationChallenge=crypto.randomUUID();j.leaseExpiresAt=0;
 }
 if(b.action==='failed'){j.status='needs_attention';j.reason='실행이 중단되었습니다. 기존 계약·거래를 대조하기 전 자동 재전송하지 않습니다.';j.leaseExpiresAt=0;}
 return publicProofJob(await save(j));
}
export async function verificationTask(id:string):Promise<VerificationTask>{const j=await getProofJob(id);if(j.status!=='awaiting_verification'||!j.chainBinding||!j.verificationChallenge)fail('독립 검증 대기 상태가 아닙니다.');return {jobId:j.id,scope:j.scope,sourceDigest:j.sourceDigest,binding:j.chainBinding,receipts:j.receipts,revocation:j.revocation==='pending',challenge:j.verificationChallenge};}
export async function completeProofVerification(raw:unknown){
 const e=z.object({body:jobVerificationSchema,signature:z.string().min(80).max(100)}).strict().parse(raw),b=e.body,config=process.env.BIZPROOF_PROOF_VERIFIER_TRUST;if(!config)fail('검증기 신뢰 키가 설정되지 않았습니다.',503);
 await verifySigned(publicSigningKey.parse(JSON.parse(config)),b,e.signature);
 const j=await getProofJob(b.jobId),task=await verificationTask(j.id);
 if(b.challenge!==task.challenge||b.taskDigest!==await digest(task)||b.sourceDigest!==j.sourceDigest||b.contractAddress!==j.target?.contractAddress||b.receiptsVerified!==j.receipts.length||Date.parse(b.checkedAt)>Date.now()+5000||Date.parse(b.checkedAt)<Date.now()-60000||b.revoked!==task.revocation)fail('독립 검증의 원본·작업·시각 연결이 일치하지 않습니다.',422);
 if(!task.revocation){if(b.results.length!==2)fail('두 기관 결과가 필요합니다.');for(const r of task.binding.requests)if(!b.results.some(x=>x.id===r.id&&x.requestId===r.requestId&&x.policyHash===r.policyHash))fail('원래 요청과 체인 결과가 다릅니다.');await current(j);j.status='confirmed';}
 else {if((await current(j,true)).status!=='revoked')fail('기관 취소와 체인 취소가 일치하지 않습니다.');j.status='blocked';j.revocation='confirmed';}
 j.verification=b;delete j.verificationChallenge;j.reason=task.revocation?'기관 취소와 체인 취소를 모두 확인했습니다.':undefined;
 if(j.events.length<400)j.events.push({stage:'indexer',status:'complete',seq:j.events.length+1,at:new Date().toISOString()});
 return publicProofJob(await save(j));
}
export function proofWorkerTrust(){return {platform:{keyId:platformKey().keyId,publicKey:platformKey().publicKey},issuer:remoteConfig().trust};}
