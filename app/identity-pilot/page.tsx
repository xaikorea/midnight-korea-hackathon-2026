import {getChatGPTUser} from '../chatgpt-auth';
import {requireIdentityPilot} from '@/lib/identity-sessions';
import {identityCapabilities} from '@/lib/identity-provider';
import {readState} from '@/lib/store';
import {digest} from '@/lib/signatures';
import IdentityPilot from './pilot';
import '../issuance.css';
export const dynamic='force-dynamic';
export const metadata={title:'인증 공급자 연결 시험 | BizProof',robots:{index:false,follow:false}};
export default async function Page(){
 const user=await getChatGPTUser();let allowed=false;
 if(user){try{requireIdentityPilot(user.userId,user.authMode);allowed=identityCapabilities().personIdentity.configured;}catch{}}
 if(!allowed||!user)return <main className="issuance-page"><section className="issuance-intro"><h1>인증 공급자 연결 준비 중</h1><p>계약된 공급자의 설정과 승인된 파일럿 계정이 준비되면 이 화면에서 본인확인을 진행할 수 있습니다.</p><p>현재 공개 시연은 합성 인증을 사용합니다. 휴대폰 본인확인·문서 전자서명·기업 대표권 확인은 각각 별도로 검증해야 합니다.</p><a href="/issuance">자격 발급 체험으로 돌아가기</a></section></main>;
 const {state}=await readState(user.storageOwner);
 const companies=await Promise.all(state.companies.map(async c=>({id:c.id,name:c.name,documentHash:await digest({context:'bizproof:identity-provider-acceptance:v1',companyId:c.id,purpose:'인증 공급자 연결 인수시험'})})));
 return <IdentityPilot companies={companies}/>;
}
