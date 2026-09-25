import {z} from 'zod';
import {canonical} from './domain';
import {agePass} from './policy-age';
import {digest,verify} from './signatures';
import {programWindow} from './program-catalog';
import type {ProgramProfile,ProgramCredential,ProgramData,Check,Rule,Outcome,Fact,Precheck} from './program-types';
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
export const programFactsSchema=z.object({foundedOn:day.optional(),registered:z.boolean().optional(),newIndustry:z.boolean().optional(),revenueKrw:z.number().int().min(0).max(1e15).optional(),fiscalYear:z.number().int().min(1900).max(2200).optional(),investmentKrw:z.number().int().min(0).max(1e15).optional(),plannedResidents:z.number().int().min(0).max(1000000).optional(),nationalTaxClear:z.boolean().optional(),localTaxClear:z.boolean().optional(),noHubHistory:z.boolean().optional(),noDuplicateSpace:z.boolean().optional(),womenBusiness:z.boolean().optional()}).strict().refine(f=>Object.keys(f).length>0).refine(f=>f.revenueKrw===undefined||f.fiscalYear!==undefined);
export function programCredentialPayload(c:ProgramCredential){const body=Object.fromEntries(Object.entries(c).filter(([key])=>key!=='signature'&&key!=='status'));return {context:'bizproof:program-credential:1',body};}
export function combineOutcomes(outcomes:Outcome[],op:'all'|'any'):Outcome{
 const active=outcomes.filter(x=>x!=='not_applicable');if(!active.length)return 'not_applicable';
 if(op==='all'){if(active.includes('fail'))return 'fail';if(active.includes('unknown'))return 'unknown';if(active.includes('manual_review'))return 'manual_review';return 'pass';}
 if(active.includes('pass'))return 'pass';if(active.includes('unknown'))return 'unknown';if(active.includes('manual_review'))return 'manual_review';return 'fail';
}
type Usable=ProgramCredential[];
function factValue(credentials:Usable,fact:Fact,year?:number){
 const rows=credentials.filter(c=>c.facts[fact]!==undefined&&(year===undefined||c.facts.fiscalYear===year));
 const values=new Set(rows.map(c=>canonical(c.facts[fact])));
 return {value:values.size===1?rows[0].facts[fact]:undefined,conflict:values.size>1,ids:rows.map(c=>c.id),docs:[...new Set(rows.flatMap(c=>c.evidence.map(e=>e.id)))]};
}
export function evaluateProgramRule(rule:Rule,credentials:Usable):Check{
 const base={id:rule.id,label:rule.label,credentialIds:[] as string[],documentIds:[] as string[],...(rule.bonus?{bonus:true}:{})};
 if(rule.op==='all'||rule.op==='any'){
  const children=rule.rules.map(r=>evaluateProgramRule(r,credentials));const outcome=combineOutcomes(children.map(r=>r.outcome),rule.op);
  return {...base,children,outcome,reason:rule.op==='any'?'경로 중 하나를 충족하면 수치 조건을 충족합니다.':'모든 하위 조건을 확인합니다.',credentialIds:[...new Set(children.flatMap(r=>r.credentialIds))],documentIds:[...new Set(children.flatMap(r=>r.documentIds))]};
 }
 if(rule.op==='manual')return {...base,outcome:'manual_review',reason:rule.reason};
 const fact=rule.op==='age'?'foundedOn':rule.fact,found=factValue(credentials,fact,rule.op==='compare'?rule.fiscalYear:undefined);
 if(found.value===undefined)return {...base,outcome:rule.bonus?'not_applicable':'unknown',reason:found.conflict?'서로 다른 유효 자격의 값이 충돌합니다. 발급기관 확인이 필요합니다.':rule.bonus?'선택 가점 자료가 없습니다. 필수 조건에는 영향을 주지 않습니다.':'해당 기간·항목의 유효한 서명 자격이 없습니다.',credentialIds:found.ids,documentIds:found.docs};
 const pass=rule.op==='age'?typeof found.value==='string'&&agePass(found.value,{maxAgeMonths:rule.months,ageComparison:rule.comparison,ageReferenceDate:rule.referenceDate},new Date(rule.referenceDate)):rule.comparison==='eq'?found.value===rule.value:typeof found.value==='number'&&typeof rule.value==='number'&&found.value>=rule.value;
 return {...base,outcome:rule.bonus&&!pass?'not_applicable':pass?'pass':'fail',reason:pass?'유효한 서명 자격으로 조건을 확인했습니다.':'확인된 자격이 조건을 충족하지 않습니다.',credentialIds:found.ids,documentIds:found.docs};
}
export async function precheckProgram(input:{data:ProgramData;company:{id:string;registration:string;accountStatus?:string};profile:ProgramProfile;now?:Date;verifiedDocuments:ReadonlySet<string>}):Promise<Precheck>{
 const {data,company,profile,verifiedDocuments}=input,now=input.now??new Date(),warnings:string[]=[],usable:Usable=[];
 const needed=new Set<Fact>();const collect=(r:Rule)=>{if(r.op==='all'||r.op==='any')r.rules.forEach(collect);else if(r.op==='age')needed.add('foundedOn');else if(r.op==='compare'){needed.add(r.fact);if(r.fiscalYear!==undefined)needed.add('fiscalYear');}};profile.rules.forEach(collect);
 for(const c of data.credentials.filter(c=>c.companyId===company.id&&Object.keys(c.facts).some(key=>needed.has(key as Fact)))){
  const issuer=data.issuers.find(i=>i.id===c.issuerId);
  const valid=company.accountStatus!=='suspended'&&issuer?.status==='active'&&c.schemaVersion==='bizproof:program-facts:1'&&c.registration===company.registration&&c.status==='active'&&Date.parse(c.issuedAt)<=now.getTime()&&Date.parse(c.expiresAt)>now.getTime()&&programFactsSchema.safeParse(c.facts).success&&Object.keys(c.facts).every(k=>issuer.facts.includes(k as Fact))&&c.keyId===issuer.keyId&&c.evidence.length>0&&c.evidence.every(e=>{const d=data.documents.find(d=>d.id===e.id);return d?.companyId===company.id&&d.sha256===e.sha256&&verifiedDocuments.has(e.id);})&&await verify(issuer.publicKey,programCredentialPayload(c),c.signature);
  if(valid)usable.push(c);else warnings.push(`자격 ${c.id}: 만료·취소·서명·기업 연결·증빙 또는 발급자 신뢰를 확인하지 못해 제외했습니다.`);
 }
 const checks=profile.rules.map(rule=>evaluateProgramRule(rule,usable));
 if(company.accountStatus==='suspended')checks.unshift({id:'company-active',label:'기업 업무 상태',outcome:'fail',reason:'중지된 기업입니다.',credentialIds:[],documentIds:[]});
 for(const requirement of profile.documents){
  const docs=data.documents.filter(d=>d.companyId===company.id&&d.type===requirement.type&&verifiedDocuments.has(d.id));
  const valid=docs.filter(d=>d.size<=requirement.maxBytes&&(!requirement.maxPages||d.pages<=requirement.maxPages));
  const alternative=requirement.alternative?data.documents.filter(d=>d.companyId===company.id&&d.type===requirement.alternative&&verifiedDocuments.has(d.id)&&d.size<=requirement.maxBytes):[];
  const outcome:Outcome=valid.length?'pass':docs.length?'fail':requirement.bonus?'not_applicable':alternative.length?'manual_review':'unknown';
  checks.push({id:'document:'+requirement.type,label:requirement.label,bonus:requirement.bonus,outcome,reason:valid.length?'파일 무결성·형식·페이지·용량 확인 완료. 문서 내용의 사실 인정은 별도입니다.':docs.length?`${Math.round(requirement.maxBytes/1024/1024)}MB${requirement.maxPages?` · ${requirement.maxPages}쪽`:''} 제한에 맞는 파일이 필요합니다.`:alternative.length?(requirement.exception??'대체서류 인정 여부를 담당자가 확인해야 합니다.'):requirement.bonus?'선택 가점 자료입니다.':'필수 자료가 없습니다.',credentialIds:[],documentIds:(valid.length?valid:alternative).map(d=>d.id)});
 }
 const referenced=new Set(checks.flatMap(c=>c.documentIds));
 for(const c of usable)for(const e of c.evidence)referenced.add(e.id);
 const body={companyId:company.id,profileId:profile.id,profileVersion:profile.version,profileHash:await digest(profile),checks,outcome:combineOutcomes(checks.filter(c=>!c.bonus).map(c=>c.outcome),'all'),credentialDigests:await Promise.all(usable.map(async c=>({id:c.id,digest:await digest(c)}))),documents:data.documents.filter(d=>referenced.has(d.id)).map(d=>({id:d.id,sha256:d.sha256})),warnings,windowStatus:programWindow(profile,now),networkConnected:false as const,officialReceipt:null};
 return {...body,evaluatedAt:now.toISOString(),fingerprint:await digest(body)};
}
