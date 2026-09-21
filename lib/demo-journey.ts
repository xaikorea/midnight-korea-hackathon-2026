import {type State,type Credential,type Policy,type DemoJourney,credentialPayload} from './domain';
import {schemaBinding} from './credential-family';
import {digest,makeKeys,sign} from './signatures';
export async function createDemoJourney(s:State,reviewer:string):Promise<DemoJourney>{
 const uid=crypto.randomUUID(),at=new Date().toISOString(),companyId='demo-company-'+uid,issuerId='demo-issuer-'+uid;
 const company={id:companyId,name:'재사용 시연 기업',registration:'DEMO-'+uid.slice(0,12),industry:'소프트웨어',region:'서울',contact:'demo@example.invalid',createdAt:at};s.companies.push(company);
 const issuer={id:issuerId,name:'시연 전용 발급기관',did:'did:web:demo.invalid:'+uid,status:'active' as const,keyId:'demo-key-'+uid,...await makeKeys(),previousKeys:[],createdAt:at};s.issuers.push(issuer);
 const schema=s.schemas[0];if(!schema)throw Error('기업 자격 스키마가 필요합니다.');const founded=new Date();founded.setUTCDate(1);founded.setUTCMonth(founded.getUTCMonth()-24);
 const c:Credential={id:'demo-credential-'+uid,proofVersion:2,familyBinding:await schemaBinding(schema),companyId,issuerId,schemaId:schema.id,keyId:issuer.keyId,claims:{revenue:300000000,foundedOn:founded.toISOString().slice(0,10),region:'서울',certified:true},issuedAt:at,expiresAt:new Date(Date.now()+90*864e5).toISOString(),status:'active',signature:'',source:{kind:'synthetic',reference:'BizProof fixed scenario v1',period:'데모 기준 시점',method:'3억 원·서울·약 24개월의 가상 속성 생성',reviewer,reviewedAt:at,documents:[],notice:'시연용 합성 데이터이며 실제 기업의 재무 정보를 확인한 기록이 아닙니다.'}};
 c.signature=await sign(issuer.privateKey,credentialPayload(c));s.credentials.push(c);
 const specs=[{key:'buyer',name:'구매사 등록 조건',kind:'buyer',audience:'가상 구매사',minRevenue:200000000,maxRevenue:null,maxAgeMonths:null,region:null},{key:'grant',name:'지원사업 신청 조건',kind:'grant',audience:'가상 지원기관',minRevenue:null,maxRevenue:500000000,maxAgeMonths:36,region:'서울'},{key:'negative',name:'미충족 비교 조건',kind:'buyer',audience:'가상 프리미엄 구매사',minRevenue:500000000,maxRevenue:null,maxAgeMonths:null,region:null},{key:'revoked',name:'취소 후 재사용 검사',kind:'buyer',audience:'가상 구매사',minRevenue:200000000,maxRevenue:null,maxAgeMonths:null,region:null}] as const;
 const requestIds={} as DemoJourney['requestIds'];
 for(const spec of specs){const p:Policy={id:'demo-policy-'+spec.key+'-'+uid,name:spec.name,kind:spec.kind,audience:spec.audience,minRevenue:spec.minRevenue,maxRevenue:spec.maxRevenue,maxAgeMonths:spec.maxAgeMonths,region:spec.region,version:1,requireCertification:false,issuerIds:[issuerId],createdAt:at,status:'active'};s.policies.push(p);const id='demo-request-'+spec.key+'-'+uid;requestIds[spec.key]=id;s.requests.push({id,companyId,policyId:p.id,policy:p,policyHash:await digest(p),nonce:crypto.randomUUID(),status:'pending',expiresAt:new Date(Date.now()+864e5).toISOString(),createdAt:at});}
 const journey={id:'journey-'+uid,companyId,credentialId:c.id,requestIds,createdAt:at};(s.demoJourneys??=[]).push(journey);return journey;
}
