import type {VerificationRequest,Presentation} from './domain';
export type ApplicationStatus='pending'|'submitted'|'verified'|'rejected'|'cancelled'|'expired'|'unknown';
export function applicationStatus(r:Pick<VerificationRequest,'status'|'expiresAt'>,p:Pick<Presentation,'expiresAt'>|undefined,now=Date.now()):ApplicationStatus{
 if(['verified','rejected','cancelled','expired'].includes(r.status))return r.status as ApplicationStatus;
 if(!['pending','submitted'].includes(r.status))return 'unknown';
 const deadline=Date.parse(r.expiresAt);if(!Number.isFinite(deadline))return 'unknown';
 if(deadline<=now)return 'expired';
 if(r.status==='pending')return 'pending';
 const expiry=p&&Date.parse(p.expiresAt);if(expiry===undefined||!Number.isFinite(expiry))return 'unknown';
 return expiry<=now?'expired':'submitted';
}
export function applicationStatusCopy(status:string){
 switch(status){
 case 'verified':return {title:'조건 검증을 완료했습니다',message:'조건 검증을 완료했습니다. 최종 선정·계약 승인은 해당 기관에서 결정합니다.',tone:'success'};
 case 'submitted':return {title:'기관 확인을 기다리고 있습니다',message:'제출했습니다. 기관 확인을 기다려 주세요.',tone:'pending'};
 case 'pending':return {title:'제출 준비 중입니다',message:'공유 내용을 확인하고 동의한 뒤 제출하세요.',tone:'pending'};
 case 'rejected':return {title:'충족하지 못한 조건이 있습니다',message:'충족하지 못한 조건이 있습니다. 진행 현황에서 항목을 확인하고 자료나 신청 대상을 검토하세요.',tone:'warning'};
 case 'cancelled':return {title:'취소된 신청입니다',message:'이 신청은 취소되었습니다. 필요한 경우 공유 내용을 다시 확인하고 새로 신청하세요.',tone:'warning'};
 case 'expired':return {title:'제출 유효기간이 만료되었습니다',message:'기관 확인 전에 제출 유효기간이 만료되었습니다. 현재 자격과 공유 내용을 다시 확인하고 동의해 재제출하세요.',tone:'warning'};
 default:return {title:'신청 상태를 확인해 주세요',message:'현재 결과를 확인할 수 없습니다. 진행 현황을 새로 확인하세요.',tone:'warning'};
 }
}
