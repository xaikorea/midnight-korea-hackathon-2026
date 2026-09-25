import {automaticDemoOwner} from './demo-automation';
import {issuerCall,issuerScope,importRemoteCredential,RemoteIssuerError} from './remote-issuer';
import {readState,saveState,ConflictError} from './store';
import {digest} from './signatures';

/** Only the fixed, scoped synthetic issuer is available through issuerCall. */
export async function finishDemoIssuance(owner:string,scope:string,request:{id:string;revision:number;status:string}){
 if(!automaticDemoOwner(owner)||await issuerScope(owner,owner)!==scope)throw new RemoteIssuerError(403,'자동 발급은 내 공개 합성 체험에서만 이용할 수 있습니다.');
 let issued=request;
 if(issued.status==='submitted'){
  const hash=await digest({context:'automatic-synthetic-issuance:1',scope,id:request.id,revision:request.revision});
  const key=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
  issued=await issuerCall(scope,'POST',`/v1/issuance-requests/${request.id}/decisions`,{key,revision:request.revision,decision:'approve',reason:'공개 합성 고정 자료 자동 모의 검토 · 실제 기관 심사 아님'});
 }
 if(issued.status!=='issued')throw new RemoteIssuerError(409,'보완·반려·철회된 신청은 자동 승인하지 않습니다.');
 for(let attempt=0;attempt<4;attempt++){
  const {state,version}=await readState(owner),receipt=await importRemoteCredential(state,scope,issued.id);
  try{await saveState(owner,state,version);return {...issued,receipt,automatic:true};}
  catch(e){if(!(e instanceof ConflictError)||attempt===3)throw e;}
 }
 throw new RemoteIssuerError(409,'기관 발급은 보존되었습니다. 지갑 수신을 다시 시도하세요.');
}
