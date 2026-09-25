import type {publicProofJob} from './proof-jobs';

type Job=ReturnType<typeof publicProofJob>;
export type ProgressStep={label:string;state:'done'|'current'|'waiting'|'stopped'};

/** Only server evidence advances a step. Historical proof success cannot imply current validity. */
export function proofJobProgress(job?:Job):ProgressStep[]{
 const labels=['신청 접수','관리자 승인','증명·거래 처리','거래 대조','검증 결과'];
 if(!job)return labels.map((label,i)=>({label,state:i===0?'done':'waiting'}));
 const stopped=['blocked','cancelled','needs_attention'].includes(job.status)||job.revocation!=='none'||job.currentStatus==='unknown';
 const verified=job.status==='confirmed'&&!!job.verification&&!job.verification.revoked;
 const submitted=job.status==='awaiting_verification'||verified;
 const completed=[true,!!job.approvedAt,submitted,verified,verified];
 const active=!job.approvedAt?1:submitted?3:2;
 return labels.map((label,i)=>({label,state:stopped&&i>=active?'stopped':completed[i]?'done':i===active?'current':'waiting'}));
}

export function matchesApplication(job:Pick<Job,'credentialId'|'requests'>,credentialId?:string,requestIds?:string[]){
 return (!credentialId||job.credentialId===credentialId)&&(!requestIds||job.requests.every(r=>requestIds.includes(r.id)));
}
