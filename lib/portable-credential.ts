import {z} from 'zod';
import {canonical,claimsInput,credentialPayload,type Credential,type State} from './domain';
import {inspectCredential} from './credential-family';
import {digest} from './signatures';

const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const json64=(value:unknown)=>encode(encoder.encode(canonical(value)));
const decode=(value:string)=>{if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error('base64url');const bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));if(encode(bytes)!==value)throw Error('base64url');return bytes;};
export class PortableCredentialError extends Error {}
export const portableNotice='원본 기업 속성을 포함하는 서명된 VC-JWT입니다. 암호화·선택적 공개·영지식증명이 아니며, 외부 수신자는 현재 취소 상태와 발급기관의 실제 권한을 별도로 확인해야 합니다.';
const vocab='https://bizproof.example/vocab#';
const contexts=['https://www.w3.org/2018/credentials/v1',{'@vocab':vocab}];
const profile='bizproof-vc-jwt-v1';
const publicJwkSchema=z.object({kty:z.literal('OKP'),crv:z.literal('Ed25519'),x:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict();
function publicJwk(key:JsonWebKey){return publicJwkSchema.parse({kty:key.kty,crv:key.crv,x:key.x});}
export function issuerDid(key:JsonWebKey){return 'did:jwk:'+json64(publicJwk(key));}
export function issuerDidDocument(key:JsonWebKey){const did=issuerDid(key),id=did+'#0';return {'@context':['https://www.w3.org/ns/did/v1','https://w3id.org/security/suites/jws-2020/v1'],id:did,verificationMethod:[{id,type:'JsonWebKey2020',controller:did,publicKeyJwk:publicJwk(key)}],assertionMethod:[id]};}
const credentialUrn=(id:string)=>'urn:bizproof:credential:'+encode(encoder.encode(id));
const companyUrn=(id:string)=>'urn:bizproof:company:'+encode(encoder.encode(id));
const headerSchema=z.object({alg:z.literal('EdDSA'),typ:z.literal('JWT'),kid:z.string().min(10).max(1000)}).strict();
const timestamp=z.number().int().nonnegative().max(253402300799);
const payloadSchema=z.object({iss:z.string().startsWith('did:jwk:').max(1000),sub:z.string().max(500),jti:z.string().max(500),iat:timestamp,nbf:timestamp,exp:timestamp,vc:z.object({
 '@context':z.array(z.union([z.string(),z.record(z.string())])).length(2),type:z.tuple([z.literal('VerifiableCredential'),z.literal('BizProofBusinessCredential')]),id:z.string(),issuer:z.string(),issuanceDate:z.string(),expirationDate:z.string(),credentialSubject:z.object({id:z.string(),claims:claimsInput}).strict(),
 bizproof:z.object({profile:z.literal(profile),credentialId:z.string().min(1).max(160),companyId:z.string().min(1).max(160),issuerId:z.string().min(1).max(160),schemaId:z.string().min(1).max(160),sourceDigest:z.string().regex(/^[a-f\d]{64}$/),sourceKeyId:z.string().min(1).max(160)}).strict()
}).strict()}).strict();
export async function exportPortableCredential(s:State,c:Credential){
 if(!(await inspectCredential(s,c)).valid)throw new PortableCredentialError('원본 자격의 서명·발급기관·스키마·유효성을 확인하세요.');
 const issuer=s.issuers.find(i=>i.id===c.issuerId)!;const now=Math.floor(Date.now()/1000),exp=Math.min(now+86400,Math.floor(Date.parse(c.expiresAt)/1000));
 if(exp<=now)throw new PortableCredentialError('자격 유효기간이 지났습니다.');
 const did=issuerDid(issuer.publicKey),id=credentialUrn(c.id),sub=companyUrn(c.companyId);
 const payload={iss:did,sub,jti:id,iat:now,nbf:now,exp,vc:{'@context':contexts,type:['VerifiableCredential','BizProofBusinessCredential'],id,issuer:did,issuanceDate:new Date(now*1000).toISOString(),expirationDate:new Date(exp*1000).toISOString(),credentialSubject:{id:sub,claims:c.claims},bizproof:{profile,credentialId:c.id,companyId:c.companyId,issuerId:c.issuerId,schemaId:c.schemaId,sourceDigest:await digest(credentialPayload(c)),sourceKeyId:c.keyId}}};
 payloadSchema.parse(payload);const input=json64({alg:'EdDSA',typ:'JWT',kid:did+'#0'})+'.'+json64(payload);
 if(!issuer.privateKey)throw new PortableCredentialError('별도 발급 자격은 원본 JSON 내보내기를 사용하세요. 웹 서버에서 발급기관 서명을 다시 만들 수 없습니다.');
 const key=await crypto.subtle.importKey('jwk',issuer.privateKey,{name:'Ed25519'},false,['sign']);
 const signature=await crypto.subtle.sign('Ed25519',key,encoder.encode(input));
 return {format:'jwt_vc_json' as const,profile,token:input+'.'+encode(new Uint8Array(signature)),credentialId:c.id,expiresAt:payload.vc.expirationDate,didDocument:issuerDidDocument(issuer.publicKey),notice:portableNotice};
}
export async function verifyPortableCredential(s:State,token:string){
 const checks:{id:string;label:string;pass:boolean}[]=[];const add=(id:string,label:string,pass:boolean)=>{checks.push({id,label,pass});return pass;};
 const report=()=>({valid:checks.length===10&&checks.every(c=>c.pass),format:'jwt_vc_json' as const,profile,checks,checkedAt:new Date().toISOString(),scope:'current-workspace' as const,notice:'이 워크스페이스 발급 기록과 현재 상태를 대조한 결과입니다. 파일 소지자의 신원·담당자 권한이나 구매·지원 조건 충족을 인증하지 않습니다.'});
 let header:z.infer<typeof headerSchema>,payload:z.infer<typeof payloadSchema>,parts:string[],signature:Uint8Array;
 try{if(token.length>30000)throw Error('size');parts=token.split('.');if(parts.length!==3)throw Error('parts');header=headerSchema.parse(JSON.parse(decoder.decode(decode(parts[0]))));payload=payloadSchema.parse(JSON.parse(decoder.decode(decode(parts[1]))));signature=decode(parts[2]);if(signature.length!==64)throw Error('signature');add('format','허용한 VC-JWT 형식·서명 알고리즘',true);}catch{add('format','허용한 VC-JWT 형식·서명 알고리즘',false);return report();}
 const meta=payload.vc.bizproof,issuer=s.issuers.find(i=>i.id===meta.issuerId),c=s.credentials.find(x=>x.id===meta.credentialId);
 // Resolve only keys from this authenticated workspace. An embedded DID never establishes issuer trust.
 const keys=issuer?[issuer.publicKey,...issuer.previousKeys.map(k=>k.publicKey)]:[];
 const key=keys.find(k=>issuerDid(k)===payload.iss);
 add('issuer','등록된 발급기관·공개키 연결',!!key&&!!c&&c.issuerId===issuer?.id);
 let signed=false;if(key){try{const imported=await crypto.subtle.importKey('jwk',key,{name:'Ed25519'},false,['verify']);signed=await crypto.subtle.verify('Ed25519',imported,new Uint8Array(signature),encoder.encode(parts.slice(0,2).join('.')));}catch{/* invalid signature */}}
 add('signature','JWT 전체 서명·키 식별자',signed&&header.kid===payload.iss+'#0');
 const now=Math.floor(Date.now()/1000);
 add('time','교환 파일의 발급·만료 시간',payload.iat===payload.nbf&&payload.nbf<=now&&payload.exp>now&&payload.exp>payload.nbf&&payload.exp-payload.nbf<=86400&&(!c||payload.exp<=Math.floor(Date.parse(c.expiresAt)/1000)));
 add('mapping','VC와 JWT 식별자·시간·문맥 일치',canonical(payload.vc['@context'])===canonical(contexts)&&payload.vc.issuer===payload.iss&&payload.vc.id===payload.jti&&payload.jti===credentialUrn(meta.credentialId)&&payload.sub===companyUrn(meta.companyId)&&payload.vc.credentialSubject.id===payload.sub&&payload.vc.issuanceDate===new Date(payload.nbf*1000).toISOString()&&payload.vc.expirationDate===new Date(payload.exp*1000).toISOString());
 add('source','원본 발급 기록의 내용·스키마 연결',!!c&&meta.companyId===c.companyId&&meta.schemaId===c.schemaId&&meta.sourceKeyId===c.keyId&&meta.sourceDigest===await digest(credentialPayload(c))&&canonical(payload.vc.credentialSubject.claims)===canonical(c.claims));
 const source=c?await inspectCredential(s,c):undefined;
 add('original-signature','원본 자격의 서명 유지',source?.checks.find(x=>x.id==='signature')?.pass===true);
 add('status','현재 원본 취소·만료 상태',source?.checks.find(x=>x.id==='status')?.pass===true);
 add('trust','현재 발급기관 신뢰 상태',issuer?.status==='active');
 add('schema-subject','스키마·보유 기업·원본 시간',!!source&&source.checks.filter(x=>['schema','subject','time'].includes(x.id)).every(x=>x.pass));
 return report();
}
