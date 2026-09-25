import {z} from 'zod';
import {authorization, CATALOG, ISSUER_ID, intentBody} from '../services/issuer/protocol.mjs';
import {credentialPayload, claimsInput, type Credential, type State} from './domain';
import {digest,verify} from './signatures';

export class RemoteIssuerError extends Error {constructor(public status:number,message:string){super(message);}}
const fail=(message:string,status=503):never=>{throw new RemoteIssuerError(status,message);};
export function remoteConfig(){
 const raw=process.env.BIZPROOF_ISSUER_URL,secret=process.env.BIZPROOF_ISSUER_SERVICE_SECRET,pin=process.env.BIZPROOF_ISSUER_TRUST;
 if(!raw||!secret||secret.length<48||!pin)fail('별도 발급 서비스를 연결 중입니다. 잠시 후 다시 시도하세요.');
 let url:URL;try{url=new URL(raw!);}catch{return fail('발급 서비스 설정을 확인해야 합니다.');}
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['127.0.0.1','localhost','issuer'].includes(url.hostname))fail('승인된 발급 서비스 주소가 아닙니다.');
 const trust=z.object({issuerId:z.literal(ISSUER_ID),keyId:z.string().min(1),publicKey:z.object({kty:z.literal('OKP'),crv:z.literal('Ed25519'),x:z.string().min(20)}).strict()}).parse(JSON.parse(pin!));
 return {url:url.origin,secret:secret!,trust};
}
export const issuerScope=(owner:string,actor:string)=>digest({context:'bizproof:issuer-scope:v1',owner,actor});
export async function issuerCall<T=Record<string,unknown>>(scope:string,method:'GET'|'POST',path:string,body:unknown=null):Promise<T>{
 const config=remoteConfig(),iat=Date.now();
 if(!/^\/v1\/[a-zA-Z0-9/?=&_-]+$/.test(path))fail('지원하지 않는 발급 경로입니다.',400);
 const token=authorization(config.secret,{aud:'bizproof-issuer-demo',mode:'synthetic',scope,method,path,bodyHash:await digest(body),iat,exp:iat+30000,jti:crypto.randomUUID()});
 let response:Response;try{response=await fetch(config.url+path,{method,headers:{Authorization:'BizProof '+token,'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store'});}catch{return fail('발급기관과 통신할 수 없습니다. 완료 여부를 다시 조회하세요.');}
 const text=await response.text();if(text.length>180000)fail('발급기관 응답을 확인할 수 없습니다.');let result;try{result=JSON.parse(text);}catch{return fail('발급기관 응답 형식이 올바르지 않습니다.');}
 if(!response.ok)fail(typeof result.error==='string'?result.error:'발급기관 요청 실패',response.status>=500?503:response.status);
 return result as T;
}
const source=z.object({kind:z.literal('synthetic'),reference:z.string(),period:z.string(),method:z.string(),reviewer:z.string(),reviewedAt:z.string().datetime(),documents:z.array(z.never()).length(0),notice:z.string()}).strict();
export const remoteCredentialSchema=z.object({id:z.string().regex(/^remote-[a-f0-9-]{36}$/),proofVersion:z.literal(3),remoteBinding:z.object({requestId:z.string().uuid(),scope:z.string().regex(/^[a-f0-9]{64}$/),identitySessionId:z.string().uuid(),identityMode:z.literal('simulated'),documentHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),companyId:z.literal(CATALOG.companyId),issuerId:z.literal(ISSUER_ID),schemaId:z.literal('business-v1'),claims:claimsInput,issuedAt:z.string().datetime(),expiresAt:z.string().datetime(),keyId:z.string(),status:z.literal('active'),source,signature:z.string().min(80).max(100)}).strict();
export async function verifyRemoteOriginal(raw:unknown,scope:string,requestId:string,purpose:'use'|'status'='use'){
 const c=remoteCredentialSchema.parse(raw),pin=remoteConfig().trust;
 if(c.remoteBinding.scope!==scope||c.remoteBinding.requestId!==requestId||c.keyId!==pin.keyId||c.remoteBinding.documentHash!==await digest(intentBody())||await digest(c.claims)!==await digest(CATALOG.claims)||!await verify(pin.publicKey,credentialPayload(c),c.signature)||Date.parse(c.issuedAt)>Date.now()+5000||purpose==='use'&&Date.parse(c.expiresAt)<=Date.now()||Date.parse(c.expiresAt)<=Date.parse(c.issuedAt))fail('발급기관 서명 또는 신청 연결을 확인하지 못했습니다.',422);
 return c;
}
const statusSchema=z.object({body:z.object({context:z.literal('bizproof:issuer-status:v1'),issuerId:z.literal(ISSUER_ID),keyId:z.string(),scope:z.string(),credentialId:z.string(),credentialDigest:z.string(),status:z.enum(['active','revoked']),revision:z.number().int().positive(),nonce:z.string().uuid(),checkedAt:z.string().datetime(),expiresAt:z.string().datetime()}).strict(),signature:z.string()}).strict();
export async function remoteCredentialStatus(c:Credential,minRevision=0){
 if(c.proofVersion!==3||!c.remoteBinding)fail('원격 발급 연결이 없습니다.',422);
 const pin=remoteConfig().trust,nonce=crypto.randomUUID();
 // Every use asks for a nonce-bound fresh status. A stored receipt is never enough to authorize use.
 const result=statusSchema.parse(await issuerCall(c.remoteBinding!.scope,'GET','/v1/credentials/'+c.id+'/status?nonce='+nonce)),b=result.body;
 if(b.keyId!==pin.keyId||c.keyId!==pin.keyId||b.scope!==c.remoteBinding!.scope||b.credentialId!==c.id||b.credentialDigest!==await digest(credentialPayload(c))||b.nonce!==nonce||b.revision<minRevision||Date.parse(b.checkedAt)>Date.now()+5000||Date.parse(b.checkedAt)<Date.now()-60000||Date.parse(b.expiresAt)<=Date.now()||Date.parse(b.expiresAt)-Date.parse(b.checkedAt)>60000||!await verify(pin.publicKey,b,result.signature))fail('발급기관의 최신 상태 서명을 확인하지 못했습니다.',422);
 return result;
}
export async function importRemoteCredential(s:State,scope:string,requestId:string){
 const c=await verifyRemoteOriginal(await issuerCall(scope,'GET','/v1/issuance-requests/'+requestId+'/credential'),scope,requestId);
 const previous=s.credentialReceipts?.find(r=>r.credentialId===c.id),status=await remoteCredentialStatus(c,previous?.statusRevision);
 if(status.body.status!=='active')fail('발급기관에서 취소한 자격입니다.',422);
 const hash=await digest(credentialPayload(c)),existing=s.credentials.find(v=>v.id===c.id);
 if(existing&&await digest(credentialPayload(existing))!==hash)fail('기존 자격의 원본과 충돌합니다.',409);
 const pin=remoteConfig().trust,at=new Date().toISOString();
 if(!s.issuers.some(i=>i.id===pin.issuerId))s.issuers.push({kind:'remote',id:pin.issuerId,name:'BizProof 독립 시연 발급기관',did:'urn:bizproof:issuer:independent-demo',status:'active',keyId:pin.keyId,publicKey:pin.publicKey,previousKeys:[],createdAt:at});
 const issuer=s.issuers.find(i=>i.id===pin.issuerId)!;
 if(issuer.kind!=='remote'||issuer.keyId!==pin.keyId||await digest(issuer.publicKey)!==await digest(pin.publicKey)||issuer.status!=='active')fail('등록된 발급기관의 키 또는 신뢰 상태가 다릅니다.',422);
 const schema=s.schemas.find(v=>v.id===c.schemaId);
 if(schema&&schema.version!==1)fail('발급 자격의 스키마 버전과 지갑 설정이 다릅니다.',422);
 if(!schema)s.schemas.push({id:c.schemaId,name:'기업 기본 · 재무 자격',version:1,description:'별도 시연 발급기관의 고정 기업 속성 스키마',fields:[{key:'revenue',label:'연 매출액',type:'integer',private:true},{key:'foundedOn',label:'설립일',type:'date',private:true},{key:'region',label:'소재지',type:'string',private:true},{key:'certified',label:'인증 보유',type:'boolean',private:true}],createdAt:at});
 if(!s.companies.some(v=>v.id===c.companyId))s.companies.push({id:c.companyId,name:CATALOG.name,registration:'DEMO-ISSUER-001',industry:'소프트웨어',region:'서울',contact:'demo@example.invalid',createdAt:at});
 if(!existing)s.credentials.push(c);
 if(!previous)(s.credentialReceipts??=[]).push({credentialId:c.id,requestId,digest:hash,receivedAt:at,statusRevision:status.body.revision});
 else previous.statusRevision=status.body.revision;
 for(const [kind,id,name,audience] of [['buyer','issuer-demo-buyer','별도 발급 자격 · 구매사 등록','미래산업 구매팀 (가상)'],['grant','issuer-demo-grant','별도 발급 자격 · 지원사업 신청','서울창업지원센터 (가상)']] as const){
   if(!s.policies.some(p=>p.id===id))s.policies.push({id,name,audience,kind,version:1,minRevenue:kind==='buyer'?200000000:null,maxRevenue:kind==='grant'?500000000:null,maxAgeMonths:kind==='grant'?36:null,region:kind==='grant'?'서울':null,requireCertification:false,issuerIds:[pin.issuerId],createdAt:at,status:'active'});
   if(!s.policyAutomation?.some(p=>p.policyId===id))(s.policyAutomation??=[]).push({policyId:id,enabled:true,actor:'system:scoped-demo-policy',at});
 }
 // Keep the fast demo untouched; the new flow navigates to its own company explicitly.
 if(!previous)s.audit.push({id:crypto.randomUUID(),at,role:'company',action:'remote-credential-received',target:c.id,detail:'고정 신뢰 키·원본 서명·동의 연결·최신 기관 상태 검증 후 지갑 저장'});
 return {credentialId:c.id,requestId,digest:hash,receivedAt:previous?.receivedAt??at,status:status.body.status,companyId:c.companyId};
}
