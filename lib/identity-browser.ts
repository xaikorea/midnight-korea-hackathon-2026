// Browser outcomes are navigation hints. Only the authenticated server verifies identity.
export type IdentityLaunch={identityVerificationId:string;storeId:string;channelKey:string;customData:string};
export type IdentitySummary={id:string;status:'pending'|'verified'|'failed'|'cancelled'|'consumed'|'expired';expiresAt:number;documentHash:string;mode?:'provider-test'|'live';documentSigned:false};
export type IdentitySdk={requestIdentityVerification:(input:IdentityLaunch&{redirectUrl:string})=>Promise<{identityVerificationId?:string;code?:string}|undefined>};
export function redirectSession(url:string,saved:IdentitySummary|null){
 const value=new URL(url),transaction=value.searchParams.get('identityVerificationId');
 if(!transaction)return null;
 if(!saved||transaction!=='bizproof-'+saved.id||saved.expiresAt<=Date.now())throw Error('현재 신청과 일치하는 인증 요청을 찾을 수 없습니다.');
 return saved.id;
}
export async function launchIdentity(sdk:IdentitySdk,session:IdentitySummary,launch:IdentityLaunch,origin:string,check:(id:string)=>Promise<IdentitySummary>){
 if(session.expiresAt<=Date.now()||launch.identityVerificationId!=='bizproof-'+session.id)throw Error('인증 요청이 만료되었거나 신청 연결이 다릅니다.');
 const base=new URL(origin);if(base.origin!==origin||base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('허용된 인증 복귀 주소가 아닙니다.');
 const result=await sdk.requestIdentityVerification({...launch,redirectUrl:origin+'/identity-pilot'});
 if(result?.identityVerificationId&&result.identityVerificationId!==launch.identityVerificationId)throw Error('인증 거래가 현재 신청과 다릅니다.');
 // Even an SDK success or error must be reconciled against the server's own transaction.
 return check(session.id);
}
