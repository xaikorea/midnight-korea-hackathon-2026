import {z} from 'zod';
const hex=z.string().regex(/^[a-f0-9]{64}$/),text=z.string().min(1).max(160),uint=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const sourceBodySchema=z.object({format:z.literal('bizproof-midnight-source-v1'),network:z.enum(['undeployed','preprod']),contractAddress:hex,holder:hex,
 source:z.object({credentialId:text,companyId:text,issuerId:text,keyId:text,digest:hex}).strict(),issuedAt:uint,expiresAt:uint,
 claims:z.object({revenue:uint.max(1e12),foundedDay:uint,region:uint.min(1).max(65535),certified:z.boolean(),expiresAt:uint}).strict(),
 requests:z.array(z.object({id:text,kind:z.enum(['buyer','grant']),requestId:hex,audience:hex,nonce:hex,policyHash:hex,authorityId:text.optional(),
 deadline:uint,policy:z.object({minRevenue:uint.max(1e12),maxRevenue:uint.max(1e12),minFoundedDay:uint,region:uint.max(65535),requireCertification:z.boolean()}).strict()}).strict()).min(1).max(2)
}).strict();
export const sourceEnvelopeSchema=z.object({body:sourceBodySchema,signature:z.string().max(200)}).strict();
export type WebSource=z.infer<typeof sourceEnvelopeSchema>;
export function sourceCanonical(value:unknown):string{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(sourceCanonical).join(',')+']';const obj=value as Record<string,unknown>;return '{'+Object.keys(obj).sort().filter(k=>obj[k]!==undefined).map(k=>JSON.stringify(k)+':'+sourceCanonical(obj[k])).join(',')+'}';}
export async function verifyWebSource(input:unknown,pinnedKey:JsonWebKey,expected:{network:string;contractAddress:string;holder:string},now=Math.floor(Date.now()/1000)){
 const envelope=sourceEnvelopeSchema.parse(input),b=envelope.body;
 if(b.network!==expected.network||b.contractAddress!==expected.contractAddress||b.holder!==expected.holder||b.issuedAt>now||b.expiresAt<=now||b.expiresAt<=b.issuedAt||b.expiresAt-b.issuedAt>600||b.claims.expiresAt<b.expiresAt||b.claims.foundedDay>Math.floor(now/86400)||new Set(b.requests.map(r=>r.id)).size!==b.requests.length||new Set(b.requests.map(r=>r.kind)).size!==b.requests.length||new Set(b.requests.map(r=>r.requestId)).size!==b.requests.length||b.requests.some(r=>r.deadline<b.expiresAt||r.policy.minRevenue>r.policy.maxRevenue))throw Error('웹 자격 연결의 대상·기간·요청을 확인하세요.');
 if(pinnedKey.kty!=='OKP'||pinnedKey.crv!=='Ed25519'||pinnedKey.d)throw Error('독립적으로 신뢰한 발급자 공개키가 필요합니다.');
 const key=await crypto.subtle.importKey('jwk',pinnedKey,{name:'Ed25519'},false,['verify']);
 if(!await crypto.subtle.verify('Ed25519',key,Uint8Array.from(atob(envelope.signature),x=>x.charCodeAt(0)),new TextEncoder().encode(sourceCanonical(b))))throw Error('웹 발급자 서명이 일치하지 않습니다.');
 return b;
}
