import {z} from 'zod';
export const vpPolicies=['jwt_vc_json/audience-check','jwt_vc_json/nonce-check','jwt_vc_json/envelope_signature','jwt_vc_json/exp-check','jwt_vc_json/nbf-check'];
export const vcPolicies=['signature','expiration','not-before'];
export const verifierStatus=z.enum(['UNKNOWN','ACTIVE','UNUSED','EXPIRED','SUCCESSFUL','FAILED']);
export type VerifierSession={id:string;actor:string;role:string;requestId:string;policyHash:string;expiresAt:string;createdAt:string;status:z.infer<typeof verifierStatus>;authorizationUrl:string;checkedAt?:string};
export class WaltidError extends Error{constructor(){super('외부 검증 서버의 설정·연결·응답을 확인하세요.');}}
export function verifierConfig(input:{address?:string;publicOrigin?:string;token?:string}){
 if(!input.address)return null;
 function origin(value:string){const u=new URL(value);if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))))throw new WaltidError();return u.origin;}
 try{if(input.token&&/[\r\n]/.test(input.token))throw new WaltidError();return {address:origin(input.address),publicOrigin:origin(input.publicOrigin||input.address),token:input.token};}catch{throw new WaltidError();}
}
export function enterpriseQuery(subject:string,issuers:string[]){if(!issuers.length)throw new WaltidError();return {credentials:[{id:'enterprise',format:'jwt_vc_json',meta:{type_values:[['VerifiableCredential','BizProofBusinessCredential']]},claims:[{path:['credentialSubject','id'],values:[subject]},{path:['issuer'],values:issuers}]}]};}
export function sessionSetup(id:string,expiresAt:string,query:ReturnType<typeof enterpriseQuery>){return {flow_type:'cross_device',core_flow:{sessionId:id,expiration_date:expiresAt,retention_duration:'PT1H',dcql_query:query,policies:{vp_policies:vpPolicies,vc_policies:vcPolicies}}};}
const idSchema=z.string().uuid();
export function waltidClient(config:NonNullable<ReturnType<typeof verifierConfig>>,fetcher:typeof fetch=fetch){
 async function call(path:string,body?:unknown){
  try{const r=await fetcher(config.address+path,{method:body?'POST':'GET',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{}),...(config.token?{Authorization:'Bearer '+config.token}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(12000)});if(!r.ok||!r.body)throw new WaltidError();const reader=r.body.getReader(),chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024){await reader.cancel();throw new WaltidError();}chunks.push(value);}const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new WaltidError();}
 }
 return {
  async create(id:string,expiresAt:string,query:ReturnType<typeof enterpriseQuery>){idSchema.parse(id);const data=z.object({sessionId:z.literal(id),bootstrapAuthorizationRequestUrl:z.string().max(8000)}).parse(await call('/verification-session/create',sessionSetup(id,expiresAt,query)));const url=new URL(data.bootstrapAuthorizationRequestUrl);const requestUri=url.searchParams.get('request_uri');if(url.protocol!=='openid4vp:'||url.username||url.password||url.hash||!requestUri)throw new WaltidError();const endpoint=new URL(requestUri);if(endpoint.origin!==config.publicOrigin||endpoint.pathname!==`/verification-session/${id}/request`||endpoint.search||endpoint.hash||endpoint.username||endpoint.password)throw new WaltidError();return data.bootstrapAuthorizationRequestUrl;},
  async inspect(id:string){idSchema.parse(id);const data=z.object({id:z.literal(id),status:verifierStatus}).parse(await call(`/verification-session/${id}/info`));return {status:data.status,checkedAt:new Date().toISOString()};}
 };
}
export const verifierNotice='외부 서버의 제출 검증 상태입니다. 구매·지원 조건 충족, 현재 원본 취소 상태, 담당자 권한 또는 Midnight 증명을 인증하지 않습니다. JWT VC는 원본 속성이 검증 서버로 전달될 수 있습니다.';
export function sessionView(s:VerifierSession){return {id:s.id,requestId:s.requestId,expiresAt:s.expiresAt,createdAt:s.createdAt,status:s.status,authorizationUrl:['ACTIVE','UNUSED'].includes(s.status)?s.authorizationUrl:null,checkedAt:s.checkedAt,eligible:null,notice:verifierNotice};}
