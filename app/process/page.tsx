/* eslint-disable @next/next/no-html-link-for-pages */
import BizProofLogo from '../bizproof-logo';
import ProcessConsole from '../process-console';
export const metadata={title:'BizProof | 처리 과정 관제'};
export default function ProcessPage(){return <main className="process-page"><header><a href="/?view=apply"><BizProofLogo/></a><a href="/?view=apply">신청 화면으로 →</a></header><div className="process-page-heading"><span>PROCESS OBSERVATORY</span><h1>처리 과정 관제</h1><p>신청 화면을 옆에 두고 서버의 실제 실행 기록을 확인하세요. 같은 체험 공간의 기록을 3초 간격으로 조회합니다.</p></div><ProcessConsole/></main>;}
