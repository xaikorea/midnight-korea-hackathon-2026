import {z} from 'zod';
import {sourceBodySchema,sourceCanonical} from './web-source.ts';

const hex=z.string().regex(/^[a-f0-9]{64}$/),text=z.string().min(1).max(200),date=z.string().datetime();
export const publicSigningKey=z.object({kty:z.literal('OKP'),crv:z.literal('Ed25519'),x:z.string().min(20)}).strict();
export const originalCredentialSchema=z.object({id:text,proofVersion:z.literal(3),companyId:text,issuerId:text,schemaId:text,
 remoteBinding:z.object({requestId:z.string().uuid(),scope:hex,identitySessionId:z.string().uuid(),identityMode:z.literal('simulated'),documentHash:hex}).strict(),
 claims:z.object({revenue:z.number().int().min(0).max(1e12),foundedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),region:text,certified:z.boolean()}).strict(),
 issuedAt:date,expiresAt:date,keyId:text,status:z.literal('active'),signature:z.string().min(80).max(100),
 source:z.object({kind:z.literal('synthetic'),reference:text,period:text,method:text,reviewer:text,reviewedAt:date,documents:z.array(z.never()).length(0),notice:z.string().max(1000)}).strict()
}).strict();
export const originalPolicySchema=z.object({id:text,name:text,audience:text,kind:z.enum(['buyer','grant']),version:z.number().int().positive(),minRevenue:z.number().int().min(0).max(1e12).nullable(),maxRevenue:z.number().int().min(0).max(1e12).nullable(),maxAgeMonths:z.number().int().min(0).max(1200).nullable(),region:text.nullable(),requireCertification:z.boolean(),issuerIds:z.array(text).min(1).max(20),createdAt:date,status:z.literal('active')}).strict();
export const originalRequestSchema=z.object({id:text,companyId:text,policyId:text,policyHash:hex,policy:originalPolicySchema,nonce:text,expiresAt:date,createdAt:date}).strict();
export const issuedSourceBodySchema=z.object({context:z.literal('bizproof:midnight:issued-source:v2'),jobId:z.string().uuid(),keyId:text,scope:hex,referenceTime:z.number().int().positive(),consentExpiresAt:z.number().int().positive(),original:originalCredentialSchema,originalRequests:z.array(originalRequestSchema).length(2),binding:sourceBodySchema}).strict();
export const issuedSourceSchema=z.object({body:issuedSourceBodySchema,signature:z.string().min(80).max(100)}).strict();
export type IssuedSource=z.infer<typeof issuedSourceSchema>;
export type OriginalRequest=z.infer<typeof originalRequestSchema>;
export const sourceHash=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sourceCanonical(value)))),x=>x.toString(16).padStart(2,'0')).join('');
export function originalPayload(c:z.infer<typeof originalCredentialSchema>){return {context:'bizproof:credential:issuance:v3',proofVersion:3,remoteBinding:c.remoteBinding,body:{id:c.id,companyId:c.companyId,issuerId:c.issuerId,schemaId:c.schemaId,claims:c.claims,source:c.source,issuedAt:c.issuedAt,expiresAt:c.expiresAt,keyId:c.keyId}};}
export async function verifySigned(key:JsonWebKey,body:unknown,signature:string){
 const pin=publicSigningKey.parse(key),imported=await crypto.subtle.importKey('jwk',pin,{name:'Ed25519'},false,['verify']);
 if(!await crypto.subtle.verify('Ed25519',imported,Uint8Array.from(atob(signature),v=>v.charCodeAt(0)),new TextEncoder().encode(sourceCanonical(body))))throw Error('Pinned signing key / signature mismatch');
}
// Same calendar-month boundary as the web policy; rejects non-monotone month-end rules.
export function issuedFoundingCutoff(months:number|null,at:number){
 if(months===null)return 0;const accepted=(day:number)=>{const date=new Date(day*864e5);date.setUTCMonth(date.getUTCMonth()+months);return at*1000<=date.getTime();};
 let lo=0,hi=Math.floor(at/86400)+1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(accepted(mid))hi=mid;else lo=mid+1;}
 for(let day=Math.max(0,lo-35);day<=lo+35;day++)if(accepted(day)!==(day>=lo))throw Error('Unsupported non-monotone calendar policy');return lo;
}
export async function deriveIssuedBinding(original:unknown,rawRequests:unknown,referenceTime:number,target:{contractAddress:string;holder:string},now:number,consentExpiresAt:number){
 const c=originalCredentialSchema.parse(original),requests=z.array(originalRequestSchema).length(2).parse(rawRequests);
 const regions=[...new Set([c.claims.region,...requests.flatMap(r=>r.policy.region?[r.policy.region]:[])])].sort();
 const converted=await Promise.all(requests.map(async r=>({id:r.id,kind:r.policy.kind,requestId:await sourceHash({context:'bizproof:midnight:request:v1',id:r.id,policyHash:r.policyHash}),audience:await sourceHash(r.policy.audience),nonce:await sourceHash(r.nonce),policyHash:r.policyHash,deadline:Math.min(consentExpiresAt,Math.floor(Date.parse(r.expiresAt)/1000)),policy:{minRevenue:r.policy.minRevenue??0,maxRevenue:r.policy.maxRevenue??1e12,minFoundedDay:issuedFoundingCutoff(r.policy.maxAgeMonths,referenceTime),region:r.policy.region?regions.indexOf(r.policy.region)+1:0,requireCertification:r.policy.requireCertification}})));
 return sourceBodySchema.parse({format:'bizproof-midnight-source-v1',network:'undeployed',...target,source:{credentialId:c.id,companyId:c.companyId,issuerId:c.issuerId,keyId:c.keyId,digest:await sourceHash(originalPayload(c))},issuedAt:now,expiresAt:Math.min(now+600,consentExpiresAt,Math.floor(Date.parse(c.expiresAt)/1000),...converted.map(r=>r.deadline)),claims:{revenue:c.claims.revenue,foundedDay:Math.floor(Date.parse(c.claims.foundedOn)/864e5),region:regions.indexOf(c.claims.region)+1,certified:c.claims.certified,expiresAt:Math.floor(Date.parse(c.expiresAt)/1000)},requests:converted});
}
export async function verifyIssuedSource(raw:unknown,pins:{platform:{keyId:string;publicKey:JsonWebKey};issuer:{issuerId:string;keyId:string;publicKey:JsonWebKey}},expected:{jobId:string;scope:string;contractAddress:string;holder:string},now=Math.floor(Date.now()/1000)){
 const e=issuedSourceSchema.parse(raw),b=e.body,c=b.original,x=b.binding;
 if(b.jobId!==expected.jobId||b.scope!==expected.scope||c.remoteBinding.scope!==expected.scope||b.keyId!==pins.platform.keyId||c.issuerId!==pins.issuer.issuerId||c.keyId!==pins.issuer.keyId)throw Error('Job / tenant / issuer binding mismatch');
 await verifySigned(pins.platform.publicKey,b,e.signature);await verifySigned(pins.issuer.publicKey,originalPayload(c),c.signature);
 if(b.referenceTime>now||b.consentExpiresAt<=now||b.consentExpiresAt-b.referenceTime>5400||x.issuedAt>now||x.issuedAt<now-600||x.expiresAt<=now||x.expiresAt-x.issuedAt>600||Date.parse(c.issuedAt)>now*1000+5000||Date.parse(c.expiresAt)<=now*1000||c.claims.foundedOn!==new Date(Date.parse(c.claims.foundedOn)).toISOString().slice(0,10)||Date.parse(c.claims.foundedOn)>now*1000)throw Error('Expired or invalid approval / source');
 if(new Set(b.originalRequests.map(r=>r.id)).size!==2||new Set(b.originalRequests.map(r=>r.policy.kind)).size!==2||new Set(b.originalRequests.map(r=>r.nonce)).size!==2)throw Error('Distinct original requests required');
 for(const r of b.originalRequests)if(r.companyId!==c.companyId||r.policyId!==r.policy.id||!r.policy.issuerIds.includes(c.issuerId)||await sourceHash(r.policy)!==r.policyHash||r.policy.minRevenue!==null&&r.policy.maxRevenue!==null&&r.policy.minRevenue>r.policy.maxRevenue)throw Error('Original policy / company mismatch');
 const derived=await deriveIssuedBinding(c,b.originalRequests,b.referenceTime,{contractAddress:expected.contractAddress,holder:expected.holder},x.issuedAt,b.consentExpiresAt);
 // Never trust converted claims or Compact policies merely because the web signed them.
 if(await sourceHash(derived)!==await sourceHash(x))throw Error('Converted claims / policy / target differs from issuer original');
 return b;
}
