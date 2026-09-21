import {seedState} from './seed';
import {createDemoJourney} from './demo-journey';
import {credentialPayload,type State} from './domain';
import {sign} from './signatures';

// A complete, signed fixture is stored BEFORE a visitor claims the workspace.
export async function preparedDemoState():Promise<State>{
 const s=await seedState();
 s.schemas[0].id='schema-demo-'+crypto.randomUUID();
 s.companies=[];s.issuers=[];s.credentials=[];s.policies=[];s.requests=[];s.connections=[];s.audit=[];
 const j=await createDemoJourney(s,'system:demo-preparation');
 const company=s.companies[0],credential=s.credentials[0];
 company.name='주식회사 한빛테크 (가상)';company.industry='소프트웨어';
 credential.source!.reference='BizProof prepared walkthrough v2';
 credential.signature=await sign(s.issuers[0].privateKey,credentialPayload(credential));
 const policyIds=(['buyer','grant'] as const).map(key=>s.requests.find(r=>r.id===j.requestIds[key])!.policyId);
 for(const p of s.policies){p.audience=p.kind==='grant'?'서울창업지원센터 (가상)':'미래산업 구매팀 (가상)';}
 // Refresh bound policy snapshots after naming the synthetic recipients.
 const {digest}=await import('./signatures');
 for(const r of s.requests){r.policy=structuredClone(s.policies.find(p=>p.id===r.policyId)!);r.policyHash=await digest(r.policy);}
 const at=new Date().toISOString();
 s.policyAutomation=policyIds.map(policyId=>({policyId,enabled:true,actor:'system:demo-recipient',at}));
 s.preparedDemo={version:2,preparedAt:at,companyId:company.id,credentialId:credential.id,policyIds};
 s.settings.name='한빛테크 체험 공간';
 s.audit.push({id:crypto.randomUUID(),at,actor:'system:demo-preparation',role:'admin',action:'demo-prepared',target:company.id,detail:'가상 기업 1개·서명 자격 1개·신청 대상 2개 사전 저장. 실제 발급기관 인증 아님.'});
 return s;
}
