import {serviceAdmin} from '@/lib/service-admin';
import {redirect} from 'next/navigation';
import ProofJobsPanel from '@/app/proof-jobs-panel';
import '../../issuance.css';
export const dynamic='force-dynamic';
export const metadata={title:'Midnight 실행 관리 | BizProof',robots:{index:false,follow:false}};
export default async function AdminProofJobs(){if(!await serviceAdmin())redirect('/admin/login');return <main className="issuance-page"><header className="issuance-header"><h1>Midnight 실행 관리</h1><nav><a href="/admin">관리자 홈</a><a href="/chain-jobs">내 체험 화면</a></nav></header><ProofJobsPanel administrator/></main>;}
