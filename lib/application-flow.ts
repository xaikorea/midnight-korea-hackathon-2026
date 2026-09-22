import type {ProcessObserver} from './process-types';
import {applicationStatus,applicationStatusCopy} from './application-status';
import {type State,type Policy,type Credential,type Presentation,type VerificationRequest,credentialPayload,presentationPayload,evaluate,statusOf} from './domain';
import {inspectCredential} from './credential-family';
import {checkAuthority} from './authority';
import {requireReviewedCredential} from './business-assurance';
import {digest,sign,verify} from './signatures';
import {evaluateSubmission,policyEngineMode} from './policy-engine';
import {type BusinessActor,operational,requireBusinessAccess} from './business-access';
export class ApplicationError extends Error {constructor(public status:number,message:string){super(message);}}
const error=(message:string,status=422):never=>{throw new ApplicationError(status,message);};
export type ApplicationChoice={companyId:string;policyId:string;credentialId?:string};
export async function prepareApplication(s:State,ctx:BusinessActor,choice:ApplicationChoice,observe?:ProcessObserver){
 if(!['company','admin'].includes(ctx.role))error('신청 기업 역할에서 제출하세요.',403);
 await requireBusinessAccess(ctx,choice.companyId);
 await observe?.('credential','running','신청 대상 상태와 기업의 자격·발급기관·서명·취소·만료 상태를 검사합니다.');
 const company=s.companies.find(c=>c.id===choice.companyId),policy=s.policies.find(p=>p.id===choice.policyId);
 if(!company||!policy)error('기업 또는 신청 대상을 찾을 수 없습니다.',404);
 if(company!.accountStatus==='suspended'||policy!.status!=='active')error('현재 신청할 수 없는 기업 또는 종료된 신청 대상입니다.');
 const p=policy!;const candidates=[];const authorityCandidates=[];let unavailableReason="missing_credential";
 for(const c of s.credentials.filter(c=>c.companyId===choice.companyId)){
  if((s.walletEntries??[]).some(e=>e.credentialId===c.id&&e.archived)){unavailableReason='archived';continue;}if(!p.issuerIds.includes(c.issuerId)){unavailableReason='issuer_untrusted';continue;}
  const inspection=await inspectCredential(s,c);
  await observe?.('credential',inspection.valid?'success':'failed','자격의 서명·신뢰·상태·스키마·기업 연결 검사',{credentialId:c.id,issuerId:c.issuerId,schemaId:c.schemaId,keyId:c.keyId,checks:inspection.checks});
  if(!inspection.valid){unavailableReason='credential_invalid';continue;}
  if(operational(ctx)){try{requireReviewedCredential(s,c);}catch{continue;}}
  const authorities=[];
  for(const a of s.authorities??[]){if(a.credentialId===c.id&&a.holderUserId===ctx.actor&&a.scope===p.kind&&(await checkAuthority(s,a,c.companyId,p.kind)).valid)authorities.push(a);}
  authorities.sort((a,b)=>b.expiresAt.localeCompare(a.expiresAt)||a.id.localeCompare(b.id));
  if(operational(ctx)&&!authorities.length){authorityCandidates.push({id:c.id,issuerId:c.issuerId,expiresAt:c.expiresAt});continue;}
  candidates.push({id:c.id,issuerId:c.issuerId,expiresAt:c.expiresAt,authorityId:authorities[0]?.id,authorityHolder:authorities[0]?.holder,authorityTitle:authorities[0]?.title,...evaluate(c.claims,p)});
 }
 // Prefer satisfying credentials; conflicting attributes still require an explicit choice.
 const preferred=candidates.some(c=>c.eligible)?candidates.filter(c=>c.eligible):candidates;
 preferred.sort((a,b)=>b.expiresAt.localeCompare(a.expiresAt)||a.id.localeCompare(b.id));
 const distinct=new Set(await Promise.all(preferred.map(c=>digest(s.credentials.find(v=>v.id===c.id)!.claims))));
 const needsChoice=distinct.size>1&&!choice.credentialId;
 const selected=choice.credentialId?candidates.find(c=>c.id===choice.credentialId):needsChoice?undefined:preferred[0];
 if(choice.credentialId&&!selected)error('선택한 자격을 현재 사용할 수 없습니다. 다시 확인하세요.');
 await observe?.('credential',selected?'success':needsChoice?'waiting':'failed',selected?'사용할 기업 자격을 연결했습니다.':needsChoice?'내용이 다른 자격 중 선택이 필요합니다.':'신청에 사용할 유효 자격 또는 담당자 권한이 없습니다.',{candidateCount:candidates.length,credentialId:selected?.id,authorityId:selected?.authorityId,operational:operational(ctx)});
 const auto=!!s.policyAutomation?.find(a=>a.policyId===p.id)?.enabled;
 const credential=selected?s.credentials.find(c=>c.id===selected.id)!:undefined;
 const previewHash=await digest({actor:ctx.actor,companyId:company!.id,policy:p,auto,credential:credential?credentialPayload(credential):null,signature:credential?.signature,authority:selected?.authorityId?s.authorities?.find(a=>a.id===selected.authorityId):null});
 return {reasonCode: selected?'ready':needsChoice?'credential_choice':authorityCandidates.length?'missing_authority':unavailableReason,authorityCandidates,companyId:company!.id,companyName:company!.name,policyId:p.id,title:p.name,audience:p.audience,kind:p.kind,autoVerify:auto,candidates,selected,needsChoice,ready:!!selected,previewHash,shared:['기업 식별 정보','조건별 충족 여부','요청·정책 식별값','발급기관·서명·유효기간',...(selected?.authorityId?['담당자 이름·역할·업무 범위']:[])],excluded:['정확한 매출·설립일 원본','증빙 파일'],reason:needsChoice?'내용이 서로 다른 자격이 있습니다. 사용할 자격을 확인하세요.':!selected?(operational(ctx)?'검토된 유효 자격과 본인에게 연결된 업무 권한이 필요합니다.':'이 대상에서 인정하는 유효 자격이 없습니다. 보유 자격·발급기관 또는 증빙을 확인하세요.'):'',notice:'서버는 원본 속성을 처리합니다. 조건 결과로 일부 범위를 추론할 수 있습니다.'};
}
export type ApplicationPreview=Awaited<ReturnType<typeof prepareApplication>>;
export async function submitApplication(s:State,ctx:BusinessActor,input:ApplicationChoice&{key:string;previewHash:string;consent:boolean},observe?:ProcessObserver){
 await observe?.('access','running','기업의 쓰기 권한과 명시적인 공유 동의를 확인합니다.');
 if(!['company','admin'].includes(ctx.role))error('신청 기업 역할에서 제출하세요.',403);
 await requireBusinessAccess(ctx,input.companyId,true);
 if(input.consent!==true)error('공유 내용을 확인하고 제출에 동의하세요.',400);
 await observe?.('access','success','역할·기업 접근 권한·공유 동의를 확인했습니다.',{operational:operational(ctx)});
 const previous=s.applicationSubmissions?.find(v=>v.key===input.key&&v.actor===ctx.actor);
 if(previous){if(previous.companyId!==input.companyId||previous.policyId!==input.policyId||previous.previewHash!==input.previewHash)error('다른 제출에 사용한 요청 식별값입니다.',409);await observe?.('request','success','같은 요청 키의 기존 접수를 반환합니다. 새 제출이나 서명을 만들지 않습니다.',{requestId:previous.requestId,presentationId:previous.presentationId,replayed:true});return applicationReceipt(s,previous.requestId,true);}
 const preview=await prepareApplication(s,ctx,input,observe);
 if(!preview.ready)error(preview.reason);
 await observe?.('consent','running','확인한 공유 내용과 현재 자격·권한·정책을 해시로 대조합니다.');
 if(preview.previewHash!==input.previewHash)error('자격·권한·신청 조건이 변경되었습니다. 공유 내용을 다시 확인하세요.',409);
 await observe?.('consent','success','사용자가 동의한 내용과 현재 처리 내용이 일치합니다.',{previewHash:input.previewHash});
 await observe?.('request','running','중복 신청과 만료 상태를 확인하고 기관별 요청을 연결합니다.');
 const at=new Date().toISOString(),policy=s.policies.find(p=>p.id===input.policyId)!,c=s.credentials.find(c=>c.id===preview.selected!.id)!,issuer=s.issuers.find(i=>i.id===c.issuerId)!;
 // One active application per company and target, even if a caller supplies a fresh key.
 const existing=s.requests.find(r=>r.companyId===c.companyId&&r.policyId===policy.id&&['submitted','verified'].includes(r.status)&&applicationStatus(r,s.presentations.find(p=>p.requestId===r.id))!=='expired'&&Date.parse(r.expiresAt)>Date.now());
 if(existing)error('이미 제출한 신청이 있습니다. 진행 현황에서 확인하세요.',409);
 // Retire expired unsigned/unverified attempts only after a fresh preview and explicit consent.
 const expired=s.requests.filter(r=>r.companyId===c.companyId&&r.policyId===policy.id&&['pending','submitted'].includes(r.status)&&applicationStatus(r,s.presentations.find(p=>p.requestId===r.id))==='expired');
 for(const old of expired){old.status='expired';s.audit.push({id:crypto.randomUUID(),at,actor:ctx.actor,role:ctx.role,action:'application-expired',target:old.id,detail:'유효기간 만료 · 재동의 후 새 요청으로 재제출'});}
 const hash=await digest(policy);
 let r=expired.length?undefined:s.requests.find(r=>r.companyId===c.companyId&&r.policyId===policy.id&&r.status==='pending'&&Date.parse(r.expiresAt)>Date.now()&&r.policyHash===hash);
 if(!r){r={id:'request-'+crypto.randomUUID(),companyId:c.companyId,policyId:policy.id,policy:structuredClone(policy),policyHash:hash,nonce:crypto.randomUUID(),status:'pending',expiresAt:new Date(Date.now()+864e5).toISOString(),createdAt:at};s.requests.push(r);}
 await observe?.('request','success','수신 기관·정책 해시·일회용 요청값(nonce)을 연결했습니다.',{requestId:r.id,policyHash:r.policyHash,nonce:r.nonce});
 await observe?.('policy','running','기관 정책에 따라 조건을 판정합니다.',{engine:policyEngineMode()});
 const ev=await evaluateSubmission(c.claims,policy,new Date(at));
 await observe?.('policy','success',ev.eligible?'기관의 신청 조건을 충족합니다.':'조건 판정이 완료되었으며 일부 조건은 미충족입니다.',{eligible:ev.eligible,checks:ev.checks,engine:policyEngineMode()});
 await observe?.('signature','running','요청에 묶인 제출 결과를 구성하고 Ed25519로 서명합니다.');
 const p:Presentation={id:'presentation-'+crypto.randomUUID(),proofVersion:2,schemaId:c.schemaId,credentialDigest:await digest(credentialPayload(c)),submittedBy:ctx.actor,...(preview.selected!.authorityId?{authorityId:preview.selected!.authorityId}:{}),requestId:r.id,credentialId:c.id,companyId:c.companyId,policyHash:r.policyHash,nonce:r.nonce,audience:policy.audience,issuedAt:at,expiresAt:new Date(Math.min(Date.now()+15*60e3,Date.parse(r.expiresAt),Date.parse(c.expiresAt))).toISOString(),...ev,signature:'',issuerId:issuer.id,keyId:issuer.keyId,mode:'signed-demo'};
 p.signature=await sign(issuer.privateKey,presentationPayload(p));s.presentations.push(p);r.status='submitted';
 await observe?.('signature','success','기관별 제출 결과에 서버 전자서명을 생성했습니다.',{credentialId:c.id,presentationId:p.id,credentialDigest:p.credentialDigest,keyId:p.keyId,algorithm:'Ed25519'});
 s.audit.push({id:crypto.randomUUID(),at,actor:ctx.actor,role:ctx.role,action:'application-submit',target:r.id,detail:preview.companyName+' → '+policy.audience+' · 공유 확인 · '+input.previewHash});
 if(preview.autoVerify){
  // Only a recipient-enabled policy may invoke the internal verifier; no role impersonation.
  await observe?.('verification','running','기관이 허용한 자동 검증: 서명·원본 연결·정책·nonce·조건을 다시 검사합니다.');
  await validateAutomaticResult(s,c,policy,r,p,ctx);
  await observe?.('verification','success','서명과 요청 연결을 검증하고 조건 판정의 일치 여부를 확인했습니다.',{requestId:r.id,presentationId:p.id,eligible:p.eligible,algorithm:'Ed25519'});
  p.verifiedAt=at;r.status=p.eligible?'verified':'rejected';
  s.audit.push({id:crypto.randomUUID(),at,actor:'system:policy-verifier',role:policy.kind,action:'application-auto-verify',target:r.id,detail:policy.audience+' · 기관이 설정한 자동 검증 · 최종 사업 승인 아님'});
 }else await observe?.('verification','waiting','기관의 자동 검증 설정이 꺼져 있어 담당자 확인을 기다립니다.');
 (s.applicationSubmissions??=[]).push({key:input.key,actor:ctx.actor,companyId:c.companyId,policyId:policy.id,previewHash:input.previewHash,requestId:r.id,presentationId:p.id});
 await observe?.('audit','success','접수·감사 기록을 구성했습니다. 데이터베이스 저장 전까지는 확정되지 않습니다.',{requestId:r.id,presentationId:p.id});
 return applicationReceipt(s,r.id,false);
}
async function validateAutomaticResult(s:State,c:Credential,policy:Policy,r:VerificationRequest,p:Presentation,ctx:BusinessActor){
 if(!(await inspectCredential(s,c)).valid||statusOf(c)!=='active')error('자격의 현재 유효성 확인에 실패했습니다.');
 if(operational(ctx))requireReviewedCredential(s,c);
 if(p.authorityId){const a=s.authorities?.find(a=>a.id===p.authorityId);if(!a||a.holderUserId!==ctx.actor||!(await checkAuthority(s,a,c.companyId,policy.kind)).valid)error('담당자 권한이 변경되었습니다.');}
 if(operational(ctx)&&!p.authorityId)error('본인에게 연결된 담당자 권한이 필요합니다.');
 const i=s.issuers.find(i=>i.id===p.issuerId)!;
 if(!await verify(i.publicKey,presentationPayload(p),p.signature)||p.credentialDigest!==await digest(credentialPayload(c))||p.policyHash!==await digest(r.policy)||p.nonce!==r.nonce||p.audience!==r.policy.audience||Date.parse(p.expiresAt)<=Date.now())error('제출 결과 연결 검증에 실패했습니다.');
 const ev=evaluate(c.claims,r.policy,new Date(p.issuedAt));if(await digest(ev)!==await digest({eligible:p.eligible,checks:p.checks}))error('조건 판정이 일치하지 않습니다.');
}
function applicationReceipt(s:State,id:string,replayed:boolean){const r=s.requests.find(r=>r.id===id)!;const p=s.presentations.find(p=>p.requestId===id)!;const status=applicationStatus(r,p);return {requestId:r.id,presentationId:p.id,status,eligible:p.eligible,verifiedAt:p.verifiedAt,replayed,message:applicationStatusCopy(status).message};}
