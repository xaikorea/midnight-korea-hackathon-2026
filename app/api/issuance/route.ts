import {getChatGPTUser} from '@/app/chatgpt-auth';
import {publicDemo,requestOrigin} from '@/lib/public-demo';
import {demoWriteAllowed} from '@/lib/public-demo-guard';
import {issuerCall,issuerScope,importRemoteCredential,remoteCredentialStatus,RemoteIssuerError,remoteConfig} from '@/lib/remote-issuer';
import {readState,saveState,ConflictError} from '@/lib/store';
import {z} from 'zod';
import {digest} from '@/lib/signatures';
import {noteCredentialRevoked} from '@/lib/proof-jobs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function context(){
 const u=await getChatGPTUser();if(!u)throw new RemoteIssuerError(401,'체험 공간에 먼저 접속하세요.');
 // The demo service cannot be used by a live pilot, even by changing a request parameter.
 if(!publicDemo()||u.authMode!=='demo'||!u.userId.startsWith('demo-')||u.storageOwner!==u.userId)throw new RemoteIssuerError(403,'별도 발급 체험은 공개 합성 체험 공간에서만 제공됩니다.');
 return {...u,scope:await issuerScope(u.storageOwner,u.userId)};
}
function failure(e:unknown){if(e instanceof RemoteIssuerError)return reply({error:e.message},e.status);if(e instanceof ConflictError)return reply({error:'발급 원본은 기관에 보존되어 있습니다. 새로고침 후 지갑에 다시 받으세요.'},409);if(e instanceof z.ZodError||e instanceof SyntaxError)return reply({error:'입력 형식 또는 발급기관 응답을 확인하세요.'},400);return reply({error:'발급 처리에 실패했습니다. 현재 상태를 다시 조회하세요.'},503);}
export async function GET(){try{
 const u=await context();remoteConfig();
 const [catalog,list,{state,version}]=await Promise.all([issuerCall(u.scope,'GET','/v1/catalog'),issuerCall(u.scope,'GET','/v1/issuance-requests'),readState(u.storageOwner)]);
 const receipts=[];let changed=false;
 for(const r of state.credentialReceipts??[]){const c=state.credentials.find(c=>c.id===r.credentialId);if(!c||c.remoteBinding?.scope!==u.scope)continue;try{const status=await remoteCredentialStatus(c,r.statusRevision);if(status.body.revision>r.statusRevision){r.statusRevision=status.body.revision;changed=true;}if(status.body.status==='revoked'&&c.status!=='revoked'){c.status='revoked';c.revokedAt=status.body.checkedAt;changed=true;}receipts.push({...r,status:c.status==='revoked'?'revoked':Date.parse(c.expiresAt)<=Date.now()?'expired':'active',statusCheckedAt:status.body.checkedAt});}catch{receipts.push({...r,status:'unknown'});}}
 if(changed)await saveState(u.storageOwner,state,version);
 return reply({catalog,...list,receipts,identityMode:'simulated',transport:'separate-http-service',blockchain:'per-job-status',blockchainStatusUrl:'/api/proof-jobs'});
 }catch(e){return failure(e);}}
const command=z.object({action:z.enum(['apply','start-identity','confirm-identity','cancel-identity','submit','decide','resubmit','cancel','receive','revoke']),key:z.string().uuid(),id:z.string().max(100).optional(),identityId:z.string().uuid().optional(),documentHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),consent:z.boolean().optional(),revision:z.number().int().positive().optional(),decision:z.enum(['approve','needs_changes','reject']).optional(),reason:z.string().max(300).optional()}).strict();
export async function POST(req:Request){try{
 const u=await context();if(req.headers.get('origin')!==requestOrigin(req))throw new RemoteIssuerError(403,'같은 사이트에서 요청하세요.');
 if(!await demoWriteAllowed(u.userId))throw new RemoteIssuerError(429,'요청이 많습니다. 잠시 후 다시 시도하세요.');
 const raw=await req.text();if(raw.length>8000)throw new RemoteIssuerError(413,'요청이 너무 큽니다.');const b=command.parse(JSON.parse(raw));
 const requestId=()=>z.string().uuid().parse(b.id);
 let result:unknown;
 switch(b.action){
  case 'apply':{
   if(b.consent!==true)throw new RemoteIssuerError(400,'문서와 시뮬레이션 안내를 확인하고 동의하세요.');
   const key=async(label:string)=>{const h=await digest({key:b.key,label});return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
   const identity=await issuerCall<{id:string}>(u.scope,'POST','/v1/identity-sessions',{key:await key('identity'),mode:'simulated',documentHash:b.documentHash});
   await issuerCall(u.scope,'POST','/v1/identity-sessions/'+identity.id+'/confirm',{key:await key('consent'),documentHash:b.documentHash,consent:true});
   result=await issuerCall(u.scope,'POST','/v1/issuance-requests',{key:await key('submit'),identityId:identity.id,documentHash:b.documentHash});break;
  }
  case 'start-identity':result=await issuerCall(u.scope,'POST','/v1/identity-sessions',{key:b.key,mode:'simulated',documentHash:b.documentHash});break;
  case 'confirm-identity':case 'cancel-identity':result=await issuerCall(u.scope,'POST','/v1/identity-sessions/'+requestId()+'/'+(b.action==='confirm-identity'?'confirm':'cancel'),{key:b.key,documentHash:b.documentHash,consent:b.consent});break;
  case 'submit':result=await issuerCall(u.scope,'POST','/v1/issuance-requests',{key:b.key,identityId:b.identityId,documentHash:b.documentHash});break;
  case 'decide':result=await issuerCall(u.scope,'POST','/v1/issuance-requests/'+requestId()+'/decisions',{key:b.key,revision:b.revision,decision:b.decision,reason:b.reason??''});break;
  case 'resubmit':case 'cancel':result=await issuerCall(u.scope,'POST','/v1/issuance-requests/'+requestId()+'/'+b.action,{key:b.key,revision:b.revision,reason:b.reason??''});break;
  case 'receive':{
   const {state,version}=await readState(u.storageOwner);result=await importRemoteCredential(state,u.scope,requestId());await saveState(u.storageOwner,state,version);break;
  }
  case 'revoke':{
   const id=z.string().regex(/^remote-[a-f0-9-]{36}$/).parse(b.id);result=await issuerCall(u.scope,'POST','/v1/credentials/'+id+'/revocations',{key:b.key,reason:b.reason??''});
   // Issuer commit precedes workspace synchronization. Any failure is recoverable by a fresh status check.
   await noteCredentialRevoked(u.storageOwner,id);
   const {state,version}=await readState(u.storageOwner),c=state.credentials.find(c=>c.id===id);
   if(c){const receipt=state.credentialReceipts?.find(r=>r.credentialId===id),status=await remoteCredentialStatus(c,receipt?.statusRevision);if(status.body.status!=='revoked')throw new RemoteIssuerError(503,'기관의 취소 결과를 다시 확인해야 합니다.');if(receipt)receipt.statusRevision=status.body.revision;c.status='revoked';c.revokedAt=status.body.checkedAt;c.reason=b.reason;await saveState(u.storageOwner,state,version);}break;
  }
 }
 return reply(result);
 }catch(e){return failure(e);}}
