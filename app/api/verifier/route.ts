import {requireBusinessAccess,visibleBusinessState} from '@/lib/business-access';
import {FgaError} from '@/lib/openfga';
import {env} from 'cloudflare:workers';
import {getChatGPTUser,getActiveRole} from '@/app/chatgpt-auth';
import {readState,saveState,ConflictError} from '@/lib/store';
import {issuerDid} from '@/lib/portable-credential';
import {enterpriseQuery,verifierConfig,waltidClient,sessionView,verifierNotice,type VerifierSession} from '@/lib/waltid-verifier';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const config=()=>verifierConfig({address:env.WALTID_VERIFIER_URL,publicOrigin:env.WALTID_VERIFIER_PUBLIC_ORIGIN,token:env.WALTID_VERIFIER_TOKEN});
async function access(){const user=await getChatGPTUser(),role=await getActiveRole();return user&&role&&['admin','buyer','grant'].includes(role)?{user,role}:null;}
export async function GET(){const ctx=await access();if(!ctx)return json({error:'관리자·구매사·지원기관 로그인이 필요합니다.'},403);try{const {state}=await readState(ctx.user.storageOwner);const visible=await visibleBusinessState(state,{actor:ctx.user.userId,owner:ctx.user.storageOwner,authMode:ctx.user.authMode,role:ctx.role});const ids=new Set(visible.requests.map(r=>r.id));return json({configured:!!config(),notice:verifierNotice,sessions:(state.verifierSessions??[]).filter(s=>s.actor===ctx.user.userId&&s.role===ctx.role&&ids.has(s.requestId)).map(s=>sessionView(Date.parse(s.expiresAt)<=Date.now()&&['ACTIVE','UNUSED'].includes(s.status)?{...s,status:'EXPIRED'}:s))});}catch{return json({error:'외부 검증 설정을 확인하세요.'},503);}}
export async function POST(req:Request){
 const ctx=await access();if(!ctx)return json({error:'관리자·구매사·지원기관 로그인이 필요합니다.'},403);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'허용되지 않는 출처입니다.'},403);
 try{
  const text=await req.text();if(text.length>1000)return json({error:'요청이 너무 큽니다.'},413);
  const input=z.discriminatedUnion('action',[z.object({action:z.literal('create'),requestId:z.string().min(1).max(160),consent:z.literal(true)}).strict(),z.object({action:z.literal('refresh'),id:z.string().uuid()}).strict()]).parse(JSON.parse(text));
  const c=config();if(!c)return json({error:'서버에 walt.id 검증 서비스를 먼저 설정하세요.'},503);
  const {state,version}=await readState(ctx.user.storageOwner);const sessions=state.verifierSessions??=[];const now=Date.now();let session:VerifierSession;
  if(input.action==='create'){
   const request=state.requests.find(r=>r.id===input.requestId&&(ctx.role==='admin'||r.policy.kind===ctx.role));
   if(!request)return json({error:'요청을 찾을 수 없습니다.'},404);
   await requireBusinessAccess({actor:ctx.user.userId,owner:ctx.user.storageOwner,authMode:ctx.user.authMode,role:ctx.role},request.companyId);if(request.status!=='pending'||Date.parse(request.expiresAt)<=now)return json({error:'진행 중인 유효한 요청만 연결할 수 있습니다.'},409);
   if(sessions.some(s=>s.requestId===request.id&&s.actor===ctx.user.userId&&Date.parse(s.expiresAt)>now&&['ACTIVE','UNUSED'].includes(s.status)))return json({error:'이미 진행 중인 외부 검증 세션이 있습니다.'},409);
   if(sessions.length>=100)return json({error:'워크스페이스 검증 세션 한도에 도달했습니다.'},409);
   const issuers=state.issuers.filter(i=>i.status==='active'&&request.policy.issuerIds.includes(i.id)).map(i=>issuerDid(i.publicKey));
   const company=state.companies.find(x=>x.id===request.companyId);if(!company||company.accountStatus==='suspended')return json({error:'신청 기업 상태를 확인하세요.'},409);
   const subject='urn:bizproof:company:'+btoa(String.fromCharCode(...new TextEncoder().encode(company.id))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
   const id=crypto.randomUUID(),expiresAt=new Date(Math.min(now+600000,Date.parse(request.expiresAt))).toISOString();
   const authorizationUrl=await waltidClient(c).create(id,expiresAt,enterpriseQuery(subject,issuers));
   session={id,actor:ctx.user.userId,role:ctx.role,requestId:request.id,policyHash:request.policyHash,expiresAt,createdAt:new Date(now).toISOString(),status:'ACTIVE',authorizationUrl};sessions.push(session);
  }else{
   const found=sessions.find(s=>s.id===input.id&&s.actor===ctx.user.userId&&s.role===ctx.role);if(!found)return json({error:'세션을 찾을 수 없습니다.'},404);session=found;
   const request=state.requests.find(r=>r.id===session.requestId);
   if(!request||request.policyHash!==session.policyHash||request.status!=='pending'||Date.parse(request.expiresAt)<=now)return json({error:'업무 요청이 변경되거나 종료되었습니다.'},409);
   await requireBusinessAccess({actor:ctx.user.userId,owner:ctx.user.storageOwner,authMode:ctx.user.authMode,role:ctx.role},request.companyId);if(Date.parse(session.expiresAt)<=now&&['ACTIVE','UNUSED'].includes(session.status))session.status='EXPIRED';
   else if(['ACTIVE','UNUSED','UNKNOWN'].includes(session.status))Object.assign(session,await waltidClient(c).inspect(session.id));
  }
  state.audit.push({id:crypto.randomUUID(),actor:ctx.user.userId,role:ctx.role,at:new Date().toISOString(),action:'verifier.'+input.action,target:session.requestId,detail:'외부 지갑 세션 '+session.status+' · 업무 승인과 별도'});
  await saveState(ctx.user.storageOwner,state,version);return json(sessionView(session));
 }catch(e){if(e instanceof FgaError)return json({error:e.message},e.status);if(e instanceof ConflictError)return json({error:e.message},409);if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'요청 또는 외부 검증 응답 형식을 확인하세요.'},400);return json({error:'외부 검증 서버에 연결하지 못했거나 응답 검증에 실패했습니다.'},503);}
}
