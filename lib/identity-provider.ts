import {z} from 'zod';
import {createHmac} from 'node:crypto';
import {digest} from './signatures';
export type IdentityIntent={id:string;actor:string;companyId:string;purpose:'business-issuance';documentHash:string;createdAt:number;expiresAt:number;nonce:string};
export type IdentityEvidence={provider:'portone-v2';mode:'provider-test'|'live';kind:'person-identity';transactionId:string;subjectRef:string;verifiedAt:string;intentHash:string;documentSigned:false};
export interface IdentityProvider{start(intent:IdentityIntent):Promise<{identityVerificationId:string;storeId:string;channelKey:string;customData:string}>;verify(intent:IdentityIntent):Promise<IdentityEvidence|{status:'pending'|'failed'}>;}
export interface DocumentSigningProvider{verify(intent:IdentityIntent):Promise<{provider:string;mode:'provider-test'|'live';kind:'document-signature';documentHash:string;intentHash:string;signatureVerified:true;verifiedAt:string}>;}
export class IdentityProviderError extends Error{constructor(public status:number,message:string){super(message);}}
const text=z.string().min(1).max(200);
export const portOneConfigSchema=z.object({storeId:text,channelKey:text,channelType:z.enum(['TEST','LIVE']),secret:z.string().min(20),subjectSecret:z.string().min(48)}).strict();
type Config=z.infer<typeof portOneConfigSchema>;
const verifiedSchema=z.object({status:z.literal('VERIFIED'),id:text,channel:z.object({key:text,type:z.enum(['TEST','LIVE'])}),verifiedCustomer:z.object({ci:z.string().optional(),di:z.string().optional()}),customData:z.string(),requestedAt:z.string().datetime({offset:true}),verifiedAt:z.string().datetime({offset:true}),version:z.literal('V2')});
export function identityCapabilities(){const enabled=process.env.BIZPROOF_IDENTITY_PILOT==='true'&&process.env.BIZPROOF_PUBLIC_DEMO!=='true';return {personIdentity:{provider:'portone-v2',configured:enabled&&!!process.env.BIZPROOF_PORTONE_CONFIG,mode:enabled?'restricted-pilot':'unavailable'},documentSigning:{configured:false,reason:'전자서명 공급자의 계약·검증 규격 확인 필요'},businessAuthority:{automatic:false,reason:'본인확인과 별도로 기업 담당자 권한을 검토합니다.'}};}
export class PortOneIdentityProvider implements IdentityProvider{
 private readonly config:Config;
 constructor(config:Config,private readonly transport:typeof fetch=fetch){this.config=portOneConfigSchema.parse(config);}
 async start(intent:IdentityIntent){if(intent.expiresAt<=Date.now())throw new IdentityProviderError(422,'인증 요청이 만료되었습니다.');return {identityVerificationId:'bizproof-'+intent.id,storeId:this.config.storeId,channelKey:this.config.channelKey,customData:JSON.stringify({context:'bizproof:identity-intent:v1',digest:await digest(intent)})};}
 async verify(intent:IdentityIntent){
  const request=await this.start(intent),url=new URL('https://api.portone.io/identity-verifications/'+encodeURIComponent(request.identityVerificationId));url.searchParams.set('storeId',this.config.storeId);
  let response:Response;try{response=await this.transport(url,{headers:{Authorization:'PortOne '+this.config.secret},redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store'});}catch{throw new IdentityProviderError(503,'인증기관의 결과를 조회하지 못했습니다.');}
  if(response.status===404)return {status:'pending' as const};if(!response.ok)throw new IdentityProviderError(503,'인증기관 연결 설정 또는 응답을 확인해야 합니다.');
  // Never log, return or persist provider response bodies (name, phone, CI, raw PG data).
  const raw=await response.text();if(raw.length>100000)throw new IdentityProviderError(502,'인증 응답 크기를 확인해야 합니다.');const data=JSON.parse(raw) as {status?:string};
  if(data.status==='READY')return {status:'pending' as const};if(data.status==='FAILED')return {status:'failed' as const};
  const b=verifiedSchema.parse(data),subject=b.verifiedCustomer.ci??b.verifiedCustomer.di;
  if(b.id!==request.identityVerificationId||b.channel.key!==this.config.channelKey||b.channel.type!==this.config.channelType||b.customData!==request.customData||!subject||Date.parse(b.requestedAt)<intent.createdAt-5000||Date.parse(b.verifiedAt)<Date.parse(b.requestedAt)||Date.parse(b.verifiedAt)>Date.now()+5000||Date.parse(b.verifiedAt)>intent.expiresAt)throw new IdentityProviderError(422,'인증 거래·문서·채널·유효기간이 일치하지 않습니다.');
  return {provider:'portone-v2' as const,mode:b.channel.type==='LIVE'?'live' as const:'provider-test' as const,kind:'person-identity' as const,transactionId:b.id,subjectRef:createHmac('sha256',this.config.subjectSecret).update(this.config.storeId+'\0'+subject).digest('hex'),verifiedAt:b.verifiedAt,intentHash:await digest(intent),documentSigned:false as const};
 }
}
export function requireDocumentSignature(evidence:IdentityEvidence|Awaited<ReturnType<DocumentSigningProvider['verify']>>,intent:IdentityIntent){if(evidence.kind!=='document-signature'||evidence.documentHash!==intent.documentHash||!evidence.signatureVerified)throw new IdentityProviderError(422,'본인확인 결과를 신청 문서의 전자서명으로 대신할 수 없습니다.');}
