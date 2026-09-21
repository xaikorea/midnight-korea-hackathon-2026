import {sourceBodySchema,verifyWebSource,type WebSource} from '../contracts/sdk/web-source';
import {credentialPayload,type State,type Credential} from './domain';
import {digest,sign} from './signatures';
import {inspectCredential} from './credential-family';
import {foundingCutoff} from './compact-policy';
import {checkAuthority} from './authority';
import {requireReviewedCredential,requireAuthorityActor} from './business-assurance';
import {z} from 'zod';
export const midnightSourceInput=z.object({network:z.enum(['undeployed','preprod']),contractAddress:z.string().regex(/^[a-f0-9]{64}$/),holder:z.string().regex(/^[a-f0-9]{64}$/),requests:z.array(z.object({id:z.string(),authorityId:z.string().optional()}).strict()).min(1).max(2)}).strict();
export async function exportMidnightSource(s:State,c:Credential,raw:unknown,actor:string,strict:boolean){
 const input=midnightSourceInput.parse(raw);if(!(await inspectCredential(s,c)).valid)throw Error('유효한 원본 자격이 필요합니다.');if(strict)requireReviewedCredential(s,c);
 const now=Math.floor(Date.now()/1000),requests=input.requests.map(x=>{const r=s.requests.find(r=>r.id===x.id);if(!r||r.companyId!==c.companyId||r.status!=='pending'||!r.policy.issuerIds.includes(c.issuerId))throw Error('동일 기업의 대기 중인 요청이 필요합니다.');return {r,authorityId:x.authorityId};});
 const expiresAt=Math.min(now+600,Math.floor(Date.parse(c.expiresAt)/1000),...requests.map(({r})=>Math.floor(Date.parse(r.expiresAt)/1000)));
 const regions=[...new Set([c.claims.region,...requests.flatMap(({r})=>r.policy.region?[r.policy.region]:[])])].sort();
 const converted=[];for(const {r,authorityId} of requests){if(await digest(r.policy)!==r.policyHash)throw Error('정책 스냅샷 불일치');if(strict||authorityId){const a=s.authorities?.find(a=>a.id===authorityId);requireAuthorityActor(a,actor);if(!a||a.credentialId!==c.id||!(await checkAuthority(s,a,c.companyId,r.policy.kind)).valid)throw Error('유효한 본인 담당자 권한이 필요합니다.');}
 converted.push({id:r.id,kind:r.policy.kind,requestId:await digest({context:'bizproof:midnight:request:v1',id:r.id,policyHash:r.policyHash}),audience:await digest(r.policy.audience),nonce:await digest(r.nonce),policyHash:r.policyHash,...(authorityId?{authorityId}:{}),deadline:Math.floor(Date.parse(r.expiresAt)/1000),policy:{minRevenue:r.policy.minRevenue??0,maxRevenue:r.policy.maxRevenue??1e12,minFoundedDay:foundingCutoff(r.policy,new Date(now*1000)),region:r.policy.region?regions.indexOf(r.policy.region)+1:0,requireCertification:r.policy.requireCertification}});}
 const issuer=s.issuers.find(i=>i.id===c.issuerId)!;
 const body=sourceBodySchema.parse({format:'bizproof-midnight-source-v1',...input,requests:converted,source:{credentialId:c.id,companyId:c.companyId,issuerId:c.issuerId,keyId:issuer.keyId,digest:await digest(credentialPayload(c))},issuedAt:now,expiresAt,claims:{revenue:c.claims.revenue,foundedDay:Math.floor(Date.parse(c.claims.foundedOn)/864e5),region:regions.indexOf(c.claims.region)+1,certified:c.claims.certified,expiresAt:Math.floor(Date.parse(c.expiresAt)/1000)}});
 const result={body,signature:await sign(issuer.privateKey,body)};await verifyWebSource(result,issuer.publicKey,input,now);return result;
}
export async function checkMidnightSource(s:State,envelope:WebSource,actor:string,strict:boolean){
 const b=envelope.body,c=s.credentials.find(c=>c.id===b.source.credentialId),issuer=s.issuers.find(i=>i.id===b.source.issuerId);if(!c||!issuer||issuer.status!=='active'||issuer.keyId!==b.source.keyId||c.issuerId!==issuer.id)throw Error('현재 발급기관·자격 연결 실패');
 await verifyWebSource(envelope,issuer.publicKey,b);if(!(await inspectCredential(s,c)).valid||await digest(credentialPayload(c))!==b.source.digest)throw Error('원본 자격 변경·취소·만료');if(strict)requireReviewedCredential(s,c);
 for(const x of b.requests){const r=s.requests.find(r=>r.id===x.id);if(!r||r.companyId!==c.companyId||r.status!=='pending'||r.policyHash!==x.policyHash||await digest(r.policy)!==x.policyHash||Date.parse(r.expiresAt)<=Date.now())throw Error('요청 변경·취소·만료');if(strict||x.authorityId){const a=s.authorities?.find(a=>a.id===x.authorityId);requireAuthorityActor(a,actor);if(!a||a.credentialId!==c.id||!(await checkAuthority(s,a,c.companyId,r.policy.kind)).valid)throw Error('담당자 권한 취소·불일치');}}
 return {current:true as const,sourceDigest:b.source.digest,checkedAt:new Date().toISOString()};
}
