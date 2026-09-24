import Link from 'next/link';
import {ShieldCheck} from 'lucide-react';
import './verification-evidence.css';
export default function VerificationLink(){return <aside className="evidence-link"><ShieldCheck size={18}/><Link href="/verification">Midnight 실제 검증 증거 보기 →</Link><span>별도 가상 자격의 Local Devnet 실행 사례 · 현재 신청 결과와 구분</span></aside>;}
