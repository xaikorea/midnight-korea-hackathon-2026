/* eslint-disable @next/next/no-html-link-for-pages -- Full navigation synchronizes the custom workspace location store. */
import BizProofLogo from '../bizproof-logo';
import UserGuide from '../user-guide';
export const metadata={title:'이용자 가이드 | BizProof',description:'기업 등록부터 자격 발급, 제출, 검증과 관리자 기능까지 단계별 이용 안내'};
export default function GuidePage(){return <main className="guide-public" id="guide-top"><header><a href="/"><BizProofLogo/><span> · 시작 화면으로</span></a><h1>이용자 가이드</h1><p>로그인 없이 읽고, 필요한 기능으로 바로 이동하세요.</p></header><UserGuide/></main>;}
