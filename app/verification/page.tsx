import Link from 'next/link';
import BizProofLogo from '../bizproof-logo';
import VerificationEvidence from '../verification-evidence';
import '../verification-evidence.css';
export const metadata={title:'BizProof | Midnight 검증 증거',description:'동일 기업 자격의 두 기관 조건 검증, 실제 Local Devnet 거래와 정보 공개 범위를 확인합니다.'};
export default function VerificationPage(){return <main className="evidence-page"><header><Link href="/welcome"><BizProofLogo/></Link><nav><Link href="/guide">이용자 가이드</Link><Link href="/?view=apply">직접 체험하기 →</Link></nav></header><VerificationEvidence/></main>;}
