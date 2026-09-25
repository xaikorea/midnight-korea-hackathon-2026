import type {State} from './domain';
import type {ProgramData,ProgramProfile,ProgramCredential,ProgramDocument,DocumentType,Fact,Facts,ConsentChallenge,Precheck,ProgramApplication,ReviewEvent} from './program-types';
import {makeKeys,sign,verify,digest} from './signatures';
import {programCredentialPayload} from './program-rules';
import {syntheticProgramPdf} from './program-documents';
export const programScenarios=['normal','investment-path','missing-history','wrong-year','expired-tax','oversized-ir','negative'] as const;
export type ProgramScenario=typeof programScenarios[number];
export class ProgramError extends Error{constructor(message:string,public status=422){super(message);}}
export async function initializeProgramData():Promise<ProgramData>{return {issuers:[],credentials:[],documents:[],applications:[],receiptKey:{keyId:'program-receipt-'+crypto.randomUUID(),...await makeKeys()},scenarios:[]};}
export async function prepareProgramScenario(state:State,scenario:ProgramScenario,write:(document:ProgramDocument,bytes:ArrayBuffer)=>Promise<void>,owner:string,now=new Date()){
 const data=state.programData??=await initializeProgramData(),existing=data.scenarios.find(s=>s.scenario===scenario);if(existing)return existing.companyId;
 const companyId='demo-program-'+scenario,at=now.toISOString();
 if(state.companies.some(c=>c.id===companyId))throw new ProgramError('시연 기업 식별자가 이미 사용 중입니다.');
 const company={id:companyId,name:`가상 재사용기업 · ${scenario}`,registration:'DEMO-PROGRAM-'+scenario,industry:'합성 기술기업',region:'경기',contact:'demo@example.invalid',createdAt:at};
 state.companies.push(company);
 const groups:{name:string;facts:Facts;documents:DocumentType[]}[]=[
  {name:'가상 기업등록 발급자',facts:{registered:true,foundedOn:scenario==='negative'?'2010-01-01':'2023-03-01',newIndustry:false},documents:['registration']},
  {name:'가상 재무 검토 발급자',facts:{revenueKrw:['investment-path','negative'].includes(scenario)?1_000_000_000:2_400_000_000,fiscalYear:scenario==='wrong-year'?2024:2025},documents:['finance']},
  {name:'가상 투자 검토 발급자',facts:{investmentKrw:['wrong-year','negative'].includes(scenario)?500_000_000:3_400_000_000},documents:['investment']},
  {name:'가상 인력·이력 검토 발급자',facts:{plannedResidents:scenario==='negative'?8:17,...(scenario==='missing-history'?{}:{noHubHistory:true,noDuplicateSpace:true})},documents:['residents','application']},
  {name:'가상 납세 검토 발급자',facts:{nationalTaxClear:true,localTaxClear:true},documents:['national-tax','local-tax']}
 ];

 const types:DocumentType[]=['registration','ir','finance','investment','residents','national-tax','local-tax','insurance','application','consent','technical-proposal','credit','esg'];
 for(const type of types){const id=crypto.randomUUID(),lines=groups.filter(g=>g.documents.includes(type)).flatMap(g=>Object.entries(g.facts).map(([key,value])=>`${key}: ${value}`)),bytes=await syntheticProgramPdf(companyId,type,type==='ir'&&scenario==='oversized-ir'?11:1,lines.length?lines:['Scenario: '+scenario,'For internal preparation and reviewer simulation only.']),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const d:ProgramDocument={id,companyId,type,name:`SYNTHETIC-${type}.pdf`,key:`evidence/${owner}/${id}`,sha256,size:bytes.byteLength,pages:type==='ir'&&scenario==='oversized-ir'?11:1,createdAt:at,source:'synthetic',scan:'synthetic-not-scanned'};await write(d,bytes);data.documents.push(d);
 }
 for(const group of groups){let issuer=data.issuers.find(i=>i.name===group.name);if(!issuer){issuer={id:'program-issuer-'+crypto.randomUUID(),name:group.name,keyId:crypto.randomUUID(),...await makeKeys(),facts:group.name.includes('인력')?['plannedResidents','noHubHistory','noDuplicateSpace']:Object.keys(group.facts) as Fact[],status:'active'};data.issuers.push(issuer);}
  const c:ProgramCredential={id:'program-credential-'+crypto.randomUUID(),schemaVersion:'bizproof:program-facts:1',companyId,registration:company.registration,issuerId:issuer.id,keyId:issuer.keyId,facts:group.facts,evidence:data.documents.filter(d=>d.companyId===companyId&&group.documents.includes(d.type)).map(d=>({id:d.id,sha256:d.sha256})),issuedAt:new Date(now.getTime()-86400000).toISOString(),expiresAt:new Date(now.getTime()+(scenario==='expired-tax'&&group.name.includes('납세')?-1000:7*86400000)).toISOString(),status:'active',signature:'',source:'synthetic'};c.signature=await sign(issuer.privateKey,programCredentialPayload(c));data.credentials.push(c);
 }
 data.scenarios.push({scenario,companyId});return companyId;
}
export async function consentChallenge(data:ProgramData,precheck:Precheck,actor:string,owner:string,now=new Date()):Promise<ConsentChallenge>{
 const body:ConsentChallenge['body']={context:'bizproof:program-consent:1',actor,owner,companyId:precheck.companyId,profileId:precheck.profileId,profileHash:precheck.profileHash,fingerprint:precheck.fingerprint,nonce:crypto.randomUUID(),expiresAt:new Date(now.getTime()+5*60000).toISOString(),scope:'company-and-checks-and-document-manifest'};
 return {body,signature:await sign(data.receiptKey.privateKey,body)};
}
export function applicationReceiptPayload(a:ProgramApplication){return {context:'bizproof:program-application:1',id:a.id,actor:a.actor,companyId:a.companyId,profile:a.profile,precheck:a.precheck,consent:a.consent,createdAt:a.createdAt,mode:a.mode};}
export async function saveProgramApplication(data:ProgramData,input:{actor:string;owner:string;profile:ProgramProfile;precheck:Precheck;consent:ConsentChallenge;confirmed:boolean;now?:Date}){
 const {consent,actor,owner,profile,precheck}=input,body=consent.body,now=input.now??new Date();
 if(!input.confirmed||body.context!=='bizproof:program-consent:1'||body.scope!=='company-and-checks-and-document-manifest'||body.actor!==actor||body.owner!==owner||body.companyId!==precheck.companyId||body.profileId!==profile.id||body.profileHash!==await digest(profile)||!await verify(data.receiptKey.publicKey,body,consent.signature))throw new ProgramError('기업·수신자·사용자·공유 범위의 동의를 다시 확인하세요.',403);
 const existing=data.applications.find(a=>a.consent.body.nonce===body.nonce);if(existing)return existing;
 if(!Number.isFinite(Date.parse(body.expiresAt))||Date.parse(body.expiresAt)<=now.getTime()||Date.parse(body.expiresAt)>now.getTime()+5*60000||body.fingerprint!==precheck.fingerprint)throw new ProgramError('자료 또는 조건이 변경되었거나 동의가 만료되었습니다. 다시 확인해 주세요.',409);
 if(data.applications.length>=100)throw new ProgramError('이 공간의 신청 준비 기록 한도에 도달했습니다.',429);
 const application:ProgramApplication={id:crypto.randomUUID(),actor,companyId:precheck.companyId,profile:structuredClone(profile),precheck:structuredClone(precheck),consent:structuredClone(consent),createdAt:now.toISOString(),revision:0,status:'draft',history:[],externalReceipt:null,mode:'synthetic',receipt:{keyId:data.receiptKey.keyId,publicKey:data.receiptKey.publicKey,signature:''}};
 application.receipt.signature=await sign(data.receiptKey.privateKey,applicationReceiptPayload(application));data.applications.push(application);return application;
}
export function reviewProgramApplication(application:ProgramApplication,input:{revision:number;ruleId:string;decision:ReviewEvent['decision'];reason:string;evidenceIds:string[]},actor:string,now=new Date()){
 if(application.revision!==input.revision)throw new ProgramError('검토 기록이 변경되었습니다. 새로고침하세요.',409);
 const check=application.precheck.checks.find(c=>c.id===input.ruleId);
 if(!check||check.outcome!=='manual_review')throw new ProgramError('담당자 검토 항목만 결정할 수 있습니다. 미충족·미확인 사실은 새 근거로 다시 검사해야 합니다.');
 if(input.reason.trim().length<10||!input.evidenceIds.length||input.evidenceIds.some(id=>!application.precheck.documents.some(d=>d.id===id)))throw new ProgramError('10자 이상의 검토 사유와 이 신청에 연결된 근거가 필요합니다.');
 if(application.history.length>=200)throw new ProgramError('검토 기록 한도에 도달했습니다.');
 application.history.push({at:now.toISOString(),actor,...input,reason:input.reason.trim(),simulation:application.mode==='synthetic'});application.revision++;
 const confirmed=(id:string)=>application.history.findLast(h=>h.ruleId===id)?.decision==='confirmed';
 application.status=application.precheck.checks.filter(c=>!c.bonus).every(c=>c.outcome==='pass'||c.outcome==='manual_review'&&confirmed(c.id))?'internal_reviewed':'draft';
 return application;
}
