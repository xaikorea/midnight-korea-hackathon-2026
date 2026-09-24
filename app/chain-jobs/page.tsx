import BizProofLogo from '../bizproof-logo';
import ProofJobsPanel from '../proof-jobs-panel';
import '../issuance.css';
export const metadata={title:'내 자격의 Midnight 처리 | BizProof',robots:{index:false,follow:false}};
export default function ChainJobs(){return <main className="issuance-page"><header className="issuance-header"><a href="/welcome"><BizProofLogo/></a><nav><a href="/issuance">자격 발급</a><a href="/guide#guide-issued-midnight">이용자 가이드</a></nav></header><section className="issuance-intro"><span className="issuance-kicker">ONE CREDENTIAL, VERIFIED ON CHAIN</span><h1>내 신청이 체인에서 처리되는 과정.</h1></section><ProofJobsPanel/></main>;}
