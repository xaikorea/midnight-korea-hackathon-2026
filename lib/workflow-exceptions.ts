import {z} from 'zod';
import {type State,companyInput,type AccessRequest} from './domain';
import {ApplicationError,prepareApplication} from './application-flow';
import {type BusinessActor,requireBusinessAccess,operational} from './business-access';
import {requireEvidenceAccess,accessConfig} from './openfga-runtime';
import {fgaClient,fgaUser,fgaCompany,fgaWorkspace,FgaError} from './openfga';
import {issueAuthority} from './authority';
import {requireReviewedCredential} from './business-assurance';
const reason=z.string().trim().min(3).max(500);
const fail=(message:string,status=422):never=>{throw new ApplicationError(status,message)};
const event=(actor:string,status:string,reason:string,evidenceIds?:string[])=>({at:new Date().toISOString(),actor,status,reason,...(evidenceIds?{evidenceIds:[...evidenceIds]}:{})});
export async function workflowAction(s:State,ctx:BusinessActor,action:string,b:Record<string,unknown>){
 const now=new Date().toISOString();
 const requester=()=>{if(!['company','admin'].includes(ctx.role))fail('신청 기업 역할에서 요청하세요.',403)};
 if(action==='reapprove-legacy-company-access'){
  if(ctx.role!=='admin')fail('관리자만 재검토할 수 있습니다.',403);
  const r=(s.accessRequests??[]).find(r=>r.id===b.id);if(!r)fail('요청을 찾을 수 없습니다.',404);
  const item=r!;
  if(item.kind!=='company'||item.status!=='provisioning'||item.approval||!item.companyId)fail('승인 기록이 없는 기존 기업 연결 요청만 재검토할 수 있습니다.',409);
  const c=s.companies.find(c=>c.id===item.companyId);if(!c)fail('연결할 기업을 찾을 수 없습니다.',404);
  await requireBusinessAccess(ctx,item.companyId!,true);
  if(c!.accountStatus==='suspended')fail('중지된 기업에는 접근 권한을 연결할 수 없습니다.');
  if(!item.companyData?.registration||item.companyData.registration!==c!.registration)fail('기존 요청과 기업 식별번호가 일치하지 않습니다.',409);
  const note=reason.parse(b.reason);if(b.confirmed!==true)fail('기존 승인 기록과 신청자의 소속·업무 범위를 다시 확인하세요.',400);
  // Never infer bootstrap privileges from legacy data or accept approval scope from the client.
  item.approval={actor:ctx.actor,owner:ctx.owner,companyId:c!.id,requester:item.actor,newCompany:false,at:now};
  item.decision=note;item.history.push(event(ctx.actor,'provisioning','기존 요청 재승인: '+note));return item;
 }
 if(action==='request-company-access'||action==='request-authority-access'){
  requester();const kind=action==='request-company-access'?'company':'authority';
  const input=z.object({holder:z.string().trim().min(2).max(80),title:z.string().trim().min(2).max(80),reason}).parse(b);
  let companyData:AccessRequest['companyData'],companyId:string|undefined,credentialId:string|undefined,policyId:string|undefined;
  if(kind==='company')companyData=companyInput.parse(b.data);
  else{companyId=z.string().parse(b.companyId);policyId=z.string().parse(b.policyId);credentialId=z.string().parse(b.credentialId);await requireBusinessAccess(ctx,companyId,true);const preview=await prepareApplication(s,ctx,{companyId,policyId});if(!preview.authorityCandidates.some(c=>c.id===credentialId)&&!preview.candidates.some(c=>c.id===credentialId))fail('권한을 연결할 유효한 자격을 다시 확인하세요.');}
  const same=(s.accessRequests??[]).find(r=>r.actor===ctx.actor&&r.kind===kind&&['pending','provisioning'].includes(r.status)&&(kind==='company'?r.companyData?.registration===companyData!.registration:r.credentialId===credentialId&&r.policyId===policyId));if(same)return same;
  const r:AccessRequest={id:'access-'+crypto.randomUUID(),kind,actor:ctx.actor,...input,createdAt:now,status:'pending',companyData,companyId,credentialId,policyId,history:[event(ctx.actor,'pending',input.reason)]};(s.accessRequests??=[]).push(r);return r;
 }
 if(['decide-access-request','cancel-access-request'].includes(action)){
  const r=(s.accessRequests??[]).find(r=>r.id===b.id);if(!r)fail('요청을 찾을 수 없습니다.',404);
  const item=r!;
  if(action==='cancel-access-request'){requester();if(item.actor!==ctx.actor)fail('본인의 요청만 철회할 수 있습니다.',403);if(item.status!=='pending')fail('대기 요청만 철회할 수 있습니다.',409);item.status='cancelled';item.history.push(event(ctx.actor,item.status,'신청자 철회'));return item;}
  if(ctx.role!=='admin'&&(ctx.role!=='issuer'||item.kind!=='authority'))fail('담당 관리자만 검토할 수 있습니다.',403);
  if(item.companyId)await requireBusinessAccess(ctx,item.companyId,true);
  const decision=z.enum(['approve','reject']).parse(b.decision);const note=reason.parse(b.reason);
  if(item.status==='approved'&&decision==='approve')return item;
  if(item.status!=='pending')fail('요청 상태가 변경되었습니다.',409);
  if(decision==='reject'){item.status='rejected';item.decision=note;item.history.push(event(ctx.actor,item.status,note));return item;}
  if(b.confirmed!==true)fail('신청자의 소속과 요청 근거 확인이 필요합니다.',400);
  if(item.kind==='authority'){
   const c=s.credentials.find(c=>c.id===item.credentialId),p=s.policies.find(p=>p.id===item.policyId);
   if(!c||!p||p.status!=='active'||!p.issuerIds.includes(c.issuerId))fail('현재 자격과 정책을 다시 확인하세요.');
   if(operational(ctx)){try{requireReviewedCredential(s,c!)}catch{fail('검토 근거가 있는 자격이 필요합니다.')}}
   const a=await issueAuthority(s,{credentialId:c!.id,holderUserId:item.actor,holder:item.holder,title:item.title,scope:p!.kind,days:30});item.authorityId=a.id;item.status='approved';
  }else{
   // Resolve by registered identifier only after admin confirmation; no applicant resource enumeration.
   let c=s.companies.find(c=>c.registration===item.companyData!.registration);const newCompany=!c;
   if(c){await requireBusinessAccess(ctx,c.id,true);if(c.accountStatus==='suspended')fail('중지된 기업에는 접근 권한을 연결할 수 없습니다.');}
   else{c={...item.companyData!,id:'company-'+item.id,createdAt:now};s.companies.push(c);}
   item.companyId=c.id;item.approval={actor:ctx.actor,owner:ctx.owner,companyId:c.id,requester:item.actor,newCompany,at:now};item.status='provisioning';
  }
  item.decision=note;item.history.push(event(ctx.actor,item.status,note));return item;
 }
 if(['decide-issuance-review','resubmit-issuance-review','withdraw-issuance-review'].includes(action)){
  const r=(s.issuanceRequests??[]).find(r=>r.id===b.id);if(!r)fail('검토 요청을 찾을 수 없습니다.',404);const item=r!;await requireBusinessAccess(ctx,item.companyId,true);
  if(z.number().int().min(0).parse(b.revision)!==(item.revision??0))fail('검토 내용이 변경되었습니다. 새로 확인하세요.',409);
  let status:typeof item.status,note:string;
  if(action==='decide-issuance-review'){
   if(!['issuer','admin'].includes(ctx.role))fail('발급 담당자만 검토할 수 있습니다.',403);if(item.status!=='pending')fail('검토 대기 상태가 아닙니다.',409);status=z.enum(['needs_changes','rejected']).parse(b.status);note=reason.parse(b.reason);
  }else{
   requester();if(item.actor!==ctx.actor)fail('본인의 요청만 변경할 수 있습니다.',403);
   if(action==='withdraw-issuance-review'){if(!['pending','needs_changes'].includes(item.status))fail('철회할 수 없는 상태입니다.',409);status='cancelled';note='신청자 철회';}
   else{if(!['needs_changes','rejected','cancelled'].includes(item.status))fail('보완·반려·철회된 요청만 다시 제출할 수 있습니다.',409);
    const p=s.policies.find(p=>p.id===item.policyId),c=s.companies.find(c=>c.id===item.companyId);if(p?.status!=='active'||!p.issuerIds.includes(item.issuerId)||s.issuers.find(i=>i.id===item.issuerId)?.status!=='active'||!c||c.accountStatus==='suspended')fail('현재 신청 대상과 발급기관을 확인하세요.');
    if((s.issuanceRequests??[]).some(r=>r.id!==item.id&&r.companyId===item.companyId&&r.policyId===item.policyId&&['pending','needs_changes'].includes(r.status)))fail('다른 진행 중인 검토 요청이 있습니다.',409);
    const ids=z.array(z.string()).min(1).max(10).parse(b.evidenceIds);if(ids.some(id=>!s.evidence.some(e=>e.id===id&&e.companyId===item.companyId)))fail('해당 기업의 증빙만 제출하세요.',403);
    await requireEvidenceAccess({userId:ctx.actor,storageOwner:ctx.owner,authMode:ctx.authMode},item.companyId,'read');note=reason.parse(b.reason);item.evidenceIds=[...new Set(ids)];status='pending';
   }
  }
  (item.history??=[]).push(event(ctx.actor,status,note,item.evidenceIds));item.status=status;item.reason=note;item.revision=(item.revision??0)+1;return item;
 }
 fail('지원하지 않는 업무 요청입니다.',400);
}
// Provisioning is persisted before any external write. Retrying resumes the same approved target.
export async function validateProvisioning(s:State,ctx:BusinessActor,r:AccessRequest){
 if(ctx.role!=='admin'||r.kind!=='company'||r.status!=='provisioning'||!r.companyId)fail('권한 연결 대상이 아닙니다.',403);
 const a=r.approval;
 if(!a)fail('승인 범위가 없는 이전 요청입니다. 관리자에게 기업 권한과 승인 기록 재확인을 요청하세요.',409);
 if(a!.actor!==ctx.actor||a!.owner!==ctx.owner||a!.companyId!==r.companyId||a!.requester!==r.actor)fail('최초 승인자와 승인 범위가 일치해야 재시도할 수 있습니다.',403);
 const c=s.companies.find(c=>c.id===r.companyId);if(!c)fail('연결할 기업을 찾을 수 없습니다.',404);
 if(c!.accountStatus==='suspended')fail('중지된 기업에는 접근 권한을 연결할 수 없습니다.');
 if(a!.newCompany){if(c!.id!=='company-'+r.id||c!.registration!==r.companyData?.registration)fail('신규 기업 최초 권한 연결의 대상이 일치하지 않습니다.',403);}
 else await requireBusinessAccess(ctx,r.companyId!,true);
}
export async function provisionCompanyAccess(s:State,ctx:BusinessActor,r:AccessRequest){
 await validateProvisioning(s,ctx,r);
 if(ctx.role!=='admin'||r.kind!=='company'||r.status!=='provisioning'||!r.companyId)fail('권한 연결 대상이 아닙니다.',403);
 const config=accessConfig();if(!config){if(operational(ctx))throw new FgaError();return;}
 const client=fgaClient(config),user=fgaUser(r.actor),object=fgaCompany(ctx.owner,r.companyId!);
 if(!await client.check(user,'company',fgaWorkspace(ctx.owner)))fail('신청자의 공동 공간 기업 역할을 먼저 연결하세요.',403);
 const users=[...new Set([user,fgaUser(r.approval!.actor)])];const tuples=users.flatMap(user=>[{user,relation:'business_writer',object},{user,relation:'writer',object}]);
 const missing=[];for(const t of tuples)if(!await client.check(t.user,t.relation,t.object))missing.push(t);
 if(missing.length){try{const response=await fetch(config.address+`/stores/${config.storeId}/write`,{method:'POST',headers:{'Content-Type':'application/json',...(config.token?{Authorization:'Bearer '+config.token}:{})},body:JSON.stringify({authorization_model_id:config.modelId,writes:{tuple_keys:missing}}),redirect:'error',signal:AbortSignal.timeout(5000)});await response.body?.cancel();if(!response.ok)throw new FgaError();}catch{throw new FgaError();}}
 for(const relation of ['can_write_business','can_write_evidence'])if(!await client.check(user,relation,object))throw new FgaError();
}

