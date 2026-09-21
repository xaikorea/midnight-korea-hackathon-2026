import {verifyWebSource,type WebSource} from './web-source.ts';
import {bytes32} from './config.ts';
import type {BizProofClient} from './client.ts';
import type {IssuerVault} from './issuer.ts';
// Caller provides connected clients and a separately trusted issuer key. No synthetic claims.
// Freshness callback must call authenticated check-midnight-source; local file possession is insufficient.
export async function runWebCredentialReuse(options:{envelope:WebSource;pinnedIssuerKey:JsonWebKey;network:string;contractAddress:string;holderCommitment:string;issuerId:bigint;issuer:IssuerVault;administrator:BizProofClient;holder:BizProofClient;onReceipt:(event:{stage:'create'|'submit';webRequestId:string;receipt:Awaited<ReturnType<BizProofClient['submit']>>})=>Promise<void>;assertCurrent:(source:WebSource)=>Promise<{current:true;sourceDigest:string}>}){
 if(options.administrator.network!==options.network||options.holder.network!==options.network)throw Error('클라이언트 네트워크 불일치');
 const verify=()=>verifyWebSource(options.envelope,options.pinnedIssuerKey,{network:options.network,contractAddress:options.contractAddress,holder:options.holderCommitment});
 const fresh=async()=>{const body=await verify();const result=await options.assertCurrent(options.envelope);if(result.current!==true||result.sourceDigest!==body.source.digest)throw Error('웹 원본의 현재 상태 확인 실패');return body;};
 const b=await fresh();
 const enrollment=await options.holder.enrollHolder(options.contractAddress);if(enrollment.network!==options.network||enrollment.holder!==b.holder)throw Error('보유 지갑 연결 불일치');
 const attestation=await options.issuer.issue(options.issuerId,{credentialId:bytes32(b.source.digest),revenue:BigInt(b.claims.revenue),foundedDay:BigInt(b.claims.foundedDay),region:BigInt(b.claims.region),certified:b.claims.certified,expiresAt:BigInt(b.expiresAt)},bytes32(b.holder));
 await options.holder.storeAttestation(attestation.claims,attestation.signature);
 const receipts=[];
 for(const r of b.requests){await fresh();await options.administrator.join(options.contractAddress);await options.administrator.advanceTime();const created=await options.administrator.createRequest(bytes32(r.requestId),{holder:bytes32(b.holder),audience:bytes32(r.audience),nonce:bytes32(r.nonce),deadline:BigInt(Math.min(r.deadline,b.expiresAt)),policy:{issuerId:options.issuerId,minRevenue:BigInt(r.policy.minRevenue),maxRevenue:BigInt(r.policy.maxRevenue),minFoundedDay:BigInt(r.policy.minFoundedDay),region:BigInt(r.policy.region),requireCertification:r.policy.requireCertification}});
  await options.onReceipt({stage:'create',webRequestId:r.id,receipt:created});await fresh();const receipt=await options.holder.submit(bytes32(r.requestId));await options.onReceipt({stage:'submit',webRequestId:r.id,receipt});receipts.push({webRequestId:r.id,policyHash:r.policyHash,receipt});
 }
 return {sourceCredentialId:b.source.credentialId,sourceDigest:b.source.digest,receipts,notice:'서명된 웹 원본에서 재증명한 결과입니다. 웹 업무를 자동 승인하지 않으며 체인 영수증 검증과 원본 취소 동기화는 별도입니다.'};
}
